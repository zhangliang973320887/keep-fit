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
NODE_INSTALL_VERSION="20.18.0"
NPM_REGISTRY="https://registry.npmmirror.com"

# ---------- helpers -----------------------------------------------------------

# Wrap privileged calls; expand to nothing when already root.
sudo_run() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo -E "$@"; fi
}

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

node_version_major() {
  node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0
}

# Returns 0 if Node + npm both present and Node >= required version.
node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  command -v npm  >/dev/null 2>&1 || return 1
  local major
  major=$(node_version_major)
  [ "$major" -ge "$NODE_REQ_MAJOR" ]
}

# Try NodeSource setup script + package install. Verifies version afterwards.
install_node_via_nodesource() {
  local distro="$1"
  local setup_url
  case "$distro" in
    rhel)   setup_url="https://rpm.nodesource.com/setup_20.x" ;;
    debian) setup_url="https://deb.nodesource.com/setup_20.x" ;;
    *)      return 1 ;;
  esac

  echo "  Trying NodeSource via package manager…"
  local script
  if ! script=$(curl -fsSL --connect-timeout 10 --max-time 30 "$setup_url"); then
    echo "  ! NodeSource setup script could not be fetched (network issue?)"
    return 1
  fi
  echo "$script" | sudo_run bash - || return 1

  case "$distro" in
    rhel)   sudo_run yum install -y nodejs || return 1 ;;
    debian) sudo_run apt-get install -y nodejs || return 1 ;;
  esac
  hash -r
  return 0
}

install_node_via_distro_pkg() {
  local distro="$1"
  case "$distro" in
    alpine) sudo_run apk add --update nodejs npm ;;
    arch)   sudo_run pacman -Sy --noconfirm nodejs npm ;;
    *)      return 1 ;;
  esac
  hash -r
}

# Last-resort: download a prebuilt binary from npmmirror.com to /opt and symlink.
install_node_via_binary() {
  local arch
  arch=$(detect_arch)
  if [ "$arch" = "unsupported" ]; then
    echo "  ✗ Unsupported CPU architecture: $(uname -m)"
    return 1
  fi
  local pkg="node-v${NODE_INSTALL_VERSION}-linux-${arch}"
  local url="https://npmmirror.com/mirrors/node/v${NODE_INSTALL_VERSION}/${pkg}.tar.xz"

  echo "  Downloading $url"
  cd /opt
  if ! sudo_run curl -fL --connect-timeout 15 --max-time 600 -O "$url"; then
    echo "  ✗ Download failed"
    cd - >/dev/null
    return 1
  fi
  sudo_run tar -xf "${pkg}.tar.xz"
  sudo_run rm -f "${pkg}.tar.xz"
  sudo_run ln -sf "/opt/${pkg}/bin/node" /usr/local/bin/node
  sudo_run ln -sf "/opt/${pkg}/bin/npm"  /usr/local/bin/npm
  sudo_run ln -sf "/opt/${pkg}/bin/npx"  /usr/local/bin/npx
  cd - >/dev/null
  hash -r
}

# Some package repos (EPEL on CentOS 7) ship `nodejs` without `npm`.
# If that happened, try to install npm separately.
ensure_npm_present() {
  if command -v npm >/dev/null 2>&1; then return 0; fi
  echo "  ! Node installed but npm is missing — trying to install separately"
  local distro
  distro=$(detect_distro)
  case "$distro" in
    rhel)   sudo_run yum install -y npm 2>/dev/null || true ;;
    debian) sudo_run apt-get install -y npm 2>/dev/null || true ;;
  esac
  hash -r
  command -v npm >/dev/null 2>&1
}

ensure_node() {
  if node_ok; then
    echo "  ✓ Node $(node -v), npm $(npm -v)"
    return 0
  fi

  if command -v node >/dev/null 2>&1; then
    echo "  ! Found Node $(node -v) but it's too old / missing npm. Will replace."
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

  # Strategy 1: NodeSource (newest Node, but needs network to deb/rpm.nodesource.com)
  if [ "$distro" = "rhel" ] || [ "$distro" = "debian" ]; then
    if install_node_via_nodesource "$distro" && node_ok; then
      echo "  ✓ Installed via NodeSource"
      return 0
    fi
    echo "  ! NodeSource path didn't yield Node ${NODE_REQ_MAJOR}+ — trying npm fix-up"
    if ensure_npm_present && node_ok; then
      echo "  ✓ Installed via NodeSource (npm filled in)"
      return 0
    fi
    echo "  ! Falling back to binary install"
  fi

  # Strategy 2: Distro built-in (Alpine / Arch — usually fresh enough)
  if [ "$distro" = "alpine" ] || [ "$distro" = "arch" ]; then
    if install_node_via_distro_pkg "$distro" && node_ok; then
      echo "  ✓ Installed via distro package manager"
      return 0
    fi
    echo "  ! Distro package didn't yield Node ${NODE_REQ_MAJOR}+ — falling back to binary"
  fi

  # Strategy 3: Download prebuilt binary from npmmirror (no version mismatch risk)
  if install_node_via_binary && node_ok; then
    echo "  ✓ Installed via binary download (npmmirror)"
    return 0
  fi

  echo "✗ Could not install a working Node ${NODE_REQ_MAJOR}+. See errors above."
  exit 1
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
