#!/usr/bin/env bash
# First-time deployment of Keep Fit on a Linux VPS.
# Safe to re-run — idempotent.

set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="keep-fit"
NODE_REQ_MAJOR=18

echo "==> Keep Fit deploy"

# --- 1. Node version check ----------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js not found. Install Node ${NODE_REQ_MAJOR}+ first:"
  echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "    sudo apt-get install -y nodejs"
  exit 1
fi
node_major=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
if [ "$node_major" -lt "$NODE_REQ_MAJOR" ]; then
  echo "✗ Node ${NODE_REQ_MAJOR}+ required, found $(node -v)"
  exit 1
fi
echo "  ✓ Node $(node -v)"

# --- 2. PM2 installed? --------------------------------------------------------
if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> Installing PM2 globally"
  npm install -g pm2
fi
echo "  ✓ PM2 $(pm2 -v)"

# --- 3. Install dependencies --------------------------------------------------
echo "==> Installing dependencies (npm ci)"
npm ci

# --- 4. Build production bundle ----------------------------------------------
echo "==> Building production bundle"
npm run build

# --- 5. Start / reload via PM2 ------------------------------------------------
mkdir -p logs

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "==> App is already registered — reloading (zero downtime)"
  pm2 reload ecosystem.config.js --update-env
else
  echo "==> Starting fresh"
  pm2 start ecosystem.config.js
fi

# Persist the process list so it survives `pm2 kill`
pm2 save

# --- 6. Done ------------------------------------------------------------------
echo ""
echo "✓ Deployed."
pm2 status "$APP_NAME"
echo ""
echo "Default URL: http://localhost:3000"
echo ""
echo "To start on boot, run once:"
echo "    pm2 startup    # copy & run the printed sudo command"
echo "    pm2 save"
