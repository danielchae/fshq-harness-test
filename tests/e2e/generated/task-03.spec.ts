import { test, expect } from '@playwright/test';

test.describe('task-03: League Connection Wizard - Step 1', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/connect-league');
  });

  test('When user enters empty or malformed Sleeper username, validation error displays inline before submission', async ({ page }) => {
    const input = page.getByRole('textbox', { name: /username|league.*id/i });
    await input.fill('');
    await input.blur();

    const errorMessage = page.locator('[role="alert"], .error-message, [data-testid="validation-error"]').first();
    await expect(errorMessage).toBeVisible();

    await input.fill('ab');
    await input.blur();

    await expect(errorMessage).toBeVisible();
  });

  test('When user submits valid username, loading spinner appears while fetching leagues from data layer', async ({ page }) => {
    const input = page.getByRole('textbox', { name: /username|league.*id/i });
    await input.fill('validuser123');

    const submitButton = page.getByRole('button', { name: 'Continue' });
    await submitButton.click();

    const spinner = page.locator('[data-testid="loading-spinner"]').first();
    await expect(spinner).toBeVisible();
  });

  test('When data layer returns leagues, user sees selectable list of their leagues', async ({ page }) => {
    await page.route('**/api/sleeper/leagues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leagues: [
            { id: '1', name: 'Test League 1', team_count: 12, season: '2024' },
            { id: '2', name: 'Test League 2', team_count: 10, season: '2024' },
          ],
        }),
      });
    });

    const input = page.getByRole('textbox', { name: /username|league.*id/i });
    await input.fill('validuser123');

    const submitButton = page.getByRole('button', { name: 'Continue' });
    await submitButton.click();

    const leagueList = page.locator('[data-testid="league-list"]');
    await expect(leagueList).toBeVisible();

    await expect(page.getByText('Test League 1')).toBeVisible();
    await expect(page.getByText('Test League 2')).toBeVisible();
  });

  test('When data layer returns no leagues for username, empty state shows with message \'No leagues found for this username\'', async ({ page }) => {
    await page.route('**/api/sleeper/leagues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ leagues: [] }),
      });
    });

    const input = page.getByRole('textbox', { name: /username|league.*id/i });
    await input.fill('emptyuser');

    const submitButton = page.getByRole('button', { name: 'Continue' });
    await submitButton.click();

    await expect(page.getByText(/no leagues found for this username/i)).toBeVisible();
  });

  test('When data layer returns error (e.g., API timeout), error message displays with retry button', async ({ page }) => {
    await page.route('**/api/sleeper/leagues*', async (route) => {
      await route.abort('timedout');
    });

    const input = page.getByRole('textbox', { name: /username|league.*id/i });
    await input.fill('erroruser');

    const submitButton = page.getByRole('button', { name: 'Continue' });
    await submitButton.click();

    const errorMessage = page.getByTestId('error-message');
    await expect(errorMessage).toBeVisible();

    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();
  });
});
