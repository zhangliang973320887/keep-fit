package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

// migratePayload is what the frontend sends ONCE on first server-backed sign-in,
// to upload whatever was sitting in localStorage prior to the backend cutover.
//
// All fields are optional. Unknown / malformed entries are skipped silently —
// we'd rather complete a partial migration than reject the whole thing because
// of one bad row.
type migratePayload struct {
	Workouts []workoutDTO `json:"workouts"`
	History  []historyDTO `json:"history"`
	Settings json.RawMessage `json:"settings"`
}

type migrateResult struct {
	Workouts int `json:"workouts"`
	History  int `json:"history"`
	Settings int `json:"settings"`
}

func handleMigrate(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, _ := userIDFrom(r.Context())

		var p migratePayload
		if err := decodeJSON(r, &p); err != nil {
			writeError(w, http.StatusBadRequest, "bad_request")
			return
		}

		tx, err := db.Begin()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db_error")
			return
		}
		defer tx.Rollback()

		res := migrateResult{}

		now := time.Now().UTC()
		for _, wkt := range p.Workouts {
			if wkt.ClientID == "" || wkt.Name == "" {
				continue
			}
			ex := wkt.Exercises
			if len(ex) == 0 {
				ex = json.RawMessage("[]")
			}
			if !json.Valid(ex) {
				continue
			}
			created := wkt.CreatedAt
			if created.IsZero() {
				created = now
			}
			updated := wkt.UpdatedAt
			if updated.IsZero() {
				updated = now
			}
			if _, err := tx.Exec(`
				INSERT INTO workouts (user_id, client_id, name, description, exercises, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(user_id, client_id) DO NOTHING
			`, uid, wkt.ClientID, wkt.Name, wkt.Description, string(ex), created, updated); err == nil {
				res.Workouts++
			}
		}

		for _, h := range p.History {
			if h.ClientID == "" || h.WorkoutID == "" || h.WorkoutName == "" {
				continue
			}
			sets := h.CompletedSets
			if len(sets) == 0 {
				sets = json.RawMessage("[]")
			}
			if !json.Valid(sets) {
				continue
			}
			started := h.StartedAt
			if started.IsZero() {
				started = h.CompletedAt
			}
			completed := h.CompletedAt
			if completed.IsZero() {
				completed = now
			}
			if _, err := tx.Exec(`
				INSERT INTO history (user_id, client_id, workout_id, workout_name, started_at, completed_at, duration_seconds, completed_sets)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(user_id, client_id) DO NOTHING
			`, uid, h.ClientID, h.WorkoutID, h.WorkoutName, started, completed, h.DurationSeconds, string(sets)); err == nil {
				res.History++
			}
		}

		if len(p.Settings) > 0 && json.Valid(p.Settings) {
			if _, err := tx.Exec(`
				INSERT INTO settings (user_id, data) VALUES (?, ?)
				ON CONFLICT(user_id) DO UPDATE SET data = excluded.data
			`, uid, string(p.Settings)); err == nil {
				res.Settings = 1
			}
		}

		if err := tx.Commit(); err != nil {
			writeError(w, http.StatusInternalServerError, "commit_failed")
			return
		}
		writeJSON(w, http.StatusOK, res)
	}
}
