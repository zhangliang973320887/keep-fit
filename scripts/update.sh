#!/usr/bin/env bash
# Pull latest code, rebuild frontend + backend, zero-downtime reload.
# Run on the server whenever you push new code.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing frontend dependencies"
npm ci

echo "==> Building frontend"
npm run build

if [ -d backend ]; then
  echo "==> Building Go backend"
  (
    cd backend
    go mod download
    CGO_ENABLED=0 go build -ldflags="-s -w" -o keep-fit-api .
  )
fi

mkdir -p logs data

# Make the persisted JWT secret available for the PM2 env on reload.
if [ -f .env.jwt ]; then
  export JWT_SECRET=$(cat .env.jwt)
fi

echo "==> Reloading PM2 (zero downtime)"
pm2 reload ecosystem.config.js --update-env

echo ""
echo "✓ Updated."
pm2 status
