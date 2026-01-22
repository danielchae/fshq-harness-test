import { test, expect } from '@playwright/test';

test.describe('task-13: Content Moderation Actions', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    // Mock user API to return admin user
    await page.route('**/api/user/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'admin-1',
          name: 'Admin User',
          email: 'admin@test.com',
          role: 'admin',
        }),
      });
    });

    await page.route('**/api/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          moments: [
            { id: '1', type: 'post', content: 'Test post', pinned: false },
          ],
        }),
      });
    });

    await page.goto('/leagues/test-league');
  });

  test('When admin views moment card, three-dot moderation menu icon appears in card header', async ({ page }) => {
    const moment = page.locator('[data-testid="feed-moment"]').first();
    const moderationMenu = moment.locator('[data-testid="moderation-menu"]');

    await expect(moderationMenu).toBeVisible();
  });

  test('When admin clicks Pin action, moment moves to top of feed and shows pinned indicator badge', async ({ page }) => {
    await page.route('**/api/moderation/pin*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, pinned: true }),
      });
    });

    const moment = page.locator('[data-testid="feed-moment"]').first();
    const moderationMenu = moment.locator('[data-testid="moderation-menu"]');

    await moderationMenu.click();

    const pinAction = page.getByRole('menuitem', { name: /pin/i });
    await pinAction.click();

    const pinnedBadge = moment.locator('[data-testid="pinned-badge"]');
    await expect(pinnedBadge).toBeVisible();
  });

  test('When admin clicks Hide action, moment is removed from public feed and queued for review', async ({ page }) => {
    await page.route('**/api/moderation/hide*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    const moment = page.locator('[data-testid="feed-moment"]').first();
    const momentContent = await moment.textContent();

    const moderationMenu = moment.locator('[data-testid="moderation-menu"]');
    await moderationMenu.click();

    const hideAction = page.getByRole('menuitem', { name: /hide/i });
    await hideAction.click();

    await expect(moment).not.toBeVisible();
  });

  test('When user without admin role views moment, moderation menu icon is not rendered', async ({ page, context }) => {
    // Clear previous route handlers and set up non-admin user mock
    await page.unrouteAll();

    // Mock user API to return regular (non-admin) user
    await page.route('**/api/user/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          name: 'Regular User',
          email: 'user@test.com',
          role: 'fan',
        }),
      });
    });

    await page.route('**/api/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          moments: [
            { id: '1', type: 'post', content: 'Test post', pinned: false },
          ],
        }),
      });
    });

    await page.reload();

    const moment = page.locator('[data-testid="feed-moment"]').first();
    const moderationMenu = moment.locator('[data-testid="moderation-menu"]');

    const isVisible = await moderationMenu.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});
