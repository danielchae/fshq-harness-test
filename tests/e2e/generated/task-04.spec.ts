import { test, expect } from '@playwright/test';

test.describe('task-04: League Connection Wizard - Step 2', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/sleeper/leagues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leagues: [
            { id: '1', name: 'Test League', team_count: 12, season: '2024' },
          ],
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

  test('When user reaches step 2, league preview card renders with name, team count, and season year', async ({ page }) => {
    const previewCard = page.locator('[data-testid="league-preview-card"]');
    await expect(previewCard).toBeVisible();

    await expect(previewCard.getByRole('heading', { name: 'Test League' })).toBeVisible();
    await expect(previewCard.getByText(/12.*teams?/i)).toBeVisible();
    await expect(previewCard.getByText(/2024/)).toBeVisible();
  });

  test('When user clicks Confirm button, wizard proceeds to sync step', async ({ page }) => {
    const confirmButton = page.getByRole('button', { name: /confirm/i });
    await confirmButton.click();

    await expect(page.locator('[data-testid="sync-progress"]')).toBeVisible();
  });

  test('When user clicks Back button, wizard returns to step 1 with previous username preserved in input', async ({ page }) => {
    const backButton = page.getByRole('button', { name: /back/i });
    await backButton.click();

    const input = page.getByRole('textbox', { name: /username|league.*id/i });
    const inputValue = await input.inputValue();
    expect(inputValue).toBe('validuser123');
  });

  test('When selected league already exists in FSHQ database, info message offers option to join existing league instead', async ({ page, context }) => {
    await page.route('**/api/leagues/check-exists*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exists: true, leagueSlug: 'test-league' }),
      });
    });

    await page.goto('/connect-league');

    const input = page.getByRole('textbox', { name: /username|league.*id/i });
    await input.fill('validuser123');

    const submitButton = page.getByRole('button', { name: /^continue$/i });
    await submitButton.click();

    const leagueCard = page.locator('[data-testid="league-card"]').first();
    await leagueCard.click();

    const infoMessage = page.getByTestId('info-message');
    await expect(infoMessage).toBeVisible();

    const joinButton = page.getByRole('button', { name: /join.*existing/i });
    await expect(joinButton).toBeVisible();
  });
});
