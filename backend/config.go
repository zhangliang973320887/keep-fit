package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
	"time"
)

type config struct {
	Port      string
	DBPath    string
	JWTSecret string
	JWTTTL    time.Duration
	// CookieSecure controls the Secure flag on the auth cookie. Set to "0" or
	// "false" in dev (HTTP localhost). Default: true (assume HTTPS in prod).
	CookieSecure bool
	// CookieSameSite — "lax" (default), "strict", or "none".
	CookieSameSite string
}

func loadConfig() (*config, error) {
	c := &config{
		Port:           getenv("PORT", "8080"),
		DBPath:         getenv("DB_PATH", "./data/keep-fit.db"),
		JWTSecret:      getenv("JWT_SECRET", ""),
		CookieSameSite: getenv("COOKIE_SAMESITE", "lax"),
	}

	ttlDays, err := strconv.Atoi(getenv("JWT_TTL_DAYS", "30"))
	if err != nil || ttlDays <= 0 {
		return nil, fmt.Errorf("JWT_TTL_DAYS must be a positive int")
	}
	c.JWTTTL = time.Duration(ttlDays) * 24 * time.Hour

	secure := getenv("COOKIE_SECURE", "true")
	c.CookieSecure = !(secure == "0" || secure == "false" || secure == "no")

	if c.JWTSecret == "" {
		// Auto-generate one and tell the operator to pin it. Without pinning,
		// every restart invalidates everyone's sessions — fine in dev, bad in
		// prod, so we warn loudly either way.
		buf := make([]byte, 32)
		if _, err := rand.Read(buf); err != nil {
			return nil, fmt.Errorf("read random: %w", err)
		}
		c.JWTSecret = hex.EncodeToString(buf)
		fmt.Fprintln(os.Stderr, "⚠ JWT_SECRET not set, generated an ephemeral one.")
		fmt.Fprintln(os.Stderr, "⚠ Set JWT_SECRET=<64 hex chars> in env to keep sessions across restarts.")
	}
	if len(c.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 chars")
	}

	return c, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
