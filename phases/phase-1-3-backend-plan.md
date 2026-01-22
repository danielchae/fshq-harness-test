# Phase 1-3: Backend Task List Creation

Extract and organize backend development tasks from the PRD source files into an actionable task list that, when fully executed, will result in a fully functional application.

In our overall build process, we are 1) starting with a boilerplate template SaaS application, 2) building the entire frontend on top of that existing boilerplate app, 3) presenting it to the client to experience fully (with mock data where necessary), then 4) building the rest of the backend afterwards. Your job is to create the comprehensive task list to achieve #4 so that we can end up with a polished production-ready app with no mock data routing or temporary code.

## Prerequisites
- Completed Phase 1-1 (PRD Context Mapping)
- Completed Phase 1-2 (Frontend Task List) 

{{PRD_CONTEXT}}

---

## 📁 File to Update

**You MUST update this file**: `reference/backend-task-list.json`
**Location**: The file exists in the reference folder. Update it in place.
**CRITICAL**: The file path is `reference/backend-task-list.json`, NOT at workspace root, NOT `prd/backend-task-list.json`

---

## 🚨 WHAT TO DO

First verify the file exists:
```bash
ls -la reference/backend-task-list.json
```

Then fill out ALL fields in this existing JSON file by analyzing the PRD files listed above.

---

## 🎯 Your Mission

Analyze the PRD files to extract all backend development tasks. Each task should be:
- **Atomic**: Completable in 1-2 hours (one focused work session)
- **Testable**: Clear acceptance criteria from PRD specs
- **Independent**: Minimal dependencies on other tasks
- **Actionable**: Clear what needs to be built

**CRITICAL REQUIREMENT**: The `prdReference` field MUST only reference files from the "Implementation Context" section above. These are your authoritative source documents. Your task list content MUST faithfully represent the requirements, specifications, and data schemas from these PRD files - do not invent or assume functionality not explicitly documented in the referenced PRD files.

---

## 📝 Task Structure to Follow

Each task in the `tasks` array should have this structure:

> ⚠️ **CRITICAL - TASK ID FORMAT**: Task IDs MUST be exactly `task-01`, `task-02`, `task-03`, etc. using a **2-digit number with leading zero**. Do NOT use prefixes like `BE-`, `API-`, `DB-`, or any other format. The regex pattern is: `^task-\d{2}$`
>
> ✅ CORRECT: `task-01`, `task-02`, `task-10`, `task-42`  
> ❌ WRONG: `BE-001`, `BE-01`, `task-1`, `backend-01`, `API-001`

```json
{
  "id": "task-01",
  "title": "Action-oriented title (e.g., Create user authentication API)",
  "description": "Clear description of what needs to be done",
  "status": "pending",
  "type": "model|action|fetcher|job|integration",
  "lastUpdated": "ISO 8601 timestamp (e.g., 2024-10-29T12:00:00Z)",
  "dependencies": ["other-task-ids"],
  "acceptanceCriteria": [
    "Specific testable criterion from PRD",
    "Another criterion",
    "..."
  ],
  "implementation": {
    "path": "Where this will be implemented",
    "multiTenant": true,
    "cacheStrategy": "If applicable"
  },
  "prdReference": ["prd/file-path.md"],
  "subtasks": [
    {
      "id": "parent-id.1",
      "title": "Specific subtask if needed",
      "description": "Details for complex tasks",
      "status": "pending"
    }
  ]
}
```

The `executionPlan.phases` array should group tasks logically:

```json
{
  "order": 1,
  "name": "Data Layer",
  "taskIds": ["task-01", "task-02"],
  "rationale": "Why these tasks go first"
}
```

---

## 📋 Task Extraction Process

### STEP 1: Analyze PRD for Backend Work
Read through the PRD files above and identify:
- **Data Models**: Database schemas, relationships
- **API Endpoints**: Server Actions, data fetchers
- **Business Logic**: Workflows, validations, calculations
- **Background Jobs**: Scheduled tasks, async operations
- **Integrations**: External services, APIs
- **Security**: Authentication, authorization, permissions

### STEP 1.5: Filter Stack Conflicts

If PRD mentions technologies that duplicate existing stack capabilities, DO NOT create tasks for them. For example:

| PRD Mentions | Use Instead |
|--------------|-------------|
| Supabase Auth, Firebase Auth | Auth.js (already configured) |
| Supabase Database, MongoDB | Prisma + PostgreSQL (already configured) |
| External file storage | Supabase Storage (already configured - bucket: `samus-storage`) |

Create tasks that USE existing stack to fulfill the requirement. Document the mapping in task description.

