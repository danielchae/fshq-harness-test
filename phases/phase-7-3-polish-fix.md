# Phase 7-3: Fix {{BUILD_UNIT_NAME}}

## 🎯 Objective
Fix the identified full-build polish issue: **{{BUILD_UNIT_TITLE}}**

## 📋 Issue Details

**Checklist Item ID**: `{{BUILD_UNIT_ID}}`
**Sequence**: Fix {{BUILD_UNIT_SEQUENCE}} of {{BUILD_UNIT_TOTAL_ITEMS}}

### What to Fix
{{BUILD_UNIT_DESCRIPTION}}

### Audit Finding
{{BUILD_UNIT_DETAILS}}

## 🔧 Implementation

1. **Understand the Issue**
   - Read the audit finding details above
   - Identify specific files and locations that need changes
   - Understand the expected outcome

2. **Make Surgical Fixes**
   - Only change what's necessary to address this specific issue
   - Don't refactor unrelated code
   - Preserve existing functionality
   - Follow existing codebase patterns

3. **Verify the Fix**
   - Check that the issue is resolved
   - For visual issues, use Chrome DevTools to verify
   - For code issues, run relevant validation commands
   - For data flow issues, test end-to-end

## 🚀 Development Server
- Server is active on **http://localhost:3000** with Turbopack fast refresh
- Changes should be reflected automatically
- Run `npx prisma generate` after modifying schema
- If server needs restart: `bash scripts/check-or-start-dev-server.sh`

> ⚠️ **CRITICAL**: Never run `pkill -f node`, `npm run build`, or `pnpm build` - these crash the orchestrator.

## ✅ Success Criteria

This fix is complete when:
1. The specific issue identified in the audit finding is resolved
2. The app still functions correctly (no regressions)
3. TypeScript compiles without errors related to this fix
4. The fix is minimal and surgical

### Quick Verify Checklist
After implementing the fix:
- [ ] Issue resolved → confirm via DevTools or test command
- [ ] Run `pnpm tsc --noEmit` → zero errors
- [ ] If Prisma schema touched → `npx prisma validate` + `npx prisma generate`
- [ ] Smoke-test only the affected flow → no regressions

## 📝 Notes

- Focus on this specific checklist item
- If the fix requires significant changes, implement the minimum viable solution
- If moving files, first document all importers to avoid leaving broken imports
