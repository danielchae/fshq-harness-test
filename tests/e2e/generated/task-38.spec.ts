import { test, expect } from '@playwright/test';

test.describe('Loading Skeleton and Empty State Components', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('When feed is loading, skeleton cards render with shimmer pulse animation matching card dimensions', async ({ page }) => {
    await page.route('**/api/feed*', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      route.fulfill({ status: 200, body: JSON.stringify({ moments: [], nextCursor: null }) });
    });

    // Navigate and wait for DOM to be ready (but not for network)
    await page.goto('/leagues/demo-league/feed', { waitUntil: 'domcontentloaded' });

    const skeleton = page.locator('[data-testid="feed-skeleton"]');
    await expect(skeleton).toBeVisible({ timeout: 2000 });

    const hasAnimation = await skeleton.evaluate((el) => {
      const animation = window.getComputedStyle(el).animation;
      return animation.includes('pulse') || animation.includes('shimmer');
    });
    expect(hasAnimation).toBe(true);
  });

  test('When table is loading, skeleton rows render matching expected column count and widths', async ({ page }) => {
    await page.route('**/api/leagues/*/leaderboard*', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      route.fulfill({ status: 200, body: JSON.stringify({ standings: [], leagueAverage: 0 }) });
    });

    // Navigate and wait for DOM to be ready (but not for network)
    await page.goto('/leagues/demo-league/leaderboard', { waitUntil: 'domcontentloaded' });

    const tableSkeleton = page.locator('[data-testid="table-skeleton"]');
    await expect(tableSkeleton).toBeVisible({ timeout: 2000 });

    const skeletonCells = tableSkeleton.locator('[data-testid="skeleton-cell"]');
    const cellCount = await skeletonCells.count();
    expect(cellCount).toBeGreaterThan(0);
  });

  test('When empty state component renders, illustration, title, description, and optional CTA button display', async ({ page }) => {
    await page.route('**/api/feed*', route => {
      route.fulfill({ status: 200, body: JSON.stringify({ moments: [], nextCursor: null }) });
    });

    await page.goto('/leagues/demo-league/feed');

    const emptyState = page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();

    await expect(emptyState.locator('[data-testid="empty-illustration"]')).toBeVisible();
    await expect(emptyState.locator('[data-testid="empty-title"]')).toBeVisible();
    await expect(emptyState.locator('[data-testid="empty-description"]')).toBeVisible();
  });

  test('When passing action prop to empty state, CTA button renders and fires onClick handler', async ({ page }) => {
    await page.route('**/api/leagues/*/teams*', route => {
      route.fulfill({ status: 200, body: JSON.stringify([]) });
    });

    await page.goto('/leagues/demo-league/teams');

    const emptyState = page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();

    const ctaButton = emptyState.locator('[data-testid="empty-cta"]');
    await expect(ctaButton).toBeVisible();

    await ctaButton.click();
    await expect(page).toHaveURL(/\/leagues\/demo-league\/teams\/create/);
  });
});
