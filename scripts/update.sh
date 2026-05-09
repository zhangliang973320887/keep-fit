#!/usr/bin/env bash
# Pull latest code, rebuild, zero-downtime reload.
# Run on the server whenever you push new code.

set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="keep-fit"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing dependencies"
npm ci

echo "==> Building"
npm run build

echo "==> Reloading PM2 (zero downtime)"
pm2 reload ecosystem.config.js --update-env

echo ""
echo "✓ Updated."
pm2 status "$APP_NAME"
