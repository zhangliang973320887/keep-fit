package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type workoutDTO struct {
	ClientID    string          `json:"id"`         // frontend's client_id
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Exercises   json.RawMessage `json:"exercises"`  // pass-through JSON array
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

func handleListWorkouts(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())
		rows, err := db.Query(`
			SELECT client_id, name, description, exercises, created_at, updated_at
			FROM workouts
			WHERE user_id = ?
			ORDER BY updated_at DESC
		`, uid)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		defer rows.Close()

		out := []workoutDTO{}
		for rows.Next() {
			var d workoutDTO
			var exJSON string
			if err := rows.Scan(&d.ClientID, &d.Name, &d.Description, &exJSON, &d.CreatedAt, &d.UpdatedAt); err != nil {
				writeError(w, http.StatusInternalServerError, "scan_error")
				return
			}
			d.Exercises = json.RawMessage(exJSON)
			out = append(out, d)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func handleUpsertWorkout(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())

		var body workoutDTO
		if err := decodeJSON(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request")
			return
		}

		// If the URL has a {clientID}, that wins over the body's id (PUT semantic).
		if urlID := chi.URLParam(r, "clientID"); urlID != "" {
			body.ClientID = urlID
		}

		body.ClientID = strings.TrimSpace(body.ClientID)
		body.Name = strings.TrimSpace(body.Name)
		if body.ClientID == "" || body.Name == "" {
			writeError(w, http.StatusBadRequest, "missing_fields")
			return
		}
		if len(body.Exercises) == 0 {
			body.Exercises = json.RawMessage("[]")
		}
		// Sanity-validate the exercises blob is JSON
		if !json.Valid(body.Exercises) {
			writeError(w, http.StatusBadRequest, "invalid_exercises_json")
			return
		}

		now := time.Now().UTC()
		if body.CreatedAt.IsZero() {
			body.CreatedAt = now
		}
		body.UpdatedAt = now

		_, err := db.Exec(`
			INSERT INTO workouts (user_id, client_id, name, description, exercises, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id, client_id) DO UPDATE SET
			  name = excluded.name,
			  description = excluded.description,
			  exercises = excluded.exercises,
			  updated_at = excluded.updated_at
		`, uid, body.ClientID, body.Name, body.Description, string(body.Exercises), body.CreatedAt, body.UpdatedAt)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}

		writeJSON(w, http.StatusOK, body)
	}
}

func handleDeleteWorkout(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())
		clientID := chi.URLParam(r, "clientID")
		if clientID == "" {
			writeError(w, http.StatusBadRequest, "missing_id")
			return
		}
		res, err := db.Exec(
			`DELETE FROM workouts WHERE user_id = ? AND client_id = ?`,
			uid, clientID,
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			writeError(w, http.StatusNotFound, "not_found")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

