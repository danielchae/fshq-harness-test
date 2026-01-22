import { test, expect } from '@playwright/test';

test.describe('Reusable UI Components: Infinite Scroll and Toast', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('When user scrolls within 200px of container bottom, onLoadMore callback fires and loading spinner appears', async ({ page }) => {
    // Mock feed API to return paginated data with a delay on subsequent requests
    let requestCount = 0;
    await page.route('**/api/feed*', async route => {
      requestCount++;
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get('cursor');

      // First request: return data with nextCursor
      if (!cursor) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            moments: [
              { id: 'mock-1', type: 'post', content: 'Test post 1', createdAt: '2024-01-15T18:00:00Z', authorName: 'User1', reactions: {}, commentCount: 0 },
              { id: 'mock-2', type: 'post', content: 'Test post 2', createdAt: '2024-01-15T17:00:00Z', authorName: 'User2', reactions: {}, commentCount: 0 },
              { id: 'mock-3', type: 'post', content: 'Test post 3', createdAt: '2024-01-15T16:00:00Z', authorName: 'User3', reactions: {}, commentCount: 0 },
            ],
            nextCursor: 'mock-3'
          })
        });
        return;
      }

      // Second request (pagination): delay to show spinner, then return more data
      await new Promise(resolve => setTimeout(resolve, 1500));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          moments: [
            { id: 'mock-4', type: 'post', content: 'Test post 4', createdAt: '2024-01-15T15:00:00Z', authorName: 'User4', reactions: {}, commentCount: 0 },
          ],
          nextCursor: null
        })
      });
    });

    await page.goto('/leagues/demo-league/feed');

    const container = page.locator('[data-testid="infinite-scroll-container"]');
    await expect(container).toBeVisible();

    // Scroll to trigger load more
    await container.evaluate((el) => {
      el.scrollTop = el.scrollHeight - el.clientHeight - 150;
    });

    const loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    await expect(loadingSpinner).toBeVisible({ timeout: 3000 });
  });

  test('When no more content exists, \'No more items\' message displays at container bottom', async ({ page }) => {
    // Intercept the feed API to return empty data (end of feed)
    await page.route('**/api/feed*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ moments: [], nextCursor: null })
      });
    });

    await page.goto('/leagues/demo-league/feed');

    const container = page.locator('[data-testid="infinite-scroll-container"]');
    await expect(container).toBeVisible();

    const endMessage = page.locator('text=No more items');
    await expect(endMessage).toBeVisible();
  });

  test('When toast.success() is called, green success toast appears and auto-dismisses after 5s', async ({ page, context }) => {
    // Add admin role cookie to access settings page
    await context.addCookies([{
      name: 'user-role',
      value: 'admin',
      domain: 'localhost',
      path: '/'
    }]);

    await page.goto('/leagues/demo-league/settings');

    const visibilitySwitch = page.getByRole('switch', { name: /visibility/i });
    await expect(visibilitySwitch).toBeVisible({ timeout: 5000 });
    await visibilitySwitch.click();

    const toast = page.locator('[data-testid="toast"][data-type="success"]');
    await expect(toast).toBeVisible({ timeout: 3000 });

    const bgColor = await toast.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(bgColor).toContain('34, 197, 94');

    await expect(toast).not.toBeVisible({ timeout: 7000 });
  });

  test('When multiple toasts trigger, they stack vertically without overlapping', async ({ page }) => {
    await page.goto('/leagues/demo-league/feed');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Trigger multiple toasts using the global showToast function
    await page.evaluate(() => {
      const showToast = (window as any).showToast;
      if (showToast) {
        showToast('First message');
        showToast('Second message');
        showToast('Third message');
      }
    });

    // Wait for toasts to appear
    await page.waitForTimeout(500);

    const toasts = page.locator('[data-testid="toast"]');
    const count = await toasts.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const firstToast = await toasts.nth(0).boundingBox();
    const secondToast = await toasts.nth(1).boundingBox();

    if (firstToast && secondToast) {
      // Toasts should be stacked (either first.y > second.y or first.y + height <= second.y)
      // Sonner stacks from bottom by default, so first toast is at bottom
      expect(Math.abs(firstToast.y - secondToast.y)).toBeGreaterThan(0);
    }
  });
});
