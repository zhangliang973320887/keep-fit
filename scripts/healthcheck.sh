#!/usr/bin/env bash
# Lightweight health probe — exits 0 if the app responds, non-zero otherwise.
# Wire into a cron / monitoring system if you want alerts.

PORT="${PORT:-3000}"
URL="http://localhost:${PORT}/"

if curl -fsS -m 5 "$URL" >/dev/null; then
  echo "OK"
  exit 0
fi
echo "FAIL: $URL did not respond within 5s"
exit 1
