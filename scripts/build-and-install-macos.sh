#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="OpenVocaly"
BUNDLE_ID="com.openvocally.app"
LOCAL_IDENTITY_NAME="OpenVocaly Local Signing"
INSTALL_ROOT="/Applications"
INSTALL_APP=true
INSTALL_DEPENDENCIES=true
FORCE_RUNTIMES=false
UPDATE_SOURCE=false
BUILD_ARTIFACTS=false
LAUNCH_APP=true
CHECK_ONLY=false
SIGN_IDENTITY="${OPENVOCALY_SIGN_IDENTITY:-}"

print_usage() {
  cat <<'EOF'
Build OpenVocaly from this checkout and install it as a regular macOS app.
No Apple Developer account is needed.

Usage:
  ./scripts/build-and-install-macos.sh [options]

Options:
  --update           Fast-forward this checkout (git pull --ff-only) before building.
  --check            Only run the environment checks, then exit.
  --no-install       Build the app without copying it to the install directory.
  --no-launch        Do not open the app after installing it.
  --artifacts        Also build the DMG and ZIP into dist/.
  --skip-deps        Reuse node_modules instead of running npm ci.
  --force-runtimes   Rebuild the native transcription runtimes.
  --identity NAME    Code signing identity to use ("-" for ad-hoc).
  --install-dir DIR  Install into DIR instead of /Applications.
  -h, --help         Show this help.

Signing:
  With a stable signing identity, macOS keeps the Microphone and Accessibility
  permissions across rebuilds. Create one once per Mac with
  ./scripts/setup-macos-signing.sh. Without it the app is ad-hoc signed and the
  permissions must be granted again after every install.
EOF
}

log() {
  echo "[openvocaly] $*"
}

fail() {
  echo "[openvocaly] Error: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1. $2"
}

