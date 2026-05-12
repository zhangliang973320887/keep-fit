package main

import (
	"encoding/json"
	"io"
	"net/http"
)

// writeJSON serializes v and writes it as application/json.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		// At this point status code already written; best we can do is log.
		// In production a panic here would be caught by middleware.Recoverer.
		_ = err
	}
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}

// decodeJSON reads the request body into dst with a small size cap so we
// don't get OOM'd by a malicious giant body. 1 MiB is plenty for our schema.
func decodeJSON(r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	// Reject trailing junk after the first JSON value.
	if _, err := dec.Token(); err != io.EOF {
		if err == nil {
			return io.ErrUnexpectedEOF
		}
	}
	return nil
}
