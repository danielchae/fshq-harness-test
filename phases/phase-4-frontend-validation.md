# Phase 4: Frontend Validation & Testing

## 🎯 Objective
Thoroughly test the frontend implementation from phase 2, ensuring all features work correctly through browser testing. Fix any issues preventing the app from running properly.

## Prerequisites
- Phase 2 (Frontend Build) completed
- Phase 3 (Frontend Polish) completed

## 🔍 Testing Scope

### 1. Environment Setup Verification
First, ensure the development environment is properly configured:
- Verify all dependencies are installed (`pnpm install`)
- Check dev server is accessible at http://localhost:3000
- Confirm no TypeScript or build errors
- Verify mock data fixtures load correctly (JSON files in `src/data/`)

### 2. Access Setup (If Required)
If the app prompts for authentication before reaching feature pages, establish access using the test credentials so you can continue validation:
- Navigate to http://localhost:3000
- If redirected to sign-in, authenticate with: test@samus.ai / 12345
- Confirm you can reach the dashboard or main landing page after access is granted

### 3. Feature Testing from frontend-task-list.json
Systematically test each implemented feature from the frontend task list:
- Read `reference/frontend-task-list.json` to identify all implemented features
- After logging in, begin every validation pass from the dashboard home (`/`), then reach target screens exclusively through the shared navigation (sidebar links, mobile sheet toggle, command palette shortcuts, marketing navbar where applicable)
- For each UI component/feature marked as completed:
  - Navigate to the relevant page using the surfaced navigation entry
  - Test all interactive elements (buttons, forms, modals)
  - Verify data displays correctly (even if using mock data)
  - Check responsive design at different viewport sizes
  - Test keyboard navigation and accessibility

### 4. Common Issues to Check and Fix

#### Package Dependencies
```bash
# Check for missing packages in console/terminal errors
# If found, install missing dependencies:
pnpm add [package-name]
```

#### Access Issues (If Required)
- Verify NextAuth is configured
- Check middleware isn't blocking required resources
- If auth redirects are looping, check middleware configuration

#### Mock Data Issues
- Verify JSON fixture files exist in `src/data/`
- Check imports are correct (no Node.js modules in client components)
- Ensure data types match expected API response shapes

#### Build/Compilation Issues
```bash
# If TypeScript errors:
pnpm tsc --noEmit

# If server crashes, wait 15 seconds for auto-recovery, or run:
bash scripts/check-or-start-dev-server.sh
```

> ⚠️ **CRITICAL**: 
> - Never run `pkill -f node` or similar broad process-killing commands. This will terminate the orchestrator and crash the entire workflow.
> - **Never run `npm run build` or `pnpm build`** - this crashes the orchestrator.

#### Callback Behavior Issues
- For components with callback props (`onComplete`, `onLock`, `onTimeout`), test behavior when target state is already active on initial mount
- Verify callbacks don't fire repeatedly or on every render

## 🛠️ Fix Implementation

**Evidence + Triage**: Before fixing, capture the exact console error or failed network request plus the steps to reproduce. This prevents chasing the wrong problem.

For any issues discovered:
1. **Document the issue** - What error/problem was observed? (exact message + repro steps)
2. **Identify root cause** - Use browser DevTools, console logs, error messages
3. **Implement minimal fix** - Make surgical changes only; no scope creep
4. **Verify fix works** - Re-run only the affected flow and confirm the error is gone
5. **Regression test** - Ensure fix didn't break other features

## 📋 Validation Checklist

Before marking this phase complete, verify:

### ✅ Core Functionality
- [ ] Dev server runs without crashes
- [ ] No TypeScript compilation errors
- [ ] No critical console errors in browser

### ✅ Feature Coverage
- [ ] All Phase 2 UI components render correctly
- [ ] Forms validate and submit (even if to mock endpoints)
- [ ] Navigation between pages works via the surfaced navigation (sidebar, mobile sheet, command palette, marketing navbar)
- [ ] Data displays (mock or real) appear as expected
- [ ] Interactive elements (buttons, dropdowns, modals) function

### ✅ Browser Testing
- [ ] Tested in Chrome with DevTools
- [ ] No infinite redirects or auth loops
- [ ] Pages load within reasonable time
- [ ] No broken images or missing assets

### ✅ Accessibility & UX
- [ ] Keyboard navigation works for interactive elements
- [ ] Page layouts are responsive
- [ ] Loading states display appropriately
- [ ] Error states are handled gracefully

## 🚀 Browser Testing Approach

Use Chrome DevTools for testing:
1. Open the dashboard or main landing page (`http://localhost:3000/`) and authenticate only if prompted
2. Use shared navigation controls (sidebar, mobile sheet trigger, command palette, marketing navbar) to reach the feature under test
3. Use browser snapshot tool to verify page structure
4. Test form submissions and interactions
5. Check console for errors
6. Verify data displays correctly from fixtures

## 📝 Output Documentation

Document all fixes made in this file for reference:
```markdown
## Issues Found and Fixed

### Issue 1: [Description]
- **Error**: [What was observed]
- **Cause**: [Root cause]
- **Fix**: [What was changed]
- **Files Modified**: [List of files]

### Issue 2: [Continue pattern...]
```

## ⚠️ Important Notes

- **Use test credentials only if prompted**: test@samus.ai / 12345 (NextAuth)
- **Don't modify core architecture**: Fix issues minimally
- **Preserve mock data**: JSON fixtures should remain for backend to replace with real data
- **Keep changes surgical**: Only fix what's broken, don't refactor

## Success Criteria

This phase is complete when:
1. The app runs without critical errors
2. All implemented features from Phase 2 are accessible and functional
3. Browser testing shows no major UI/UX issues
4. All fixes are documented

After successful validation, proceed to Git snapshot before backend development.

