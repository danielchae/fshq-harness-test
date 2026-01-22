## CRITICAL: OUTPUT FORMAT REQUIREMENTS

You MUST respond with ONLY valid JSON that matches this exact schema. Do not include any text before or after the JSON object.

### JSON Schema (REQUIRED)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["passed", "score", "reasons", "criteria_scores", "retryRecommended", "criticalFailures"],
  "properties": {
    "passed": { "type": "boolean" },
    "score": { "type": "number", "minimum": 0, "maximum": 1 },
    "reasons": { "type": "array", "items": { "type": "string" } },
    "criteria_scores": { "type": "object", "additionalProperties": { "type": "number", "minimum": 0, "maximum": 1 } },
    "retryRecommended": { "type": "boolean" },
    "criticalFailures": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": false
}
```

Remember: Output ONLY the JSON object. No explanations, no markdown formatting outside the JSON, no additional text.

# Gate 3-3: Frontend Polish Fix Validator

## 🎯 Purpose
Validate that the frontend polish fix was implemented correctly.

## 📋 Fix Details
- **Checklist Item ID**: `{{BUILD_UNIT_ID}}`
- **Title**: `{{BUILD_UNIT_NAME}}`

### Original Issue
{{BUILD_UNIT_DETAILS}}

## 🔍 Validation Process

1. **Verify the fix addresses the original issue**
   - Check the specific files/locations mentioned in the audit finding
   - Confirm the problematic pattern no longer exists

2. **Check for regressions**
   - Ensure TypeScript still compiles: `pnpm tsc --noEmit`
   - Verify the app still runs: check http://localhost:3000

3. **Validate the fix quality**
   - Fix is surgical and minimal
   - No unrelated changes
   - Follows existing code patterns

## ✅ Pass Conditions

- The original issue is resolved
- No TypeScript errors introduced
- App still functions correctly
- Fix is appropriate for the issue

## ❌ Fail Conditions

- Original issue still present
- New TypeScript errors introduced
- App broken by the fix
- Fix is incomplete or incorrect

## 📊 Scoring

- **issue_resolved**: 1.0 if fixed, 0.0 if still present
- **no_regressions**: 1.0 if no new errors, 0.0 if broken
- **fix_quality**: 1.0 if surgical, 0.5 if over-engineered

**Pass threshold**: score >= 0.9

---

Remember: Output ONLY the JSON object—no prose, markdown, or extra commentary.


