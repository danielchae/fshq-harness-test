# Phase 5-1: Backend Plan Revision

Review and finalize the backend task list based on the completed frontend implementation. When the final backend task list is fully executed, it should result in a fully functional full-stack application.

In our overall build process, we are 1) building the entire frontend first, 2) presenting it to the client to experience fully (with mock data where necessary), then 3) building the entire backend afterwards. Your job is to create the comprehensive task list to achieve #3.

## Prerequisites
- Completed Phase 2 (Frontend Implementation)
- Completed Phase 3 (Frontend Polish)
- Completed Phase 4 (Frontend Validation)
- Existing backend task list at `reference/backend-task-list.json`
- Backend handoff document at `reference/backend-handoff.md`

## 📤 Backend Handoff Document

**Read the frontend developer notes:**
```bash
cat reference/backend-handoff.md
```

This document contains helpful notes from frontend development:
- Mock Server Actions created with expected signatures
- Data structure assumptions and validation patterns
- Edge cases handled in the UI
- Performance considerations noted
- Any "heads up" items for backend implementation

**Use these notes to refine your backend task list where helpful.**

## 📁 File to Update

**Update this file**: `reference/backend-task-list.json`

---

## 🎯 Your Mission

Now that the frontend is complete, produce a final, definitive backend task list:

1. **Review Frontend Implementation**
   - Read `reference/backend-handoff.md` for any helpful notes from frontend dev
   - Check all Server Actions called by frontend components
   - Identify actual data structures used
   - Note API response formats expected

2. **Revise Task List**
   - Add any missing tasks needed for frontend
   - Remove tasks for unused features
   - Update task details to match frontend reality
   - Adjust priorities based on critical features

3. **Produce Clean Output**
   - Final task list with NO revision notes
   - All tasks status: "pending"
   - Clear, actionable task definitions
   - Logical execution plan

4. **Link Frontend Handoff Notes**
   - For each backend task, identify which frontend tasks documented relevant simulation code or integration notes in `reference/backend-handoff.md`
   - Add a `handoffNotes` field to the task with the specifically relevant notes
   - Example: `"handoffNotes": "BulkImport uses setTimeout simulation at src/components/capture/bulk-import.tsx:155. Replace with bulkCreateObjectsAction."`
   - If no relevant frontend handoff notes exist, set `handoffNotes` field empty.

---

## 🔍 Placeholder Inventory (Required)

Before revising tasks, inventory placeholders in built frontend:

```bash
# Find mock implementations
grep -r "// MOCK:" src/data/ --include="*.ts" -l

# Find placeholder URLs
grep -rE "picsum\.photos|placeholder\.com|via\.placeholder" src/ --include="*.ts" --include="*.tsx" -l

# Find TODO/FIXME stubs that may return fake success (workflow wiring risk)
grep -rE "(TODO|FIXME).*(return|success)" src/data/ src/lib/ --include="*.ts" -l
```

For EACH placeholder found:
1. Verify a backend task exists to replace it
2. If missing, add task with `implementation.path` pointing to the file

For EACH TODO stub found that returns a value:
1. Review the function to determine if it's on a user-facing path
2. If it returns fake success (e.g., `success: true` without real implementation), ensure a task exists to implement it
3. These are high-risk for "workflow wiring" bugs where actions appear to succeed but don't complete all steps

Gate 7-1 will verify no placeholder URLs or TODO stubs returning fake success remain after backend build.

---

## 📝 Task Structure

> ⚠️ **CRITICAL - TASK ID FORMAT**: Task IDs MUST be exactly `task-01`, `task-02`, etc. (regex: `^task-\d{2}$`). Do NOT use prefixes like `BE-` or `API-`.

