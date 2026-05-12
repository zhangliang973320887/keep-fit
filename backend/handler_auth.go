package main

import (
	"database/sql"
	"errors"
	"net/http"
	"time"
)

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"createdAt"`
}

func handleRegister(db *sql.DB, auth *authService, cfg *config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req authRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request")
			return
		}
		email := normalizeEmail(req.Email)
		if !isValidEmail(email) {
			writeError(w, http.StatusBadRequest, "invalid_email")
			return
		}
		if len(req.Password) < minPasswordLen {
			writeError(w, http.StatusBadRequest, "weak_password")
			return
		}

		hash, err := hashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "hash_failed")
			return
		}

		res, err := db.Exec(
			`INSERT INTO users (email, password) VALUES (?, ?)`,
			email, hash,
		)
		if err != nil {
			// SQLite UNIQUE violation
			writeError(w, http.StatusConflict, "email_taken")
			return
		}
		uid, _ := res.LastInsertId()

		token, exp, err := auth.sign(uid)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "sign_failed")
			return
		}
		auth.setCookie(w, cfg, token, exp)

		var createdAt time.Time
		if err := db.QueryRow(`SELECT created_at FROM users WHERE id = ?`, uid).Scan(&createdAt); err != nil {
			createdAt = time.Now().UTC()
		}
		writeJSON(w, http.StatusCreated, authResponse{Email: email, CreatedAt: createdAt})
	}
}

func handleLogin(db *sql.DB, auth *authService, cfg *config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req authRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request")
			return
		}
		email := normalizeEmail(req.Email)
		if !isValidEmail(email) {
			// Treat invalid email same as wrong creds — don't leak account existence.
			writeError(w, http.StatusUnauthorized, "wrong_credentials")
			return
		}

		var (
			uid       int64
			passHash  string
			createdAt time.Time
		)
		err := db.QueryRow(
			`SELECT id, password, created_at FROM users WHERE email = ?`,
			email,
		).Scan(&uid, &passHash, &createdAt)
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "wrong_credentials")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		if !verifyPassword(passHash, req.Password) {
			writeError(w, http.StatusUnauthorized, "wrong_credentials")
			return
		}

		token, exp, err := auth.sign(uid)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "sign_failed")
			return
		}
		auth.setCookie(w, cfg, token, exp)
		writeJSON(w, http.StatusOK, authResponse{Email: email, CreatedAt: createdAt})
	}
}

func handleLogout(cfg *config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clearCookie(w, cfg)
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}

func handleMe(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())
		var (
			email     string
			createdAt time.Time
		)
		err := db.QueryRow(
			`SELECT email, created_at FROM users WHERE id = ?`, uid,
		).Scan(&email, &createdAt)
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "unauthenticated")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		writeJSON(w, http.StatusOK, authResponse{Email: email, CreatedAt: createdAt})
	}
}

// handleDeleteAccount removes the user and ON DELETE CASCADE clears all their
// workouts/history/settings.
func handleDeleteAccount(db *sql.DB, cfg *config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())
		if _, err := db.Exec(`DELETE FROM users WHERE id = ?`, uid); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		clearCookie(w, cfg)
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}
