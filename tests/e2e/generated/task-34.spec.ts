import { test, expect } from '@playwright/test';

test.describe('User Profile Page', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
  });

  test('When user visits profile page, their name, email, and avatar display in header', async ({ page }) => {
    const profileHeader = page.locator('[data-testid="profile-header"]');
    await expect(profileHeader).toBeVisible();

    await expect(profileHeader.locator('[data-testid="user-name"]')).toBeVisible();
    await expect(profileHeader.locator('[data-testid="user-email"]')).toBeVisible();
    await expect(profileHeader.locator('[data-testid="user-avatar"]')).toBeVisible();
  });

  test('When viewing stats section, season and all-time pick\'ems record displays', async ({ page }) => {
    const statsSection = page.locator('[data-testid="stats-overview"]');
    await expect(statsSection).toBeVisible();

    await expect(statsSection.locator('[data-testid="season-record"]')).toBeVisible();
    await expect(statsSection.locator('[data-testid="all-time-record"]')).toBeVisible();
  });

  test('When user toggles notification preference switch, change saves immediately with toast confirmation', async ({ page }) => {
    const notificationSwitch = page.getByRole('switch', { name: /notification/i }).first();

    await notificationSwitch.click();

    const toast = page.locator('[data-testid="toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/saved/i);
  });

  test('When user edits profile field and blurs input, changes save with autosave indicator', async ({ page }) => {
    const nameInput = page.getByRole('textbox', { name: /name/i });

    await nameInput.fill('Updated User Name');
    await nameInput.blur();

    const autosaveIndicator = page.locator('[data-testid="autosave-indicator"]');
    await expect(autosaveIndicator).toContainText(/saved/i, { timeout: 3000 });
  });

  test('When profile API returns error, error message displays with retry button', async ({ page }) => {
    await page.route('**/api/profile', route => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) });
    });

    await page.reload();

    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();

    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();
  });
});
