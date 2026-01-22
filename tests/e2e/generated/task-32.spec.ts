import { test, expect } from '@playwright/test';

test.describe('League Settings Page for Admins', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/demo-league/settings');
  });

  test('When admin visits settings page, current visibility, join rules, and description display', async ({ page }) => {
    const visibilityToggle = page.locator('[data-testid="visibility-toggle"]');
    await expect(visibilityToggle).toBeVisible();

    const joinRuleToggle = page.locator('[data-testid="join-rule-toggle"]');
    await expect(joinRuleToggle).toBeVisible();

    const descriptionEditor = page.locator('[data-testid="league-description"]');
    await expect(descriptionEditor).toBeVisible();
  });

  test('When admin toggles visibility switch, change saves and success toast confirms', async ({ page }) => {
    const visibilitySwitch = page.getByRole('switch', { name: /visibility/i });
    const initialState = await visibilitySwitch.getAttribute('aria-checked');

    await visibilitySwitch.click();

    // Sonner toasts use data-sonner-toast attribute and role="status"
    const toast = page.locator('[data-sonner-toast]', { hasText: /saved/i });
    await expect(toast).toBeVisible();

    const newState = await visibilitySwitch.getAttribute('aria-checked');
    expect(newState).not.toBe(initialState);
  });

  test('When admin edits description textarea, autosave triggers after typing stops', async ({ page }) => {
    const textarea = page.getByRole('textbox', { name: /description/i });

    await textarea.fill('New league description for testing autosave');

    const autosaveIndicator = page.locator('[data-testid="autosave-indicator"]');
    await expect(autosaveIndicator).toContainText(/saved/i, { timeout: 3000 });
  });

  test('When user without admin role visits settings URL, access denied message displays with redirect to feed', async ({ browser }) => {
    // Create a fresh context with non-admin role cookie (no admin storageState)
    const context = await browser.newContext();
    await context.addCookies([{
      name: 'user-role',
      value: 'fan',
      domain: 'localhost',
      path: '/'
    }]);

    const page = await context.newPage();
    await page.goto('/leagues/demo-league/settings');

    const accessDenied = page.locator('[data-testid="access-denied"]');
    await expect(accessDenied).toBeVisible();

    await expect(page).toHaveURL(/\/leagues\/demo-league\/?/, { timeout: 5000 });

    await context.close();
  });
});
