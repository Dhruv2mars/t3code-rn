#!/bin/sh
# Launch the debug macOS app against Metro and a locally built host sidecar.
#
# Usage: scripts/launch-dev-macos.sh [metroPort] [hostCjs] [nodeBin]
#
# Defaults: port 8083, hostCjs ../desktop-rn-host/dist/host.cjs when that
# package exists (U-003), nodeBin resolved from PATH. The app receives the
# sidecar location through T3CODE_RN_NODE_BIN / T3CODE_RN_HOST_CJS, which the
# T3SidecarSpawner native module exposes to JS via launchEnvironment().
set -eu

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8083}"

default_host_cjs() {
  sibling="$APP_ROOT/../desktop-rn-host/dist/host.cjs"
  if [ -f "$sibling" ]; then
    echo "$sibling"
  else
    echo ""
  fi
}

HOST_CJS="${2:-$(default_host_cjs)}"
NODE_BIN="${3:-$(command -v node)}"

APP_BIN="$APP_ROOT/macos/build/Build/Products/Debug/T3CodeRN-macOS.app/Contents/MacOS/T3CodeRN-macOS"
if [ ! -x "$APP_BIN" ]; then
  echo "debug app not built at $APP_BIN" >&2
  exit 1
fi
if [ -z "$HOST_CJS" ] || [ ! -f "$HOST_CJS" ]; then
  echo "sidecar dist not found; pass hostCjs as argument 2" >&2
  exit 1
fi
if [ -z "$NODE_BIN" ]; then
  echo "node binary not found on PATH; pass nodeBin as argument 3" >&2
  exit 1
fi

BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' \
  "$APP_ROOT/macos/build/Build/Products/Debug/T3CodeRN-macOS.app/Contents/Info.plist")"

restore_js_location() {
  defaults delete "$BUNDLE_ID" RCT_jsLocation >/dev/null 2>&1 || true
}
trap restore_js_location EXIT

defaults write "$BUNDLE_ID" RCT_jsLocation "localhost:$PORT"

echo "launching $APP_BIN (metro localhost:$PORT, sidecar $HOST_CJS)"
env T3CODE_RN_NODE_BIN="$NODE_BIN" T3CODE_RN_HOST_CJS="$HOST_CJS" "$APP_BIN"
