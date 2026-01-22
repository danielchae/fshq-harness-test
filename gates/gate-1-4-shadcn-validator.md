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

### Example Valid Response
```json
{
  "passed": true,
  "score": 0.92,
  "reasons": ["Annotated components have valid structure", "Referenced components exist on disk", "Build passes cleanly"],
  "criteria_scores": {
    "annotation_quality": 0.95,
    "target_paths": 0.90,
    "component_files": 1.0,
    "build_health": 1.0
  },
  "retryRecommended": false,
  "criticalFailures": []
}
```

Remember: Output ONLY the JSON object. No explanations, no markdown formatting outside the JSON, no additional text.

# Gate 1-4: shadcn Components Validation

## 🎯 Purpose
Confirm the frontend task list documents shadcn/ui usage per task, the referenced components are actually installed, and verification evidence exists so Phase 2 can build without extra setup.

{{GATE_CONTEXT}}

## 📋 Validation

**Use read_file tool. You are in workspace directory.**

1. Read `reference/frontend-task-list.json`.
2. Inspect every task's `uiDependencies` array.
3. For each dependency with a non-empty `targetPath`, verify the file exists using the terminal.

## 🔍 Validation Criteria

### 1. Annotation Quality (25% weight)
- [ ] Tasks that have `uiDependencies` use valid structure: each entry has `component`, `docsUrl`, and `targetPath`.
- [ ] `docsUrl` matches the official pattern `https://ui.shadcn.com/docs/components/<slug>`.
- [ ] `component` values are kebab-case slugs suitable for `npx shadcn@latest add`.
- [ ] Tasks without `uiDependencies` or with empty arrays are acceptable (not every task needs shadcn).

Scoring: valid structure on annotated tasks 1.0; minor format issues 0.8; invalid docs URLs or malformed entries 0.5.

### 2. Target Paths (20% weight)
- [ ] `targetPath` values use correct pattern: `@/components/ui/<component>` for single-app structure.
- [ ] Path patterns are consistent across annotated tasks.

Scoring: correct paths 1.0; minor inconsistencies 0.8; incorrect patterns 0.5.

### 3. Component Files Present (30% weight)
- [ ] For every dependency whose `targetPath` is non-empty, the file exists on disk.
- [ ] Verify component files contain actual shadcn component code (not empty).

Scoring: all referenced files present 1.0; a single missing file 0.7; multiple missing files 0.3.

### 4. Build Health (25% weight) - CRITICAL
Run a build check to ensure no breaking changes were introduced:
```bash
cd /workspace && pnpm tsc --noEmit 2>&1 | head -30
```

- [ ] TypeScript compilation succeeds (no errors).
- [ ] No CSS/Tailwind errors (check for "Can't resolve" errors in output).
- [ ] No missing module errors introduced by this phase.

Scoring: build passes cleanly 1.0; warnings only 0.9; **any build error 0.0 (critical failure)**.

⚠️ **This is a blocking check**: If the build is broken, the gate MUST fail regardless of other scores.

## 📊 Scoring

```
Total Score = (
  annotation_quality * 0.25 +
  target_paths * 0.20 +
  component_files * 0.30 +
  build_health * 0.25
)
```

**Pass**: ≥ 0.85 AND build_health > 0

## 🚨 Critical Failures
- `reference/frontend-task-list.json` missing or invalid JSON.
- Referenced component file absent (targetPath points to missing file).
- **Build errors (TypeScript, CSS, or module resolution failures).**

## ✅ Pass Requirements
- Task list retains prior data and stays valid JSON.
- Annotated components have valid structure and exist on disk.
- Build passes cleanly.
- Score ≥ 0.85.

## ❌ Fail Conditions
- Invalid annotation structure on tasks that have `uiDependencies`.
- Referenced components missing from disk.
- Build failures.
- Score < 0.85.
