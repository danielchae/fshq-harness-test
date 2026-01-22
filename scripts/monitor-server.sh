#!/bin/bash
# Server monitoring and recovery script for platform starter
#
# This is a BACKGROUND SAFETY NET that runs every 3 minutes.
# It provides a third layer of server health protection:
#
# Layer 1: Claude Code hooks (.claude/hooks.json)
#   - Runs check-or-start-dev-server.sh after every file write
#   - Gives instant feedback to agent when build breaks
#   - Agent can fix errors immediately
#
# Layer 2: check-or-start-dev-server.sh
#   - Self-healing script that starts/restarts server
#   - Called by hooks and at startup
#
# Layer 3: This script (monitor-server.sh)
#   - Background process checking every 3 minutes
#   - Catches edge cases where hooks didn't fire
#   - Handles external crashes (memory, etc.)

set -euo pipefail

log_info() {
  echo "[server-monitor] $(date '+%H:%M:%S') $1"
}

log_error() {
  echo "[server-monitor] $(date '+%H:%M:%S') ❌ $1" >&2
}

# Function to check server health
check_server_health() {
  local max_retries=3
  local retry_count=0
  
  # Use PORT from environment (Railway sets this)
  local port="${PORT:-3000}"
  
  while [ $retry_count -lt $max_retries ]; do
    response=$(curl -s -o /dev/null -w "%{http_code}" -L --max-time 10 http://127.0.0.1:${port} 2>/dev/null || echo "000")
    
    case $response in
      200|201|204)
        return 0
        ;;
      301|302|303|307|308)
        return 0
        ;;
      500|502|503)
        log_error "Server returned error code: $response"
        return 1
        ;;
      000)
        log_error "Failed to connect to server (timeout or connection refused)"
        return 1
        ;;
      *)
        if [ "$response" -ge 400 ] && [ "$response" -lt 500 ]; then
          return 0
        else
          log_info "Unexpected response code: $response, retrying..."
          sleep 2
          retry_count=$((retry_count + 1))
        fi
        ;;
    esac
  done
  
  return 1
}

restart_server() {
  local port="${PORT:-3000}"
  log_info "Restarting dev server on port ${port} (via check-or-start-dev-server.sh)..."

  if [ -f "/workspace/scripts/check-or-start-dev-server.sh" ]; then
    bash /workspace/scripts/check-or-start-dev-server.sh || return 1
    log_info "Server restart script completed"
    return 0
  fi

  log_error "check-or-start-dev-server.sh not found at /workspace/scripts/check-or-start-dev-server.sh"
    return 1
}

# Main monitoring loop
monitor_server() {
  local check_interval=${1:-180}
  
  log_info "Starting server health monitoring (interval: ${check_interval}s)"
  
  while true; do
    if ! check_server_health; then
      log_error "Server health check failed"
      
      if restart_server; then
        log_info "Server successfully restarted"
        sleep 20
      else
        log_error "Failed to restart server"
        sleep 30
      fi
    fi
    
    sleep $check_interval
  done
}

# If running as a script
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
  monitor_server "${1:-180}"
fi
