#!/usr/bin/env bash
# check-or-start-dev-server.sh
# Self-healing dev server script for Claude Code hooks
#
# This script:
# 1. Checks if the dev server is healthy
# 2. If not, attempts to restart it
# 3. On failure, dumps logs so the agent can diagnose and fix
#
# Exit codes:
#   0 = Server is healthy
#   1 = Server failed to start (logs dumped for agent to see)

set -euo pipefail

# Configuration - use Railway's PORT (defaults to 3000 if not set)
PORT="${PORT:-3000}"
HEALTH_PATH="${HEALTH_PATH:-/}"
SERVER_CMD="pnpm dev"
MAX_RETRIES="${MAX_RETRIES:-20}"
SLEEP_SECONDS="${SLEEP_SECONDS:-3}"
LOCK_WAIT_SECONDS="${LOCK_WAIT_SECONDS:-30}"
LOG_FILE="/workspace/log/dev-server.log"
HEALTH_URL="http://127.0.0.1:${PORT}${HEALTH_PATH}"
LOCK_DIR="/workspace/.dev-server-restart.lock"

# Ensure log directory exists
mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true

echo "[hook] Checking dev server at ${HEALTH_URL} ..."

# 1. Quick check: is server already up?
if curl -fsS --max-time 5 "${HEALTH_URL}" > /dev/null 2>&1; then
  echo "[hook] Server already running."
  exit 0
fi

# Also accept redirects (301, 302, etc.) as "healthy"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 5 "${HEALTH_URL}" 2>/dev/null || echo "000")
if [[ "${HTTP_CODE}" =~ ^(200|301|302|303|307|308)$ ]]; then
  echo "[hook] Server responding with ${HTTP_CODE}."
  exit 0
fi

echo "[hook] Server not responding (code: ${HTTP_CODE}), diagnosing..."

# Prevent multiple concurrent restarts (gates, hooks, monitor can all call this)
acquire_lock() {
  if mkdir "${LOCK_DIR}" 2>/dev/null; then
    trap 'rmdir "${LOCK_DIR}" 2>/dev/null || true' EXIT
    return 0
  fi
  return 1
}

if ! acquire_lock; then
  echo "[hook] Another restart is already in progress. Waiting up to ${LOCK_WAIT_SECONDS}s..."
  for _ in $(seq 1 "${LOCK_WAIT_SECONDS}"); do
    sleep 1
    if curl -fsS --max-time 5 "${HEALTH_URL}" > /dev/null 2>&1; then
      echo "[hook] Server became healthy while waiting for restart lock."
      exit 0
    fi
  done
  echo "[hook] Restart lock still held and server is not healthy. Exiting with failure."
  exit 1
fi

# Re-check health after acquiring lock (another caller may have fixed it)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 5 "${HEALTH_URL}" 2>/dev/null || echo "000")
if [[ "${HTTP_CODE}" =~ ^(200|301|302|303|307|308)$ ]]; then
  echo "[hook] Server responding with ${HTTP_CODE} (post-lock)."
  exit 0
fi

# 1.5. Check for TypeScript errors (informational only - don't block server startup)
# Resume builds may have TS errors in generated test files that don't prevent Next.js from working
# Next.js with Turbopack CAN run with TypeScript errors - it shows them in the browser
echo "[hook] Checking for TypeScript compilation errors..."
TS_ERRORS=""
if ! npx tsc --noEmit 2>&1; then
  TS_ERRORS="true"
  echo ""
  echo "[hook] ⚠️ TypeScript errors detected (may be in test files - will try to start anyway)"
else
  echo "[hook] ✅ TypeScript compilation OK"
fi

echo "[hook] Attempting to start server..."
echo "[hook] Command: ${SERVER_CMD}"

# 2. Kill any existing process on the port
if command -v fuser > /dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
  sleep 1
elif command -v lsof > /dev/null 2>&1; then
  PID_ON_PORT="$(lsof -t -i:"${PORT}" 2>/dev/null || true)"
  if [[ -n "${PID_ON_PORT}" ]]; then
    echo "[hook] Killing existing process on port ${PORT} (PID ${PID_ON_PORT})"
    kill "${PID_ON_PORT}" 2>/dev/null || true
    sleep 1
  fi
fi

# 3. Clear Next.js cache (prevents stale build errors)
if [[ -d "/workspace/.next/cache" ]]; then
  echo "[hook] Clearing Next.js cache..."
  rm -rf /workspace/.next/cache 2>/dev/null || true
fi

# 4. Start the server in background
cd /workspace
mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true
echo "[hook] Starting server on port ${PORT}, logging to ${LOG_FILE}..."
# Builder runs should be resilient to non-deterministic external image hosts (LLM placeholders).
# Set SAMUS_BUILDER=1 for the Next.js process so next.config can disable image optimization safely.
nohup env SAMUS_BUILDER="${SAMUS_BUILDER:-1}" ${SERVER_CMD} > "${LOG_FILE}" 2>&1 &
SERVER_PID=$!
echo "[hook] Started server (PID ${SERVER_PID}), waiting for it to become healthy..."

# 5. Wait/retry for health
for i in $(seq 1 "${MAX_RETRIES}"); do
  sleep "${SLEEP_SECONDS}"
  
  # Check health
  if curl -fsS --max-time 5 "${HEALTH_URL}" > /dev/null 2>&1; then
    echo "[hook] Server is up and healthy after ${i} checks."
    exit 0
  fi
  
  # Also accept redirects
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 5 "${HEALTH_URL}" 2>/dev/null || echo "000")
  if [[ "${HTTP_CODE}" =~ ^(200|301|302|303|307|308)$ ]]; then
    echo "[hook] Server responding with ${HTTP_CODE} after ${i} checks."
    exit 0
  fi
  
  # Check if process is still running
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    echo "[hook] Server process died unexpectedly!"
    break
  fi
  
  echo "[hook] Still not up (attempt ${i}/${MAX_RETRIES}, code: ${HTTP_CODE}), waiting..."
done

# 6. Failed to start / become healthy
echo ""
echo "========================================"
echo "[hook] ERROR: Server failed to become healthy after ${MAX_RETRIES} attempts."
if [[ -n "${TS_ERRORS}" ]]; then
  echo "[hook] ⚠️ TypeScript errors were detected earlier - these may be the cause."
  echo "[hook] Run 'npx tsc --noEmit' to see the errors."
fi
echo "[hook] Dumping last 100 lines of log to help you debug:"
echo "========================================"
echo ""

if [[ -f "${LOG_FILE}" ]]; then
  tail -n 100 "${LOG_FILE}" || echo "[hook] (Could not read log file)"
else
  echo "[hook] (No log file found at ${LOG_FILE})"
fi

echo ""
echo "========================================"
echo "[hook] Please fix the error above and try again."
echo "========================================"

exit 1
