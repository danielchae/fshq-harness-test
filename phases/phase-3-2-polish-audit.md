# Phase 3-2: Frontend Polish Audit

## 🎯 Objective
Evaluate the completed frontend implementation against the checklist below. Identify issues that need remediation before proceeding to frontend validation.

## Prerequisites
- Phase 3-1 (UI Polish) completed

## 📋 Checklist to Evaluate

### 1. `html-metadata` — Verify HTML titles and metadata reflect the app's identity. Ensure every page has appropriate `<title>`, meta descriptions, and Open Graph tags. Remove any boilerplate/placeholder values (e.g., "Platform Starter") and replace with app-specific content.

### 2. `footer-branding` — Replace generic footer branding with Samus attribution. If the app contains footer branding text (e.g., "AppName v1.0", version labels, or placeholder product names in sidebars or page footers), replace it with "Powered by [Samus](https://samus.ai?ref=[appname])" using `target="_blank"`. Only apply this if such branding exists—do not add a footer where none exists.

### 3. `auth-page-design` — Apply polished UI design to authentication pages
Login, signup, and/or password reset pages should have a visually appealing layout and elements that reflects the app's overall UI aesthetic—not generic boilerplate forms. Redesign if necessary.

### 4. `little-big-detail` — Do a review of the app with an eye toward adding one or two LittleBigDetails to the UI/UX - small interactive touches or feedback elements that make the product feel more polished and intuitive for users. These are subtle enhancements like immediate inline feedback on form fields, animated confirmation cues when actions complete, context-aware hints or tooltips, gentle loading indicators, or other little moments that help users understand what's happening and feel more confident using the product. The goal is not to add big new features but to look for opportunities where thoughtful, small interactions can improve clarity and delight as users move through the experience. 

### 5. `callback-wiring` — Verify callback props are connected. Check that components with callback props (onAddItem, onSubmit, onClick handlers) receive real handlers from their parent pages, not undefined.

### 6. `boilerpalte-dashboard` - Verify if the placeholder dashboard page from the original boilerplate saas at /dashboard still exists as a placeholder. Clean it up if the placeholder page still exists.

### 7. `layout-structure` — Verify layout architecture is complete
Check that:
- Each page has exactly one global header/navbar visible (no duplicate stacking)
- If sidebar navigation exists, it spans full viewport height (no background gaps)
- Route groups with complete layouts are parallel to, not nested within, other route groups
- etc

### 8. `rams-audit` — Run accessibility and visual design audit
Perform a comprehensive accessibility and visual design review following the methodology in `scripts/rams-review.md`. Scan the frontend source files (components, pages) and evaluate against the WCAG 2.1 criteria and visual design checks specified in that file.

**Review criteria (from rams-review.md):**

*Accessibility (WCAG 2.1)*:
- **Critical** (must fail): Images without alt, icon-only buttons missing aria-label, form inputs without labels, non-semantic click handlers (div onClick), links without href
- **Serious** (must fail): Focus outline removed without replacement, missing keyboard handlers, color-only information, touch targets under 44x44px
- **Moderate** (should fix): Skipped heading levels, positive tabIndex values, role without required attributes

*Visual Design*:
- **Layout & Spacing** (should fix): Inconsistent spacing values, overflow/alignment issues, z-index conflicts
- **Typography** (should fix): Mixed font families/weights, line height issues, missing font fallbacks
- **Color & Contrast** (must fail): Contrast ratio below 4.5:1, missing hover/focus states, dark mode inconsistencies
- **Components** (should fix): Missing button states, missing form field states, inconsistent borders/shadows

**How to evaluate:**
1. Read `scripts/rams-review.md` for the full review methodology
2. Scan key frontend files (pages, components, layouts) for issues
3. Use the output format from rams-review.md (with line numbers, code snippets, fixes, WCAG refs)
4. Fail this item if any Critical, Serious, or Color & Contrast issues are found
5. Put the FULL review output in the `details` field so the fix phase has complete context

## 🔍 Evaluation Process

For EACH checklist item:

1. **Inspect the codebase** using appropriate tools (grep, file reads, browser navigation)
2. **Document findings** with specific file paths and line numbers where issues exist
3. **Determine pass/fail status** based on whether remediation is needed
4. **Record details** explaining why the item passed or failed

## 📤 Output Format

Create `reference/fe-polish-findings.json`:

```json
{
  "auditedAt": "<ISO timestamp>",
  "items": [
    {
      "id": "html-metadata",
      "title": "Verify HTML titles and metadata reflect the app's identity",
      "description": "Ensure every page has appropriate <title>, meta descriptions, and Open Graph tags. Remove any boilerplate/placeholder values and replace with app-specific content.",
      "status": "pass|fail",
      "details": "Specific finding. If failed, include file paths and what needs fixing."
    },
    {
      "id": "rams-audit",
      "title": "Run accessibility and visual design audit",
      "description": "Scan frontend files for WCAG 2.1 compliance and visual design issues",
      "status": "fail",
      "details": "CRITICAL: [A11Y] Line 24 app/components/Button.tsx - Button missing accessible name. Fix: Add aria-label. WCAG 4.1.2 | SERIOUS: [A11Y] Line 48 app/page.tsx - Focus outline removed. Fix: Add focus-visible:ring-2. WCAG 2.4.7"
    }
  ]
}
```

Include one entry per checklist item with the exact `id` and `title` from above. For `rams-audit`, put the full rams output in `details` so the fix phase has complete context.

## ✅ Passing Criteria

- Each checklist item has been evaluated
- Findings are documented with specific details
- `reference/fe-polish-findings.json` is valid JSON
- All items have "pass" or "fail" status

## 📝 Notes

- If all items pass, the next phase (phase-3-3) will complete immediately with no fixes
- Failed items will generate remediation phases in phase-3-3
- Be thorough but not overly critical - only fail items that genuinely need fixing