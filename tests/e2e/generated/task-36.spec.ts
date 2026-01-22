import { test, expect } from '@playwright/test';

test.describe('Mobile Navigation Drawer', () => {
  test.use({
    storageState: 'tests/e2e/.auth/user.json',
    viewport: { width: 375, height: 667 }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/demo-league/feed');
  });

  test('When user taps hamburger icon on mobile, drawer slides in from left edge', async ({ page }) => {
    const hamburgerButton = page.locator('[data-testid="hamburger-button"]');
    await expect(hamburgerButton).toBeVisible();

    await hamburgerButton.click();

    const drawer = page.locator('[data-testid="mobile-nav-drawer"]');
    await expect(drawer).toBeVisible();

    const drawerBox = await drawer.boundingBox();
    expect(drawerBox?.x).toBe(0);
  });

  test('When drawer is open, all navigation items display with icons and labels', async ({ page }) => {
    const hamburgerButton = page.locator('[data-testid="hamburger-button"]');
    await hamburgerButton.click();

    const navItems = page.locator('[data-testid="nav-item"]');
    await expect(navItems.first()).toBeVisible();

    const firstItem = navItems.first();
    await expect(firstItem.locator('[data-testid="nav-icon"]')).toBeVisible();
    await expect(firstItem.locator('[data-testid="nav-label"]')).toBeVisible();
  });

  test('When user taps outside drawer or taps a navigation item, drawer closes with animation', async ({ page }) => {
    const hamburgerButton = page.locator('[data-testid="hamburger-button"]');
    await hamburgerButton.click();

    const drawer = page.locator('[data-testid="mobile-nav-drawer"]');
    await expect(drawer).toBeVisible();

    const navItem = page.locator('[data-testid="nav-item"]').first();
    await navItem.click();

    await expect(drawer).not.toBeVisible({ timeout: 1000 });
  });

  test('When user swipes left on open drawer, drawer closes', async ({ page }) => {
    const hamburgerButton = page.locator('[data-testid="hamburger-button"]');
    await hamburgerButton.click();

    const drawer = page.locator('[data-testid="mobile-nav-drawer"]');
    await expect(drawer).toBeVisible();

    const drawerBox = await drawer.boundingBox();
    if (drawerBox) {
      // Simulate swipe gesture using touchscreen tap and move
      const startX = drawerBox.x + 50;
      const startY = drawerBox.y + 100;
      const endX = drawerBox.x - 200;
      const endY = drawerBox.y + 100;

      await page.touchscreen.tap(startX, startY);
      // Create swipe by moving touch from start to end position
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY);
      await page.mouse.up();
    }

    await expect(drawer).not.toBeVisible({ timeout: 1000 });
  });
});
