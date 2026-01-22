# Gate 3-1: Frontend UI Review Validation (LLM)

## CRITICAL: OUTPUT FORMAT REQUIREMENTS

You MUST respond with ONLY valid JSON that matches the schema below. Do not include any text before or after the JSON object.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["passed", "score", "reasons", "criteria_scores", "retryRecommended", "criticalFailures"],
  "additionalProperties": false,
  "properties": {
    "passed": { "type": "boolean" },
    "score": { "type": "number", "minimum": 0, "maximum": 1 },
    "reasons": { "type": "array", "items": { "type": "string" } },
    "criteria_scores": { "type": "object", "additionalProperties": { "type": "number", "minimum": 0, "maximum": 1 } },
    "retryRecommended": { "type": "boolean" },
    "criticalFailures": { "type": "array", "items": { "type": "string" } }
  }
}
```

---

## 🎯 Purpose

Validate that **UI polish work** was applied effectively. This is a visual review—focus on what you can see, not code compilation.

---

## 🔍 How to Validate

Use Chrome DevTools MCP to visually inspect the app:

1. Navigate to `http://localhost:3000`
2. If on sign-in page, authenticate first
3. Visit key pages and take screenshots at desktop (1280px) and mobile (375px)
   - **Do not use full-page screenshots**
   - Keep viewport-sized captures only (max height <= 800px)
   - If a page is long, scroll and take multiple viewport screenshots
4. Check for console errors and accessibility warnings: `list_console_messages({ types: ["error", "warning"] })`
   - Fail on warnings indicating missing required elements in overlay components (dialogs, sheets, modals)

---

## 📊 Quality Checks

### 1. Visual Consistency (50%)
- Typography feels consistent across pages (sizes, weights, line heights)
- Color palette is coherent (no jarring mismatches)
- Component styling is cohesive (buttons, inputs, cards work together)
- Spacing and whitespace feel balanced

### 2. Responsive Design (40%)
- Mobile layout (375px) works without horizontal overflow
- Navigation adapts properly on smaller screens
- Content stacks correctly without breaking
- Touch targets are appropriately sized

### 3. App Functional (10%)
- App loads at localhost:3000
- No blocking console errors that break functionality

---

## 🚨 Critical Failures (Automatic Fail)

- App completely fails to load or crashes
- Major layout breaks (content overflowing viewport, overlapping elements)
- Navigation is completely broken on mobile
- Accessibility warnings in console (missing required elements in overlay components)

---

## ⚠️ DO NOT Fail For

- Minor subjective styling preferences
- Color choices that work but aren't ideal
- Console warnings (only errors that break functionality matter)

---

## ✅ Passing Conditions

- Visual styling is consistent and intentional
- Responsive design works at key breakpoints
- App is functional and usable
- `score` = weighted average of criteria scores
- **Pass threshold**: score >= 0.8

---

Remember: Output ONLY the JSON object—no prose, markdown, or extra commentary.
