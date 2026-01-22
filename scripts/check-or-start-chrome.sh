#!/usr/bin/env bash
# check-or-start-chrome.sh
# Self-healing Chrome script for Browser MCP tools
#
# This script:
# 1. Checks if Chrome is healthy on port 9222
# 2. If not, kills zombie processes and restarts Chrome
# 3. Waits for Chrome to become ready
#
# Exit codes:
#   0 = Chrome is healthy
#   1 = Chrome failed to start

set -euo pipefail

CHROME_PORT="${CHROME_PORT:-9222}"
CHROME_URL="http://localhost:${CHROME_PORT}/json/version"
MAX_RETRIES="${MAX_RETRIES:-15}"
SLEEP_SECONDS="${SLEEP_SECONDS:-1}"
LOG_FILE="${LOG_FILE:-/workspace/log/chrome-restart.log}"
# Use the same profile path as setup-mcp-tools.sh for consistency
CHROME_PROFILE="/tmp/chrome-debug-profile"

mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true

log() {
  echo "[chrome-health] $1"
  echo "$(date -Iseconds) $1" >> "${LOG_FILE}" 2>/dev/null || true
}

# 1. Quick check: is Chrome already responding?
if curl -s --max-time 3 "${CHROME_URL}" > /dev/null 2>&1; then
  log "Chrome already healthy on port ${CHROME_PORT}"
  exit 0
fi

log "Chrome not responding, attempting restart..."

# 2. Kill any existing Chrome processes on the debugging port
pkill -9 -f "remote-debugging-port=${CHROME_PORT}" 2>/dev/null || true
sleep 2

# 3. Clean up the profile directory to prevent stale lock issues
# This is critical: Chrome can fail to start if there's a stale SingletonLock
rm -rf "${CHROME_PROFILE}" 2>/dev/null || true

# 4. Find Chrome/Chromium executable (same order as setup-mcp-tools.sh)
CHROME_BIN=""
if [ -x "/usr/bin/chromium" ]; then
  CHROME_BIN="/usr/bin/chromium"
elif [ -x "/usr/bin/chromium-browser" ]; then
  CHROME_BIN="/usr/bin/chromium-browser"
elif [ -x "/usr/bin/google-chrome" ]; then
  CHROME_BIN="/usr/bin/google-chrome"
fi

if [ -z "$CHROME_BIN" ]; then
  log "ERROR: No Chrome/Chromium binary found"
  exit 1
fi

log "Starting Chrome: ${CHROME_BIN}"

# 5. Start Chrome with debugging enabled
# Matches setup-mcp-tools.sh flags exactly, plus stability flags
$CHROME_BIN \
  --headless=true \
  --remote-debugging-port=${CHROME_PORT} \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --user-data-dir="${CHROME_PROFILE}" \
  --disable-web-security \
  --disable-features=VizDisplayCompositor \
  > /dev/null 2>&1 &

CHROME_PID=$!
log "Chrome started (PID ${CHROME_PID}), waiting for ready..."

# 6. Wait for Chrome to become ready
for i in $(seq 1 "${MAX_RETRIES}"); do
  sleep "${SLEEP_SECONDS}"
  
  if curl -s --max-time 2 "${CHROME_URL}" > /dev/null 2>&1; then
    log "Chrome ready after ${i}s"
    exit 0
  fi
  
  # Check if process died
  if ! kill -0 "${CHROME_PID}" 2>/dev/null; then
    log "Chrome process died unexpectedly"
    break
  fi
done

log "ERROR: Chrome failed to start after ${MAX_RETRIES} attempts"
exit 1

