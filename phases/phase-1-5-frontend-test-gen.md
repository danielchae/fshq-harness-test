# Phase 1-5: Frontend E2E Test Generation

Generate Playwright E2E tests for every task in `reference/frontend-task-list.json`. These tests encode acceptance criteria as executable specifications that will run after each build task to validate implementation correctness.

## Prerequisites
- Completed Phase 1-1 (PRD Context Mapping)
- Completed Phase 1-2 (Frontend Task List)
- Completed Phase 1-4 (shadcn Components)

{{PRD_CONTEXT}}

{{WORKSPACE_STRUCTURE}}

---

## 📁 Output Location

**You MUST create test files in**: `tests/e2e/generated/`
Write one test file per task: `tests/e2e/generated/{task-id}.spec.ts`
Example: Task `task-03` → `tests/e2e/generated/task-03.spec.ts`

**CRITICAL**: Tests are written BEFORE implementation. They serve as executable specifications that will initially fail and pass once implementation is complete.

---

## 🚨 WHAT TO DO

First verify the source manifest exists:
```bash
ls -la reference/frontend-task-list.json
```

Then create the test directory structure:
```bash
mkdir -p tests/e2e/generated
mkdir -p tests/e2e/fixtures
```

Generate one `.spec.ts` file per task by analyzing each task's `acceptanceCriteria` array.

---

## 🎯 Your Mission

For EACH task in `reference/frontend-task-list.json`:

1. Read the task's `acceptanceCriteria` array
2. Generate a Playwright test file with one `test()` block per acceptance criterion
3. Tests must be runnable against `http://localhost:3000`
4. Tests use authenticated state from `tests/e2e/fixtures/auth.json`

---

## 📝 Test File Template

```typescript
// tests/e2e/generated/{task-id}.spec.ts
import { test, expect } from '@playwright/test';

test.describe('{task-title}', () => {
  
  test('{acceptance-criterion-1 - verbatim from manifest}', async ({ page }) => {
    // Navigate to the relevant route
    await page.goto('/{route}');
    
    // Wait for key content to be visible (avoid networkidle - it's unreliable)
    await expect(page.locator('[data-testid="..."]')).toBeVisible();
    
    // Perform user interactions if needed
    // ...
    
    // Assert the acceptance criterion is met
    await expect(page.getByRole('...', { name: '...' })).toBeVisible();
  });

  test('{acceptance-criterion-2 - verbatim from manifest}', async ({ page }) => {
    // ...
  });
  
});
```

---

## 📋 Test Writing Rules

### 0. Test Scoping - What Deserves E2E Tests

Generate E2E tests only for:
- Multi-step user workflows (onboarding, checkout, data entry flows)
- Core data operations (create, update, delete user content)
- Critical navigation paths (protected route access)

Skip E2E tests for:
- UI preference controls (theme toggle, language selector, display settings)
- Single-component interactions handled by established libraries (next-themes, etc.)
- Settings that don't persist beyond the browser session

### 0.5. Test Isolation

Each test must be independent and not rely on state from previous tests:
- Tests can run in any order and still pass
- Use `test.beforeEach()` for common setup (navigation, data seeding)
- Never assume a previous test has created data or navigated somewhere

### 1. One Test Per Acceptance Criterion
Map each acceptance criterion directly to a test. Use the criterion text as the test name:

| Acceptance Criterion | Test Name |
|---------------------|-----------|
| "Grid displays 3 columns on desktop" | `test('Grid displays 3 columns on desktop', ...)` |
| "Shows loading skeleton while fetching" | `test('Shows loading skeleton while fetching', ...)` |
| "Form validates email format" | `test('Form validates email format', ...)` |

### 1.5 TypeScript-safe Playwright Patterns (IMPORTANT)
Generated tests must **typecheck** under strict TypeScript settings. Avoid these common mistakes:

- **Do not chain Locator helpers after async Page actions**
  - ❌ `await page.click('[data-testid="grid-item"]').first();` (click returns `Promise<void>`)
  - ✅ `const item = page.locator('[data-testid="grid-item"]').first(); await item.click();`

