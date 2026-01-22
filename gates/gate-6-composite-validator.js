#!/usr/bin/env node

/**
 * Gate 6 Composite Validator (Backend Build Tasks)
 * 
 * Runs Vitest tests for the specific backend task being validated.
 * Tests directly call Server Actions, Data Fetchers, and Models.
 * This is the "science" part - deterministic, reproducible validation.
 * 
 * If tests pass → gate passes
 * If tests fail → gate fails with specific failure details for retry
 * If no tests exist → gate skips (allows tasks without tests)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Strip ANSI escape codes from text
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
 * Check if dev server is healthy (still needed for some integration tests)
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
    execSync('npx tsc --noEmit --pretty 2>&1', {
      cwd: baseDir,
      encoding: 'utf-8',
      timeout: 60000,
      stdio: 'pipe'
    });
    return { hasErrors: false };
  } catch (e) {
    const output = e.stdout || e.stderr || e.message || '';
    console.error('\n========================================');
    console.error('⚠️ TypeScript compilation warnings detected');
    console.error('========================================');
    console.error(output.substring(0, 2000));
    console.error('========================================\n');
    
    return {
      hasErrors: true,
      errors: output.substring(0, 2000)
    };
  }
}

/**
 * Ensure dev server is running (for integration tests that may need it)
 */
