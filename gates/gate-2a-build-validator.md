# Gate 2a: Frontend Build Quality Validation (LLM)

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

Validate **code quality and architecture** aspects that E2E tests cannot cover. Functional correctness is validated by Playwright tests; this gate focuses on non-functional quality.

**Note**: This gate runs AFTER Playwright tests pass. If you're seeing this, the task's acceptance criteria have already been verified by automated tests.

## 📋 Task Overview
- **Task ID**: `{{BUILD_UNIT_ID}}`
- **Title**: `{{BUILD_UNIT_NAME}}`
- **Type**: `{{BUILD_UNIT_TYPE}}`
- **Execution Sequence**: {{BUILD_UNIT_SEQUENCE}} / {{BUILD_UNIT_FRONTEND_TOTAL}}

## 📝 Description
{{BUILD_UNIT_DESCRIPTION}}

## ✅ Acceptance Criteria (Already Verified by Playwright)
{{BUILD_UNIT_ACCEPTANCE_CRITERIA}}

---

## 🔍 Quality Checks (What This Gate Validates)

### 1. Code Architecture (40%)
- [ ] Server components used by default, `'use client'` only when needed for hooks/events
- [ ] Correct import patterns (`@/components/ui/`, `@/lib/`, `@/` paths)
- [ ] Components placed in correct directories per conventions
- [ ] No hardcoded values that should be environment variables or config
- [ ] Proper TypeScript usage (no unnecessary `any` types)
- [ ] Mock data uses simple fixtures/constants (no MSW or mock-service-worker)
- [ ] shadcn/ui base components (`src/components/ui/`) not modified to add wrapper-level padding/margin/gap (use Tailwind at usage sites instead)

### 2. React Best Practices (25%)
- [ ] Error boundaries present for components that could fail
- [ ] Loading states handled with Suspense or conditional rendering
- [ ] Keys provided for list items
- [ ] Event handlers use proper patterns (not creating functions in render)
- [ ] Memoization used appropriately (not over-used)

### 3. Accessibility & UX (20%)
- [ ] Interactive elements have accessible names (aria-label or visible text)
- [ ] Form inputs have associated labels
- [ ] Focus management handled for modals/dialogs
- [ ] Reasonable color contrast (not checking exact values, just obvious issues)
- [ ] `data-testid` attributes added for key elements (enables E2E testing)

### 4. Build Health (15%)
- [ ] No TypeScript errors: `pnpm tsc --noEmit` passes
- [ ] No lint errors: `pnpm lint` passes
- [ ] Dev server health: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` returns 200

---

## 🚨 Critical Failures (Automatic Fail)

- Required source files missing or mislocated
- TypeScript compilation would fail
- Import paths that would break at runtime
- `'use client'` on every component (indicates misunderstanding of server components)

---

## ⚠️ DO NOT Fail For

These are handled by Playwright tests or are subjective:
- Acceptance criteria not being met (Playwright validates this)
- Specific UI layout or styling (Playwright validates this)
- Component behavior (Playwright validates this)
- Minor code style preferences
- "Could be better" suggestions

---

## ✅ Passing Conditions

- All architecture checks pass
- No critical failures detected
- Build health commands succeed
- `score` = average of criteria scores

---

## 📝 Backend Handoff Check

- Verify `reference/backend-handoff.md` contains entry for `{{BUILD_UNIT_ID}}`
- Content should document any backend dependencies or mock patterns used
- FAIL if separate `backend-handoff-task-*.md` files were created

---

Remember: Output ONLY the JSON object—no prose, markdown, or extra commentary.
