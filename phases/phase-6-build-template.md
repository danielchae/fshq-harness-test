# Phase 6: Build {{BUILD_UNIT_NAME}}

There are {{BUILD_UNIT_BACKEND_TOTAL}} backend tasks and {{BUILD_UNIT_FRONTEND_TOTAL}} frontend tasks in this workflow. {{BUILD_UNIT_BACKEND_COMPLETED}} backend tasks have been completed so far; this is backend task #{{BUILD_UNIT_SEQUENCE}}.

Your job is to implement backend task `{{BUILD_UNIT_ID}}` based on PRD requirements.

## 🧾 Task Snapshot
- **Type**: {{BUILD_UNIT_TYPE}}
- **Execution Sequence**: {{BUILD_UNIT_SEQUENCE}}
- **Execution Phase**: {{BUILD_UNIT_PHASE_LABEL}}
- **Phase Position**: {{BUILD_UNIT_PHASE_POSITION}}
- **Dependencies**: {{BUILD_UNIT_DEPENDENCIES}}
- **Last Updated**: {{BUILD_UNIT_LAST_UPDATED}}

{{PRD_CONTEXT}}

{{WORKSPACE_STRUCTURE}}

{{BUILD_UNIT_HANDOFF_NOTES_SECTION}}

## 📘 Rationale
{{BUILD_UNIT_PHASE_RATIONALE}}

## 📝 Description
{{BUILD_UNIT_DESCRIPTION}}

## ✅ Acceptance Criteria
{{BUILD_UNIT_ACCEPTANCE_CRITERIA}}

{{BUILD_UNIT_E2E_TEST_CONTRACT}}## 📚 PRD Sources
{{BUILD_UNIT_PRD_SOURCES}}

## 📁 Backend Components

{{BUILD_UNIT_MODELS_SECTION}}

{{BUILD_UNIT_ACTIONS_SECTION}}

{{BUILD_UNIT_FETCHERS_SECTION}}

{{BUILD_UNIT_JOBS_SECTION}}

## 📁 File Locations
- **Models**: Update `prisma/schema.prisma`
- **Actions**: `src/actions/{feature}/{action-name}.ts`
- **Schemas**: `src/schemas/{feature}/{schema-name}.ts`
- **Data Fetchers**: `src/data/{domain}/get-{thing}.ts`
- **Types**: Generated from Prisma schema or in `src/types/`

## 📦 Data Layer Updates

For fetcher tasks, frontend has already created the import chain. Update the existing data layer file in place:

1. **Find the mock implementation**
   ```bash
   grep -r "// MOCK" src/data/ | head -10
   ```

2. **Update in place** (same file, same function signature)
   ```typescript
   // BEFORE: src/data/posts/get-posts.ts
   import { mockPosts } from '@/data/fixtures/posts';
   
   export async function getPosts(input: GetPostsInput) {
     // MOCK: Backend will replace with Prisma query
     return mockPosts.filter(p => p.workspaceId === input.workspaceId);
   }
   
   // AFTER:
   import { prisma } from '@/lib/db';
   
   export async function getPosts(input: GetPostsInput) {
     return prisma.post.findMany({
       where: { workspaceId: input.workspaceId },
       orderBy: { createdAt: 'desc' }
     });
   }
   ```

