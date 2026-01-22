#!/bin/bash

# setup-mcp-tools.sh
# Configure MCP servers for both Claude and Gemini CLI.
# - Starts Chrome with debugging port for Chrome DevTools MCP
# - Registers MCP servers with Gemini CLI when configured

set -euo pipefail

log_info() {
  echo "[setup-mcp-tools] $1"
}

log_warn() {
  echo "[setup-mcp-tools] ⚠️  $1" >&2
}

log_error() {
  echo "[setup-mcp-tools] ❌ $1" >&2
}

log_success() {
  echo "[setup-mcp-tools] ✅ $1"
}

# --- Create required directories ----------------------------------------------
mkdir -p /workspace/log
mkdir -p /workspace/.gemini

# --- Claude MCP Config (.mcp.json) -------------------------------------------
# Claude CLI can load MCP servers from a config file passed via --mcp-config.
# We create a minimal project config so phase/gate runs (one-shot `claude` calls)
# still have access to chrome-devtools tools.
CLAUDE_MCP_CONFIG="/workspace/.mcp.json"
if [ ! -f "$CLAUDE_MCP_CONFIG" ]; then
  cat > "$CLAUDE_MCP_CONFIG" << 'MCPEOF'
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "chrome-devtools-mcp@latest",
        "--browserUrl=http://localhost:9222",
        "--isolated=true",
        "--viewport=1920x1080",
        "--acceptInsecureCerts=true",
        "--logFile=/workspace/log/chrome-devtools.log"
      ]
    }
  }
}
MCPEOF
  log_success "Created Claude MCP config at $CLAUDE_MCP_CONFIG"
else
  log_info "Claude MCP config already exists at $CLAUDE_MCP_CONFIG"
fi

# --- Chrome Setup (for Chrome DevTools MCP) ---------------------------------
# Provides browser automation tools for UI testing and validation
# Docs: https://github.com/ChromeDevTools/chrome-devtools-mcp

CHROME_READY=false

# Start Chrome with debugging if not already running
if ! pgrep -f "remote-debugging-port=9222" > /dev/null; then
  log_info "Starting Chrome with remote debugging on port 9222..."
  
  # Find Chrome/Chromium executable
  CHROME_BIN=""
  if [ -x "/usr/bin/chromium" ]; then
    CHROME_BIN="/usr/bin/chromium"
    log_info "Using Chromium browser"
  elif [ -x "/usr/bin/chromium-browser" ]; then
    CHROME_BIN="/usr/bin/chromium-browser"
    log_info "Using Chromium browser"
  elif [ -x "/usr/bin/google-chrome" ]; then
    CHROME_BIN="/usr/bin/google-chrome"
    log_info "Using Google Chrome"
  fi
  
  if [ -n "$CHROME_BIN" ]; then
    # Start Chrome in background with debugging (following Docker best practices)
    $CHROME_BIN \
      --headless=true \
      --remote-debugging-port=9222 \
      --no-sandbox \
      --disable-setuid-sandbox \
      --disable-dev-shm-usage \
      --disable-gpu \
      --user-data-dir="/tmp/chrome-debug-profile" \
      --disable-web-security \
      --disable-features=VizDisplayCompositor \
      > /dev/null 2>&1 &
    
    # Wait for Chrome to start (up to 10 seconds)
    for i in 1 2 3 4 5 6 7 8 9 10; do
      if curl -s http://localhost:9222/json/version > /dev/null 2>&1; then
        CHROME_READY=true
        break
      fi
      sleep 1
    done
    
    if [ "$CHROME_READY" = true ]; then
      log_success "Chrome debugging ready on port 9222"
    else
      log_warn "Chrome may not have started correctly - MCP browser tools may fail"
    fi
  else
    log_warn "No Chrome/Chromium binary found - browser testing will not work"
  fi
else
  log_info "Chrome debugging already running on port 9222"
  if curl -s http://localhost:9222/json/version > /dev/null 2>&1; then
    CHROME_READY=true
    log_success "Chrome DevTools protocol accessible"
  fi
fi

# --- Playwright Setup (for E2E test gates) ----------------------------------
# Configures Playwright to use system Chromium for test execution
log_info "Configuring Playwright for E2E test gates..."

