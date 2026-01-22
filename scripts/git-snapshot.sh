#!/bin/bash
# git-snapshot.sh - Create a snapshot branch of current repository state
#
# Usage:
#   git-snapshot.sh <phase-id>  # Create snapshot for specified phase
#
# This script:
# 1. Preserves current work by committing any changes
# 2. Creates a new snapshot branch
# 3. Pushes the branch to GitHub
# 4. Returns to original branch
# 5. Sends Inngest notification

set -e

# Parse command line arguments
PHASE_ID="${1:-unknown}"

# Colors for output - use printf for better compatibility
if [ -t 1 ] && [ "${NO_COLOR:-}" != "1" ]; then
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    RED='\033[0;31m'
    NC='\033[0m' # No Color
else
    GREEN=''
    YELLOW=''
    BLUE=''
    RED=''
    NC=''
fi

# Add error trap for better error reporting
trap 'printf "${RED}Error occurred at line $LINENO with exit code $?${NC}\n"; exit 1' ERR

printf "${BLUE}=====================================${NC}\n"
printf "${BLUE}  Git Snapshot (${PHASE_ID})${NC}\n"
printf "${BLUE}=====================================${NC}\n"

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    printf "${RED}❌ Error: Not in a git repository${NC}\n"
    exit 1
fi

# Check if origin remote exists
if ! git remote get-url origin >/dev/null 2>&1; then
    printf "${RED}❌ Error: No GitHub remote configured${NC}\n"
    exit 1
fi

# Extract repository name from env or git remote
get_repository_name() {
    if [ -n "${GITHUB_REPOSITORY:-}" ]; then
        echo "$GITHUB_REPOSITORY"
        return
    fi
    local remote_url=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ "$remote_url" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
        echo "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
        return
    fi
    echo ""
}

# Send Inngest event notification
send_inngest_event() {
    local event_name="$1"
    local payload="$2"
    
    if [ -z "$INNGEST_EVENT_KEY" ]; then
        printf "${YELLOW}⚠️  INNGEST_EVENT_KEY not set - skipping notification${NC}\n"
        return 0
    fi
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "https://inn.gs/e/${INNGEST_EVENT_KEY}" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"${event_name}\", \"data\": ${payload}}")
    
    local body=$(echo "$response" | head -n -1)
    local http_code=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "202" ]; then
        printf "${GREEN}✅ Inngest notification sent successfully${NC}\n"
    else
        printf "${YELLOW}⚠️  Inngest notification failed (HTTP ${http_code})${NC}\n"
        printf "${YELLOW}   Response: ${body}${NC}\n"
    fi
}

# Extract build identifier from Railway service name (e.g., "closetcanvas-build-2" -> "build-2", "fshq-rebuild-4" -> "rebuild-4")
BUILD_BRANCH=$(echo "${RAILWAY_SERVICE_NAME:-}" | grep -oE '(re)?build-[0-9]+' || echo "")
if [ -z "$BUILD_BRANCH" ]; then
    BUILD_BRANCH="local"
fi

TIMESTAMP=$(date +%m%d-%H%M)
SNAPSHOT_BRANCH="${BUILD_BRANCH}-snapshot-${PHASE_ID}-${TIMESTAMP}"

# Save current git branch for returning after push
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
    CURRENT_BRANCH=$(git rev-parse HEAD)
    printf "${YELLOW}⚠️  Detached HEAD state, will return to ${CURRENT_BRANCH}${NC}\n"
fi

printf "${YELLOW}🌿 Build: ${BUILD_BRANCH}${NC}\n"
printf "${YELLOW}🌿 Snapshot: ${SNAPSHOT_BRANCH}${NC}\n"

# Ensure critical directories are in .gitignore to prevent multi-GB pushes
# These directories can be 3-6GB and would exceed GitHub's 2GiB push limit
GITIGNORE_FILE=".gitignore"
CRITICAL_IGNORES=(".next" "node_modules" ".pnpm-store" "*.tsbuildinfo" ".turbo")

for ignore_entry in "${CRITICAL_IGNORES[@]}"; do
    if [ -f "$GITIGNORE_FILE" ]; then
        if ! grep -q "^${ignore_entry}$\|^${ignore_entry}/$" "$GITIGNORE_FILE" 2>/dev/null; then
            echo "${ignore_entry}/" >> "$GITIGNORE_FILE"
            printf "${YELLOW}⚠️  Added ${ignore_entry} to .gitignore (prevents push failures)${NC}\n"
        fi
    else
        echo "${ignore_entry}/" >> "$GITIGNORE_FILE"
        printf "${YELLOW}⚠️  Created .gitignore with ${ignore_entry}${NC}\n"
    fi
