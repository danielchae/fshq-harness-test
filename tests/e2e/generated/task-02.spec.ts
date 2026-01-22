import { test, expect } from '@playwright/test';

test.describe('task-02: League Clubhouse Layout', () => {
  // Uses project-level storageState from playwright.config.ts (tests/e2e/fixtures/auth.json)

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league');
  });

  test('When user navigates to /leagues/[slug], left sidebar renders with Feed, Pick\'ems, Rankings, Matchups, Leaderboard, Transactions links', async ({ page }) => {
    const sidebar = page.locator('[data-testid="league-sidebar"]');
    await expect(sidebar).toBeVisible();

    await expect(sidebar.getByRole('link', { name: /feed/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /pick'?ems/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /rankings/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /matchups/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /leaderboard/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /transactions/i })).toBeVisible();
  });

  test('When user clicks a navigation link, URL updates and active link shows highlighted state', async ({ page }) => {
    const sidebar = page.locator('[data-testid="league-sidebar"]');
    const pickemLink = sidebar.getByRole('link', { name: /pick'?ems/i });

    await pickemLink.click();

    await expect(page).toHaveURL(/\/leagues\/test-league\/pickems/);

    const activeLink = sidebar.locator('[data-active="true"], [aria-current="page"], .active');
    await expect(activeLink).toContainText(/pick'?ems/i);
  });

  test('When user views on mobile viewport, hamburger menu replaces sidebar and opens slide-out drawer on tap', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const hamburger = page.getByRole('button', { name: /menu|navigation/i });
    await expect(hamburger).toBeVisible();

    const sidebar = page.locator('[data-testid="league-sidebar"]');
    const sidebarVisible = await sidebar.isVisible();
    expect(sidebarVisible).toBe(false);

    await hamburger.click();

    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /feed/i })).toBeVisible();
  });

  test('When user has commissioner role, Commissioner Desk link appears in navigation section', async ({ page, context }) => {
    await context.addCookies([{
      name: 'user-role',
      value: 'commissioner',
      domain: 'localhost',
      path: '/',
    }]);

    await page.reload();

    const sidebar = page.locator('[data-testid="league-sidebar"]');
    await expect(sidebar.getByRole('link', { name: /commissioner.*desk/i })).toBeVisible();
  });

  test('When user has admin role, Settings link appears in navigation section', async ({ page, context }) => {
    await context.addCookies([{
      name: 'user-role',
      value: 'admin',
      domain: 'localhost',
      path: '/',
    }]);

    await page.reload();

    const sidebar = page.locator('[data-testid="league-sidebar"]');
    await expect(sidebar.getByRole('link', { name: /settings/i })).toBeVisible();
  });
});
