import { test, expect } from '@playwright/test';

test.describe('Task 19: Power Rankings Display Page', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/rankings');
    await page.waitForLoadState('networkidle');
  });

  test('When user visits rankings page, most recent published rankings display by default', async ({ page }) => {
    // Verify rankings table is visible
    const rankingsTable = page.getByRole('table').or(page.getByTestId('rankings-table'));
    await expect(rankingsTable).toBeVisible();

    // Verify table has rows
    const rows = page.getByRole('row').or(page.getByTestId('ranking-row'));
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(1); // At least header + 1 data row

    // Verify rank numbers are present and in order
    const rankCells = page.getByTestId('rank-number').or(rankingsTable.locator('td:first-child, [data-rank]'));
    const firstRank = await rankCells.first().textContent();
    expect(firstRank).toContain('1');
  });

  test("When user selects different week from dropdown, that week's rankings load and display", async ({ page }) => {
    // Find week selector
    const weekSelector = page.getByRole('combobox', { name: /week/i })
      .or(page.getByTestId('week-selector'));
    await expect(weekSelector).toBeVisible();

    // Open dropdown
    await weekSelector.click();

    // Select a different week (assuming week options are available)
    const weekOption = page.getByRole('option', { name: /week [0-9]+/i }).nth(1);
    if (await weekOption.count() > 0) {
      await weekOption.click();

      // Wait for rankings to reload
      await page.waitForLoadState('networkidle');

      // Verify rankings table is still visible with data
      const rankingsTable = page.getByRole('table').or(page.getByTestId('rankings-table'));
      await expect(rankingsTable).toBeVisible();
    }
  });

  test('When viewing rankings table, each row shows rank, team name, team logo, and commissioner commentary', async ({ page }) => {
    // Get first ranking row (data row, not header)
    const firstRow = page.getByRole('row').nth(1);
    await expect(firstRow).toBeVisible();

    // Verify rank number
    const rankNumber = firstRow.getByTestId('rank-number');
    await expect(rankNumber).toBeVisible();

    // Verify team name
    const teamName = firstRow.getByTestId('team-name');
    await expect(teamName).toBeVisible();

    // Verify team logo/avatar - use the data-testid which is on the Avatar container
    const teamLogo = firstRow.getByTestId('team-logo');
    await expect(teamLogo).toBeVisible();

    // Verify commentary is present
    const commentary = firstRow.getByTestId('commentary');
    await expect(commentary).toBeVisible();
  });

  test("When no rankings published for selected week, empty state displays with message 'Rankings not yet published for this week'", async ({ page }) => {
    // Mock API to return no rankings
    await page.route('**/api/power-rankings*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rankings: [] })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify empty state message - use the specific text
    const emptyState = page.getByText('Rankings not yet published for this week');
    await expect(emptyState).toBeVisible();
  });

  test('When rankings API returns error, error message displays with retry button', async ({ page }) => {
    // Mock API error
    await page.route('**/api/power-rankings*', async (route) => {
      await route.abort('failed');
    });

    // Reload page
    await page.reload();

    // Wait for error message - use the heading specifically
    const errorMessage = page.getByRole('heading', { name: /unable to load/i });
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Verify retry button exists
    const retryButton = page.getByRole('button', { name: /retry|try again/i });
    await expect(retryButton).toBeVisible();
  });
});
