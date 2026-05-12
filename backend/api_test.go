package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

// newTestServer spins up an in-memory-ish test backend pointing at a fresh
// SQLite file under t.TempDir().
func newTestServer(t *testing.T) (*httptest.Server, *http.Client) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")

	cfg := &config{
		Port:           "0",
		DBPath:         dbPath,
		JWTSecret:      "test-secret-thats-long-enough-pls-32-chars",
		JWTTTL:         time.Hour,
		CookieSecure:   false, // httptest is plain HTTP
		CookieSameSite: "lax",
	}
	if err := os.Setenv("JWT_SECRET", cfg.JWTSecret); err != nil {
		t.Fatal(err)
	}

	store, err := openDB(cfg.DBPath)
	if err != nil {
		t.Fatalf("openDB: %v", err)
	}
	t.Cleanup(func() { store.Close() })
	if err := migrate(store); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	auth := &authService{secret: []byte(cfg.JWTSecret), ttl: cfg.JWTTTL}

	r := chi.NewRouter()
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/register", handleRegister(store, auth, cfg))
		r.Post("/login", handleLogin(store, auth, cfg))
		r.Post("/logout", handleLogout(cfg))
	})
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

	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)

	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar, Timeout: 5 * time.Second}
	return srv, client
}

// --- helpers ---

