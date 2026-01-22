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
  "reasons": ["Tasks well-defined and atomic", "Multi-tenancy properly addressed", "Clear execution plan"],
  "criteria_scores": {
    "task_list_structure": 0.95,
    "task_quality": 0.98,
    "multi_tenancy": 1.0,
    "execution_plan": 0.94,
    "traceability": 0.96
  },
  "retryRecommended": false,
  "criticalFailures": []
}
```

Remember: Output ONLY the JSON object. No explanations, no markdown formatting outside the JSON, no additional text.

# Gate 1-3: Backend Task List Validation

## 🎯 Purpose
Validate that the backend task list has been properly created to drive Phase 6 implementation.

{{GATE_CONTEXT}}

## 📋 Validation

**Use read_file tool. You are in workspace directory.**

1. Read `reference/backend-task-list.json`
2. Validate JSON structure
3. Confirm tasks align with PRD-defined architecture and tenancy decisions
4. Verify all PRD backend requirements are covered

## 🔍 Validation Criteria

### 1. Task List Structure (25% weight)

**Valid JSON and structure:**
- [ ] File exists: `reference/backend-task-list.json`
- [ ] Valid JSON format
- [ ] Contains: overview, tasks array, executionPlan
- [ ] Task IDs MUST follow exact format: `task-01`, `task-02`, etc. (regex: `^task-\d{2}$`). IDs like `BE-001`, `BE-01`, `API-001` are INVALID and must cause failure.
- [ ] Types are: model, action, fetcher, job, or integration
- [ ] All tasks have status: "pending"
- [ ] All tasks have lastUpdated timestamp

**Scoring:**
- Full compliance: 1.0
- Minor issues: 0.8
- Major structural problems: 0.5
- Invalid JSON or missing file: 0.0

### 2. Architecture Alignment (25% weight) 🚨 CRITICAL

**Tasks must match PRD-defined architecture:**
- [ ] Overview accurately reflects key architectural decisions from PRD
- [ ] Model tasks reflect required fields, relationships, and constraints
- [ ] Action/fetcher tasks use correct clients, auth flows, and security rules
- [ ] Cache, job, and integration tasks follow PRD performance requirements

**If ANY task contradicts PRD architecture → CRITICAL FAILURE**

**Scoring:**
- All tasks align with PRD architecture: 1.0
- Any contradictions to PRD specifications: 0.0 (critical failure)

### 3. Task Quality (30% weight)

**Well-defined atomic tasks:**
- [ ] Task count between 10 and 50 (inclusive)
- [ ] Each task has clear, action-oriented title
- [ ] Descriptions explain what needs to be done
- [ ] At least 3 acceptance criteria per task
- [ ] Tasks sized appropriately (1-2 hour chunks)
- [ ] Implementation paths specified where applicable
- [ ] Task content strictly faithful to PRD specifications
- [ ] Action/fetcher/job tasks include at least one negative/security acceptance criterion where applicable (e.g., "Returns 403 if user lacks permission")

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
- [ ] Rationale provided for each phase

**Scoring:**
- Perfect planning: 1.0
- Minor sequencing issues: 0.8
- Dependency problems: 0.5
- Missing or invalid plan: 0.0

### 5. PRD Traceability (5% weight)

**Every task traces to requirements:**
- [ ] All tasks have prdReference arrays
- [ ] PRD files referenced exist in Implementation Context
- [ ] Data schema specs mapped to model tasks
- [ ] API specs mapped to action/fetcher tasks
- [ ] Business logic specs referenced
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
  task_list_structure * 0.25 +
  architecture_alignment * 0.25 +
  task_quality * 0.30 +
  execution_plan * 0.15 +
  traceability * 0.05
)
```

**Pass**: ≥0.90

## 🚨 Critical Failures

- Tasks contradict PRD-defined architecture decisions
- Required file doesn't exist
- Invalid JSON that can't be parsed
- Fewer than 10 tasks (insufficient coverage)
- No execution plan
- Tasks without acceptance criteria
- Tasks without prdReference to Implementation Context
- Tasks with invented features not in PRD

## ✅ Pass Requirements

- File exists and is valid JSON
- Tasks align with PRD-defined architecture
- 10-50 well-defined tasks
- Clear execution plan with phases
- Dependencies properly mapped
- Complete traceability to PRD
- Score ≥0.90

## ❌ Fail Conditions

- Tasks contradict PRD-defined architecture
- Missing required file
- Invalid JSON structure
- Insufficient tasks (<10) or excessive tasks (>50)
- Poor task definition
- Missing dependencies or execution plan
- Score <0.90