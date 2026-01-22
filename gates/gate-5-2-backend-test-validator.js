#!/usr/bin/env node

/**
 * Gate 5-2: Backend Test Generation Validator
 * 
 * Validates that Vitest test files were generated for all backend tasks.
 * Backend tests directly test Server Actions, Data Fetchers, and Models.
 * 
 * IMPORTANT: Tests must use Vitest, NOT Playwright.
 * Playwright is for frontend E2E tests only.
 */

const fs = require('fs');
const path = require('path');

function validateBackendTestGeneration(phaseDef, qualityGate) {
  const baseDir = process.cwd();
  const manifestPath = path.join(baseDir, 'reference', 'backend-task-list.json');
  const testDir = path.join(baseDir, 'tests', 'backend');

  // Check manifest exists
  if (!fs.existsSync(manifestPath)) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('reference/backend-task-list.json not found');
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
    qualityGate.criticalFailures.push('No tasks found in backend-task-list.json');
    return qualityGate;
  }

  // Check test directory exists
  if (!fs.existsSync(testDir)) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('tests/backend/ directory not found');
    return qualityGate;
  }

  // Validation counters
  let testsFound = 0;
  let testsWithCorrectImports = 0;
  let testsWithBackendImports = 0;
  const missingTests = [];
  const wrongImports = [];
  const noBackendImports = [];
  const syntaxIssues = [];

  for (const task of tasks) {
    const taskId = task.id;
    const testFile = path.join(testDir, `be-${taskId}.test.ts`);

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
      syntaxIssues.push(`be-${taskId}: Cannot read file - ${error.message}`);
      continue;
    }

    // Check file has minimum content
    if (content.length < 100) {
      syntaxIssues.push(`be-${taskId}: Test file appears empty or too short`);
      continue;
    }

    // CRITICAL: Check for correct imports (Vitest, NOT Playwright)
    const hasVitestImport = content.includes("from 'vitest'") || content.includes('from "vitest"');
    const hasPlaywrightImport = content.includes("from '@playwright/test'") || content.includes('from "@playwright/test"');

    if (hasPlaywrightImport) {
      wrongImports.push(`be-${taskId}: Uses Playwright instead of Vitest (WRONG approach for backend)`);
    } else if (!hasVitestImport) {
      syntaxIssues.push(`be-${taskId}: Missing vitest import`);
    } else {
      testsWithCorrectImports++;
    }

    // Check for backend function imports (actions, data fetchers, or prisma)
    const hasBackendImports = 
      content.includes('@/actions/') ||
      content.includes('@/data/') ||
      content.includes('@/lib/db') ||
      content.includes("from '@/lib/") ||
      content.includes('from "@/lib/');

    if (hasBackendImports) {
      testsWithBackendImports++;
    } else {
      noBackendImports.push(`be-${taskId}: No backend function imports found (should import from @/actions/, @/data/, or @/lib/)`);
    }

    // Check for test blocks
    const testMatches = content.match(/\btest\s*\(/g) || [];
    const itMatches = content.match(/\bit\s*\(/g) || [];
    const totalTests = testMatches.length + itMatches.length;

    if (totalTests === 0) {
      syntaxIssues.push(`be-${taskId}: No test() or it() blocks found`);
      continue;
    }

    // Check for UI interactions (should NOT have these)
    const hasUIInteractions = 
      content.includes('page.goto') ||
      content.includes('page.click') ||
      content.includes('page.fill') ||
      content.includes('page.locator') ||
      content.includes('getByRole') ||
      content.includes('getByText');

    if (hasUIInteractions) {
      wrongImports.push(`be-${taskId}: Contains UI interactions - backend tests should call functions directly`);
    }
  }

  // Calculate scores
  const fileScore = tasks.length > 0 ? testsFound / tasks.length : 0;
  const importScore = testsFound > 0 ? testsWithCorrectImports / testsFound : 0;
  const backendScore = testsFound > 0 ? testsWithBackendImports / testsFound : 0;
  const qualityScore = testsFound > 0 ? Math.max(0, (testsFound - syntaxIssues.length - wrongImports.length) / testsFound) : 0;

  // Missing tests (critical)
  if (missingTests.length > 0) {
    qualityGate.passed = false;
    const displayed = missingTests.slice(0, 5);
    const remaining = missingTests.length - displayed.length;
    qualityGate.reasons.push(
      `Missing test files: be-${displayed.join('.test.ts, be-')}.test.ts${remaining > 0 ? ` (+${remaining} more)` : ''}`
    );
  }

  // Wrong imports (critical - using Playwright instead of Vitest)
  if (wrongImports.length > 0) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('Tests use Playwright instead of Vitest - backend tests must directly call functions');
    qualityGate.reasons.push(...wrongImports.slice(0, 3));
  }

  // No backend imports (failure - tests must import real code under test)
  if (noBackendImports.length > 0) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('Tests must import real backend code (@/actions/, @/data/, or @/lib/db)');
    qualityGate.reasons.push(...noBackendImports.slice(0, 3));
  }

  // Syntax issues
  if (syntaxIssues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...syntaxIssues.slice(0, 5));
  }

  qualityGate.criteria_scores = {
    testFiles: Number(fileScore.toFixed(2)),
    correctImports: Number(importScore.toFixed(2)),
    backendImports: Number(backendScore.toFixed(2)),
    syntaxValidity: Number(qualityScore.toFixed(2))
  };

  qualityGate.score = Number(
    ((fileScore * 0.4) + (importScore * 0.3) + (backendScore * 0.2) + (qualityScore * 0.1)).toFixed(2)
  );

  // Summary
  if (qualityGate.passed) {
    qualityGate.reasons.unshift(
      `Generated ${testsFound}/${tasks.length} backend Vitest test files`
    );
  }

  // Threshold check
  if (fileScore < 0.95 || importScore < 0.9) {
    qualityGate.passed = false;
    qualityGate.retryRecommended = true;
  }

  // Add structured retry context for better retry feedback
  if (!qualityGate.passed) {
    qualityGate.retryContext = {
      stage: 'backend_test_generation',
      missingTests: missingTests.slice(0, 10),
      wrongImports: wrongImports.slice(0, 10),
      noBackendImports: noBackendImports.slice(0, 10),
      syntaxIssues: syntaxIssues.slice(0, 10)
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

    const result = validateBackendTestGeneration(phaseDef, qualityGate);

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

module.exports = { validateBackendTestGeneration };

