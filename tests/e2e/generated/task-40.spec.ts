import { test, expect } from '@playwright/test';

test.describe('Data Fetching Hooks for League Data', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('When hook is called with league slug, data fetches from /api/leagues/[slug] endpoint', async ({ page }) => {
    let apiCalled = false;

    await page.route('**/api/leagues/demo-league', route => {
      apiCalled = true;
      route.fulfill({
        status: 200,
        body: JSON.stringify({ id: '1', slug: 'demo-league', name: 'Demo League' })
      });
    });

    await page.goto('/leagues/demo-league/feed');

    const leagueName = page.locator('[data-testid="league-name"]');
    await expect(leagueName).toContainText('Demo League');

    expect(apiCalled).toBe(true);
  });

  test('When data is loading, hook returns { data: undefined, isLoading: true, error: null }', async ({ page }) => {
    await page.route('**/api/leagues/demo-league', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        body: JSON.stringify({ id: '1', slug: 'demo-league', name: 'Demo League' })
      });
    });

    const navigationPromise = page.goto('/leagues/demo-league/feed');

    const loadingSkeleton = page.locator('[data-testid="league-skeleton"]');
    await expect(loadingSkeleton).toBeVisible({ timeout: 1000 });

    await navigationPromise;
  });

  test('When API returns error, hook returns { data: undefined, isLoading: false, error: Error }', async ({ page }) => {
    await page.route('**/api/leagues/demo-league', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.goto('/leagues/demo-league/feed');

    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
  });

  test('When data fetches successfully, subsequent calls return cached data without refetch', async ({ page }) => {
    let fetchCount = 0;

    await page.route('**/api/leagues/demo-league', route => {
      fetchCount++;
      route.fulfill({
        status: 200,
        body: JSON.stringify({ id: '1', slug: 'demo-league', name: 'Demo League' })
      });
    });

    await page.goto('/leagues/demo-league/feed');
    await page.waitForLoadState('networkidle');

    const initialFetchCount = fetchCount;

    await page.goto('/leagues/demo-league/leaderboard');
    await page.waitForLoadState('networkidle');

    expect(fetchCount).toBe(initialFetchCount);
  });

  test('When league slug is invalid or missing, hook returns error state with appropriate message', async ({ page }) => {
    await page.route('**/api/leagues/invalid-slug', route => {
      route.fulfill({
        status: 404,
        body: JSON.stringify({ error: 'League not found' })
      });
    });

    await page.goto('/leagues/invalid-slug/feed');

    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/not found/i);
  });

  test('When cached data exists but is stale, refetch occurs in background while stale data displays', async ({ page }) => {
    let fetchCount = 0;

    await page.route('**/api/leagues/demo-league', route => {
      fetchCount++;
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          id: '1',
          slug: 'demo-league',
          name: fetchCount === 1 ? 'Old League Name' : 'Updated League Name'
        })
      });
    });

    await page.goto('/leagues/demo-league/feed');

    const leagueName = page.locator('[data-testid="league-name"]');
    await expect(leagueName).toContainText('Old League Name');

    await page.waitForTimeout(100);
    await page.reload();

    await expect(leagueName).toContainText('Old League Name');

    await expect(leagueName).toContainText('Updated League Name', { timeout: 5000 });
  });
});
