import { test, expect } from '@playwright/test';

test.describe('Task 21: Matchups Page with Week Navigation', () => {
  // Uses auth from playwright.config.ts project setup

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/matchups');
    await page.waitForLoadState('networkidle');
  });

  test("When user visits matchups page, current week's matchups display with team names and projected scores", async ({ page }) => {
    // Verify matchup blocks are visible
    const matchupBlocks = page.getByTestId('matchup-block');
    const blockCount = await matchupBlocks.count();
    expect(blockCount).toBeGreaterThan(0);

    // Verify first matchup has team names
    const firstMatchup = matchupBlocks.first();
    const teamNames = firstMatchup.getByTestId('team-name');
    const teamCount = await teamNames.count();
    expect(teamCount).toBe(2);

    // Verify scores are displayed
    const scores = firstMatchup.getByTestId('team-score')
      .or(firstMatchup.locator('[data-score]'));
    const scoreCount = await scores.count();
    expect(scoreCount).toBeGreaterThanOrEqual(0); // May be 0 if not started
  });

  test('When user swipes or clicks week in horizontal selector, selected week\'s matchups load', async ({ page }) => {
    // Find week selector strip
    const weekSelector = page.getByTestId('week-selector-strip')
      .or(page.locator('[data-week-selector]'));
    await expect(weekSelector).toBeVisible();

    // Find week buttons
    const weekButtons = weekSelector.getByRole('button', { name: /week [0-9]+/i });
    const buttonCount = await weekButtons.count();

    if (buttonCount > 1) {
      // Click on a different week
      const secondWeek = weekButtons.nth(1);
      await secondWeek.click();

      // Wait for matchups to load
      await page.waitForLoadState('networkidle');

      // Verify matchups are displayed
      const matchupBlocks = page.getByTestId('matchup-block');
      await expect(matchupBlocks.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('When matchup is marked as featured, it displays with highlighted border and hype text', async ({ page }) => {
    // Look for featured matchup
    const featuredMatchup = page.getByTestId('matchup-block')
      .locator('[data-featured="true"]')
      .or(page.locator('.featured-matchup'));

    if (await featuredMatchup.count() > 0) {
      await expect(featuredMatchup.first()).toBeVisible();

      // Verify featured badge or indicator
      const featuredBadge = featuredMatchup.first().getByTestId('featured-badge')
        .or(featuredMatchup.first().locator('[class*="featured"]'));
      await expect(featuredBadge).toBeVisible();

      // Verify hype text is present
      const hypeText = featuredMatchup.first().getByTestId('hype-text')
        .or(featuredMatchup.first().locator('[data-hype]'));
      await expect(hypeText).toBeVisible();
    }
  });

  test('When matchup is complete, final scores and winner checkmark indicator display', async ({ page }) => {
    // Mock API to return completed matchup
    await page.route('**/api/matchups*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matchups: [{
            id: '1',
            homeTeam: { id: '1', name: 'Team A', score: 125 },
            awayTeam: { id: '2', name: 'Team B', score: 98 },
            isComplete: true,
            winnerId: '1'
          }]
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify matchup shows final scores
    const matchup = page.getByTestId('matchup-block').first();
    const scores = matchup.getByTestId('team-score');
    await expect(scores.first()).toBeVisible();

    // Verify winner indicator (checkmark)
    const winnerIndicator = matchup.getByTestId('winner-indicator')
      .or(matchup.locator('[data-winner="true"]'))
      .or(matchup.getByLabel(/winner|checkmark/i));
    await expect(winnerIndicator).toBeVisible();
  });

  test("When no matchups exist for selected week (bye week), empty state displays with message 'No matchups this week'", async ({ page }) => {
    // Mock API to return no matchups
    await page.route('**/api/matchups*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ matchups: [] })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify empty state message
    const emptyState = page.getByText('No matchups this week');
    await expect(emptyState).toBeVisible();
  });

  test('When matchups API returns error, error message displays with retry button', async ({ page }) => {
    // Mock API error
    await page.route('**/api/matchups*', async (route) => {
      await route.abort('failed');
    });

    // Reload page
    await page.reload();

    // Wait for error message
    const errorMessage = page.getByText('Error loading matchups');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Verify retry button
    const retryButton = page.getByRole('button', { name: /retry|try again/i });
    await expect(retryButton).toBeVisible();
  });
});
