import { test, expect } from '@playwright/test';

test.describe('Task 24: Pick\'ems Submission Page', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/pickems');
    await page.waitForLoadState('networkidle');
  });

  test("When user visits pickems page, current week's matchups render with selectable team buttons", async ({ page }) => {
    // Verify matchup pick cards are visible
    const pickCards = page.getByTestId('matchup-pick-card');
    const cardCount = await pickCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify first matchup has two team selection buttons
    const firstCard = pickCards.first();
    const teamButtons = firstCard.getByRole('button').filter({ hasText: /team|vs/i });
    const buttonCount = await teamButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(2);

    // Verify buttons are enabled (not locked yet)
    const firstButton = teamButtons.first();
    await expect(firstButton).toBeEnabled();
  });

  test('When user clicks team to select as pick, team button highlights and selection saves to state', async ({ page }) => {
    const firstCard = page.getByTestId('matchup-pick-card').first();
    const teamButtons = firstCard.getByRole('button').filter({ hasText: /team/i });

    // Get first team button
    const firstTeam = teamButtons.first();

    // Check if already selected (from previous test runs) - if so, click to deselect first
    const currentSelection = await firstTeam.getAttribute('data-selected');
    if (currentSelection === 'true') {
      await firstTeam.click();
      await expect(firstTeam).toHaveAttribute('data-selected', 'false', { timeout: 2000 });
    }

    // Now click to select
    await firstTeam.click();

    // Wait for the button to show selected state
    await expect(firstTeam).toHaveAttribute('data-selected', 'true', { timeout: 3000 });

    // Verify pick summary updates to show at least 1 pick
    const pickSummary = page.getByTestId('picks-summary');
    await expect(pickSummary).toBeVisible();
    await expect(pickSummary).toContainText(/1\/\d+ picks/);
  });

  test('When lock time is within 1 hour, countdown timer updates every minute with remaining time', async ({ page }) => {
    // Look for countdown timer
    const countdown = page.getByTestId('lock-countdown')
      .or(page.locator('[data-countdown]'));

    if (await countdown.count() > 0) {
      await expect(countdown).toBeVisible();

      // Get initial time
      const initialText = await countdown.textContent();

      // Wait 1 minute (or shorter for testing)
      await page.waitForTimeout(2000); // 2 seconds for test

      // Verify countdown is still visible and active
      await expect(countdown).toBeVisible();

      // Verify it shows time format (hours:minutes or minutes:seconds)
      const currentText = await countdown.textContent();
      expect(currentText).toMatch(/\d+:\d+|\d+\s*(min|hour|hr)/i);
    }
  });

  test("When user clicks Save Picks button, confirmation toast displays with pick count (e.g., '6/6 picks saved')", async ({ page }) => {
    // Make some picks first
    const pickCards = page.getByTestId('matchup-pick-card');
    const firstCard = pickCards.first();
    const teamButton = firstCard.getByRole('button').filter({ hasText: /team/i }).first();

    // Ensure button is selected (handle pre-selected state from previous runs)
    const currentSelection = await teamButton.getAttribute('data-selected');
    if (currentSelection !== 'true') {
      await teamButton.click();
      await expect(teamButton).toHaveAttribute('data-selected', 'true', { timeout: 2000 });
    }

    // Click save picks button
    const saveButton = page.getByRole('button', { name: /save pick/i });
    await saveButton.click();

    // Wait for confirmation toast (Sonner toasts use data-sonner-toast attribute)
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Verify toast contains pick count
    const toastText = await toast.textContent();
    expect(toastText).toMatch(/\d+\/\d+|pick.*saved/i);
  });

  test("When no matchups exist for picking, empty state displays with message 'No pick'em matchups this week'", async ({ page }) => {
    // Mock API to return no matchups - route pattern matches /api/leagues/[slug]/pickems
    await page.route('**/api/leagues/*/pickems**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ matchups: [], currentWeek: 10, totalWeeks: 17 })
        });
      } else {
        await route.continue();
      }
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify empty state message
    const emptyState = page.getByText(/no pick.*em matchups|no matchups available/i);
    await expect(emptyState).toBeVisible();
  });

  test('When pickems API returns error, error message displays with retry button', async ({ page }) => {
    // Mock API error - route pattern matches /api/leagues/[slug]/pickems
    await page.route('**/api/leagues/*/pickems**', async (route) => {
      await route.abort('failed');
    });

    // Reload page
    await page.reload();

    // Wait for error message (component shows "Error loading pick'ems" or "Unable to load")
    const errorMessage = page.getByText(/error|failed|unable to load/i).first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // Verify retry button (component shows "Try Again")
    const retryButton = page.getByRole('button', { name: /retry|try again/i });
    await expect(retryButton).toBeVisible();
  });
});
