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
GO_REQ_VERSION="1.22"
GO_INSTALL_VERSION="1.22.10"
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

# CentOS 7 / RHEL 7 ships with glibc 2.17. Node 18+ official binaries require
# glibc 2.28+. For these legacy hosts, Node publishes "unofficial-builds"
# linked against glibc 2.17 at unofficial-builds.nodejs.org.
glibc_minor_version() {
  # Output e.g. "2.17" → "17". Returns "999" if detection fails (assume modern).
  local v
  v=$(ldd --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+' | head -n1 || true)
  if [ -z "$v" ]; then echo "999"; return; fi
  echo "${v#*.}"
}

needs_glibc217_build() {
  local minor
  minor=$(glibc_minor_version)
  [ "$minor" -lt 28 ]
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

# Download a prebuilt binary to /opt and symlink. Picks the glibc-217 variant
# automatically on legacy distros (CentOS 7 / RHEL 7).
install_node_via_binary() {
  local arch
  arch=$(detect_arch)
  if [ "$arch" = "unsupported" ]; then
    echo "  ✗ Unsupported CPU architecture: $(uname -m)"
    return 1
  fi

  # Pick URL + filename based on glibc compatibility
  local pkg url
  if [ "$arch" = "x64" ] && needs_glibc217_build; then
    echo "  Detected legacy glibc ($(ldd --version 2>/dev/null | head -n1 | grep -oE '[0-9]+\.[0-9]+' | head -n1)) — using unofficial glibc-217 build"
    pkg="node-v${NODE_INSTALL_VERSION}-linux-${arch}-glibc-217"
    url="https://unofficial-builds.nodejs.org/download/release/v${NODE_INSTALL_VERSION}/${pkg}.tar.xz"
  else
    pkg="node-v${NODE_INSTALL_VERSION}-linux-${arch}"
    url="https://npmmirror.com/mirrors/node/v${NODE_INSTALL_VERSION}/${pkg}.tar.xz"
  fi

  echo "  Downloading $url"
  cd /opt
  # Clean up any failed previous attempt
  sudo_run rm -rf "${pkg}" "${pkg}.tar.xz"
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

  # Persist /opt/<pkg>/bin in PATH for future shells so future global npm
  # installs (e.g. pm2) become reachable without manual symlinking.
  echo "export PATH=\"/opt/${pkg}/bin:\$PATH\"" \
    | sudo_run tee /etc/profile.d/keepfit-node.sh >/dev/null
  sudo_run chmod 0755 /etc/profile.d/keepfit-node.sh
  # Make it active for *this* shell too
  export PATH="/opt/${pkg}/bin:$PATH"

  # Smoke test the binary actually runs on this kernel/glibc
  if ! node -v >/dev/null 2>&1; then
    echo "  ✗ Installed Node binary refuses to run (likely glibc/kernel mismatch)"
    return 1
  fi
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

go_version() {
  go version 2>/dev/null | sed -nE 's/^go version go([0-9]+\.[0-9]+(\.[0-9]+)?).*/\1/p'
}

go_meets_req() {
  local v="$1" req="$2"
  # Simple major.minor compare
  local v_maj v_min req_maj req_min
  v_maj=$(echo "$v" | cut -d. -f1)
  v_min=$(echo "$v" | cut -d. -f2)
  req_maj=$(echo "$req" | cut -d. -f1)
  req_min=$(echo "$req" | cut -d. -f2)
  if [ "$v_maj" -gt "$req_maj" ]; then return 0; fi
  if [ "$v_maj" -lt "$req_maj" ]; then return 1; fi
  [ "$v_min" -ge "$req_min" ]
}

ensure_go() {
  local v
  if v=$(go_version) && go_meets_req "$v" "$GO_REQ_VERSION"; then
    echo "  ✓ Go ${v}"
    return 0
  fi
  if [ "${KEEPFIT_NO_AUTO_INSTALL:-0}" = "1" ]; then
    echo "  ✗ Auto-install disabled (KEEPFIT_NO_AUTO_INSTALL=1). Install Go ${GO_REQ_VERSION}+ manually and re-run."
    exit 1
  fi
  echo "==> Auto-installing Go ${GO_INSTALL_VERSION}"

  local arch
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    armv7l|armv6l) arch="armv6l" ;;
    *) echo "  ✗ Unsupported arch: $arch"; exit 1 ;;
  esac
  local pkg url
  pkg="go${GO_INSTALL_VERSION}.linux-${arch}.tar.gz"
  url="https://golang.org/dl/${pkg}"

  cd /tmp
  sudo_run rm -rf "${pkg}"
  if ! sudo_run curl -fL --connect-timeout 15 --max-time 600 -o "${pkg}" "${url}"; then
    # Mirror fallback (China-friendly)
    url="https://golang.google.cn/dl/${pkg}"
    echo "  Retrying via ${url}"
    if ! sudo_run curl -fL --connect-timeout 15 --max-time 600 -o "${pkg}" "${url}"; then
      echo "  ✗ Could not fetch Go tarball"
      cd - >/dev/null
      exit 1
    fi
  fi
  sudo_run rm -rf /usr/local/go
  sudo_run tar -C /usr/local -xzf "${pkg}"
  sudo_run rm -f "${pkg}"
  cd - >/dev/null

  # Add /usr/local/go/bin to PATH for future shells + this one
  echo 'export PATH="/usr/local/go/bin:$PATH"' \
    | sudo_run tee /etc/profile.d/keepfit-go.sh >/dev/null
  sudo_run chmod 0755 /etc/profile.d/keepfit-go.sh
  export PATH="/usr/local/go/bin:$PATH"
  hash -r

  if ! v=$(go_version) || ! go_meets_req "$v" "$GO_REQ_VERSION"; then
    echo "  ✗ Go install seemed to succeed but go version still fails"
    exit 1
  fi
  echo "  ✓ Go ${v}"
}

ensure_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    echo "  ✓ PM2 $(pm2 -v)"
    return 0
  fi
  echo "==> Installing PM2 globally"
  npm install -g pm2
  hash -r

  # If pm2 still isn't in PATH, find it and symlink into /usr/local/bin
  if ! command -v pm2 >/dev/null 2>&1; then
    local npm_prefix npm_bin
    npm_prefix=$(npm prefix -g 2>/dev/null || true)
    if [ -n "$npm_prefix" ]; then
      npm_bin="${npm_prefix}/bin"
      if [ -x "${npm_bin}/pm2" ]; then
        echo "  Symlinking ${npm_bin}/pm2 → /usr/local/bin/pm2"
        sudo_run ln -sf "${npm_bin}/pm2" /usr/local/bin/pm2
        hash -r
      fi
    fi
  fi

  if ! command -v pm2 >/dev/null 2>&1; then
    echo "  ✗ pm2 was installed but isn't on PATH."
    echo "    Try: export PATH=\"$(npm prefix -g)/bin:\$PATH\" && pm2 -v"
    exit 1
  fi
  echo "  ✓ PM2 $(pm2 -v)"
}

