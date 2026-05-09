#!/usr/bin/env bash
# First-time deployment of Keep Fit on a Linux VPS.
# Auto-installs Node 20 + PM2 if missing, then builds and starts the app.
# Safe to re-run — idempotent.
#
# Set KEEPFIT_NO_AUTO_INSTALL=1 to skip auto-install of system deps.

set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="keep-fit"
NODE_REQ_MAJOR=18
NODE_INSTALL_VERSION="20.18.0"   # used for binary fallback
NPM_REGISTRY="https://registry.npmmirror.com"

# ---------- helpers -----------------------------------------------------------

# Use sudo only if not already root
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

detect_distro() {
  if   [ -f /etc/redhat-release ] || [ -f /etc/centos-release ] || [ -f /etc/system-release ]; then
    echo "rhel"
  elif [ -f /etc/debian_version ] || command -v apt-get >/dev/null 2>&1; then
    echo "debian"
  elif command -v apk >/dev/null 2>&1; then
    echo "alpine"
  elif command -v pacman >/dev/null 2>&1; then
    echo "arch"
  else
    echo "unknown"
  fi
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    armv7l) echo "armv7l" ;;
    *) echo "unsupported" ;;
  esac
}

install_node_via_package_manager() {
  local distro="$1"
  case "$distro" in
    rhel)
      curl -fsSL --connect-timeout 10 https://rpm.nodesource.com/setup_20.x | $SUDO -E bash -
      $SUDO yum install -y nodejs
      ;;
    debian)
      curl -fsSL --connect-timeout 10 https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
      $SUDO apt-get install -y nodejs
      ;;
    alpine)
      $SUDO apk add --update nodejs npm
      ;;
    arch)
      $SUDO pacman -Sy --noconfirm nodejs npm
      ;;
    *)
      return 1
      ;;
  esac
}

install_node_via_binary() {
  local arch
  arch=$(detect_arch)
  if [ "$arch" = "unsupported" ]; then
    echo "✗ Unsupported CPU architecture: $(uname -m)"
    return 1
  fi
  local pkg="node-v${NODE_INSTALL_VERSION}-linux-${arch}"
  local url="https://npmmirror.com/mirrors/node/v${NODE_INSTALL_VERSION}/${pkg}.tar.xz"

  echo "  Downloading $url"
  cd /opt
  curl -fL --connect-timeout 15 -O "$url"
  tar -xf "${pkg}.tar.xz"
  rm -f "${pkg}.tar.xz"
  $SUDO ln -sf "/opt/${pkg}/bin/node" /usr/local/bin/node
  $SUDO ln -sf "/opt/${pkg}/bin/npm"  /usr/local/bin/npm
  $SUDO ln -sf "/opt/${pkg}/bin/npx"  /usr/local/bin/npx
  cd - >/dev/null
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local node_major
    node_major=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
    if [ "$node_major" -ge "$NODE_REQ_MAJOR" ]; then
      echo "  ✓ Node $(node -v)"
      return 0
    fi
    echo "  ! Node $(node -v) is too old (need ${NODE_REQ_MAJOR}+)."
  else
    echo "  ! Node.js not installed."
  fi

  if [ "${KEEPFIT_NO_AUTO_INSTALL:-0}" = "1" ]; then
    echo "  ✗ Auto-install disabled (KEEPFIT_NO_AUTO_INSTALL=1). Install Node manually and re-run."
    exit 1
  fi

  local distro
  distro=$(detect_distro)
  echo "==> Auto-installing Node ${NODE_INSTALL_VERSION%%.*} on ${distro}"

  # Try package manager first
  if install_node_via_package_manager "$distro"; then
    echo "  ✓ Installed via package manager"
  else
    echo "  ! Package manager install failed/unavailable — falling back to npmmirror binary"
    install_node_via_binary
  fi

  # Re-check
  if ! command -v node >/dev/null 2>&1; then
    echo "✗ Node install failed. Try installing manually."
    exit 1
  fi
  hash -r
  echo "  ✓ Node $(node -v) ready"
}

ensure_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    echo "  ✓ PM2 $(pm2 -v)"
    return 0
  fi
  echo "==> Installing PM2 globally"
  npm install -g pm2
  hash -r
  echo "  ✓ PM2 $(pm2 -v)"
}

# ---------- main --------------------------------------------------------------

echo "==> Keep Fit deploy"

ensure_node
ensure_pm2

# Configure npm registry to a fast mirror for the install step.
# Persisted only for this project (uses .npmrc in cwd if present, else respects user config).
if ! grep -q "registry=" .npmrc 2>/dev/null; then
  echo "==> Setting npm registry to ${NPM_REGISTRY}"
  npm config set registry "$NPM_REGISTRY"
fi

echo "==> Installing dependencies (npm ci)"
npm ci

echo "==> Building production bundle"
npm run build

mkdir -p logs
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "==> App already running — reloading (zero downtime)"
  pm2 reload ecosystem.config.js --update-env
else
  echo "==> Starting fresh"
  pm2 start ecosystem.config.js
fi

pm2 save

echo ""
echo "✓ Deployed."
pm2 status "$APP_NAME"
echo ""
echo "Default URL: http://localhost:3000"
echo ""
echo "To start on boot (run once):"
echo "    pm2 startup       # then run the printed sudo command"
echo "    pm2 save"
