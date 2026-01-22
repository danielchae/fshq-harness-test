#!/usr/bin/env node

/**
 * Gate 3-2: Frontend Polish Audit Validator
 * Validates fe-polish-findings.json has valid structure.
 */

const fs = require('fs');
const path = require('path');

function validate(phaseDef, qualityGate) {
  const findingsPath = path.join(process.cwd(), 'reference', 'fe-polish-findings.json');

  if (!fs.existsSync(findingsPath)) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('reference/fe-polish-findings.json not found');
    return qualityGate;
  }

  let findings;
  try {
    findings = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
  } catch (error) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push(`JSON parse error: ${error.message}`);
    return qualityGate;
  }

  if (!findings.items || !Array.isArray(findings.items)) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('Missing "items" array');
    return qualityGate;
  }

  if (findings.items.length === 0) {
    qualityGate.passed = false;
    qualityGate.criticalFailures.push('No items evaluated');
    return qualityGate;
  }

  // Validate each item has required fields
  const issues = [];
  for (const item of findings.items) {
    if (!item.id) issues.push('Item missing id');
    else if (!item.status || !['pass', 'fail'].includes(item.status)) {
      issues.push(`${item.id}: invalid status`);
    }
    else if (!item.title) issues.push(`${item.id}: missing title`);
    else if (!item.details) issues.push(`${item.id}: missing details`);
  }

  if (issues.length > 0) {
    qualityGate.passed = false;
    qualityGate.reasons.push(...issues.slice(0, 5));
    // Add structured retry context for better retry feedback
    qualityGate.retryContext = {
      stage: 'frontend_polish_audit',
      issues: issues.slice(0, 10)
    };
    return qualityGate;
  }

  const passCount = findings.items.filter(i => i.status === 'pass').length;
  const failCount = findings.items.filter(i => i.status === 'fail').length;
  
  qualityGate.score = 1.0;
  qualityGate.reasons.push(`Audit complete: ${passCount} passed, ${failCount} need remediation`);

  return qualityGate;
}

if (require.main === module) {
  const qualityGate = {
    passed: true,
    reasons: [],
    score: 0,
    retryRecommended: false,
    criticalFailures: [],
    criteria_scores: {}
  };

  const result = validate({}, qualityGate);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}

module.exports = { validate };