# Create test directory structure
mkdir -p /workspace/tests/e2e/generated
mkdir -p /workspace/tests/e2e/fixtures
mkdir -p /workspace/test-results

# Create Playwright config if not exists
PLAYWRIGHT_CONFIG="/workspace/playwright.config.ts"
if [ ! -f "$PLAYWRIGHT_CONFIG" ]; then
  cat > "$PLAYWRIGHT_CONFIG" << 'PWEOF'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      // Only set executablePath when env var is provided (Docker)
      // Otherwise let Playwright find/download its own browser (local dev)
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      }),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    }
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests/e2e/fixtures',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      testDir: './tests/e2e/generated',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/fixtures/auth.json'
      },
      dependencies: ['setup']
    }
  ],
  webServer: {
    command: 'echo "Using existing dev server on port 3000"',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 5000
  }
});
PWEOF
  log_success "Created Playwright config at $PLAYWRIGHT_CONFIG"
else
  log_info "Playwright config already exists"
fi

# Create auth setup test for generating authenticated state
# Uses API-based auth to bypass React controlled input issues with browser automation
AUTH_SETUP_FILE="/workspace/tests/e2e/fixtures/auth.setup.ts"
if [ ! -f "$AUTH_SETUP_FILE" ]; then
  cat > "$AUTH_SETUP_FILE" << 'AUTHEOF'
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, 'auth.json');

