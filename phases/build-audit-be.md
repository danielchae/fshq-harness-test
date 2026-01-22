# Backend Build Audit

Before the gate validates your work, perform a self-audit to catch and fix any issues.

## 1. TypeScript Compilation (CRITICAL)

```bash
pnpm tsc --noEmit 2>&1 | head -50
```

**If there are errors, fix them now.** The gate will fail if TypeScript doesn't compile.

**Error triage order:**
1. **Group errors** by file/type—often one root cause produces many errors
2. **Fix import/path errors first**—these frequently cascade into other failures
3. **Avoid `@ts-ignore`**—fix the root cause instead
4. **Re-run `pnpm tsc --noEmit`** after changes to verify

Common fixes:
- Missing type definitions → Add proper types (avoid `any`)
- Import path errors → Use `@/lib/db` and `@/` paths
- Type mismatches → Align interfaces between files

## 2. Prisma Validation (If Schema Modified)

```bash
npx prisma validate
npx prisma generate
```

**If validation fails, fix the schema before proceeding.**

Common fixes:
- Missing relations → Add proper `@relation` annotations
- Invalid field types → Check Prisma type compatibility
- Circular references → Review model relationships
- Column size issues → URL columns storing file paths (`VarChar(255)`) cannot store base64 data URLs (50KB+). Use `Text` type for unbounded strings

## 3. Server Health Check

```bash
curl -L -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null
```

- **200**: Server is healthy
- **500**: Server crashed. Wait 15 seconds for auto-recovery, or run: `bash scripts/check-or-start-dev-server.sh`

> ⚠️ **CRITICAL**: 
> - Never run `pkill -f node` or similar broad process-killing commands. This will terminate the orchestrator and crash the entire workflow.
> - **Never run `npm run build` or `pnpm build`** - this crashes the orchestrator.

## 4. Lint Check

```bash
pnpm lint 2>&1 | grep -E "error|Error" | head -20
```

Fix critical linting errors (unused imports, undefined variables).

## 5. Import Verification

Check that imports are correct:
- ✅ `@/lib/db` (for Prisma client)
- ✅ `@/lib/auth` (for auth functions)
- ✅ `@/` paths (for all internal imports)
- ✅ All imported modules exist

## 6. Action/Fetcher Contracts

Verify your server actions and data fetchers:
- Match expected input/output types from frontend-task-list.json
- Include proper error handling
- Use consistent naming conventions

## 7. Callback Handler Wiring

If handoff notes listed callback handlers needing server actions:
- [ ] Server action created and exports correctly
- [ ] Frontend component updated to import and call the action
- [ ] Action is called with correct parameters (check the component props)

Quick verification:
```bash
# Check if action is imported in the component (replace paths as needed)
grep -r "import.*{action-name}" src/components/
```

## 8. Run Backend Tests

Run the Vitest tests for the current task:

```bash
# Replace {task-id} with current task (e.g., task-05)
npx vitest run tests/backend/be-{task-id}.test.ts
```

**If tests fail:**
1. Read the error message carefully
2. Fix the implementation to match expected behavior
3. Re-run the test until it passes

Common test failures:
- **AssertionError**: Your function returns different data than expected
- **TypeError**: Missing or wrong types in your implementation
- **PrismaClientKnownRequestError**: Database constraint violated

## ✅ Completion Checklist

Before finishing, confirm:
- [ ] TypeScript compiles with zero errors
- [ ] Prisma validates successfully (if schema changed)
- [ ] Server returns 200
- [ ] No critical lint errors
- [ ] All created files exist
- [ ] Imports use correct paths
- [ ] Actions/fetchers match frontend contracts
- [ ] Callback handlers wired (if listed in handoff notes)
- [ ] Backend tests pass for this task

**Do not stop until you have fixed any and all issues found.**
