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
  "reasons": ["Tasks properly cover frontend needs", "All APIs supported", "Clean task list"],
  "criteria_scores": {
    "task_list_structure": 0.95,
    "task_quality": 0.98,
    "frontend_alignment": 1.0,
    "execution_plan": 0.94,
    "document_cleanliness": 1.0
  },
  "retryRecommended": false,
  "criticalFailures": []
}
```

Remember: Output ONLY the JSON object. No explanations, no markdown formatting outside the JSON, no additional text.

# Gate 5-1: Backend Plan Revision Validation

## 🎯 Purpose
Validate that the backend task list properly supports the completed frontend implementation.

{{GATE_CONTEXT}}

## 📋 Validation

**Use read_file tool. You are in workspace directory.**

1. Read `reference/backend-task-list.json`
2. Validate JSON structure
3. Confirm tasks support all frontend features
4. Verify clean, production-ready document

## 🔍 Validation Criteria

### 1. Task List Structure (20% weight)

**Valid JSON and structure:**
- [ ] File exists: `reference/backend-task-list.json`
- [ ] Valid JSON format
- [ ] Contains: overview, tasks array, executionPlan
- [ ] Task IDs MUST follow exact format: `task-01`, `task-02`, etc. (regex: `^task-\d{2}$`). IDs like `BE-001`, `API-001` are INVALID.
- [ ] Types are: model, action, fetcher, job, or integration
- [ ] All tasks have status: "pending"
- [ ] Updated generated_at timestamp

**Scoring:**
- Full compliance: 1.0
- Minor issues: 0.8
- Major structural problems: 0.5
- Invalid JSON or missing file: 0.0

### 2. Frontend Alignment (35% weight) 🚨 CRITICAL

**Tasks must support all frontend features:**
- [ ] All Server Actions used in frontend have backend tasks
- [ ] Data models support all fields displayed in UI
- [ ] API response formats match frontend expectations
- [ ] Background jobs for user-triggered actions included
- [ ] No orphaned tasks for unused features

**If frontend features lack backend support → CRITICAL FAILURE**

**Scoring:**
- Complete frontend coverage: 1.0
- Missing critical features: 0.0 (critical failure)

### 3. Task Quality (25% weight)

**Well-defined atomic tasks:**
- [ ] Task count appropriate for application scope
- [ ] Each task has clear, action-oriented title
- [ ] Descriptions explain what needs to be done
- [ ] At least 3 acceptance criteria per task
- [ ] Tasks sized appropriately (1-2 hour chunks)
- [ ] Implementation paths specified where applicable

**Scoring:**
- Excellent task definition: 1.0
- Good tasks, minor issues: 0.8
- Tasks need refinement: 0.6
- Poor task definition: 0.3

### 4. Dependencies & Execution Plan (15% weight)

**Logical task progression:**
- [ ] Dependencies array properly defined
- [ ] No circular dependencies
- [ ] Execution plan has ordered phases
- [ ] Data models before APIs (logical order)
- [ ] Critical tasks in early phases

**Scoring:**
- Perfect planning: 1.0
- Minor sequencing issues: 0.8
- Dependency problems: 0.5
- Missing or invalid plan: 0.0

### 5. Document Cleanliness (5% weight)

**Production-ready document:**
- [ ] No revision notes or annotations
- [ ] No cancelled or deprecated tasks
- [ ] Clean, professional formatting
- [ ] Ready for developer handoff

**Scoring:**
- Completely clean: 1.0
- Has artifacts: 0.0

## 📊 Scoring

```
Total Score = (
  task_list_structure * 0.20 +
  frontend_alignment * 0.35 +
  task_quality * 0.25 +
  execution_plan * 0.15 +
  document_cleanliness * 0.05
)
```

**Pass**: ≥0.90

## 🚨 Critical Failures

- Frontend features without backend support
- Required file doesn't exist
- Invalid JSON that can't be parsed
- No tasks defined
- Tasks without acceptance criteria

## ✅ Pass Requirements

- File exists and is valid JSON
- All frontend features have backend support
- Well-defined tasks with clear criteria
- Clear execution plan with phases
- Clean document without artifacts
- Score ≥0.90

## ❌ Fail Conditions

- Missing frontend API coverage
- Missing required file
- Invalid JSON structure
- Poor task definition
- Document contains revision artifacts
- Score <0.90

