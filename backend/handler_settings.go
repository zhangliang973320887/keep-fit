package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
)

// Settings is opaque JSON to the backend — the frontend defines what's inside
// (sound pack, video toggle, etc.). We just blob-store the whole thing.

func handleGetSettings(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())
		var raw string
		err := db.QueryRow(`SELECT data FROM settings WHERE user_id = ?`, uid).Scan(&raw)
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusOK, json.RawMessage(`{}`))
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(raw))
	}
}

func handlePutSettings(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())
		var raw json.RawMessage
		if err := decodeJSON(r, &raw); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request")
			return
		}
		if !json.Valid(raw) {
			writeError(w, http.StatusBadRequest, "invalid_json")
			return
		}
		_, err := db.Exec(`
			INSERT INTO settings (user_id, data) VALUES (?, ?)
			ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
		`, uid, string(raw))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(raw))
	}
}