- **Do not use Jest asymmetric matchers where Playwright expects concrete values**
  - ❌ `await expect(locator).toHaveCount(expect.any(Number));`
  - ✅ `const count = await locator.count(); expect(count).toBeGreaterThan(0);`

- **Handle nullable Playwright return types explicitly**
  - `locator.boundingBox()` returns `BoundingBox | null` (even if the element “should” be visible).
  - ✅
    - `const box = await locator.boundingBox(); if (!box) throw new Error('Expected element to have a bounding box');`

- **Use the correct Playwright permission APIs**
  - `context.grantPermissions(permissions, options?)` only supports `options.origin` (no `permissions` key).
  - To simulate “not granted”, prefer **not granting** or use `await context.clearPermissions()`.

### 2. Selector Priority (most to least preferred)
```typescript
// 1. Role-based selectors (accessibility-first, recommended by Playwright)
page.getByRole('button', { name: 'Submit' })
page.getByRole('heading', { name: 'Products' })
page.getByLabel('Email address')

// 2. data-testid (stable, add during implementation when role selectors aren't suitable)
page.locator('[data-testid="product-grid"]')

// 3. Text content (for user-visible strings)
page.getByText('Welcome back')

// 4. CSS selectors (last resort - brittle, avoid if possible)
page.locator('.product-card')
```

### 3. Authentication Handling
Tests automatically use authenticated state. For public page tests, clear auth:
```typescript
// For protected routes (default) - auth is automatic
test('displays user dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  // ...
});

// For public routes - clear auth state
test.describe('Public pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  
  test('displays marketing page without auth', async ({ page }) => {
    await page.goto('/');
    // ...
  });
});
```

**IMPORTANT**:
- **Do not implement manual login in generated tests** (no `page.goto('/sign-in')`, filling credentials, etc.). Auth is handled via `storageState` / `tests/e2e/fixtures/auth.json`.
- Only write login tests if a task’s acceptance criteria explicitly requires validating the login flow.

### 4. Viewport Handling for Responsive Tests
```typescript
test('displays 3 columns on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/products');
  // Assert desktop layout
});

test('displays 1 column on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/products');
  // Assert mobile layout
});
```

### 5. API Mocking (when testing edge cases)
```typescript
test('displays empty state when no data', async ({ page }) => {
  // Mock empty response
  await page.route('**/api/products', route => 
    route.fulfill({ status: 200, json: [] })
  );
  await page.goto('/products');
  await expect(page.getByRole('status').or(page.getByText(/no products found/i))).toBeVisible();
});

test('displays error state on API failure', async ({ page }) => {
  await page.route('**/api/products', route => 
    route.fulfill({ status: 500, json: { error: 'Server error' } })
  );
  await page.goto('/products');
  await expect(page.getByRole('alert').or(page.getByText(/error/i))).toBeVisible();
});
```

### 6. Form Testing Patterns
```typescript
test('validates required fields', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page.getByText(/required/i)).toBeVisible();
});

test('submits form with valid data', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('SecurePass123');
  await page.getByRole('button', { name: /submit/i }).click();
  await expect(page).toHaveURL(/dashboard/);
});
```

### 7. Loading State Testing
```typescript
test('shows loading skeleton while fetching', async ({ page }) => {
  // Delay API response to observe loading state
  await page.route('**/api/data', async route => {
    await route.fulfill({ status: 200, json: { items: [] }, delay: 500 });
  });
  
  await page.goto('/data');
  const skeleton = page.locator('[data-testid="loading-skeleton"]');
  await expect(skeleton).toBeVisible();
  await expect(skeleton).not.toBeVisible({ timeout: 5000 });
});
```

---

## 🔄 Process

### STEP 1 — Load and Analyze Tasks
```bash
# Count total tasks
jq '.tasks | length' reference/frontend-task-list.json

# List all task IDs
jq -r '.tasks[].id' reference/frontend-task-list.json

# View acceptance criteria for a specific task
jq '.tasks[] | select(.id == "task-01") | .acceptanceCriteria' reference/frontend-task-list.json
```

### STEP 2 — Generate Test Files
For each task in the manifest:

