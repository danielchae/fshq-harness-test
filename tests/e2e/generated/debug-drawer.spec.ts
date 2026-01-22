import { test, expect } from '@playwright/test';

test.describe('Debug Mobile Navigation', () => {
  test.use({
    storageState: 'tests/e2e/.auth/user.json',
    viewport: { width: 375, height: 667 }
  });

  test('Debug drawer rendering', async ({ page }) => {
    await page.goto('/leagues/demo-league/feed');

    // Click hamburger
    const hamburgerButton = page.locator('[data-testid="hamburger-button"]');
    await expect(hamburgerButton).toBeVisible();
    console.log('Hamburger button found');

    await hamburgerButton.click();

    // Wait a moment for drawer to animate in
    await page.waitForTimeout(500);

    // Log all data-testid attributes on the page
    const testIds = await page.evaluate(() => {
      const elements = document.querySelectorAll('[data-testid]');
      return Array.from(elements).map(el => ({
        testId: el.getAttribute('data-testid'),
        tagName: el.tagName,
        visible: el.getBoundingClientRect().width > 0
      }));
    });
    console.log('Data-testid elements found:', JSON.stringify(testIds, null, 2));

    // Check for any dialog elements
    const dialogs = await page.evaluate(() => {
      const dialogElements = document.querySelectorAll('[role="dialog"], [data-state="open"]');
      return Array.from(dialogElements).map(el => ({
        role: el.getAttribute('role'),
        state: el.getAttribute('data-state'),
        testId: el.getAttribute('data-testid'),
        tagName: el.tagName,
        className: el.className
      }));
    });
    console.log('Dialog elements:', JSON.stringify(dialogs, null, 2));

    // Verify drawer is visible
    const drawer = page.locator('[data-testid="mobile-nav-drawer"]');
    const count = await drawer.count();
    console.log('Drawer count:', count);

    await expect(drawer).toBeVisible();
  });
});
