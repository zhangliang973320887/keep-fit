-- Keep Fit initial schema.
-- Notes:
--   * `client_id` columns hold IDs minted on the frontend (e.g. "id-abcd").
--     The server treats them as the stable identifier for a workout / history
--     entry so that an offline-then-sync flow lines up correctly.
--   * `exercises` / `completed_sets` are stored as JSON blobs — they're nested
--     arrays with a few keys each, not worth normalizing.

CREATE TABLE users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password   TEXT    NOT NULL,                 -- bcrypt
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workouts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  exercises   TEXT    NOT NULL DEFAULT '[]',   -- JSON array of WorkoutExercise
  created_at  DATETIME NOT NULL,
  updated_at  DATETIME NOT NULL,
  UNIQUE(user_id, client_id)
);

CREATE INDEX idx_workouts_user_updated ON workouts(user_id, updated_at DESC);

CREATE TABLE history (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id        TEXT    NOT NULL,
  workout_id       TEXT    NOT NULL,           -- frontend's workout client_id
  workout_name     TEXT    NOT NULL,
  started_at       DATETIME NOT NULL,
  completed_at     DATETIME NOT NULL,
  duration_seconds INTEGER NOT NULL,
  completed_sets   TEXT    NOT NULL DEFAULT '[]',  -- JSON
  UNIQUE(user_id, client_id)
);

CREATE INDEX idx_history_user_completed ON history(user_id, completed_at DESC);

CREATE TABLE settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data    TEXT    NOT NULL DEFAULT '{}'        -- JSON AppSettings
);
