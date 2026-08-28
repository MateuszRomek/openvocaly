#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_ROOT="/Applications"
INSTALL_APP=true
INSTALL_DEPENDENCIES=true
FORCE_RUNTIMES=false

print_usage() {
  cat <<'EOF'
Build and install the local OpenVocaly macOS app.

Usage:
  ./scripts/build-and-install-macos.sh [options]

Options:
  --no-install       Build the app and artifacts without copying the app to /Applications.
  --skip-deps        Reuse the existing node_modules directory instead of running npm ci.
  --force-runtimes   Rebuild the native transcription runtimes before packaging.
  --install-dir DIR  Install into DIR instead of /Applications.
  -h, --help         Show this help.

The script targets Apple Silicon and produces an ad-hoc-signed local build.
EOF
}

fail() {
  echo "[openvocaly] Error: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

while (($# > 0)); do
  case "$1" in
    --no-install)
      INSTALL_APP=false
      ;;
    --skip-deps)
      INSTALL_DEPENDENCIES=false
      ;;
    --force-runtimes)
      FORCE_RUNTIMES=true
      ;;
    --install-dir)
      (($# >= 2)) || fail "--install-dir requires a directory"
      INSTALL_ROOT="$2"
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1 (use --help for usage)"
      ;;
  esac
  shift
done

cd "$PROJECT_ROOT"

[[ "$(uname -s)" == "Darwin" ]] || fail "This script only supports macOS."
[[ "$(uname -m)" == "arm64" ]] || fail "This build currently targets Apple Silicon (arm64)."

require_command node
require_command npm
require_command git
require_command python3
require_command swift
require_command xcode-select

if ! xcode-select -p >/dev/null 2>&1; then
  fail "Xcode Command Line Tools are not installed. Run: xcode-select --install"
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
npm_major="$(npm --version | cut -d. -f1)"

if ((node_major < 22)); then
  fail "Node.js 22+ is required; found $(node --version)."
fi

if ((npm_major < 10)); then
  fail "npm 10+ is required; found $(npm --version)."
fi

if [[ "$INSTALL_DEPENDENCIES" == true ]]; then
  echo "[openvocaly] Installing locked npm dependencies..."
  npm ci
elif [[ ! -d node_modules ]]; then
  fail "node_modules is missing. Remove --skip-deps or run npm ci first."
fi

if [[ "$FORCE_RUNTIMES" == true ]]; then
  echo "[openvocaly] Rebuilding native transcription runtimes..."
  npm run build:macos-asr-host -- --force
  npm run build:whisper-cpp-runtime -- --force
  npm run build:qwen-mlx-host -- --force
fi

echo "[openvocaly] Building the arm64 macOS app and release artifacts..."
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac -- --arm64

app_path="$PROJECT_ROOT/dist/mac-arm64/OpenVocaly.app"
[[ -d "$app_path" ]] || fail "Build completed without creating $app_path"

echo "[openvocaly] Build complete:"
find "$PROJECT_ROOT/dist" -maxdepth 1 -type f \
  \( -name 'openvocaly-*.dmg' -o -name 'OpenVocaly-*.zip' \) \
  -exec stat -f '  %N (%z bytes)' {} \;

if [[ "$INSTALL_APP" != true ]]; then
  echo "[openvocaly] Skipping installation (--no-install)."
  echo "[openvocaly] App bundle: $app_path"
  exit 0
fi

if pgrep -x OpenVocaly >/dev/null 2>&1; then
  fail "OpenVocaly is running. Quit it completely, then rerun this script."
fi

install_path="$INSTALL_ROOT/OpenVocaly.app"
backup_path=""
sudo_args=()

if [[ ! -d "$INSTALL_ROOT" ]]; then
  if ! mkdir -p "$INSTALL_ROOT" 2>/dev/null; then
    require_command sudo
    sudo -v
    sudo_args=(sudo)
    "${sudo_args[@]}" mkdir -p "$INSTALL_ROOT"
  fi
fi

if [[ ! -w "$INSTALL_ROOT" ]]; then
  require_command sudo
  [[ "${#sudo_args[@]}" -gt 0 ]] || sudo -v
  sudo_args=(sudo)
fi

if [[ -e "$install_path" ]]; then
  backup_path="$INSTALL_ROOT/OpenVocaly.app.backup-$(date '+%Y%m%d-%H%M%S')-$$"
  echo "[openvocaly] Moving the previous app to $backup_path"
  "${sudo_args[@]}" mv "$install_path" "$backup_path"
fi

if ! "${sudo_args[@]}" ditto "$app_path" "$install_path"; then
  if [[ -n "$backup_path" && -e "$backup_path" ]]; then
    echo "[openvocaly] Restoring the previous app after installation failure..." >&2
    "${sudo_args[@]}" mv "$backup_path" "$install_path" || true
  fi
  fail "Could not install the app into $install_path"
fi

echo "[openvocaly] Installed: $install_path"
echo "[openvocaly] Open it with: open '$install_path'"
echo "[openvocaly] If Accessibility still says Not granted after replacing an ad-hoc build, reset and re-add it:"
echo "  tccutil reset Accessibility com.openvocally.app"
