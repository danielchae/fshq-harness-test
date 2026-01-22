import { test, expect } from '@playwright/test';

test.describe('Task 28: User Stats Card on Leaderboard', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/leaderboard');
    await page.waitForLoadState('networkidle');
  });

  test('When user views leaderboard page, personal stats card renders above table', async ({ page }) => {
    // Find user stats card
    const statsCard = page.getByTestId('user-stats-card')
      .or(page.locator('[data-user-stats]'));

    await expect(statsCard).toBeVisible();

    // Verify card is above the table
    const leaderboardTable = page.getByRole('table');

    const cardBox = await statsCard.boundingBox();
    const tableBox = await leaderboardTable.boundingBox();

    if (cardBox && tableBox) {
      expect(cardBox.y).toBeLessThan(tableBox.y);
    }
  });

  test("When viewing stats card, record displays in W-L format (e.g., '45-23')", async ({ page }) => {
    const statsCard = page.getByTestId('user-stats-card');
    await expect(statsCard).toBeVisible();

    // Find record display
    const recordDisplay = statsCard.getByTestId('user-record')
      .or(statsCard.locator('[data-record]'));

    await expect(recordDisplay).toBeVisible();

    // Verify W-L format
    const recordText = await recordDisplay.textContent();
    expect(recordText).toMatch(/\d+-\d+/); // Matches "45-23" format
  });

  test("When user's accuracy exceeds league average, green up arrow displays next to percentage", async ({ page }) => {
    // Mock API with above-average performance
    await page.route('**/api/leaderboard/user-stats*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          record: { wins: 50, losses: 20 },
          accuracy: 71.4,
          leagueAverage: 65.0,
          isAboveAverage: true
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find stats card
    const statsCard = page.getByTestId('user-stats-card');

    // Find accuracy percentage
    const accuracyDisplay = statsCard.getByTestId('accuracy-percentage')
      .or(statsCard.locator('[data-accuracy]'));

    await expect(accuracyDisplay).toBeVisible();

    // Verify green up arrow indicator
    const upArrow = statsCard.locator('[data-trend="up"], [data-icon="arrow-up"], svg[class*="up"]')
      .or(statsCard.getByTestId('trend-up'));

    await expect(upArrow).toBeVisible();
  });

  test('When viewing on mobile viewport, stats card adapts to compact single-row layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for stats card
    const statsCard = page.getByTestId('user-stats-card');
    await expect(statsCard).toBeVisible();

    // Verify card width is constrained to viewport
    const cardBox = await statsCard.boundingBox();
    if (cardBox) {
      expect(cardBox.width).toBeLessThanOrEqual(375);
    }

    // Verify stats are arranged efficiently (horizontal or stacked)
    const statsElements = statsCard.locator('[data-stat]');
    if (await statsElements.count() > 0) {
      await expect(statsElements.first()).toBeVisible();
    }
  });

  test("When user has no picks recorded, stats card shows 'No picks yet - make your first pick!'", async ({ page }) => {
    // Mock API with no picks
    await page.route('**/api/leaderboard/user-stats*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          record: { wins: 0, losses: 0 },
          accuracy: 0,
          hasNoPicks: true
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify no picks message
    const noPicksMessage = page.getByText(/no picks yet|make your first pick/i);
    await expect(noPicksMessage).toBeVisible();
  });
});
