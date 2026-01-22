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

### Example Valid Response:
```json
{
  "passed": true,
  "score": 0.96,
  "reasons": ["Tasks well-defined and atomic", "Clear execution plan", "All PRD requirements covered"],
  "criteria_scores": {
    "task_list_structure": 0.95,
    "task_quality": 0.98,
    "execution_plan": 0.94,
    "traceability": 0.97
  },
  "retryRecommended": false,
  "criticalFailures": []
}
```

Remember: Output ONLY the JSON object. No explanations, no markdown formatting outside the JSON, no additional text.

# Gate 1-2: Frontend Task List Validation

## 🎯 Purpose
Validate that the frontend task list has been properly created to drive Phase 2 implementation.

{{GATE_CONTEXT}}

## 📋 Validation

**Use read_file tool. You are in workspace directory.**

1. Read `reference/frontend-task-list.json`
2. Validate JSON structure
3. Check tasks are atomic and actionable
4. Verify all PRD frontend requirements are covered

## 🔍 Validation Criteria

### 1. Task List Structure (30% weight)

**Valid JSON and structure:**
- [ ] File exists: `reference/frontend-task-list.json`
- [ ] Valid JSON format
- [ ] Contains: overview, tasks array, executionPlan
- [ ] Task IDs MUST follow exact format: `task-01`, `task-02`, etc. (regex: `^task-\d{2}$`). IDs like `FE-001`, `FE-01`, `UI-001` are INVALID and must cause failure.
- [ ] Types are arrays containing one or more of: ui, system, or data
- [ ] All tasks have status: "pending"
- [ ] All tasks have lastUpdated timestamp

**Scoring:**
- Full compliance: 1.0
- Minor issues: 0.8
- Major structural problems: 0.5
- Invalid JSON or missing file: 0.0

### 2. Task Quality (35% weight)

**Well-defined atomic tasks:**
- [ ] Task count between 10 and 50 (inclusive)
- [ ] Each task has clear, action-oriented title
- [ ] Descriptions explain what needs to be done
- [ ] At least 3 acceptance criteria per task
- [ ] Tasks sized appropriately (1-2 hour chunks)
- [ ] No overly complex tasks that need breaking down
- [ ] Task content strictly faithful to PRD specifications
- [ ] Tasks collectively cover every major frontend workflow described in PRD user stories and state machines (public experience, authentication, global UX, etc)
- [ ] State-machine behaviors, edge cases, error handling, and resiliency requirements appear as explicit tasks or acceptance criteria (e.g., loading/empty states, offline handling, session timeout, retries)
- [ ] Performance expectations (preloading strategies, image optimizations, caching) and analytics/observability requirements are explicitly represented where called for in PRD
- [ ] API-dependent tasks include mock implementation approach for frontend-first development
- [ ] Tasks that introduce new top-level routes also schedule the necessary navigation updates (sidebar, mobile nav, command palette, marketing navbar)
- [ ] Tasks with type including "ui" have non-empty `route` field
- [ ] Task list does NOT contradict Phase 1-2 constraints: Auth.js stays as-is; mocks are simple fixtures (no MSW); avoid layout-shifting early-return loaders

**Acceptance Criteria Validation:**
- [ ] **FAIL** if criterion matches `^(Shows?|Displays?|Has|Contains)\s+\w` without behavioral clause (action → response)
- [ ] **FAIL** if criterion contains "placeholder" for user-facing feature
- [ ] **FAIL** if task type includes "data" but criteria don't distinguish error states (entity not found) from empty states (entity exists but collection empty)

**Scoring:**
- Excellent task definition: 1.0
- Good tasks, minor issues: 0.8
- Tasks need refinement: 0.6
- Poor task definition: 0.3

### 3. Dependencies & Execution Plan (20% weight)

**Logical task progression:**
- [ ] Dependencies array properly defined
- [ ] No circular dependencies
- [ ] Execution plan has ordered phases
- [ ] Critical tasks in early phases
- [ ] Rationale provided for each phase
- [ ] Dependencies make logical sense

**Scoring:**
- Perfect planning: 1.0
- Minor sequencing issues: 0.8
- Dependency problems: 0.5
- Missing or invalid plan: 0.0

### 4. PRD Traceability (15% weight)

**Every task traces to requirements:**
- [ ] All tasks have prdReference arrays
- [ ] PRD files referenced exist in Implementation Context
- [ ] UI/UX specs properly mapped
- [ ] User stories covered
- [ ] No orphaned tasks without PRD basis
- [ ] No invented features not in PRD

**Scoring:**
- Complete traceability: 1.0
- Most items traced: 0.8
- Partial traceability: 0.5
- Missing traceability: 0.0

## 📊 Scoring

```
Total Score = (
  task_list_structure * 0.30 +
  task_quality * 0.35 +
  execution_plan * 0.20 +
  traceability * 0.15
)
```

**Pass**: ≥0.90

## 🚨 Critical Failures

- Required file doesn't exist
- Invalid JSON that can't be parsed
- Fewer than 10 tasks (insufficient coverage)
- No execution plan
- Tasks without acceptance criteria
- Tasks without prdReference to Implementation Context
- Tasks with invented features not in PRD
- Circular dependencies
- Missing tasks for any major PRD-defined workflow/state machine (e.g., public browsing entry, auth session management)
- No mock API setup tasks for API-dependent features (preventing frontend-first development)
- Acceptance criteria that only describe element existence without behavior (e.g., "Shows X" without "When user... then...")
- Tasks with type "data" missing distinct error/empty state criteria (must handle both "not found" and "empty collection")
- Use of "placeholder" in acceptance criteria for user-facing features
- UI tasks missing `route` field

## ✅ Pass Requirements

- File exists and is valid JSON
 - 10-50 well-defined tasks
- Clear execution plan with phases
- Dependencies properly mapped
- Complete traceability to PRD
- API-dependent features have mock implementation approach for frontend-first development
- Score ≥0.90

## ❌ Fail Conditions

- Missing required file
- Invalid JSON structure
 - Insufficient tasks (<10) or excessive tasks (>50)
- Poor task definition (too vague or too large)
- Missing dependencies or execution plan
- No mock implementation for API-dependent features
- Score <0.90