# ---------- main --------------------------------------------------------------

echo "==> Keep Fit deploy"

ensure_node
ensure_go
ensure_pm2

if ! grep -q "registry=" .npmrc 2>/dev/null; then
  echo "==> Setting npm registry to ${NPM_REGISTRY}"
  npm config set registry "$NPM_REGISTRY"
fi

echo "==> Installing frontend dependencies (npm ci)"
npm ci

echo "==> Building frontend production bundle"
npm run build

echo "==> Building Go backend"
(
  cd backend
  go mod download
  CGO_ENABLED=0 go build -ldflags="-s -w" -o keep-fit-api .
)

mkdir -p logs data

# Generate / persist JWT_SECRET if the operator hasn't pinned one.
if [ -z "${JWT_SECRET:-}" ] && [ ! -f .env.jwt ]; then
  echo "==> Generating JWT_SECRET (saved to .env.jwt; back this up or pin in env)"
  # 32 random bytes → 64 hex chars. Falls back to /dev/urandom if openssl missing.
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32 > .env.jwt
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > .env.jwt
  fi
  chmod 600 .env.jwt
fi
if [ -f .env.jwt ]; then
  export JWT_SECRET=$(cat .env.jwt)
fi

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  echo "==> Apps already running — reloading (zero downtime)"
  pm2 reload ecosystem.config.js --update-env
else
  echo "==> Starting fresh"
  pm2 start ecosystem.config.js --update-env
fi

pm2 save

echo ""
echo "✓ Deployed."
pm2 status
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8080/api/health"
echo ""
echo "To start on boot (run once):"
echo "    pm2 startup       # then run the printed sudo command"
echo "    pm2 save"