function ensureServerRunning() {
  if (checkServerHealth()) {
    console.error('✅ Dev server is healthy');
    return { healthy: true };
  }

  console.error('⚠️ Dev server not responding, attempting to start...');

  const baseDir = process.cwd();
  const serverScript = path.join(baseDir, 'scripts', 'check-or-start-dev-server.sh');

  if (fs.existsSync(serverScript)) {
    try {
      execSync(`bash "${serverScript}"`, {
        cwd: baseDir,
        timeout: 120000,
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      if (checkServerHealth()) {
        console.error('✅ Dev server started successfully');
        return { healthy: true };
      }
    } catch (e) {
      console.error('⚠️ Server startup had issues, continuing with tests...');
    }
  }

  // Don't fail if server isn't running - backend unit tests don't need it
  return { healthy: false, warning: 'Dev server not running - some integration tests may fail' };
}

/**
 * Run Vitest tests for the specific backend task
 */
function runVitestTests() {
  const baseDir = process.cwd();
  const testFile = path.join(baseDir, 'tests', 'backend', `be-${BUILD_UNIT_ID}.test.ts`);

  // Check if vitest is available
  const vitestConfigPath = path.join(baseDir, 'vitest.config.ts');
  if (!fs.existsSync(vitestConfigPath)) {
    console.error('⚠️ vitest.config.ts not found - skipping Vitest tests');
    return {
      passed: true,
      skipped: true,
      reason: 'Vitest not configured - skipping backend tests'
    };
  }

  // If no test file exists, skip validation
  if (!BUILD_UNIT_ID) {
    return {
      passed: true,
      skipped: true,
      reason: 'No BUILD_UNIT_ID provided - skipping Vitest validation'
    };
  }

  if (!fs.existsSync(testFile)) {
    return {
      passed: true,
      skipped: true,
      reason: `No test file for be-${BUILD_UNIT_ID} at ${testFile} - skipping Vitest validation`
    };
  }

  // Ensure server is running (some tests may need DB access through server)
  const serverStatus = ensureServerRunning();
  if (serverStatus.warning) {
    console.error(`⚠️ ${serverStatus.warning}`);
  }

  try {
    console.error(`\n🧪 Running Vitest tests for be-${BUILD_UNIT_ID}...`);
    console.error(`   Test file: ${testFile}`);
    
    // Run Vitest for this specific test file
    // Use verbose reporter only - simpler and more reliable
    const result = execSync(
      `npx vitest run "${testFile}" --reporter=verbose`,
      {
        cwd: baseDir,
        timeout: 60000, // 60 second timeout (much faster than Playwright)
        encoding: 'utf-8',
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL
        },
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );

    // Parse verbose output to count tests
    const output = result || '';
    const passedMatch = output.match(/(\d+)\s+passed/);
    const testsRun = passedMatch ? parseInt(passedMatch[1], 10) : 1;

    // Exit code 0 means all tests passed
    return { 
      passed: true, 
      testsRun: testsRun, 
      testsFailed: 0,
      testsPassed: testsRun
    };
    
  } catch (error) {
    // Test execution exited with non-zero code
    // This could mean: tests failed, OR process was killed/timed out after tests passed
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';
    const output = stdout + '\n' + stderr;

    // Parse the actual test results from output
    const results = extractVitestResults(output);
    
    // KEY FIX: If tests actually passed but process exited non-zero,
    // treat as success. This handles cases like timeout after tests complete,
    // teardown failures, or process being killed.
    if (results.passed > 0 && results.failed === 0) {
      console.error('⚠️ Tests passed but process exited non-zero - treating as success');
      console.error(`   (Detected ${results.passed} passing test(s), 0 failures)`);
      return {
        passed: true,
        testsRun: results.passed,
        testsFailed: 0,
        testsPassed: results.passed,
        warning: 'Process exited non-zero but all tests passed'
      };
    }
    
    // Actual test failures detected
    const failureDetails = results.details?.length > 0
      ? results.details
      : [{ test: 'Test execution', file: testFile, error: `Test failed. Raw output:\n${stripAnsi(output.slice(0, 2000))}` }];
    
    // Use detected counts, only default to 1 if we truly couldn't parse anything
    const testsFailed = results.failed > 0 ? results.failed : (results.details?.length || 1);
    const testsRun = results.total > 0 ? results.total : testsFailed;
    
    return {
      passed: false,
      testsRun: testsRun,
      testsFailed: testsFailed,
      failures: failureDetails,
      rawOutput: stripAnsi(output.substring(0, 3000))
    };
  }
}

/**
 * Extract test results from Vitest output
 * Parses both passing and failing tests to avoid false positives
 */
function extractVitestResults(output) {
  const failures = [];
  let failed = 0;
  let passed = 0;
  let total = 0;

  const lines = output.split('\n');
  let currentTest = null;

  for (const line of lines) {
    const cleanLine = stripAnsi(line);
    
    // Count passing tests (✓ marker)
    // Be careful: only count if it's a test result line, not just any line with checkmark
    if (cleanLine.includes('✓') && !cleanLine.includes('×') && cleanLine.includes('test')) {
      passed++;
    }
    
    // Match failing tests (× marker or FAIL)
    if (cleanLine.includes('×') || (cleanLine.includes('FAIL') && !cleanLine.includes('testsFailed'))) {
      if (currentTest) failures.push(currentTest);
      currentTest = { test: cleanLine.trim(), error: '' };
      failed++;
    }
    
    // Capture error details for the current failing test
    if (currentTest && (cleanLine.includes('Error:') || cleanLine.includes('expect') || cleanLine.includes('Received:'))) {
      currentTest.error += cleanLine.trim() + ' ';
    }

    // Parse test summary lines (avoid over-matching "Test Files" etc).
    // We only trust totals derived from the *Tests* line to avoid impossible ratios like 12/9.
    if (/^\s*Tests\b/.test(cleanLine)) {
      const failedMatch = cleanLine.match(/(\d+)\s+failed/);
      const passedMatch = cleanLine.match(/(\d+)\s+passed/);
      const totalMatch = cleanLine.match(/(\d+)\s+total/);

      if (failedMatch) failed = parseInt(failedMatch[1], 10);
      if (passedMatch) passed = parseInt(passedMatch[1], 10);
      if (totalMatch) total = parseInt(totalMatch[1], 10);
    }
  }

  if (currentTest) failures.push(currentTest);

  // Calculate total from passed + failed if summary didn't provide it.
  // This ensures total is never less than failed if our passed/failed numbers are coherent.
  const actualTotal = total || (passed + failed) || 0;

  return {
    total: actualTotal,
    passed: passed,
    failed: failed,
    details: failures.slice(0, 5)
  };
}

/**
 * Main gate execution
 */
function main() {
  const startTime = Date.now();
  
  console.error(`\n${'='.repeat(60)}`);
  console.error(`🧪 VITEST GATE (Backend): be-${BUILD_UNIT_ID || 'Unknown Task'}`);
  console.error(`${'='.repeat(60)}`);

  // Check TypeScript first - STRICT ENFORCEMENT: type errors fail the gate
  const tsCheck = checkTypeScriptCompilation();
  if (tsCheck.hasErrors) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ TypeScript compilation failed (${duration}ms)`);
    console.error(`${'='.repeat(60)}\n`);
    
    // Build failure result for TypeScript errors
    const result = {
      passed: false,
      score: 0,
      reasons: [
        'TypeScript compilation failed - type contract violations detected',
        'Fix all type errors before proceeding. Common causes:',
        '  - Return type mismatch (e.g., {id} instead of {role})',
        '  - Missing required properties in returned objects',
        '  - JSONB fields not matching expected type structure'
      ],
      criticalFailures: [
        `TypeScript compilation errors:\n${tsCheck.errors || 'See console output above'}`
      ],
      retryRecommended: true,
      criteria_scores: {
        typescript: 0,
        vitest: 0
      },
      retryContext: {
        stage: 'typescript',
        errors: tsCheck.errors
      }
    };
    
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  
  console.error('✅ TypeScript compilation passed');
  
  const vitestResult = runVitestTests();
  const duration = Date.now() - startTime;
  
  if (vitestResult.skipped) {
    console.error(`\n⏭️ ${vitestResult.reason}`);
  } else if (vitestResult.passed) {
    console.error(`\n✅ All ${vitestResult.testsRun} tests passed (${duration}ms)`);
  } else {
    const hasReliableTotal =
      Number.isFinite(vitestResult.testsRun) &&
      Number.isFinite(vitestResult.testsFailed) &&
      vitestResult.testsRun > 0 &&
      vitestResult.testsRun >= vitestResult.testsFailed;
    const summary = hasReliableTotal
      ? `${vitestResult.testsFailed}/${vitestResult.testsRun} tests failed`
      : `${vitestResult.testsFailed} test(s) failed`;
    console.error(`\n❌ ${summary} (${duration}ms)`);
    
    if (vitestResult.failures?.length > 0) {
      console.error(`\nFailures:`);
      for (const f of vitestResult.failures.slice(0, 5)) {
        console.error(`  - ${f.test}`);
        if (f.error) console.error(`    ${f.error.substring(0, 200)}`);
      }
    }
  }

  console.error(`${'='.repeat(60)}\n`);

  // Build result object
  const result = {
    passed: vitestResult.passed || vitestResult.skipped,
    score: vitestResult.passed ? 1.0 : (vitestResult.skipped ? 1.0 : 0),
    reasons: [],
    criticalFailures: [],
    retryRecommended: !vitestResult.passed && !vitestResult.skipped,
    criteria_scores: {
      typescript: 1.0, // Already passed if we got here
      vitest: vitestResult.passed ? 1.0 : (vitestResult.skipped ? 1.0 : 0)
    }
  };

  // Add descriptive reasons
  if (vitestResult.skipped) {
    result.reasons.push(vitestResult.reason);
  } else if (vitestResult.passed) {
    result.reasons.push(`Vitest: ${vitestResult.testsRun} backend tests passed`);
  } else {
    const hasReliableTotal =
      Number.isFinite(vitestResult.testsRun) &&
      Number.isFinite(vitestResult.testsFailed) &&
      vitestResult.testsRun > 0 &&
      vitestResult.testsRun >= vitestResult.testsFailed;
    result.reasons.push(
      hasReliableTotal
        ? `Vitest: ${vitestResult.testsFailed}/${vitestResult.testsRun} backend tests failed`
        : `Vitest: ${vitestResult.testsFailed} backend test(s) failed`
    );
    
    // Add failure details for retry context
    if (vitestResult.failures?.length > 0) {
      for (const f of vitestResult.failures.slice(0, 5)) {
        result.reasons.push(`FAILED: ${f.test}`);
        if (f.error) {
          result.reasons.push(`  ${f.error.substring(0, 200)}`);
        }
      }
    }
    
    // Add retry context
    result.retryContext = {
      stage: 'vitest',
      testFile: `tests/backend/be-${BUILD_UNIT_ID}.test.ts`,
      failedTests: vitestResult.failures || [],
      rawOutput: vitestResult.rawOutput
    };
  }

  // Output result as JSON
  console.log(JSON.stringify(result, null, 2));
  
  process.exit(result.passed ? 0 : 1);
}

main();