```json
{
  "id": "task-01",
  "title": "Clear action-oriented title",
  "description": "What needs to be done",
  "status": "pending",
  "type": "model|action|fetcher|job|integration",
  "lastUpdated": "2024-11-02T14:30:00Z",
  "dependencies": ["other-task-ids"],
  "acceptanceCriteria": [
    "Specific testable criterion",
    "Another criterion"
  ],
  "expectedStateChanges": [
    "Primary record created with all required fields",
    "Related downstream records created (e.g., Channel records for each workspace)",
    "External data synced (e.g., Matchups for all weeks)"
  ],
  "typeContract": "src/types/domain.ts:TypeName or null",
  "implementation": {
    "path": "Where this will be implemented",
    "cacheStrategy": "If applicable"
  },
  "prdReference": ["prd/file-path.md"]
}
```

### expectedStateChanges Field (Required for User-Facing Actions)

For tasks implementing **user-facing actions** (type: `action`) that create primary entities or connect to external systems, include `expectedStateChanges`:

- **Required for**: Actions that create workspaces/organizations, connect external platforms, import data, or trigger multi-step workflows
- **Purpose**: Defines ALL downstream records that must exist after the action completes successfully
- **Used by**: Phase-5-2 generates tests asserting these state changes; Phase-6 uses them as a wiring checklist

Example for a "Create Workspace from Template" action:
```json
"expectedStateChanges": [
  "Workspace record created with all required fields",
  "Default channels created from template definition",
  "Admin membership created for workspace creator",
  "Initial settings populated from template defaults"
]
```

### typeContract Field (Required for Fetchers)

For tasks of type `fetcher` that return data consumed by frontend components:

1. **Find the existing mock implementation**:
   ```bash
   grep -r "// MOCK" src/data/ --include="*.ts" | head -5
   ```

2. **Extract the return type** from the mock file's function signature:
   ```typescript
   // Example: src/data/onboarding/get-onboarding-teams.ts
   export async function getRoleOptions(): Promise<RoleOption[]> {
   //                                              ^^^^^^^^^^^ This is the type contract
   ```

3. **Document in task**:
   ```json
   "typeContract": "src/types/onboarding.ts:RoleOption"
   ```

4. **If no explicit type exists**, set to `null` but note this in `handoffNotes`.

Phase-6 will instruct the LLM to read this type file before implementing. Gate-6 enforces `pnpm tsc --noEmit` and will fail if return types don't match.

**NO revision notes, NO cancelled status, NO developer annotations**

---

## 🔍 Review Checklist

Ensure the final task list covers:

1. **All Frontend APIs**
   - Every Server Action imported has a task
   - Parameters match what frontend sends
   - Response formats align with expectations

2. **Complete Data Models**  
   - Fields for everything frontend displays
   - Relationships for UI navigation
   - Enums for all dropdowns

3. **Required Features**
   - Data fetchers for all queries
   - Background jobs for async operations
   - Integrations frontend depends on

4. **Data Layer Coverage**
   - Run: `grep -r "// MOCK" src/data/` to find pending conversions
   - Every mock data layer file MUST have a backend task
   - If any file is not covered, add a task for it
   - These tasks should specify the exact file path to update

---

## ✅ Quality Requirements

Your final `backend-task-list.json` MUST:
- [ ] Be a clean, definitive document
- [ ] Include only tasks actually needed
- [ ] Have all tasks with status: "pending"
- [ ] Update `generated_at` timestamp
- [ ] Maintain valid JSON syntax
- [ ] Enable a fully functioning app

---

## 🔍 Verification

After updating:
```bash
# Verify valid JSON
cat reference/backend-task-list.json | jq . > /dev/null && echo "✅ Valid JSON"

# Check all tasks are pending
cat reference/backend-task-list.json | jq '.tasks[] | select(.status != "pending") | .id' | grep . && echo "❌ Non-pending tasks found" || echo "✅ All tasks pending"

# Verify no revision artifacts
cat reference/backend-task-list.json | jq '.tasks[] | select(.revisionNote != null) | .id' | grep . && echo "❌ Revision notes found" || echo "✅ Clean task list"
```

**Phase PASSES when:**
- All frontend needs covered
- Clean task list (no artifacts)
- Valid execution plan
- Ready for backend implementation