setup('authenticate test user', async ({ page, context }) => {
  const baseURL = 'http://localhost:3000';
  
  // Step 1: Get CSRF token from NextAuth
  const csrfResponse = await context.request.get(`${baseURL}/api/auth/csrf`);
  const csrfData = await csrfResponse.json();
  const csrfToken = csrfData.csrfToken;
  
  // Step 2: Authenticate via NextAuth credentials API directly
  // This bypasses UI form issues with React controlled inputs
  await context.request.post(`${baseURL}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email: 'test@samus.ai',
      password: '12345',
      json: 'true',
    },
  });
  
  // Step 3: Verify authentication succeeded
  const sessionResponse = await context.request.get(`${baseURL}/api/auth/session`);
  const session = await sessionResponse.json();
  
  if (!session?.user?.email) {
    throw new Error('Authentication failed - no session created');
  }
  
  // Step 4: Navigate to dashboard to populate page cookies
  await page.goto(`${baseURL}/dashboard`, { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/dashboard/);
  
  // Step 5: Save auth state
  await page.context().storageState({ path: authFile });
});
AUTHEOF
  log_success "Created Playwright auth setup at $AUTH_SETUP_FILE"
else
  log_info "Playwright auth setup already exists"
fi

# Create empty auth.json if it doesn't exist (will be populated by setup test)
if [ ! -f "/workspace/tests/e2e/fixtures/auth.json" ]; then
  echo '{"cookies":[],"origins":[]}' > /workspace/tests/e2e/fixtures/auth.json
  log_info "Created placeholder auth.json"
fi

# Playwright was installed globally in Dockerfile - just log status
log_success "Playwright E2E test infrastructure ready"

# --- Vitest Setup (for backend unit/integration tests) -----------------------
# Backend tests use Vitest to directly test Server Actions, Fetchers, and Models
log_info "Configuring Vitest for backend tests..."

# Create backend test directory structure
mkdir -p /workspace/tests/backend

# Create Vitest config if not exists
VITEST_CONFIG="/workspace/vitest.config.ts"
if [ ! -f "$VITEST_CONFIG" ]; then
  cat > "$VITEST_CONFIG" << 'VITESTEOF'
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/backend/**/*.test.ts'],
    setupFiles: ['tests/backend/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['verbose', 'json'],
    outputFile: {
      json: 'test-results/vitest-results.json'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
VITESTEOF
  log_success "Created Vitest config at $VITEST_CONFIG"
else
  log_info "Vitest config already exists"
fi

# Create backend test setup file if not exists
VITEST_SETUP="/workspace/tests/backend/setup.ts"
if [ ! -f "$VITEST_SETUP" ]; then
  cat > "$VITEST_SETUP" << 'SETUPEOF'
import { beforeAll, afterAll, afterEach } from 'vitest';

// Import prisma client - will be available after workspace setup
let prisma: any;

beforeAll(async () => {
  try {
    // Dynamic import to handle case where @/lib/db doesn't exist yet
    const { prisma: prismaClient } = await import('@/lib/db');
    prisma = prismaClient;
  } catch (e) {
    console.log('[vitest setup] Prisma client not available yet - tests will import directly');
  }
});

afterEach(async () => {
  // Clean up test data after each test
  // Tests should prefix test data with TEST_ for easy cleanup
  if (prisma) {
    try {
      // Add model-specific cleanup as needed
      // Example: await prisma.someModel.deleteMany({ where: { name: { startsWith: 'TEST_' } } });
    } catch (e) {
      // Ignore cleanup errors - model might not exist yet
    }
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});
SETUPEOF
  log_success "Created Vitest setup at $VITEST_SETUP"
else
  log_info "Vitest setup already exists"
fi

log_success "Vitest backend test infrastructure ready"

# --- Determine which providers need MCP configuration -----------------------
WORKFLOW_CONFIG="/workspace/workflow.json"
NEEDS_GEMINI_MCP=false

if [ -f "$WORKFLOW_CONFIG" ] && command -v jq >/dev/null 2>&1; then
  # Check if either provider or continuousTestingProvider is gemini
  DIRECT_AGENT_PROVIDER=$(jq -r '.settings.directAgent.provider // empty' "$WORKFLOW_CONFIG" 2>/dev/null || echo "")
  CONTINUOUS_TESTING_PROVIDER=$(jq -r '.settings.directAgent.continuousTestingProvider // empty' "$WORKFLOW_CONFIG" 2>/dev/null || echo "")
  
  if [ "$DIRECT_AGENT_PROVIDER" = "gemini" ] || [ "$CONTINUOUS_TESTING_PROVIDER" = "gemini" ]; then
    NEEDS_GEMINI_MCP=true
  fi
fi

# --- Gemini CLI MCP Configuration -------------------------------------------
if [ "$NEEDS_GEMINI_MCP" = true ]; then
  log_info "Configuring MCP servers for Gemini CLI..."
  
  # Check Gemini CLI availability
  if ! command -v gemini >/dev/null 2>&1; then
    log_warn "Gemini CLI not found on PATH. Install @google/gemini-cli@latest"
  elif [ -z "${GEMINI_API_KEY:-}" ]; then
    log_warn "GEMINI_API_KEY is not set. Gemini CLI commands will fail."
  else
    log_info "GEMINI_API_KEY detected"
    
    # Register chrome-devtools MCP with Gemini CLI
    # Using --trust to auto-approve tool calls (same as --yolo mode)
    # Using --scope=project to store in .gemini/settings.json
    MCP_ARGS=(
      "chrome-devtools"
      "npx"
      "chrome-devtools-mcp@latest"
      "--browserUrl=http://localhost:9222"
      "--isolated=true"
      "--headless=true"
      "--viewport=1920x1080"
      "--acceptInsecureCerts=true"
      "--logFile=/workspace/log/chrome-devtools.log"
      "--scope=project"
      "--trust"
    )
    
    if (cd /workspace && gemini mcp add "${MCP_ARGS[@]}" 2>/dev/null); then
      log_success "Registered chrome-devtools MCP server with Gemini CLI"
    else
      # May already be added, try to verify
      if (cd /workspace && gemini mcp list 2>/dev/null | grep -q "chrome-devtools"); then
        log_info "chrome-devtools MCP already registered with Gemini CLI"
      else
        log_warn "Could not register chrome-devtools MCP with Gemini CLI"
      fi
    fi
    
    # Verify MCP connection status
    if [ "$CHROME_READY" = true ]; then
      log_success "MCP browser tools should be available (Chrome running)"
    else
      log_warn "Chrome not running - Gemini MCP browser tools will be unavailable"
    fi
  fi
fi

# --- Summary -----------------------------------------------------------------
log_info "MCP and testing setup complete"
if [ "$CHROME_READY" = true ]; then
  log_info "Browser automation: ENABLED (Chrome on port 9222)"
else
  log_info "Browser automation: DISABLED (no Chrome)"
fi
log_info "Playwright E2E: ENABLED (frontend tests in /workspace/tests/e2e/)"
log_info "Vitest Backend: ENABLED (backend tests in /workspace/tests/backend/)"
