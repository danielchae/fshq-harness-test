# Frontend Build Audit

Before the gate validates your work, perform a comprehensive audit to catch and fix any issues.

## 1. TypeScript Compilation

```bash
pnpm tsc --noEmit 2>&1 | head -50
```

**If there are errors, fix them now.** The gate will fail if TypeScript doesn't compile.

Common fixes:
- Missing type definitions → Add proper types (avoid `any`)
- Import path errors → Use `@/components/ui/` and `@/` paths
- Props mismatches → Align interfaces between files

## 2. Server Health Check

```bash
curl -L -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null
```

- **200**: Server is healthy
- **500**: Server crashed. Wait 15 seconds for auto-recovery, or run: `bash scripts/check-or-start-dev-server.sh`

> ⚠️ **CRITICAL**: 
> - Never run `pkill -f node` or similar broad process-killing commands. This will terminate the orchestrator and crash the entire workflow.
> - **Never run `npm run build` or `pnpm build`** - this crashes the orchestrator.

## 3. Lint Check

```bash
pnpm lint 2>&1 | grep -E "error|Error" | head -20
```

Fix critical linting errors (unused imports, undefined variables).

## 4. Import Verification

Check that imports are correct:
- ✅ `@/components/ui/` (for shadcn components)
- ✅ `@/` paths (for all internal imports)
- ✅ All imported modules exist

{{BUILD_UNIT_DEVTOOLS_STEP}}

## 5. If Anything Looks Broken

If you encounter runtime/network/styling issues after TypeScript passes:
1. **Classify**: Is it a console error, failed network request, or visual bug?
2. **Capture evidence**: Note file/line + exact console or network error message
3. **Apply smallest fix**: Fix imports/deps first (they often cascade); avoid refactoring unrelated code
4. **Re-verify**: Reload the page and confirm console/network are clean

**Do not stop until you have fixed any and all issues found.**

## Add to Backend Handoff Documentation

Once you are done, append notes for backend developers to `reference/backend-handoff.md`:

```markdown
### {{BUILD_UNIT_ID}}: {{BUILD_UNIT_NAME}}

**Data layer files to implement:**
- `src/data/{domain}/get-{thing}.ts` - currently returns mock from fixtures
- [List ALL src/data/ files created with `// MOCK:` comments]
- [Or: "None - no data layer files in this task"]

**API routes created:**
- `src/app/api/{domain}/route.ts` - imports from data layer (ready, no changes needed)
- [Or: "None - no API routes in this task"]

**Callback handlers needing server actions:**
- [Component + prop: what action should be called (e.g., "PostComposer.onPublish → createPostAction")]
- [Or: "None - no callback handlers need wiring"]
```

**Keep concise. Focus on src/data/ files that need mock→real conversion.**