done

# Commit any uncommitted changes to preserve them
if [ -n "$(git status --porcelain)" ]; then
    printf "${BLUE}💾 Saving current work...${NC}\n"
    git add -A >/dev/null 2>&1
    git commit -m "WIP: Uncommitted changes before ${PHASE_ID} snapshot" --quiet || true
fi

# Create and checkout new branch
printf "${BLUE}🌿 Creating snapshot branch...${NC}\n"
git checkout -b "$SNAPSHOT_BRANCH" --quiet

# Configure git for large file transfers and slow connections
git config http.postBuffer 524288000 2>/dev/null || true    # 500MB buffer
git config protocol.version 2 2>/dev/null || true
git config http.lowSpeedLimit 1000 2>/dev/null || true      # bytes/sec minimum
git config http.lowSpeedTime 60 2>/dev/null || true         # allow slow transfers for 60s

# Push to origin
printf "${BLUE}🚀 Pushing snapshot branch to GitHub...${NC}\n"

# Generate fresh GitHub App token for push
push_success=false
if [ -n "${GITHUB_APP_ID:-}" ] && [ -n "${GITHUB_APP_INSTALLATION_ID:-}" ]; then
    printf "${BLUE}Generating fresh GitHub App token...${NC}\n"
    
    # Token generator is always at /app/ in Docker environment
    TOKEN_SCRIPT="/app/generate-github-token.js"
    
    if [ ! -f "$TOKEN_SCRIPT" ]; then
        printf "${RED}❌ GitHub token generator not found at ${TOKEN_SCRIPT}${NC}\n"
        git checkout "$CURRENT_BRANCH" --quiet 2>/dev/null || true
        exit 1
    fi
    
    TOKEN=$(node -e "
        const { getGitHubAppToken } = require('${TOKEN_SCRIPT}');
        getGitHubAppToken()
            .then(token => console.log(token))
            .catch(err => {
                console.error('Error:', err.message);
                process.exit(1);
            });
    " 2>&1)
    TOKEN_EXIT_CODE=$?
    
    if [ -z "$TOKEN" ] || [ $TOKEN_EXIT_CODE -ne 0 ]; then
        printf "${RED}❌ Failed to generate GitHub token${NC}\n"
        printf "${RED}   Error: ${TOKEN}${NC}\n"
        git checkout "$CURRENT_BRANCH" --quiet 2>/dev/null || true
        exit 1
    fi
    
    printf "${GREEN}✅ Token generated${NC}\n"
    
    # Use token in push operation
    ORIGIN_URL=$(git remote get-url origin)
    CLEAN_URL=$(echo "$ORIGIN_URL" | sed 's|://[^@]*@|://|')
    AUTH_URL=$(echo "$CLEAN_URL" | sed "s|https://|https://x-access-token:${TOKEN}@|")
    
    git remote set-url origin "$AUTH_URL"
    
    # Log push size for debugging - helps diagnose failures
    COMMIT_COUNT=$(git rev-list --count HEAD 2>/dev/null || echo "?")
    FILE_COUNT=$(git ls-files | wc -l | tr -d ' ')
    # Estimate repo size (du on .git is rough but useful)
    REPO_SIZE_MB=$(du -sm .git 2>/dev/null | cut -f1 || echo "?")
    printf "${BLUE}📊 Push stats: ${COMMIT_COUNT} commits, ${FILE_COUNT} files, ~${REPO_SIZE_MB}MB repo${NC}\n"
    
    # Warn if repo is approaching GitHub's 2GB push limit
    if [ "$REPO_SIZE_MB" != "?" ] && [ "$REPO_SIZE_MB" -gt 1500 ]; then
        printf "${YELLOW}⚠️  Large repository (${REPO_SIZE_MB}MB) - push may be slow or fail${NC}\n"
        printf "${YELLOW}   GitHub has a 2GB push limit. Consider reducing repo size.${NC}\n"
    fi
    
    # Retry logic with exponential backoff
    MAX_RETRIES=5  # Increased from 3 to handle transient GitHub issues
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        # Capture git push output (remote messages can be noisy). Use command success as the source of truth.
        PUSH_OUTPUT=""
        if PUSH_OUTPUT="$(git push -u origin "$SNAPSHOT_BRANCH" --quiet 2>&1)"; then
            push_success=true
            break
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                # Exponential backoff: 5, 10, 20, 40 seconds
                WAIT_TIME=$((5 * (2 ** ($RETRY_COUNT - 1))))
                # Cap at 60 seconds
                if [ $WAIT_TIME -gt 60 ]; then WAIT_TIME=60; fi
                printf "${YELLOW}⚠️  Push attempt ${RETRY_COUNT}/${MAX_RETRIES} failed${NC}\n"
                printf "${YELLOW}   GitHub may be experiencing issues. Retrying in ${WAIT_TIME} seconds...${NC}\n"
                sleep $WAIT_TIME
                
                # Regenerate token on retry
                printf "${BLUE}   Refreshing GitHub token...${NC}\n"
                NEW_TOKEN=$(node -e "
                    const { getGitHubAppToken } = require('/app/generate-github-token.js');
                    getGitHubAppToken()
                        .then(token => console.log(token))
                        .catch(err => process.exit(1));
                " 2>/dev/null)
                
                if [ -n "$NEW_TOKEN" ]; then
                    AUTH_URL=$(echo "$CLEAN_URL" | sed "s|https://|https://x-access-token:${NEW_TOKEN}@|")
                    git remote set-url origin "$AUTH_URL"
                    printf "${GREEN}   Token refreshed${NC}\n"
                fi
            fi
        fi
    done
    
    # Reset remote URL to remove token
    git remote set-url origin "$ORIGIN_URL"
else
    printf "${RED}❌ GitHub App credentials not available${NC}\n"
    git checkout "$CURRENT_BRANCH" --quiet 2>/dev/null || true
    exit 1
fi

# Return to original branch
printf "${BLUE}↩️  Returning to ${CURRENT_BRANCH}...${NC}\n"
if [[ "$CURRENT_BRANCH" =~ ^[0-9a-f]{40}$ ]]; then
    # Return to specific commit for detached HEAD
    git checkout "$CURRENT_BRANCH" --quiet 2>/dev/null || true
else
    # Return to branch
    git checkout "$CURRENT_BRANCH" --quiet
fi

# Send Inngest notification if push was successful
if [ "$push_success" = true ]; then
    # Extract repository path for URL
    REPO_NAME=$(get_repository_name)
    REPO_PATH="$REPO_NAME"
    
    printf "${GREEN}✅ Snapshot pushed: ${SNAPSHOT_BRANCH}${NC}\n"
    if [ -n "$REPO_PATH" ]; then
        printf "${GREEN}🔗 https://github.com/${REPO_PATH}/tree/${SNAPSHOT_BRANCH}${NC}\n"
    fi
    
    # Send Inngest event for success
    # Use 'success' for final build, otherwise use phase-specific status
    if [ "$PHASE_ID" = "final" ]; then
        STATUS="success"
    else
        STATUS="${PHASE_ID}-complete"
    fi
    PAYLOAD=$(cat <<EOF
{
  "status": "${STATUS}",
  "branch": "${BUILD_BRANCH}",
  "snapshotBranch": "${SNAPSHOT_BRANCH}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "repositoryName": "${REPO_NAME}"
}
EOF
)
    send_inngest_event "builder/output.ready" "$PAYLOAD"
    
    # Output parseable snapshot branch name for orchestrator to capture
    printf "SNAPSHOT_BRANCH: ${SNAPSHOT_BRANCH}\n"
else
    printf "${RED}❌ Push failed after ${MAX_RETRIES} attempts${NC}\n"
    printf "${YELLOW}   This is usually a transient GitHub issue (HTTP 500).${NC}\n"
    printf "${YELLOW}   The build will continue - snapshot is non-critical.${NC}\n"
    
    # Send failure notification
    REPO_NAME=$(get_repository_name)
    PAYLOAD=$(cat <<EOF
{
  "status": "failure",
  "error": "Push failed after ${MAX_RETRIES} attempts",
  "branch": "${BUILD_BRANCH}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "repositoryName": "${REPO_NAME}"
}
EOF
)
    send_inngest_event "builder/output.ready" "$PAYLOAD"
    
    exit 1
fi