1. Read the task's `acceptanceCriteria` array
2. Use the task's `route` field for navigation (e.g., `await page.goto(task.route)`)
3. Write a test file with one `test()` per criterion
4. Include appropriate setup (viewport, mocking) based on the criterion

### STEP 3 — Add data-testid Annotations
Create a helper file documenting recommended `data-testid` attributes:

```bash
# Create testid reference file
cat > tests/e2e/TESTID-CONVENTIONS.md << 'EOF'
# Test ID Conventions

When implementing components, add these data-testid attributes:

## Common Patterns
- Lists: `data-testid="{entity}-list"` (e.g., `product-list`)
- Items: `data-testid="{entity}-item"` (e.g., `product-item`)
- Cards: `data-testid="{entity}-card"` (e.g., `product-card`)
- Forms: `data-testid="{entity}-form"` (e.g., `signup-form`)
- Buttons: `data-testid="{action}-button"` (e.g., `submit-button`, `delete-button`)
- Inputs: `data-testid="{field}-input"` (e.g., `email-input`, `search-input`)
- Loading: `data-testid="loading-skeleton"` or `data-testid="{context}-loading"`
- Empty: `data-testid="empty-state"` or `data-testid="{context}-empty"`
- Error: `data-testid="error-state"` or `data-testid="{context}-error"`

## Task-Specific IDs
(Generated based on frontend-task-list.json)
EOF
```

### STEP 4 — Verify Test Files
```bash
# Ensure all test files exist
for id in $(jq -r '.tasks[].id' reference/frontend-task-list.json); do
  if [ ! -f "tests/e2e/generated/${id}.spec.ts" ]; then
    echo "MISSING: tests/e2e/generated/${id}.spec.ts"
  fi
done

# Count tests per file
for f in tests/e2e/generated/*.spec.ts; do
  count=$(grep -c "test('" "$f" 2>/dev/null || echo 0)
  echo "$f: $count tests"
done
```

---

## ✅ Success Criteria

- [ ] One `.spec.ts` file exists for each task in `frontend-task-list.json`
- [ ] Each file has at least one `test()` block per acceptance criterion
- [ ] All files use consistent imports from `@playwright/test`
- [ ] Tests use appropriate selectors (data-testid preferred)
- [ ] Protected route tests use authenticated state (automatic via config)
- [ ] Public route tests explicitly clear storage state
- [ ] Responsive tests set viewport appropriately
- [ ] `TESTID-CONVENTIONS.md` documents recommended test IDs

---

## 🚫 Failure Conditions

- ⛔ Missing test files for any task in the manifest
- ⛔ Acceptance criteria not mapped to tests (fewer tests than criteria)
- ⛔ Invalid TypeScript syntax in test files
- ⛔ Hardcoded test data that won't work with actual implementation
- ⛔ Tests that assume implementation details not in acceptance criteria

---

## 🔍 FINAL VERIFICATION

After generating test files, verify they're complete:
```bash
# Check all test files exist
total=$(jq '.tasks | length' reference/frontend-task-list.json)
found=$(ls tests/e2e/generated/*.spec.ts 2>/dev/null | wc -l)
echo "Test files: $found / $total"

# Verify each test file has content
for f in tests/e2e/generated/*.spec.ts; do
  if [ -f "$f" ]; then
    tests=$(grep -c "test('" "$f" 2>/dev/null || echo 0)
    [ "$tests" -eq 0 ] && echo "⚠️  No tests in: $f"
  fi
done

# Check for proper imports
for f in tests/e2e/generated/*.spec.ts; do
  grep -q "@playwright/test" "$f" || echo "❌ Missing Playwright import: $f"
done

echo "✅ Test generation complete"
```

---

## 📚 Reference

- **Frontend task list**: `reference/frontend-task-list.json`
- **Playwright config**: `playwright.config.ts`
- **Auth fixture**: `tests/e2e/fixtures/auth.json`

---

**Phase PASSES when:**
- Test file exists for each task in frontend-task-list.json
- Each test file contains at least one test per acceptance criterion
- All test files have valid Playwright imports
- TESTID-CONVENTIONS.md is created

**Phase FAILS if:**
- Missing test files for any task
- Test files have no test() blocks
- Invalid syntax in test files
- tests/e2e/generated/ directory not created