### STEP 2: Create Atomic Tasks
Break down features into tasks that are:
- **Focused**: One clear deliverable (e.g., one model, one API endpoint)
- **Sized Right**: 1-2 hours of work
- **Complete**: Includes all aspects (schema, logic, validation)
- **Testable**: Can verify it works per PRD specs

**Examples of good task granularity:**
- "Create User model with organization relationship"
- "Implement user registration server action"
- "Add email verification background job"
- "Create product search data fetcher with caching"
- "Implement inventory update workflow"

**Data flow completeness**: For any task involving file storage or data persistence, ensure BOTH write path (upload/save) AND read path (retrieve/serve) are covered in acceptance criteria.

### STEP 3: Apply PRD Architecture Patterns
For every data model task:
- If PRD defines tenancy patterns (single-tenant vs. multi-tenant), align accordingly
- Use the appropriate action client and auth primitives specified in PRD
- Consider cache invalidation strategy
- Apply security and data-isolation rules documented in the PRD

### STEP 4: Identify Dependencies
For each task, determine:
- What models must exist first?
- What other APIs are required?
- What external services needed?
- What authentication/authorization required?

### STEP 5: Create Execution Plan
Group tasks into logical phases. For example:
- **Phase 1**: Data Models (foundation)
- **Phase 2**: Core APIs (CRUD operations)
- **Phase 3**: Business Logic (workflows, calculations)
- **Phase 4**: Background Jobs (async operations)
- **Phase 5**: Data Layer Integration (replace mock implementations in src/data/ files)
- **Phase 6**: Integrations (external services)

### STEP 5.5: Map Data Layer Files

Frontend creates data layer files with mock implementations that backend must replace with real Prisma queries.

Search for `// MOCK:` comments in `src/data/`:
```bash
grep -r "// MOCK" src/data/ --include="*.ts"
```

Each file found needs a backend task to:
- Replace mock implementation with Prisma query
- Keep function signature identical (API routes already call it)
- Remove fixture imports once converted

These are typically `type: "fetcher"` tasks. Include the exact file path in task description.

### STEP 6: Update Metadata
Calculate and fill in:
- `generated_at`: Current ISO 8601 timestamp
- `overview`: Brief description of the backend scope from PRD
- `metadata.totalTasks`: Count of all tasks
- `metadata.estimatedHours`: Sum of all task estimates (1-2 hours each)
- `metadata.modelCount`: Count of model tasks
- `metadata.actionCount`: Count of action tasks
- `metadata.fetcherCount`: Count of fetcher tasks
- `metadata.jobCount`: Count of background job tasks
- `metadata.integrationCount`: Count of integration tasks
- `metadata.prdCoverage`: List the PRD files that were covered

---

## ⚠️ CRITICAL: Architecture Alignment

**EVERY new data model task MUST:**
1. Follow the architecture patterns actually defined in the PRD (if any)
2. Reference the correct action/data access layer per PRD guidance
3. Include appropriate cache invalidation where required
4. Respect security, validation, and data isolation rules from the PRD

### Non-negotiables by Task Type
| Type | Must Include |
|------|--------------|
| **model** | Schema fields, relationships, indexes, migration |
| **action** | Input validation, auth check, error handling, at least one negative/permission case in acceptance criteria |
| **fetcher** | Auth check, cache strategy (if applicable), **distinct error shapes** (not-found vs empty-collection) |
| **job** | Retry/failure handling, idempotency consideration, callable function for on-demand invocation (not just cron) |
| **integration** | Error handling for external failures, timeout/retry strategy |

**"Triggers" Validation**: When task AC uses "triggers", "calls", or "invokes" another component, verify that target component's task includes a callable interface in its AC - not just scheduled execution.

**Acceptance Criteria Requirements:**
- At least one negative/security case per action/fetcher/job (e.g., "Returns 403 if user lacks permission")
- At least one data-integrity case for model tasks when relationships exist (e.g., "Cascade deletes child records")

**Example model task:**
```json
{
  "id": "task-04",
  "title": "Create Dog model aligned with PRD schema",
  "description": "Define Dog schema using the fields, enums, and constraints specified in the PRD",
  "acceptanceCriteria": [
    "Model matches PRD-required fields and enums",
    "Relationships follow the documented ERD",
    "Indexes support documented query patterns",
    "Migration script created"
  ],
  "implementation": {
    "path": "prisma/schema.prisma"
  }
}
```

---

## 🎯 Example Tasks

Good task examples from a typical e-commerce PRD:

```json
{
  "id": "task-05",
  "title": "Create Session model with PRD security rules",
  "description": "Define Session schema using token, expiry, and cleanup constraints specified in the PRD",
  "status": "pending",
  "type": "model",
  "lastUpdated": "2024-10-29T14:30:00Z",
  "dependencies": ["create-staff-model"],
  "acceptanceCriteria": [
    "Model includes token, expiresAt, isUsed fields",
    "Foreign key references Staff with documented cascade rules",
    "Indexes support token validation and cleanup queries",
    "Cleanup requirements documented in PRD are covered"
  ],
  "implementation": {
    "path": "prisma/schema.prisma"
  },
  "prdReference": ["prd/specs/02-data-schema.json", "prd/specs/14-workflow-functions.json"]
}
```

```json
{
  "id": "task-06",
  "title": "Implement deletePhoto server action",
  "description": "Server action to remove photos and trigger CDN cleanup following PRD rules",
  "status": "pending",
  "type": "action",
  "lastUpdated": "2024-10-29T14:35:00Z",
  "dependencies": ["create-photo-model", "integration-cloudinary"],
  "acceptanceCriteria": [
    "Validates business rules from PRD before deletion",
    "Queues CDN cleanup workflow",
    "Recalculates display order and primary photo",
    "Invalidates documented cache tags"
  ],
  "implementation": {
    "path": "src/actions/photos/delete-photo.ts",
    "cacheStrategy": "Invalidate dog profile caches"
  },
  "prdReference": ["prd/specs/12-business-functions.json", "prd/specs/06-integration-functions.json"]
}
```

---

## ✅ Quality Requirements

Your updated `backend-task-list.json` MUST have:
- [ ] Valid JSON syntax
- [ ] `generated_at` with current ISO timestamp
- [ ] Meaningful `overview` describing backend scope
- [ ] Task count between 10 and 50 (inclusive)
- [ ] Each task with all required fields
- [ ] Task IDs MUST follow exact format: `task-01`, `task-02`, etc. (2-digit with leading zero, NO prefixes like BE- or API-)
- [ ] All tasks set to `status: "pending"`
- [ ] Valid `type` values (model, action, fetcher, job, or integration)
- [ ] At least 3 acceptance criteria per task
- [ ] Proper dependency mapping
- [ ] Logical execution plan with 4-5 phases
- [ ] Updated metadata with accurate counts
- [ ] PRD references only to files from Implementation Context

---

## 🚫 Common Pitfalls to Avoid

**CRITICAL FAILURES:**
- Ignoring PRD-defined architecture or security requirements
- Forgetting cache invalidation for mutations documented in PRD
- Not using proper action client or access layer specified in PRD

**AVOID:**
- Tasks that are too large (> 2 hours)
- Vague task descriptions
- Missing acceptance criteria
- Circular dependencies
- Tasks without prdReference from "Implementation Context"
- Inventing features not explicitly in PRD documents
- Invalid JSON syntax
- Empty or minimal task lists

**DO:**
- Keep tasks focused and atomic
- Capture tenancy, security, and caching rules exactly as described in the PRD
- Include clear acceptance criteria
- Map all dependencies explicitly
- Reference ONLY PRD files from "Implementation Context" section
- Extract requirements EXACTLY as specified in PRD (no embellishment)
- Include lastUpdated timestamp for all tasks
- Consider caching and performance
- Ensure comprehensive coverage of PRD requirements

---

## 🔍 FINAL VERIFICATION

After updating the file, verify it's valid:
```bash
# Check file exists and is valid JSON
cat reference/backend-task-list.json | jq . > /dev/null && echo "✅ Valid JSON"

# Check task count
cat reference/backend-task-list.json | jq '.tasks | length'

# Check all tasks have required fields
cat reference/backend-task-list.json | jq '.tasks[] | select(.id == null or .title == null or .acceptanceCriteria == null or .prdReference == null)' | jq -s 'if length > 0 then "❌ Some tasks missing required fields" else "✅ All tasks have required fields" end'

# Verify generated_at is set
cat reference/backend-task-list.json | jq '.generated_at' | grep -q "^\"20" && echo "✅ Timestamp set" || echo "❌ Missing timestamp"
```

**Phase PASSES when:**
- File is updated with valid JSON
- Task count between 10 and 50
- All required fields populated
- Execution plan defined
- Metadata updated
- PRD traceability complete

**Phase FAILS if:**
- Invalid JSON syntax
- Fewer than 10 tasks or more than 50 tasks
- Tasks contradict PRD-defined architecture rules
- Missing required fields
- No execution plan
- Metadata not updated
- Tasks without PRD references