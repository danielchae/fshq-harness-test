import { test, expect } from '@playwright/test';

test.describe('task-15: Commissioner Desk Page Shell', () => {
  test.use({ storageState: 'tests/e2e/auth/commissioner.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/desk');
  });

  test('When commissioner visits /leagues/[slug]/desk, week and season selectors render with current week pre-selected', async ({ page }) => {
    const weekSelector = page.locator('[data-testid="week-selector"]');
    await expect(weekSelector).toBeVisible();

    const seasonSelector = page.locator('[data-testid="season-selector"]');
    await expect(seasonSelector).toBeVisible();

    const selectedWeek = weekSelector.locator('[data-selected="true"], [aria-selected="true"]');
    await expect(selectedWeek).toBeVisible();
  });

  test('When user switches between Power Rankings, Matchup Predictions, Posts tabs, appropriate editor loads', async ({ page }) => {
    const tabs = page.locator('[role="tablist"]');
    await expect(tabs).toBeVisible();

    const powerRankingsTab = tabs.getByRole('tab', { name: /power.*rankings/i });
    await powerRankingsTab.click();

    const rankingsEditor = page.locator('[data-testid="rankings-editor"]');
    await expect(rankingsEditor).toBeVisible();

    const matchupTab = tabs.getByRole('tab', { name: /matchup.*predictions/i });
    await matchupTab.click();

    const matchupEditor = page.locator('[data-testid="matchup-editor"]');
    await expect(matchupEditor).toBeVisible();

    const postsTab = tabs.getByRole('tab', { name: /posts/i });
    await postsTab.click();

    const postsEditor = page.locator('[data-testid="posts-editor"]');
    await expect(postsEditor).toBeVisible();
  });

  test('When content autosaves, indicator shows \'Saving...\' then transitions to \'All changes saved\'', async ({ page }) => {
    await page.route('**/api/desk/autosave*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const editor = page.locator('[role="textbox"]').first();
    await editor.fill('Test content for autosave');

    const autosaveIndicator = page.locator('[data-testid="autosave-indicator"]');
    await expect(autosaveIndicator).toContainText(/saving/i);

    await expect(autosaveIndicator).toContainText(/all changes saved/i, { timeout: 5000 });
  });

  test('When user without commissioner role visits page, access denied message renders with redirect link', async ({ page, context }) => {
    // Get current cookies to preserve session but change role
    const cookies = await context.cookies();

    // Remove only the user-role cookie to simulate non-commissioner user
    const sessionCookies = cookies.filter(c => c.name !== 'user-role');

    // Clear all and add back session cookies with fan role
    await context.clearCookies();
    await context.addCookies([
      ...sessionCookies,
      {
        name: 'user-role',
        value: 'fan',
        domain: 'localhost',
        path: '/',
      }
    ]);

    await page.reload();

    await expect(page.getByText('Access Denied')).toBeVisible();

    const redirectLink = page.getByRole('link', { name: /back to|return to/i });
    await expect(redirectLink).toBeVisible();
  });
});
