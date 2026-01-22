# Gate 6: Backend Build Quality Validation (LLM)

## CRITICAL: OUTPUT FORMAT REQUIREMENTS

You MUST respond with ONLY valid JSON that matches the schema below. Do not include any text before or after the JSON object.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["passed", "score", "reasons", "criteria_scores", "retryRecommended", "criticalFailures"],
  "additionalProperties": false,
  "properties": {
    "passed": { "type": "boolean" },
    "score": { "type": "number", "minimum": 0, "maximum": 1 },
    "reasons": { "type": "array", "items": { "type": "string" } },
    "criteria_scores": { "type": "object", "additionalProperties": { "type": "number", "minimum": 0, "maximum": 1 } },
    "retryRecommended": { "type": "boolean" },
    "criticalFailures": { "type": "array", "items": { "type": "string" } }
  }
}
```

---

## 🎯 Purpose

Validate **code quality and architecture** aspects that API/integration tests cannot cover. Functional correctness is validated by Playwright tests; this gate focuses on non-functional quality.

**Note**: This gate runs AFTER Playwright tests pass. If you're seeing this, the task's acceptance criteria have already been verified by automated tests.

## 📋 Task Overview
- **Task ID**: `{{BUILD_UNIT_ID}}`
- **Title**: `{{BUILD_UNIT_NAME}}`
- **Type**: `{{BUILD_UNIT_TYPE}}`
- **Execution Sequence**: {{BUILD_UNIT_SEQUENCE}} / {{BUILD_UNIT_BACKEND_TOTAL}}

## 📝 Description
{{BUILD_UNIT_DESCRIPTION}}

## ✅ Acceptance Criteria (Already Verified by Playwright)
{{BUILD_UNIT_ACCEPTANCE_CRITERIA}}

## 📁 Backend Components
{{BUILD_UNIT_MODELS_SECTION}}

{{BUILD_UNIT_ACTIONS_SECTION}}

{{BUILD_UNIT_FETCHERS_SECTION}}

{{BUILD_UNIT_JOBS_SECTION}}

---

## 🔍 Quality Checks (What This Gate Validates)

### 1. Architecture Alignment (35%)
- [ ] Models match PRD schema specifications (field names, types, relationships)
- [ ] Actions implement required auth and tenancy patterns from manifest
- [ ] Fetchers apply documented data-access rules
- [ ] Jobs follow PRD-defined scheduling and safety constraints
- [ ] Files placed in correct directories per conventions

### 2. Code Quality (25%)
- [ ] Proper TypeScript usage (no unnecessary `any` types)
- [ ] Error handling implemented for all failure cases
- [ ] Validation using Zod schemas where appropriate
- [ ] No hardcoded values that should be config/env vars
- [ ] Consistent coding patterns with existing codebase

### 3. Security & Data Integrity (25%)
- [ ] Auth checks present on protected actions
- [ ] Tenancy/organization scoping applied where needed
- [ ] Input validation before database operations
- [ ] No SQL injection vectors (using Prisma properly)
- [ ] Sensitive data not logged or exposed

### 4. Build Health (15%)
- [ ] Prisma schema valid: `npx prisma validate` passes
- [ ] TypeScript compiles: `pnpm tsc --noEmit` passes
- [ ] Lint passes: `pnpm lint` passes
- [ ] Dev server running: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` returns 200

---

## 🚨 Critical Failures (Automatic Fail)

- Required files missing or mislocated
- Models don't match PRD schema
- TypeScript compilation would fail
- Auth/tenancy patterns violated
- Architecture contradicts PRD decisions

---

## ⚠️ DO NOT Fail For

These are handled by Playwright tests or are subjective:
- Acceptance criteria not being met (Playwright validates this)
- API returning correct data (Playwright validates this)
- Database operations working (Playwright validates this)
- Minor code style preferences
- "Could be better" suggestions

---

## ✅ Passing Conditions

- All architecture checks pass
- No critical failures detected  
- Build health commands succeed
- `score` = average of criteria scores

---

Remember: Output ONLY the JSON object—no prose, markdown, or extra commentary.