while (($# > 0)); do
  case "$1" in
    --update) UPDATE_SOURCE=true ;;
    --check) CHECK_ONLY=true ;;
    --no-install) INSTALL_APP=false ;;
    --no-launch) LAUNCH_APP=false ;;
    --artifacts) BUILD_ARTIFACTS=true ;;
    --skip-deps) INSTALL_DEPENDENCIES=false ;;
    --force-runtimes) FORCE_RUNTIMES=true ;;
    --identity)
      (($# >= 2)) || fail "--identity requires a value"
      SIGN_IDENTITY="$2"
      shift
      ;;
    --install-dir)
      (($# >= 2)) || fail "--install-dir requires a directory"
      INSTALL_ROOT="$2"
      shift
      ;;
    -h | --help)
      print_usage
      exit 0
      ;;
    *) fail "Unknown option: $1 (use --help for usage)" ;;
  esac
  shift
done

cd "$PROJECT_ROOT"

check_platform() {
  [[ "$(uname -s)" == "Darwin" ]] || fail "This script only supports macOS."
  [[ "$(uname -m)" == "arm64" ]] || fail "OpenVocaly requires an Apple Silicon Mac."
  local macos_major
  macos_major="$(sw_vers -productVersion | cut -d. -f1)"
  ((macos_major >= 14)) || fail "macOS 14 or newer is required; found $(sw_vers -productVersion)."
  log "macOS $(sw_vers -productVersion) on Apple Silicon"
}

check_node() {
  local required_major node_major npm_major nvm_node=""
  required_major="$(tr -dc '0-9.' <.nvmrc | cut -d. -f1)"
  node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  if ((node_major < required_major)) && [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    log "Switching to Node.js $(cat .nvmrc) from .nvmrc with nvm..."
    set +u
    # shellcheck disable=SC1091
    source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    nvm install >/dev/null
    nvm_node="$(nvm which "$(cat .nvmrc)" 2>/dev/null || true)"
    set -u
    if [[ -x "$nvm_node" ]]; then
      PATH="$(dirname "$nvm_node"):$PATH"
      export PATH
      hash -r
    fi
  fi
  require_command node "Install Node.js $(cat .nvmrc) (for example: nvm install, or brew install node@$required_major)."
  require_command npm "npm ships with Node.js."
  node_major="$(node -p "process.versions.node.split('.')[0]")"
  npm_major="$(npm --version | cut -d. -f1)"
  ((node_major >= required_major)) || fail "Node.js $required_major+ is required; found $(node --version) at $(command -v node).
nvm's Node $(cat .nvmrc) is at: ${nvm_node:-not found}
If that binary itself reports v$node_major, reinstall it: nvm uninstall $(cat .nvmrc) && nvm install"
  ((npm_major >= 10)) || fail "npm 10+ is required; found $(npm --version)."
  log "Node.js $(node --version), npm $(npm --version)"
}

check_python() {
  require_command python3 "Install Python 3 (for example: brew install python)."
  python3 -c 'import venv, ensurepip' 2>/dev/null ||
    fail "python3 at $(command -v python3) has no working venv/ensurepip. Install Python from Homebrew or python.org."
  [[ "$(python3 -c 'import platform; print(platform.machine())')" == "arm64" ]] ||
    fail "python3 at $(command -v python3) runs as Intel (Rosetta). MLX needs a native arm64 Python, for example /opt/homebrew/bin/python3."
  log "$(python3 --version) at $(command -v python3)"
}

probe_toolchain() {
  local probe_dir status=0
  probe_dir="$(mktemp -d)"
  printf 'int main(void) { return 0; }\n' >"$probe_dir/probe.c"
  printf 'print("ok")\n' >"$probe_dir/probe.swift"
  xcrun clang "$probe_dir/probe.c" -o "$probe_dir/probe-c" >"$probe_dir/log" 2>&1 &&
    xcrun swiftc "$probe_dir/probe.swift" -o "$probe_dir/probe-swift" >>"$probe_dir/log" 2>&1 &&
    "$probe_dir/probe-swift" >/dev/null 2>&1 || status=1
  if ((status != 0)); then
    TOOLCHAIN_PROBE_LOG="$(tail -n 3 "$probe_dir/log")"
  fi
  rm -rf "$probe_dir"
  return "$status"
}

# A selected Xcode that is older than the installed macOS SDK fails at link time
# ("tapi error ... unknown architecture"). Pick a combination that links.
check_toolchain() {
  require_command xcode-select "Install the Xcode Command Line Tools: xcode-select --install"
  xcode-select -p >/dev/null 2>&1 || fail "Xcode Command Line Tools are not installed. Run: xcode-select --install"
  require_command git "Install the Xcode Command Line Tools: xcode-select --install"

  TOOLCHAIN_PROBE_LOG=""
  if probe_toolchain; then
    log "Compiler toolchain OK ($(xcode-select -p))"
    return
  fi

  local clt=/Library/Developer/CommandLineTools
  if [[ -d "$clt" ]] && DEVELOPER_DIR="$clt" probe_toolchain; then
    export DEVELOPER_DIR="$clt"
    log "The selected Xcode cannot link with this SDK; using the Command Line Tools instead ($clt)"
    return
  fi

  local xcode_sdk
  xcode_sdk="$(xcode-select -p)/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
  if [[ -d "$xcode_sdk" ]] && SDKROOT="$xcode_sdk" probe_toolchain; then
    export SDKROOT="$xcode_sdk"
    log "Using the SDK bundled with the selected Xcode ($xcode_sdk)"
    return
  fi

  fail "Cannot compile native code. Last error:
$TOOLCHAIN_PROBE_LOG
Fix: update Xcode or the Command Line Tools (softwareupdate --list), or select a working one:
  sudo xcode-select --switch /Library/Developer/CommandLineTools"
}

check_disk_space() {
  local free_gb
  free_gb="$(df -g "$PROJECT_ROOT" | awk 'NR==2 {print $4}')"
  ((free_gb >= 8)) || fail "At least 8 GB of free disk space is needed to build; found ${free_gb} GB."
}

resolve_identity() {
  if [[ -n "$SIGN_IDENTITY" ]]; then
    return
  fi
  local valid
  valid="$(security find-identity -v -p codesigning 2>/dev/null || true)"
  if grep -q "\"$LOCAL_IDENTITY_NAME\"" <<<"$valid"; then
    SIGN_IDENTITY="$LOCAL_IDENTITY_NAME"
  else
    SIGN_IDENTITY="-"
  fi
}

check_platform
check_node
check_python
check_toolchain
check_disk_space
resolve_identity

if [[ "$SIGN_IDENTITY" == "-" ]]; then
  log "Signing: ad-hoc. Run ./scripts/setup-macos-signing.sh once to keep permissions across rebuilds."
else
  log "Signing identity: $SIGN_IDENTITY"
fi

if [[ "$CHECK_ONLY" == true ]]; then
  log "Environment checks passed."
  exit 0
fi

if [[ "$UPDATE_SOURCE" == true ]]; then
  [[ -z "$(git status --porcelain --untracked-files=no)" ]] ||
    fail "--update needs a clean working tree. Commit or stash your changes first."
  log "Updating the checkout..."
  git pull --ff-only
fi

if [[ "$INSTALL_DEPENDENCIES" == true ]]; then
  log "Installing locked npm dependencies..."
  npm ci
elif [[ ! -d node_modules ]]; then
  fail "node_modules is missing. Remove --skip-deps or run npm ci first."
fi

if [[ "$FORCE_RUNTIMES" == true ]]; then
  log "Rebuilding native transcription runtimes..."
  npm run build:macos-asr-host -- --force
  npm run build:whisper-cpp-runtime -- --force
  npm run build:qwen-mlx-host -- --force
fi

builder_target=--dir
if [[ "$BUILD_ARTIFACTS" == true ]]; then
  builder_target=--mac
fi

log "Building the app..."
rm -rf "$PROJECT_ROOT/dist/mac-arm64"
npm run build:mac -- --arm64 "$builder_target" "-c.mac.identity=$SIGN_IDENTITY" -c.mac.timestamp=none

app_path="$PROJECT_ROOT/dist/mac-arm64/$APP_NAME.app"
[[ -d "$app_path" ]] || fail "The build finished without creating $app_path"

verify_bundle() {
  local app="$1" resources="$1/Contents/Resources/app.asar.unpacked"
  local required=(
    "resources/bin/macos-asr-host"
    "resources/bin/macos-fast-paste"
    "resources/bin/whisper-server-darwin-arm64"
    "resources/qwen-mlx-host/qwen-mlx-host"
  )
  local missing=()
  for path in "${required[@]}"; do
    [[ -x "$resources/$path" ]] || missing+=("$path")
  done
  compgen -G "$resources/node_modules/@openvocaly/ptt-hook-macos/build/Release/*.node" >/dev/null ||
    missing+=("ptt-hook-macos native module")
  ((${#missing[@]} == 0)) || fail "The app bundle is missing: ${missing[*]}"

  codesign --verify --deep --strict "$app" 2>&1 ||
    fail "The app signature does not verify. Run: codesign --verify --deep --strict --verbose=2 '$app'"
  local identifier
  identifier="$(codesign -dv "$app" 2>&1 | sed -n 's/^Identifier=//p')"
  [[ "$identifier" == "$BUNDLE_ID" ]] || fail "Signed with identifier '$identifier', expected '$BUNDLE_ID'."
}

verify_bundle "$app_path"
log "Built and verified: $app_path"

if [[ "$INSTALL_APP" != true ]]; then
  exit 0
fi

quit_running_app() {
  pgrep -x "$APP_NAME" >/dev/null 2>&1 || return 0
  log "Quitting the running $APP_NAME..."
  osascript -e "tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true
  for _ in {1..20}; do
    pgrep -x "$APP_NAME" >/dev/null 2>&1 || return 0
    sleep 0.5
  done
  pkill -x "$APP_NAME" || true
  sleep 1
  ! pgrep -x "$APP_NAME" >/dev/null 2>&1 || fail "$APP_NAME is still running. Quit it, then rerun this script."
}

designated_requirement() {
  codesign -d -r- "$1" 2>/dev/null | sed -n 's/^#* *designated => //p' || true
}

install_path="$INSTALL_ROOT/$APP_NAME.app"
use_sudo=false
as_installer() {
  if [[ "$use_sudo" == true ]]; then sudo "$@"; else "$@"; fi
}
mkdir -p "$INSTALL_ROOT" 2>/dev/null || true
if [[ ! -w "$INSTALL_ROOT" ]]; then
  sudo -v
  use_sudo=true
  as_installer mkdir -p "$INSTALL_ROOT"
fi

had_previous_install=false
previous_requirement=""
if [[ -d "$install_path" ]]; then
  had_previous_install=true
  previous_requirement="$(designated_requirement "$install_path")"
fi

quit_running_app

staging_path="$INSTALL_ROOT/.$APP_NAME.app.installing-$$"
as_installer rm -rf "$staging_path"
as_installer ditto "$app_path" "$staging_path" || fail "Could not copy the app into $INSTALL_ROOT"
as_installer xattr -dr com.apple.quarantine "$staging_path" 2>/dev/null || true

if [[ -d "$install_path" ]]; then
  backup_path="$INSTALL_ROOT/.$APP_NAME.app.previous"
  as_installer rm -rf "$backup_path"
  as_installer mv "$install_path" "$backup_path"
  if ! as_installer mv "$staging_path" "$install_path"; then
    as_installer mv "$backup_path" "$install_path"
    fail "Could not replace $install_path; the previous app was restored."
  fi
  as_installer rm -rf "$backup_path"
else
  as_installer mv "$staging_path" "$install_path"
fi
log "Installed: $install_path"

new_requirement="$(designated_requirement "$install_path")"
if [[ "$had_previous_install" == true && "$previous_requirement" != "$new_requirement" ]]; then
  log "The app's signature changed, so macOS would silently ignore the old permission grants. Resetting them."
  for service in Accessibility Microphone ListenEvent PostEvent; do
    tccutil reset "$service" "$BUNDLE_ID" >/dev/null 2>&1 || true
  done
  log "Grant Microphone and Accessibility again when OpenVocaly asks."
fi

if [[ "$LAUNCH_APP" == true ]]; then
  open "$install_path"
  sleep 5
  pgrep -x "$APP_NAME" >/dev/null 2>&1 ||
    fail "$APP_NAME exited right after launch. Run it from a terminal to see why: '$install_path/Contents/MacOS/$APP_NAME'"
  log "$APP_NAME is running."
fi
