# Phase 7-2: Full Build Polish Audit

## 🎯 Objective
Evaluate the completed full-stack implementation against the checklist below. Identify issues that need remediation before the build is considered complete.

## Prerequisites
- Phase 6 (Backend Build) completed with all dynamic phases passing

## 📋 Checklist to Evaluate

### 1. `error-boundary` — Implement error boundary and 404 pages
Make sure that `error.tsx` exists for runtime error handling and `not-found.tsx` for 404 pages. Users should see friendly error messages, not default framework error screens.

### 2. `typescript-workarounds` — Resolve TypeScript type workarounds
Search for type assertions like `as '/dashboard'` or `as any` that bypass type checking. Fix underlying type definitions rather than using casts as workarounds.

### 3. `hydration-mismatch` — Fix React hydration mismatches
Check browser console for hydration errors. Ensure server-rendered HTML matches client-side render, especially for values that differ based on client state (e.g., `isMobile`, `aria-current`).

### 4. `navigation-behaviors` — Verify navigation links trigger expected behaviors
Test that navigation items with query parameters (e.g., `?focus=search`) actually implement the expected behavior. Links should not just navigate but also perform associated actions like focusing inputs.

### 5. `sign-out-accessible` — Ensure sign out functionality is accessible
If there's login, there should be logout. Verify a sign out button/link exists in an intuitive location (e.g., settings, profile menu, or sidebar). Users must be able to log out from the authenticated state.

### 6. `navigation-labels-consistent` — Verify navigation labels are consistent across breakpoints
Check that mobile and desktop navigation use consistent labels in substance. (e.g., don't label the same link "Profile" on mobile and "Settings" on desktop without reason).

### 7. `data-layer-no-mocks` — Ensure all data layer files use real implementations
Run these checks:
1. `grep -r "// MOCK" src/data/` - should return nothing (all mocks replaced with Prisma)
2. `grep -r "fixtures" src/app/api/` - API routes should not import from fixtures
3. `grep -r "api/fixtures" src/hooks/` - hooks should not fetch from /api/fixtures
4. Check feature flag polarity in `src/data/` and `src/lib/` - env checks like `<SERVICE>_ENABLED === 'true'` for real API are WRONG; the pattern should be `MOCK_<SERVICE>_ENABLED === 'true'` for mock fallback. Real implementations should be the default, mocks should be opt-in.

Each finding indicates incomplete backend integration. The data layer pattern requires:
- `src/data/{domain}/` files should use Prisma, not fixtures
- API routes import from data layer (which now has real implementations)
- Hooks fetch from real API routes, not fixture endpoints
- External API integrations default to real, with mocks requiring explicit opt-in

### 8. `client-storage-consumed` — Verify data stored client-side is consumed and processed
If data is saved to sessionStorage/localStorage for later processing (e.g., pending uploads), ensure there's code that actually reads and handles that data. Dead writes lead to features that appear to work but don't persist.

### 9. `z-index-layering` — Verify z-index layering on pages with overlapping elements
Test sticky headers/footers against overlapping content (checkboxes, modals, tooltips). Ensure proper z-index hierarchy so UI elements don't incorrectly layer over each other.

### 10. `component-sizing` — Check component sizing consistency within related groups
Buttons, inputs, and controls that appear side-by-side should use consistent size variants. Mismatched sizes (e.g., `size="sm"` next to `size="default"`) create visual inconsistency.

### 11. `third-party-resources` — Verify third-party resource integrations work in production context
Ensure that external resources (images, APIs, CDN assets) load correctly when the app makes cross-origin requests. Check for CORS errors, redirect issues, and blocked requests that may work locally but fail in production.

### 12. `conditional-logic-order` — Review conditional logic order in computed state values
When a component computes display mode or UI state from multiple conditions (e.g., in `useMemo`), verify the condition order is correct. More specific or transient states should be checked before general or persistent states, otherwise early returns may prevent valid state transitions.

### 13. `data-structure-contracts` — Verify data structure contracts between producer and consumer
When data is passed via storage (sessionStorage, localStorage, API), ensure the producer writes the exact structure the consumer expects. Check for mismatched property names (e.g., `angles` vs `captures`, `imageUrl` vs `preview`) that silently break data flow.

### 14. `local-storage-persistence` — Ensure local/dev storage implementations actually persist data
If cloud storage has a "local mode" fallback, verify it works end-to-end. Stub implementations that return mock URLs without actually storing data will appear to work (201 responses) but fail when resources are fetched (400/404 errors).

### 15. `value-computation-consistency` — Check for inconsistent value computation across related code paths
When the same value (URL, ID, path, etc.) is needed in multiple places, verify it's derived consistently. Look for cases where one code path computes a value one way while another recomputes it differently—this causes silent mismatches that only surface at runtime.

### 16. `image-empty-src` — Verify image components handle missing or empty src gracefully
Search for `<Image` or `<img` tags and check if src can be empty/null/undefined. Components should conditionally render or show placeholders when image URLs are missing, not pass empty strings which trigger browser warnings and broken UI.

### 17. `callback-handlers-implemented` — Verify callback handlers are implemented, not just stubbed
Search for callback props and verify they call real server actions, not stubs:
1. `grep -r "console.log.*publish\|console.log.*save\|console.log.*submit" src/` - find console.log stubs
2. `grep -r "=> {}" src/components/` - find empty arrow function handlers
3. `grep -r "TODO\|FIXME" src/components/` - find incomplete implementations

Each callback handler (onPublish, onSave, onSubmit, etc.) should import and call a server action from `src/actions/`.

### 18. `premature-optimizations` — Check for premature performance optimizations that break layout
Look for virtual scrolling, fixed heights, absolute positioning, or complex scroll calculations in list/grid components. These optimizations are only needed for 500+ items. For typical lists, use simple CSS grid/flex that flows naturally with content. Over-optimization creates layout issues and complexity without benefit.

### 19. `type-contract-audit` — Verify data fetcher return structures match frontend types
Spot-check 3 critical data fetchers to verify their return structure matches the frontend type they satisfy:

1. **Identify critical fetchers**: Pick 3 fetchers that return complex objects consumed by UI components
2. **For each fetcher**:
   - Find the frontend type it should satisfy (from imports or `src/types/`)
   - Compare the actual return structure against the type definition
   - Flag any property name mismatches, missing required fields, or wrong types
3. **Check JSONB fields**: For any fetcher reading JSONB columns, verify the corresponding action actually persists all required fields

## 🔍 Evaluation Process

For EACH checklist item:

1. **Run appropriate validation** (grep, file checks, browser testing)
2. **Document findings** with specific file paths and line numbers
3. **Determine pass/fail status**
4. **Record actionable details** for failed items

## 📤 Output Format

Create `reference/full-polish-findings.json`:

```json
{
  "auditedAt": "<ISO timestamp>",
  "items": [
    {
      "id": "error-boundary",
      "title": "Implement error boundary and 404 pages",
      "description": "Make sure that error.tsx exists for runtime error handling and not-found.tsx for 404 pages.",
      "status": "pass|fail",
      "details": "Specific finding with file paths and actionable remediation steps"
    }
  ]
}
```

Include one entry per checklist item with the exact `id` and `title` from above.

## ✅ Passing Criteria

- Every checklist item has been evaluated
- Each item has documented findings with specific details
- `reference/full-polish-findings.json` is valid JSON
- Failed items include actionable remediation details

## 📝 Notes

- Be thorough - this is the final quality gate before the build is complete
- Focus on issues that would affect production quality
- Failed items will generate individual remediation phases
- If all items pass, the build is considered production-ready
