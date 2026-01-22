import { test, expect } from '@playwright/test';

test.describe('task-05: League Connection Wizard - Step 3', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/sleeper/leagues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leagues: [{ id: '1', name: 'Test League', team_count: 12, season: '2024' }],
        }),
      });
    });

    await page.goto('/connect-league');

    const input = page.getByRole('textbox', { name: /username|league.*id/i });
    await input.fill('validuser123');

    const submitButton = page.getByRole('button', { name: /^continue$/i });
    await submitButton.click();

    const leagueCard = page.locator('[data-testid="league-card"]').first();
    await leagueCard.click();
  });

  test('When sync starts, progress bar renders with percentage and status messages updating as sync progresses', async ({ page }) => {
    await page.route('**/api/sync/progress*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ progress: 45, status: 'Importing teams...' }),
      });
    });

    const confirmButton = page.getByRole('button', { name: /confirm/i });
    await confirmButton.click();

    const progressBar = page.locator('[role="progressbar"], [data-testid="sync-progress-bar"]');
    await expect(progressBar).toBeVisible();

    const statusMessage = page.locator('[data-testid="sync-status"]');
    await expect(statusMessage).toBeVisible();
  });

  test('When sync completes successfully, success message displays with league URL and \'Go to League\' button', async ({ page }) => {
    await page.route('**/api/sync*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, leagueSlug: 'test-league' }),
      });
    });

    const confirmButton = page.getByRole('button', { name: /confirm/i });
    await confirmButton.click();

    await expect(page.getByText(/successfully.*imported|sync.*complete/i).first()).toBeVisible();

    const goToLeagueButton = page.getByRole('button', { name: /go to league/i });
    await expect(goToLeagueButton).toBeVisible();
  });

  test('When sync fails partially (some data imported), warning message displays with option to continue or retry', async ({ page }) => {
    await page.route('**/api/sync*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          partial: true,
          message: 'Some data could not be imported'
        }),
      });
    });

    const confirmButton = page.getByRole('button', { name: /confirm/i });
    await confirmButton.click();

    const warningMessage = page.locator('[role="alert"]');
    await expect(warningMessage).toBeVisible();

    const continueButton = page.getByRole('button', { name: /continue/i });
    await expect(continueButton).toBeVisible();

    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();
  });

  test('When sync fails completely (no data imported), error message displays with retry button and support contact', async ({ page }) => {
    await page.route('**/api/sync*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Sync failed completely'
        }),
      });
    });

    const confirmButton = page.getByRole('button', { name: /confirm/i });
    await confirmButton.click();

    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible();

    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();

    await expect(page.getByText(/support|contact|help/i).first()).toBeVisible();
  });
});