3. **Keep function signature identical** - API routes already call this function
4. **Remove fixture imports** once mock code is replaced
5. **Remove the `// MOCK:` comment** after implementing
6. **Wire to Server Actions**: If a Server Action was created for functionality that has an existing API route + data layer stub, the stub MUST call the server action (don't leave TODO placeholders returning fake success)

## 🔗 Callback Handler Wiring

If handoff notes list callback handlers needing server actions (e.g., `onPublish`, `onSave`, `onDelete`):

1. **Create the server action** in `src/actions/{domain}/{action-name}.ts`
2. **Update the frontend component** to import and call the action:

```typescript
// BEFORE: Component has stubbed handler
<PostComposer onPublish={(content) => console.log('publish', content)} />

// AFTER: Wire to real server action
import { createPostAction } from '@/actions/posts/create-post';

<PostComposer onPublish={async (content) => {
  const result = await createPostAction({ content });
  if (result.success) router.refresh();
}} />
```

Check handoff notes for the exact component, prop name, and expected action.

## 🔗 Workflow Integration Checklist

If this task implements a **user-facing action** that creates primary entities or connects to external systems, complete this checklist:

1. **Scan for related helpers**: Run `ls src/lib/sync/ src/lib/` to find utility functions related to this action (e.g., `mapRostersToTeams`, `storeMatchups`, `fetchAllMatchups`)

2. **Check expectedStateChanges**: If the task has an `expectedStateChanges` array in `backend-task-list.json`, each one MUST happen when your action succeeds:
   ```bash
   jq '.tasks[] | select(.id == "{{BUILD_UNIT_ID}}") | .expectedStateChanges' reference/backend-task-list.json
   ```

3. **Verify wiring**: If helper functions exist that do what you need, **call them** instead of reimplementing inline. Check:
   - `src/lib/sync/` for data sync utilities
   - `src/lib/{domain}/` for domain-specific helpers
   - `src/data/{domain}/` for existing fetchers

4. **Don't duplicate**: If `mapRostersToTeams()` already exists and works, import and call it rather than writing inline team creation logic

5. **Test completeness**: After your action returns `success: true`, ALL records in `expectedStateChanges` must actually exist in the database

6. **Verify userId wiring**: If data function signature includes `userId`, verify all callers (API routes, server components) extract it from session AND pass it. Pattern: `const session = await auth(); const userId = session?.user?.id; if (!userId) return unauthorized();`

> ⚠️ **CRITICAL - Workflow Wiring Bug**: Returning `success: true` when downstream records weren't created is a critical bug. The action appears to work but leaves the system in an incomplete state. Before returning success:
> - Query database to verify all `expectedStateChanges` records exist - don't assume
> - If any step fails, either rollback or return an error - never fake success
> - If helper functions exist but aren't wired, wire them before completing this task
> - Generating an ID (e.g., `syncJobId`) is NOT the same as triggering the job - verify actual invocation

## 🔒 Type Contract Verification

If this task implements a **fetcher** or **action** that returns data to the frontend:

1. **Locate the frontend type**: Check if a type contract exists in:
   - `src/types/{domain}.ts` for domain types
   - The existing mock file's return type annotation
   - The frontend component that consumes this data

2. **Read the type definition**: Before implementing, read the actual TypeScript type file to understand the exact structure expected.

3. **Match the contract**: Your implementation MUST return data matching the frontend type exactly:
   - Property names must match (e.g., `role` not `id`)
   - Required fields must be present (e.g., `features` array)
   - JSONB fields must be persisted, not just built

4. **Use type assertion**: For literal returns, use `satisfies <Type>` to catch mismatches at compile time.

> ⚠️ **CRITICAL**: Gate-6 runs `pnpm tsc --noEmit` and will **FAIL the gate** if type errors exist. Fix type mismatches before completing this task.

## 🚀 Development Server
- Server is active on **http://localhost:3000** with Turbopack fast refresh
- Server should auto-recover if it crashes; if you see 500 errors, wait ~15 seconds and retry
- Run `npx prisma generate` after modifying schema
- If server needs restart: `bash scripts/check-or-start-dev-server.sh`

> ⚠️ **CRITICAL**: 
> - Never run `pkill -f node` or similar broad process-killing commands. This will terminate the orchestrator and crash the entire workflow.
> - **Never run `npm run build` or `pnpm build`** - this crashes the orchestrator. The dev server with Turbopack handles hot reloading automatically.
> - To restart the dev server: `bash scripts/check-or-start-dev-server.sh`

## 🛠 Implementation Workflow
1. Locate `{{BUILD_UNIT_ID}}` in `reference/backend-task-list.json`
2. If dependencies (`{{BUILD_UNIT_DEPENDENCIES}}`) are not completed, STOP and report blocker
3. **TDD Validation**: If a backend test exists for this task (`tests/backend/be-{{BUILD_UNIT_ID}}.test.ts`):
   - Read the test file to understand expected behavior
   - Run the test (`npx vitest run tests/backend/be-{{BUILD_UNIT_ID}}.test.ts`) to see current state
   - If test has issues (wrong mocks, invalid assumptions), fix the test FIRST
4. Read PRD sources for data, business logic, and state requirements
5. Cross-check `reference/frontend-task-list.json` for matching UI tasks; align contracts
6. Follow existing patterns and Server Actions pattern
7. Build in order: models → schemas/actions → fetchers → jobs
8. **Use correct imports**: `@/lib/db`, `@/lib/auth`, `@/` paths

> Status is updated automatically. Do not update the `backend-task-list.json` file yourself.

### If You Hit Build/Schema Errors
1. **Schema/Prisma first**: If you touched `prisma/schema.prisma`, run `npx prisma validate` then `npx prisma generate`
2. **Fix imports next**: Missing import errors often cascade into other TypeScript failures
3. **Avoid `@ts-ignore`**: Fix root cause, don't mask the error
4. **Verify**: Re-run `pnpm tsc --noEmit` after changes; smoke-test the affected flow