func do(t *testing.T, c *http.Client, method, url string, body any) *http.Response {
	t.Helper()
	var rdr io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		rdr = bytes.NewReader(buf)
	}
	req, err := http.NewRequest(method, url, rdr)
	if err != nil {
		t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func mustJSON[T any](t *testing.T, resp *http.Response) T {
	t.Helper()
	defer resp.Body.Close()
	var out T
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return out
}

func mustStatus(t *testing.T, resp *http.Response, want int) {
	t.Helper()
	if resp.StatusCode != want {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("status %d, want %d. body: %s", resp.StatusCode, want, string(body))
	}
}

// --- tests ---

func TestHealth(t *testing.T) {
	srv, c := newTestServer(t)
	resp := do(t, c, "GET", srv.URL+"/api/health", nil)
	mustStatus(t, resp, http.StatusOK)
	got := mustJSON[map[string]bool](t, resp)
	if !got["ok"] {
		t.Fatal("expected ok=true")
	}
}

func TestAuthFlow(t *testing.T) {
	srv, c := newTestServer(t)

	// /me without cookie → 401
	resp := do(t, c, "GET", srv.URL+"/api/auth/me", nil)
	mustStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()

	// register
	resp = do(t, c, "POST", srv.URL+"/api/auth/register", map[string]any{
		"email": "alice@example.com", "password": "alicepw",
	})
	mustStatus(t, resp, http.StatusCreated)
	auth := mustJSON[authResponse](t, resp)
	if auth.Email != "alice@example.com" {
		t.Fatalf("registered email: %q", auth.Email)
	}

	// /me works now (cookie persisted via jar)
	resp = do(t, c, "GET", srv.URL+"/api/auth/me", nil)
	mustStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// register same email → 409
	resp = do(t, c, "POST", srv.URL+"/api/auth/register", map[string]any{
		"email": "alice@example.com", "password": "another",
	})
	mustStatus(t, resp, http.StatusConflict)
	resp.Body.Close()

	// register weak password → 400
	resp = do(t, c, "POST", srv.URL+"/api/auth/register", map[string]any{
		"email": "bob@example.com", "password": "123",
	})
	mustStatus(t, resp, http.StatusBadRequest)
	resp.Body.Close()

	// invalid email → 400
	resp = do(t, c, "POST", srv.URL+"/api/auth/register", map[string]any{
		"email": "not-an-email", "password": "secretpw",
	})
	mustStatus(t, resp, http.StatusBadRequest)
	resp.Body.Close()

	// logout
	resp = do(t, c, "POST", srv.URL+"/api/auth/logout", nil)
	mustStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// /me after logout → 401
	resp = do(t, c, "GET", srv.URL+"/api/auth/me", nil)
	mustStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()

	// wrong password → 401
	resp = do(t, c, "POST", srv.URL+"/api/auth/login", map[string]any{
		"email": "alice@example.com", "password": "wrongpw",
	})
	mustStatus(t, resp, http.StatusUnauthorized)
	resp.Body.Close()

	// right password → 200
	resp = do(t, c, "POST", srv.URL+"/api/auth/login", map[string]any{
		"email": "alice@example.com", "password": "alicepw",
	})
	mustStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	resp = do(t, c, "GET", srv.URL+"/api/auth/me", nil)
	mustStatus(t, resp, http.StatusOK)
	resp.Body.Close()
}

func TestWorkoutsCRUD(t *testing.T) {
	srv, c := newTestServer(t)
	registerAndLogin(t, c, srv, "wk@test.com", "secretpw")

	// list empty
	resp := do(t, c, "GET", srv.URL+"/api/workouts", nil)
	mustStatus(t, resp, http.StatusOK)
	list := mustJSON[[]workoutDTO](t, resp)
	if len(list) != 0 {
		t.Fatalf("expected 0 workouts, got %d", len(list))
	}

	// create
	resp = do(t, c, "POST", srv.URL+"/api/workouts", map[string]any{
		"id":          "client-w1",
		"name":        "Push Day",
		"description": "chest + tris",
		"exercises":   []any{map[string]any{"exerciseId": "BENCH", "sets": 3, "reps": 8}},
	})
	mustStatus(t, resp, http.StatusOK)
	created := mustJSON[workoutDTO](t, resp)
	if created.ClientID != "client-w1" {
		t.Fatalf("created id mismatch: %q", created.ClientID)
	}

	// list shows 1
	resp = do(t, c, "GET", srv.URL+"/api/workouts", nil)
	mustStatus(t, resp, http.StatusOK)
	list = mustJSON[[]workoutDTO](t, resp)
	if len(list) != 1 {
		t.Fatalf("expected 1 workout, got %d", len(list))
	}

	// update (PUT same client_id)
	resp = do(t, c, "PUT", srv.URL+"/api/workouts/client-w1", map[string]any{
		"name":      "Push Day Updated",
		"exercises": []any{},
	})
	mustStatus(t, resp, http.StatusOK)
	updated := mustJSON[workoutDTO](t, resp)
	if updated.Name != "Push Day Updated" {
		t.Fatalf("update didn't change name: %q", updated.Name)
	}

	// delete
	resp = do(t, c, "DELETE", srv.URL+"/api/workouts/client-w1", nil)
	mustStatus(t, resp, http.StatusNoContent)
	resp.Body.Close()

	// delete again → 404
	resp = do(t, c, "DELETE", srv.URL+"/api/workouts/client-w1", nil)
	mustStatus(t, resp, http.StatusNotFound)
	resp.Body.Close()

	// list empty again
	resp = do(t, c, "GET", srv.URL+"/api/workouts", nil)
	mustStatus(t, resp, http.StatusOK)
	list = mustJSON[[]workoutDTO](t, resp)
	if len(list) != 0 {
		t.Fatalf("expected 0 after delete, got %d", len(list))
	}
}

func TestHistoryAndSettings(t *testing.T) {
	srv, c := newTestServer(t)
	registerAndLogin(t, c, srv, "hs@test.com", "secretpw")

	// append history
	resp := do(t, c, "POST", srv.URL+"/api/history", map[string]any{
		"id":              "h1",
		"workoutId":       "w1",
		"workoutName":     "Push Day",
		"durationSeconds": 1200,
		"completedSets":   []any{},
	})
	mustStatus(t, resp, http.StatusCreated)
	resp.Body.Close()

	resp = do(t, c, "GET", srv.URL+"/api/history", nil)
	mustStatus(t, resp, http.StatusOK)
	hl := mustJSON[[]historyDTO](t, resp)
	if len(hl) != 1 {
		t.Fatalf("expected 1 history entry, got %d", len(hl))
	}

	// clear
	resp = do(t, c, "DELETE", srv.URL+"/api/history", nil)
	mustStatus(t, resp, http.StatusNoContent)
	resp.Body.Close()

	resp = do(t, c, "GET", srv.URL+"/api/history", nil)
	hl = mustJSON[[]historyDTO](t, resp)
	if len(hl) != 0 {
		t.Fatalf("expected 0 after clear, got %d", len(hl))
	}

	// settings defaults to empty object
	resp = do(t, c, "GET", srv.URL+"/api/settings", nil)
	mustStatus(t, resp, http.StatusOK)
	raw, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if string(bytes.TrimSpace(raw)) != "{}" {
		t.Fatalf("expected empty settings, got %q", raw)
	}

	// write settings
	resp = do(t, c, "PUT", srv.URL+"/api/settings", map[string]any{
		"voiceEnabled": true, "soundPackId": "arcade",
	})
	mustStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// read back
	resp = do(t, c, "GET", srv.URL+"/api/settings", nil)
	mustStatus(t, resp, http.StatusOK)
	var got map[string]any
	json.NewDecoder(resp.Body).Decode(&got)
	resp.Body.Close()
	if got["soundPackId"] != "arcade" {
		t.Fatalf("settings round-trip failed: %v", got)
	}
}

func TestMigrate(t *testing.T) {
	srv, c := newTestServer(t)
	registerAndLogin(t, c, srv, "mig@test.com", "secretpw")

	resp := do(t, c, "POST", srv.URL+"/api/migrate", map[string]any{
		"workouts": []any{
			map[string]any{
				"id":        "legacy-w1",
				"name":      "Legacy Push",
				"exercises": []any{},
			},
			map[string]any{
				// missing id — should be skipped
				"name":      "Bad row",
				"exercises": []any{},
			},
		},
		"history": []any{
			map[string]any{
				"id":              "legacy-h1",
				"workoutId":       "legacy-w1",
				"workoutName":     "Legacy Push",
				"durationSeconds": 300,
				"completedSets":   []any{},
			},
		},
		"settings": map[string]any{"soundPackId": "zen"},
	})
	mustStatus(t, resp, http.StatusOK)
	r := mustJSON[migrateResult](t, resp)
	if r.Workouts != 1 || r.History != 1 || r.Settings != 1 {
		t.Fatalf("unexpected migrate result: %+v", r)
	}

	// verify state
	resp = do(t, c, "GET", srv.URL+"/api/workouts", nil)
	list := mustJSON[[]workoutDTO](t, resp)
	if len(list) != 1 || list[0].Name != "Legacy Push" {
		t.Fatalf("workouts after migrate: %+v", list)
	}

	resp = do(t, c, "GET", srv.URL+"/api/history", nil)
	hl := mustJSON[[]historyDTO](t, resp)
	if len(hl) != 1 {
		t.Fatalf("history after migrate: %+v", hl)
	}
}

func TestIsolationBetweenUsers(t *testing.T) {
	srv, alice := newTestServer(t)
	bobJar, _ := cookiejar.New(nil)
	bob := &http.Client{Jar: bobJar, Timeout: 5 * time.Second}

	registerAndLogin(t, alice, srv, "alice@iso.com", "alicepw")
	registerAndLogin(t, bob, srv, "bob@iso.com", "bobpw123")

	// Alice creates a workout
	resp := do(t, alice, "POST", srv.URL+"/api/workouts", map[string]any{
		"id":        "alice-only",
		"name":      "Alice's plan",
		"exercises": []any{},
	})
	mustStatus(t, resp, http.StatusOK)
	resp.Body.Close()

	// Bob sees zero workouts
	resp = do(t, bob, "GET", srv.URL+"/api/workouts", nil)
	mustStatus(t, resp, http.StatusOK)
	bobList := mustJSON[[]workoutDTO](t, resp)
	if len(bobList) != 0 {
		t.Fatalf("bob should see 0, got %d", len(bobList))
	}

	// Bob tries to delete Alice's workout — should 404
	resp = do(t, bob, "DELETE", srv.URL+"/api/workouts/alice-only", nil)
	mustStatus(t, resp, http.StatusNotFound)
	resp.Body.Close()

	// Alice's workout still there
	resp = do(t, alice, "GET", srv.URL+"/api/workouts", nil)
	aliceList := mustJSON[[]workoutDTO](t, resp)
	if len(aliceList) != 1 {
		t.Fatalf("alice's data clobbered: %+v", aliceList)
	}
}

// --- shared test helper ---

func registerAndLogin(t *testing.T, c *http.Client, srv *httptest.Server, email, password string) {
	t.Helper()
	resp := do(t, c, "POST", srv.URL+"/api/auth/register", map[string]any{
		"email": email, "password": password,
	})
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		t.Fatalf("register failed: %d %s", resp.StatusCode, body)
	}
	resp.Body.Close()
}

