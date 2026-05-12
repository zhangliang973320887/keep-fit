package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type historyDTO struct {
	ClientID        string          `json:"id"`
	WorkoutID       string          `json:"workoutId"`
	WorkoutName     string          `json:"workoutName"`
	StartedAt       time.Time       `json:"startedAt"`
	CompletedAt     time.Time       `json:"completedAt"`
	DurationSeconds int64           `json:"durationSeconds"`
	CompletedSets   json.RawMessage `json:"completedSets"`
}

func handleListHistory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())
		rows, err := db.Query(`
			SELECT client_id, workout_id, workout_name, started_at, completed_at, duration_seconds, completed_sets
			FROM history
			WHERE user_id = ?
			ORDER BY completed_at DESC
		`, uid)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		defer rows.Close()

		out := []historyDTO{}
		for rows.Next() {
			var d historyDTO
			var setsJSON string
			if err := rows.Scan(&d.ClientID, &d.WorkoutID, &d.WorkoutName, &d.StartedAt, &d.CompletedAt, &d.DurationSeconds, &setsJSON); err != nil {
				writeError(w, http.StatusInternalServerError, "scan_error")
				return
			}
			d.CompletedSets = json.RawMessage(setsJSON)
			out = append(out, d)
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func handleAppendHistory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())

		var body historyDTO
		if err := decodeJSON(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request")
			return
		}
		body.ClientID = strings.TrimSpace(body.ClientID)
		body.WorkoutID = strings.TrimSpace(body.WorkoutID)
		body.WorkoutName = strings.TrimSpace(body.WorkoutName)
		if body.ClientID == "" || body.WorkoutID == "" || body.WorkoutName == "" {
			writeError(w, http.StatusBadRequest, "missing_fields")
			return
		}
		if body.StartedAt.IsZero() {
			body.StartedAt = time.Now().UTC()
		}
		if body.CompletedAt.IsZero() {
			body.CompletedAt = time.Now().UTC()
		}
		if body.DurationSeconds < 0 {
			body.DurationSeconds = 0
		}
		if len(body.CompletedSets) == 0 {
			body.CompletedSets = json.RawMessage("[]")
		}
		if !json.Valid(body.CompletedSets) {
			writeError(w, http.StatusBadRequest, "invalid_sets_json")
			return
		}

		_, err := db.Exec(`
			INSERT INTO history (user_id, client_id, workout_id, workout_name, started_at, completed_at, duration_seconds, completed_sets)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id, client_id) DO NOTHING
		`, uid, body.ClientID, body.WorkoutID, body.WorkoutName, body.StartedAt, body.CompletedAt, body.DurationSeconds, string(body.CompletedSets))
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		writeJSON(w, http.StatusCreated, body)
	}
}

func handleClearHistory(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())
		if _, err := db.Exec(`DELETE FROM history WHERE user_id = ?`, uid); err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
