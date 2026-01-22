#!/usr/bin/env node

/**
 * Gate 1-5: Frontend Test Generation Validator
 * Validates that Playwright test files were generated for all frontend tasks
 * and that each test file covers the task's acceptance criteria
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function validateTestGeneration(phaseDef, qualityGate) {
  const baseDir = process.cwd();
  const manifestPath = path.join(baseDir, 'reference', 'frontend-task-list.json');
  const testDir = path.join(baseDir, 'tests', 'e2e', 'generated');

  // Check manifest exists
  if (!fs.existsSync(manifestPath)) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('reference/frontend-task-list.json not found');
    return qualityGate;
  }

  // Parse manifest
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push(`Manifest parsing error: ${error.message}`);
    return qualityGate;
  }

  const tasks = Array.isArray(manifest.tasks) ? manifest.tasks : [];
  
  if (tasks.length === 0) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('No tasks found in frontend-task-list.json');
    return qualityGate;
  }

  // Check test directory exists
  if (!fs.existsSync(testDir)) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('tests/e2e/generated/ directory not found');
    return qualityGate;
  }

  // Validate test files
  let testsFound = 0;
  let testsWithCoverage = 0;
  let totalCriteria = 0;
  let coveredCriteria = 0;
  const missingTests = [];
  const insufficientCoverage = [];
  const syntaxIssues = [];
  const antiPatternIssues = [];

  // Common generator pitfalls that create TypeScript errors in Playwright tests
  const antiPatterns = [
    {
      id: 'asyncActionThenFirst',
      description: 'Chaining .first() after async page actions (e.g., await page.click(...).first())',
      regex: /\bawait\s+page\.(?:click|dblclick|fill|type|press|goto|waitForURL|waitForNavigation|selectOption|check|uncheck|tap|hover)\([^\n;]*\)\.(?:first|nth|last)\s*\(/g
    },
    {
      id: 'toHaveCountWithAsymmetricMatcher',
      description: 'Using expect.any(...) inside toHaveCount (Playwright expects a concrete number)',
      regex: /\btoHaveCount\s*\(\s*expect\.any\s*\(/g
    },
    {
      id: 'grantPermissionsWrongOptions',
      description: 'Passing invalid options to context.grantPermissions (only { origin } is allowed)',
      regex: /\bgrantPermissions\s*\(\s*[^,]+,\s*\{\s*permissions\s*:/g
    }
  ];

  for (const task of tasks) {
    const taskId = task.id;
    const testFile = path.join(testDir, `${taskId}.spec.ts`);
    const criteria = Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [];
    
    totalCriteria += criteria.length;

    if (!fs.existsSync(testFile)) {
      missingTests.push(taskId);
      continue;
    }

    testsFound++;

    // Read and analyze test file
    let content;
    try {
      content = fs.readFileSync(testFile, 'utf8');
    } catch (error) {
      syntaxIssues.push(`${taskId}: Cannot read file - ${error.message}`);
      continue;
    }

    // Check file has minimum content
    if (content.length < 100) {
      syntaxIssues.push(`${taskId}: Test file appears empty or too short (${content.length} chars)`);
      continue;
    }

    // Check for required imports
    if (!content.includes("from '@playwright/test'") && !content.includes('from "@playwright/test"')) {
      syntaxIssues.push(`${taskId}: Missing @playwright/test import`);
    }

    // Check for known anti-patterns that consistently break TypeScript
    for (const p of antiPatterns) {
      if (p.regex.test(content)) {
        antiPatternIssues.push(`${taskId}: ${p.description}`);
      }
      // Reset regex state because we use /g
      p.regex.lastIndex = 0;
    }

    // Count test() blocks in the file
    const testMatches = content.match(/\btest\s*\(/g) || [];
    const testCount = testMatches.length;

    // Count test.describe blocks
    const describeMatches = content.match(/\btest\.describe\s*\(/g) || [];

    if (testCount === 0 && describeMatches.length === 0) {
      syntaxIssues.push(`${taskId}: No test() or test.describe() blocks found`);
      continue;
    }

    // Check coverage: at least one test per acceptance criterion
    if (criteria.length > 0 && testCount < criteria.length) {
      insufficientCoverage.push(`${taskId}: ${testCount} tests for ${criteria.length} acceptance criteria`);
      coveredCriteria += testCount;
    } else {
      testsWithCoverage++;
      coveredCriteria += criteria.length;
    }
  }

  // Calculate scores
  const fileScore = tasks.length > 0 ? testsFound / tasks.length : 0;
  const coverageScore = totalCriteria > 0 ? coveredCriteria / totalCriteria : 1;
  const qualityScore = testsFound > 0 ? (testsFound - syntaxIssues.length) / testsFound : 0;

  // Add issues to reasons
  if (missingTests.length > 0) {
    qualityGate.passed = false;
    const displayed = missingTests.slice(0, 5);
    const remaining = missingTests.length - displayed.length;
    qualityGate.reasons.push(
      `Missing test files: ${displayed.join(', ')}${remaining > 0 ? ` (+${remaining} more)` : ''}`
    );
  }

  if (insufficientCoverage.length > 0) {
    // Don't fail for insufficient coverage, but note it
    qualityGate.reasons.push(
      `Partial coverage: ${insufficientCoverage.slice(0, 3).join('; ')}${insufficientCoverage.length > 3 ? ` (+${insufficientCoverage.length - 3} more)` : ''}`
    );
  }

  if (syntaxIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...syntaxIssues.slice(0, 5));
  }

  if (antiPatternIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(
      `Known Playwright/TypeScript anti-patterns detected: ${antiPatternIssues.slice(0, 5).join('; ')}${antiPatternIssues.length > 5 ? ` (+${antiPatternIssues.length - 5} more)` : ''}`
    );
  }

  // TypeScript compilation check:
  // - We only FAIL this gate if errors are in tests/e2e/generated/** (the output of this phase).
  // - We still surface other TS errors as a warning (later build gates should catch them anyway).
  // This catches issues like nullable boundingBox(), bad matcher types, and invalid API usage.
  const tscResult = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
    cwd: baseDir,
    encoding: 'utf8'
  });

  if (tscResult.status !== 0) {
    const output = `${tscResult.stdout || ''}\n${tscResult.stderr || ''}`.trim();
    const lines = output.split('\n').filter(Boolean);
    const isTsErrorLine = (l) => /\berror\s+TS\d+:/i.test(l);
    const generatedPrefix = `tests${path.sep}e2e${path.sep}generated${path.sep}`;

    const tsErrorLines = lines.filter(isTsErrorLine);
    const generatedErrors = tsErrorLines.filter((l) => l.includes('tests/e2e/generated/') || l.includes(generatedPrefix));
    const otherErrors = tsErrorLines.filter((l) => !generatedErrors.includes(l));

    if (generatedErrors.length > 0) {
      qualityGate.passed = false;
      qualityGate.reasons.push('TypeScript errors detected in generated E2E tests (tests/e2e/generated/**).');
      qualityGate.reasons.push(`Generated-test tsc output (first 20 lines):\n${generatedErrors.slice(0, 20).join('\n')}`);
    } else if (otherErrors.length > 0) {
      qualityGate.reasons.push(
        'TypeScript errors detected outside generated tests (not failing Phase 1-5, but later build gates may fail).'
      );
      qualityGate.reasons.push(`Other tsc output (first 10 lines):\n${otherErrors.slice(0, 10).join('\n')}`);
    } else {
      // If tsc failed but we couldn't extract structured TS error lines, fail to be safe.
      qualityGate.passed = false;
      qualityGate.reasons.push('TypeScript compilation failed (npx tsc --noEmit), but no parseable TS error lines were found.');
      qualityGate.reasons.push(`tsc output (first 20 lines):\n${lines.slice(0, 20).join('\n')}`);
    }
  }

  // Check for TESTID-CONVENTIONS.md
  const conventionsFile = path.join(baseDir, 'tests', 'e2e', 'TESTID-CONVENTIONS.md');
  const hasConventions = fs.existsSync(conventionsFile);

  qualityGate.criteria_scores = {
    testFiles: Number(fileScore.toFixed(2)),
    criterionCoverage: Number(coverageScore.toFixed(2)),
    syntaxValidity: Number(qualityScore.toFixed(2)),
    conventions: hasConventions ? 1.0 : 0.5
  };

  qualityGate.score = Number(
    ((fileScore * 0.4) + (coverageScore * 0.3) + (qualityScore * 0.2) + (hasConventions ? 0.1 : 0.05)).toFixed(2)
  );

  // Summary
  if (qualityGate.passed) {
    qualityGate.reasons.unshift(
      `Generated ${testsFound}/${tasks.length} test files covering ${coveredCriteria}/${totalCriteria} acceptance criteria`
    );
  }

  // Check if we meet the threshold (0.95)
  if (fileScore < 0.95) {
    qualityGate.passed = false;
    qualityGate.retryRecommended = true;
  }

  // Add structured retry context for better retry feedback
  if (!qualityGate.passed) {
    qualityGate.retryContext = {
      stage: 'frontend_test_generation',
      missingTests: missingTests.slice(0, 10),
      syntaxIssues: syntaxIssues.slice(0, 10),
      antiPatternIssues: antiPatternIssues.slice(0, 10),
      insufficientCoverage: insufficientCoverage.slice(0, 10)
    };
  }

  return qualityGate;
}

if (require.main === module) {
  try {
    const phaseDef = JSON.parse(process.argv[2] || '{}');
    const qualityGate = {
      passed: true,
      reasons: [],
      score: 0,
      retryRecommended: false,
      criticalFailures: [],
      criteria_scores: {}
    };

    const result = validateTestGeneration(phaseDef, qualityGate);

    console.log(JSON.stringify(result, null, 2));

    if (!result.passed) {
      process.exit(1);
    }
  } catch (error) {
    const result = {
      passed: false,
      reasons: [`Gate execution error: ${error.message}`],
      score: 0,
      retryRecommended: false,
      criticalFailures: [`Validation error: ${error.message}`]
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

module.exports = { validateTestGeneration };


