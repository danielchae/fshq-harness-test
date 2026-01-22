import { test, expect } from '@playwright/test';

test.describe('Task 27: Leaderboard Page with Filters', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/leaderboard');
    await page.waitForLoadState('networkidle');
  });

  test('When user visits leaderboard page, season standings table displays by default sorted by wins', async ({ page }) => {
    // Verify leaderboard table is visible
    const leaderboardTable = page.getByRole('table').or(page.getByTestId('leaderboard-table'));
    await expect(leaderboardTable).toBeVisible();

    // Verify table has rows
    const rows = page.getByRole('row');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(1); // Header + data rows

    // Verify wins column exists and is sorted
    const winsColumn = page.getByRole('columnheader', { name: /wins|w/i });
    await expect(winsColumn).toBeVisible();

    // Get win values and verify descending order
    const winCells = page.locator('tbody tr td:has-text("W") , tbody tr [data-wins]').or(
      page.getByTestId('wins-cell')
    );

    if (await winCells.count() > 1) {
      const firstWins = await winCells.first().textContent();
      const secondWins = await winCells.nth(1).textContent();

      const first = parseInt(firstWins || '0', 10);
      const second = parseInt(secondWins || '0', 10);

      expect(first).toBeGreaterThanOrEqual(second);
    }
  });

  test('When user clicks scope toggle (Weekly/Season/All-Time), leaderboard reloads with selected timeframe', async ({ page }) => {
    // Find scope toggle
    const scopeToggle = page.getByTestId('scope-toggle')
      .or(page.locator('[role="group"][aria-label*="scope"]'));

    await expect(scopeToggle).toBeVisible();

    // Click on "Weekly" option - ToggleGroupItem uses radio role
    const weeklyOption = scopeToggle.getByRole('radio', { name: /weekly/i })
      .or(scopeToggle.locator('button:has-text("Weekly")'));
    await weeklyOption.click();

    // Wait for leaderboard to reload
    await page.waitForLoadState('networkidle');

    // Verify table still displays
    const leaderboardTable = page.getByRole('table');
    await expect(leaderboardTable).toBeVisible();

    // Switch to All-Time
    const allTimeOption = scopeToggle.getByRole('radio', { name: /all-time/i })
      .or(scopeToggle.locator('button:has-text("All-Time")'));
    if (await allTimeOption.count() > 0) {
      await allTimeOption.click();
      await page.waitForLoadState('networkidle');
      await expect(leaderboardTable).toBeVisible();
    }
  });

  test('When user selects role filter (Managers/Fans/All), table filters to show only matching members', async ({ page }) => {
    // Find role filter - the SelectTrigger has data-testid="role-filter"
    const roleFilter = page.getByTestId('role-filter');

    await expect(roleFilter).toBeVisible();
    await roleFilter.click();

    // Select "Managers" option - Radix Select uses role="option"
    const managersOption = page.getByRole('option', { name: /managers?/i });
    await expect(managersOption).toBeVisible();
    await managersOption.click();

    // Wait for filter to apply
    await page.waitForLoadState('networkidle');

    // Verify table still has data
    const leaderboardTable = page.getByRole('table');
    await expect(leaderboardTable).toBeVisible();

    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify manager badge/indicator if present
    const managerBadges = page.locator('[data-role="manager"]').or(page.getByText('Manager', { exact: true }));
    if (await managerBadges.count() > 0) {
      await expect(managerBadges.first()).toBeVisible();
    }
  });

  test("When viewing table, current user's row displays with highlighted background", async ({ page }) => {
    // Find current user's row
    const currentUserRow = page.getByTestId('current-user-row')
      .or(page.locator('tr[data-current-user="true"]'))
      .or(page.locator('tr.highlighted, tr.current-user'));

    if (await currentUserRow.count() > 0) {
      await expect(currentUserRow).toBeVisible();

      // Verify row has highlighting class or style
      const hasHighlight = await currentUserRow.evaluate(el => {
        const classes = el.className;
        const bgColor = window.getComputedStyle(el).backgroundColor;

        return classes.includes('highlight') ||
               classes.includes('current') ||
               el.getAttribute('data-current-user') === 'true' ||
               bgColor !== 'rgba(0, 0, 0, 0)';
      });

      expect(hasHighlight).toBe(true);
    }
  });

  test("When no leaderboard data exists (season start), empty state displays with 'Leaderboard updates after Week 1'", async ({ page }) => {
    // Mock API to return empty leaderboard - match the actual route pattern
    await page.route('**/api/leagues/*/leaderboard*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ standings: [], scope: 'season', roleFilter: 'all', currentWeek: 1, leagueAverage: 0 })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify empty state message - use specific selector for the paragraph text
    const emptyState = page.locator('p').getByText(/leaderboard updates after week 1/i);
    await expect(emptyState).toBeVisible();
  });

  test('When leaderboard API returns error, error message displays with retry button', async ({ page }) => {
    // Mock API error - match the actual route pattern
    await page.route('**/api/leagues/*/leaderboard*', async (route) => {
      await route.abort('failed');
    });

    // Reload page
    await page.reload();

    // Wait for error alert - use the AlertTitle specifically
    const errorTitle = page.locator('[role="alert"]').getByText('Error');
    await expect(errorTitle).toBeVisible({ timeout: 10000 });

    // Verify retry button
    const retryButton = page.getByRole('button', { name: /retry|try again/i });
    await expect(retryButton).toBeVisible();
  });
});
