#!/usr/bin/env node

/**
 * Gate 2 Composite Validator (Frontend Build Tasks)
 * 
 * Runs Playwright E2E tests for the specific task being validated.
 * This is the "science" part - deterministic, reproducible validation.
 * 
 * If tests pass → gate passes
 * If tests fail → gate fails with specific failure details for retry
 * If no tests exist → gate skips (allows tasks without E2E tests)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Strip ANSI escape codes from text
 * Based on https://github.com/chalk/ansi-regex (MIT licensed)
 */
function stripAnsi(text) {
  if (typeof text !== 'string') return text;
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u001B\u009B][[()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TXZcf-nq-uy=><~]))/g, '');
}

// Get task context from environment (set by phase-executor)
const BUILD_UNIT_ID = process.env.BUILD_UNIT_ID || '';
const PORT = process.env.PORT || 3000;
const LOG_FILE = '/workspace/log/dev-server.log';

/**
 * Check if dev server is healthy
 */
function checkServerHealth() {
  try {
    const response = execSync(
      `curl -s -o /dev/null -w "%{http_code}" -L --max-time 5 http://127.0.0.1:${PORT} 2>/dev/null || echo "000"`,
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();
    return ['200', '301', '302', '303', '307', '308'].includes(response);
  } catch (e) {
    return false;
  }
}

/**
 * Check for TypeScript compilation errors
 * Returns { hasErrors: boolean, errors?: string }
 */
function checkTypeScriptCompilation() {
  const baseDir = process.cwd();
  
  try {
    // Run TypeScript check without emitting
    execSync('npx tsc --noEmit --pretty 2>&1', {
      cwd: baseDir,
      encoding: 'utf-8',
      timeout: 60000,
      stdio: 'pipe'
    });
    return { hasErrors: false };
  } catch (e) {
    const output = e.stdout || e.stderr || e.message || '';
    // IMPORTANT: JS gates must emit JSON ONLY on stdout (orchestrator parses stdout).
    // Use stderr for all human-readable logs.
    console.error('\n========================================');
    console.error('❌ TYPESCRIPT COMPILATION ERRORS DETECTED');
    console.error('========================================');
    console.error(output.substring(0, 3000));
    console.error('========================================\n');
    
    return {
      hasErrors: true,
      errors: output.substring(0, 3000)
    };
  }
}

/**
 * Dump dev server logs for Railway visibility
 * Outputs to BOTH stdout (Railway captures) and stderr
 */
function dumpServerLogs() {
  const logLines = [];
  
  if (fs.existsSync(LOG_FILE)) {
    try {
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const lines = content.split('\n').slice(-100); // Last 100 lines
      
      console.error('\n========================================');
      console.error('📋 DEV SERVER LOG (last 100 lines)');
      console.error('========================================');
      for (const line of lines) {
        console.error(line);
        logLines.push(line);
      }
      console.error('========================================\n');
      
      return logLines.join('\n');
    } catch (e) {
      console.error(`[gate] Could not read log file: ${e.message}`);
    }
  } else {
    console.error(`[gate] No log file found at ${LOG_FILE}`);
  }
  
  return '';
}

/**
 * Ensure dev server is running before tests
 * Returns { healthy: boolean, error?: string, tsErrors?: string, serverLogs?: string }
 */
function ensureServerRunning() {
  // Quick check first
  if (checkServerHealth()) {
    console.error('✅ Dev server is healthy');
    return { healthy: true };
  }

  console.error('⚠️  Dev server not responding, diagnosing...');

  // FIRST: Check for TypeScript compilation errors
  // This tells us WHY the server might be down
  const tsCheck = checkTypeScriptCompilation();
  if (tsCheck.hasErrors) {
    console.error('❌ TypeScript errors found - server cannot start until these are fixed');
    const serverLogs = dumpServerLogs();
    return {
      healthy: false,
      error: 'TypeScript compilation errors prevent server startup',
      tsErrors: tsCheck.errors,
      serverLogs
    };
  }

  console.error('✅ TypeScript compilation OK, attempting to start server...');

  // Try to start using check-or-start-dev-server.sh
  const baseDir = process.cwd();
  const serverScript = path.join(baseDir, 'scripts', 'check-or-start-dev-server.sh');

  if (fs.existsSync(serverScript)) {
    try {
      const scriptOutput = execSync(`bash "${serverScript}"`, {
        cwd: baseDir,
        timeout: 120000, // 2 minutes to start server
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      // Log the script output for visibility
      if (scriptOutput) {
        console.error('[gate] Server script output:');
        console.error(scriptOutput);
      }
      
      // Verify it's now healthy
      if (checkServerHealth()) {
        console.error('✅ Dev server started successfully');
        return { healthy: true };
      }
    } catch (e) {
      const output = e.stdout || e.stderr || e.message || '';
      console.error(`❌ Server startup script failed:`);
      console.error(output);
    }
  }

  // Final check after startup attempt
  if (checkServerHealth()) {
    console.error('✅ Dev server is now healthy');
    return { healthy: true };
  }

  // Dump logs to help diagnose
  const serverLogs = dumpServerLogs();

  return {
    healthy: false,
    error: 'Dev server is not running and could not be started.',
    serverLogs
  };
}

/**
 * Run Playwright tests for the specific frontend task
 */
function runPlaywrightTests() {
  const baseDir = process.cwd();
  const testFile = path.join(baseDir, 'tests', 'e2e', 'generated', `${BUILD_UNIT_ID}.spec.ts`);

  // Ensure dev server is running before attempting tests
  const serverStatus = ensureServerRunning();
  if (!serverStatus.healthy) {
    return {
      passed: false,
      testsRun: 0,
      testsFailed: 1,
      failures: [{ test: 'Server Health Check', error: serverStatus.error }],
      serverDown: true,
      tsErrors: serverStatus.tsErrors,
      serverLogs: serverStatus.serverLogs
    };
  }

  // If no test file exists, skip validation (task may not need E2E tests)
  if (!BUILD_UNIT_ID) {
    return {
      passed: true,
      skipped: true,
      reason: 'No BUILD_UNIT_ID provided - skipping Playwright validation'
    };
  }

  if (!fs.existsSync(testFile)) {
    return {
      passed: true,
      skipped: true,
      reason: `No test file for ${BUILD_UNIT_ID} at ${testFile} - skipping Playwright validation`
    };
  }

  // Ensure auth fixture exists
  const authFile = path.join(baseDir, 'tests', 'e2e', 'fixtures', 'auth.json');
  if (!fs.existsSync(authFile) || fs.readFileSync(authFile, 'utf8').trim() === '{"cookies":[],"origins":[]}') {
    console.error('⚠️  Auth fixture not populated, attempting to generate...');
    try {
      execSync('npx playwright test --project=setup', {
        cwd: baseDir,
        timeout: 60000,
        stdio: 'pipe'
      });
    } catch (e) {
      console.error('⚠️  Auth setup failed - tests may fail for protected routes');
    }
  }

  // Create results directory
  const resultsDir = path.join(baseDir, 'test-results', BUILD_UNIT_ID);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  try {
    console.error(`\n🧪 Running Playwright tests for ${BUILD_UNIT_ID}...`);
    console.error(`   Test file: ${testFile}`);
    
    // Run Playwright tests for this specific task
    const result = execSync(
      `npx playwright test "${testFile}" --reporter=json`,
      {
        cwd: baseDir,
        timeout: 360000, // 6 minute timeout
        encoding: 'utf-8',
        env: {
          ...process.env,
          PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );

    // Parse JSON output
    try {
      const report = JSON.parse(result);
      const passed = (report.stats?.unexpected || 0) === 0;
      const testsRun = (report.stats?.expected || 0) + (report.stats?.unexpected || 0);
      
      return {
        passed,
        testsRun,
        testsFailed: report.stats?.unexpected || 0,
        duration: report.stats?.duration || 0,
        failures: passed ? [] : extractFailures(report)
      };
    } catch (parseError) {
      // JSON parsing failed but command succeeded (tests passed)
      return { passed: true, testsRun: 1, testsFailed: 0 };
    }
    
  } catch (error) {
    // Test execution failed - try to parse JSON from stdout first
    // Playwright outputs JSON even when tests fail (exit code non-zero)
    const stdout = error.stdout || '';
    
    try {
      const report = JSON.parse(stdout);
      const failures = extractFailures(report);
      return {
        passed: false,
        testsRun: (report.stats?.expected || 0) + (report.stats?.unexpected || 0) || failures.length || 1,
        testsFailed: report.stats?.unexpected || failures.length || 1,
        failures: failures,
        rawOutput: stdout.substring(0, 3000)
      };
    } catch (parseError) {
      // JSON parsing failed, fall back to text parsing
      const output = stdout || error.stderr || error.message || '';
      const failures = parsePlaywrightError(output);
      
      // Ensure failedTests is never empty - create synthetic failure if needed
      const failureDetails = failures.details?.length > 0
        ? failures.details
        : [{ test: 'Test execution', file: testFile, error: `Test failed. Raw output:\n${output.slice(0, 2000)}` }];
      
      return {
        passed: false,
        testsRun: failures.total || 1,
        testsFailed: failures.failed || 1,
        failures: failureDetails,
        rawOutput: output.substring(0, 3000)
      };
    }
  }
}

/**
 * Extract failure details from Playwright JSON report
 * Strips ANSI codes and extracts structured failure info
 */
function extractFailures(report) {
  const failures = [];
  
  for (const suite of report.suites || []) {
    for (const spec of suite.specs || []) {
      if (!spec.ok) {
        for (const test of spec.tests || []) {
          if (test.status === 'unexpected' || test.status === 'failed') {
            const result = test.results?.[0];
            const rawError = result?.error?.message || 'Test failed';
            const cleanError = stripAnsi(rawError);
            
            // Extract locator from error message if present
            const locatorMatch = cleanError.match(/Locator:\s*(.+?)(?:\n|Expected:|$)/);
            const expectedMatch = cleanError.match(/Expected:\s*(.+?)(?:\n|Received:|Timeout:|$)/);
            const timeoutMatch = cleanError.match(/Timeout:\s*(\d+)ms/);
            
            failures.push({
              test: spec.title,
              file: suite.file,
              line: spec.line,
              error: cleanError,
              locator: locatorMatch ? locatorMatch[1].trim() : null,
              expected: expectedMatch ? expectedMatch[1].trim() : (result?.error?.expected || null),
              received: result?.error?.actual || null,
              timeout: timeoutMatch ? parseInt(timeoutMatch[1], 10) : null
            });
          }
        }
      }
    }
  }
  
  return failures;
}

/**
 * Parse Playwright error output for useful failure info
 */
function parsePlaywrightError(output) {
  const lines = output.split('\n');
  const failures = [];
  let currentTest = null;
  let failed = 0;
  let total = 0;
  
  for (const line of lines) {
    // Match test failure lines
    if (line.includes('✘') || line.includes('FAILED') || line.includes('Error:')) {
      if (currentTest) failures.push(currentTest);
      currentTest = { test: line.trim(), error: '' };
      failed++;
    }
    // Match assertion details
    if (currentTest && (line.includes('Expected') || line.includes('Received') || line.includes('Locator'))) {
      currentTest.error += line.trim() + ' ';
    }
    // Match test count
    const countMatch = line.match(/(\d+)\s+passed|(\d+)\s+failed/);
    if (countMatch) {
      total += parseInt(countMatch[1] || countMatch[2] || '0', 10);
    }
  }
  
  if (currentTest) failures.push(currentTest);
  
  return {
    total: total || failures.length || 1,
    failed: failed || failures.length || 1,
    details: failures
  };
}

/**
 * Main gate execution
 */
function main() {
  const startTime = Date.now();
  
  console.error(`\n${'='.repeat(60)}`);
  console.error(`🧪 PLAYWRIGHT GATE: ${BUILD_UNIT_ID || 'Unknown Task'}`);
  console.error(`${'='.repeat(60)}`);
  
  const playwrightResult = runPlaywrightTests();
  const duration = Date.now() - startTime;
  
  if (playwrightResult.skipped) {
    console.error(`\n⏭️  ${playwrightResult.reason}`);
  } else if (playwrightResult.passed) {
    console.error(`\n✅ All ${playwrightResult.testsRun} tests passed (${duration}ms)`);
  } else {
    console.error(`\n❌ ${playwrightResult.testsFailed}/${playwrightResult.testsRun} tests failed (${duration}ms)`);
    
    if (playwrightResult.failures?.length > 0) {
      console.error(`\nFailures:`);
      for (const f of playwrightResult.failures.slice(0, 5)) {
        console.error(`  - ${f.test}`);
        if (f.error) console.error(`    ${f.error.substring(0, 150)}`);
      }
    }
  }

  console.error(`${'='.repeat(60)}\n`);

  // Build result object
  const result = {
    passed: playwrightResult.passed || playwrightResult.skipped,
    score: playwrightResult.passed ? 1.0 : (playwrightResult.skipped ? 1.0 : 0),
    reasons: [],
    criticalFailures: [],
    retryRecommended: !playwrightResult.passed && !playwrightResult.skipped,
    criteria_scores: {
      playwright: playwrightResult.passed ? 1.0 : (playwrightResult.skipped ? 1.0 : 0)
    }
  };

  // Add descriptive reasons
  if (playwrightResult.skipped) {
    result.reasons.push(playwrightResult.reason);
  } else if (playwrightResult.passed) {
    result.reasons.push(`Playwright: ${playwrightResult.testsRun} tests passed`);
  } else if (playwrightResult.serverDown) {
    // Special handling for server-down failures
    result.reasons.push('Dev server is not running - cannot run Playwright tests');
    result.criticalFailures.push('server_down');
    
    // Include TypeScript errors if present - this is the actionable info
    if (playwrightResult.tsErrors) {
      result.reasons.push('TYPESCRIPT ERRORS MUST BE FIXED:');
      // Split errors into lines and include first few
      const errorLines = playwrightResult.tsErrors.split('\n').filter(l => l.trim()).slice(0, 10);
      for (const line of errorLines) {
        result.reasons.push(line);
      }
      result.criticalFailures.push('typescript_errors');
    } else {
      result.reasons.push('Check for runtime errors in server logs');
    }
    
    result.retryContext = {
      stage: 'server_health',
      issue: playwrightResult.tsErrors ? 'typescript_compilation_error' : 'dev_server_down',
      tsErrors: playwrightResult.tsErrors,
      serverLogs: playwrightResult.serverLogs?.substring(0, 2000),
      failedTests: playwrightResult.failures || []
    };
  } else {
    result.reasons.push(`Playwright: ${playwrightResult.testsFailed}/${playwrightResult.testsRun} tests failed`);
    
    // Add failure details for retry context - clean, structured format
    if (playwrightResult.failures?.length > 0) {
      for (const f of playwrightResult.failures.slice(0, 5)) {
        const testName = f.test || 'Unknown test';
        if (f.locator) {
          result.reasons.push(`FAILED: "${testName}" - Locator: ${f.locator}`);
          if (f.expected) {
            result.reasons.push(`  Expected: ${f.expected}`);
          }
        } else {
          // Show full error without truncation for non-locator errors
          result.reasons.push(`FAILED: "${testName}" - ${f.error || 'Unknown error'}`);
        }
      }
    }
    
    // Add retry context with clean failure data
    result.retryContext = {
      stage: 'playwright',
      testFile: `tests/e2e/generated/${BUILD_UNIT_ID}.spec.ts`,
      failedTests: playwrightResult.failures || [],
      rawOutput: playwrightResult.rawOutput
    };
  }

  // Output result as JSON
  console.log(JSON.stringify(result, null, 2));
  
  process.exit(result.passed ? 0 : 1);
}

main();
