#!/usr/bin/env bash
# block-dangerous-commands.sh
# PreToolUse hook to block commands that can kill the orchestrator
#
# Exit codes:
#   0 = Allow command
#   2 = Block command (Claude Code convention)

set -eu

# Read the command from stdin (JSON input from Claude Code)
input=$(cat)

# Extract the bash command - handle both .tool_input.command and .input.command formats
cmd=$(echo "$input" | jq -r '.tool_input.command // .input.command // empty' 2>/dev/null || echo "")

# If we couldn't extract a command, allow it (might be a different tool format)
if [[ -z "$cmd" ]]; then
  exit 0
fi

# Dangerous patterns that can kill the orchestrator or crash the build
# These are regex patterns matched against the full command
BLOCKED_PATTERNS=(
  # Process killing that can hit the orchestrator
  'pkill\s+(-[0-9a-zA-Z]+\s+)*-f\s+["'"'"']?node'
  'pkill\s+(-[0-9a-zA-Z]+\s+)*-f\s+["'"'"']?orchestrator'
  'pkill\s+(-[0-9a-zA-Z]+\s+)*node([^a-z]|$)'
  'killall\s+node'
  'kill\s+.*\$\(.*node'
  'kill\s+-[0-9]+\s+.*node'
  
  # Production builds (cause resource exhaustion)
  'npm\s+run\s+build'
  'pnpm\s+(run\s+)?build'
  'yarn\s+(run\s+)?build'
  'next\s+build'
  
  # Recursive deletion of critical paths
  # Match /workspace or /workspace/ but NOT /workspace/subdir
  'rm\s+-rf\s+/workspace/?(\s|;|&|\||$)'
  'rm\s+-rf\s+/app/?(\s|;|&|\||$)'
  'rm\s+-rf\s+~'
  'rm\s+-rf\s+/(\s|;|&|\||$)'
)

# Check each pattern
for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$cmd" | grep -qiE "$pattern"; then
    cat >&2 << EOF
╔══════════════════════════════════════════════════════════════════╗
║ 🚫 BLOCKED: Dangerous command detected                           ║
╠══════════════════════════════════════════════════════════════════╣
║ Pattern matched: $pattern                                        ║
║ Command: $cmd                                                    ║
╚══════════════════════════════════════════════════════════════════╝
EOF
    exit 2  # Exit code 2 = block execution in Claude Code
  fi
done

# Command is safe, allow it
exit 0
