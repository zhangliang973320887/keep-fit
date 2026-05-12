// Keep Fit backend — net/http + Chi + SQLite.
//
// Single-binary HTTP server: auth (register/login/logout/me) + per-user CRUD
// for workouts / history / settings + a one-shot migration endpoint for
// importing the user's pre-existing localStorage data.
//
// Run:
//   PORT=8080 DB_PATH=./data/keep-fit.db JWT_SECRET=<random> ./keep-fit-api
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	store, err := openDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer store.Close()

	if err := migrate(store); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	auth := &authService{secret: []byte(cfg.JWTSecret), ttl: cfg.JWTTTL}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// Health
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})

	// Public auth routes
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/register", handleRegister(store, auth, cfg))
		r.Post("/login", handleLogin(store, auth, cfg))
		r.Post("/logout", handleLogout(cfg))
	})

	// Protected routes — require valid JWT cookie
	r.Group(func(r chi.Router) {
		r.Use(auth.middleware)
		r.Get("/api/auth/me", handleMe(store))
		r.Delete("/api/auth/account", handleDeleteAccount(store, cfg))

		r.Get("/api/workouts", handleListWorkouts(store))
		r.Post("/api/workouts", handleUpsertWorkout(store))
		r.Put("/api/workouts/{clientID}", handleUpsertWorkout(store))
		r.Delete("/api/workouts/{clientID}", handleDeleteWorkout(store))

		r.Get("/api/history", handleListHistory(store))
		r.Post("/api/history", handleAppendHistory(store))
		r.Delete("/api/history", handleClearHistory(store))

		r.Get("/api/settings", handleGetSettings(store))
		r.Put("/api/settings", handlePutSettings(store))

		r.Post("/api/migrate", handleMigrate(store))
	})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Graceful shutdown
	idleClosed := make(chan struct{})
	go func() {
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
		<-sigint

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("shutdown: %v", err)
		}
		close(idleClosed)
	}()

	log.Printf("Keep Fit API listening on :%s, db=%s", cfg.Port, cfg.DBPath)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("listen: %v", err)
	}
	<-idleClosed
}
