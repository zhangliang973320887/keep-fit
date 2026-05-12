package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const (
	cookieName      = "kf_token"
	bcryptCost      = 12 // ~250ms hash on a modern CPU — slow on purpose
	minPasswordLen  = 6
	emailMaxLen     = 254
	emailPattern    = `^[^@\s]+@[^@\s]+\.[^@\s]+$`
)

// ---- bcrypt wrappers ----

func hashPassword(plain string) (string, error) {
	if len(plain) < minPasswordLen {
		return "", errors.New("password too short")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func verifyPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// ---- JWT service ----

type authService struct {
	secret []byte
	ttl    time.Duration
}

type contextKey string

const ctxUserIDKey contextKey = "kf_user_id"

func (a *authService) sign(userID int64) (string, time.Time, error) {
	now := time.Now()
	exp := now.Add(a.ttl)
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": strconv.FormatInt(userID, 10),
		"iat": now.Unix(),
		"exp": exp.Unix(),
	})
	signed, err := tok.SignedString(a.secret)
	return signed, exp, err
}

func (a *authService) verify(tokenStr string) (int64, error) {
	parsed, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return a.secret, nil
	})
	if err != nil || !parsed.Valid {
		return 0, errors.New("invalid token")
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return 0, errors.New("invalid claims")
	}
	subRaw, ok := claims["sub"].(string)
	if !ok {
		return 0, errors.New("missing sub")
	}
	uid, err := strconv.ParseInt(subRaw, 10, 64)
	if err != nil {
		return 0, errors.New("bad sub")
	}
	return uid, nil
}

// ---- auth middleware ----

func (a *authService) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(cookieName)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthenticated")
			return
		}
		uid, err := a.verify(c.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthenticated")
			return
		}
		ctx := context.WithValue(r.Context(), ctxUserIDKey, uid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func userIDFrom(ctx context.Context) (int64, bool) {
	v, ok := ctx.Value(ctxUserIDKey).(int64)
	return v, ok
}

// ---- email validation ----

func isValidEmail(s string) bool {
	s = strings.TrimSpace(strings.ToLower(s))
	if len(s) == 0 || len(s) > emailMaxLen {
		return false
	}
	at := strings.IndexByte(s, '@')
	if at < 1 || at == len(s)-1 {
		return false
	}
	dot := strings.LastIndexByte(s[at+1:], '.')
	if dot < 1 || dot == len(s[at+1:])-1 {
		return false
	}
	if strings.ContainsAny(s, " \t\n\r") {
		return false
	}
	return true
}

func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// ---- cookie helper ----

func (a *authService) setCookie(w http.ResponseWriter, cfg *config, token string, exp time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		Expires:  exp,
		HttpOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: parseSameSite(cfg.CookieSameSite),
	})
}

func clearCookie(w http.ResponseWriter, cfg *config) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: parseSameSite(cfg.CookieSameSite),
	})
}

func parseSameSite(s string) http.SameSite {
	switch strings.ToLower(s) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}
