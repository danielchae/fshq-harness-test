import { test, expect } from '@playwright/test';

test.describe('task-01: Public Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('When user visits /, hero section renders with headline, subheadline, and prominent CTA button', async ({ page }) => {
    const hero = page.locator('[data-testid="hero-section"]');
    await expect(hero).toBeVisible();

    const headline = hero.locator('h1');
    await expect(headline).toBeVisible();
    await expect(headline).not.toBeEmpty();

    const subheadline = hero.locator('p').first();
    await expect(subheadline).toBeVisible();
    await expect(subheadline).not.toBeEmpty();

    const ctaButton = hero.getByRole('button', { name: /connect|get started/i });
    await expect(ctaButton).toBeVisible();
  });

  test('When user scrolls down on /, feature grid displays with at least 4 platform capability cards', async ({ page }) => {
    const featureGrid = page.locator('[data-testid="feature-grid"]');
    await expect(featureGrid).toBeVisible();

    const featureCards = featureGrid.locator('[data-testid="feature-card"]');
    await expect(featureCards).toHaveCount(4, { timeout: 10000 });
  });

  test('When user clicks \'Connect League\' CTA while unauthenticated, they are redirected to sign-in page', async ({ page, context }) => {
    // Clear all cookies to ensure unauthenticated state
    await context.clearCookies();
    await page.reload();

    const ctaButton = page.getByRole('button', { name: /connect league/i });
    await ctaButton.click();

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('When user clicks \'Connect League\' CTA while authenticated, they are redirected to /connect-league', async ({ page }) => {
    // Auth cookies are already loaded from storageState via playwright.config.ts
    // Just verify we have authentication and click the button
    const ctaButton = page.getByRole('button', { name: /connect league/i });
    await ctaButton.click();

    await expect(page).toHaveURL(/\/connect-league/);
  });

  test('When user views on mobile viewport (<768px), layout stacks vertically with touch-friendly spacing', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const hero = page.locator('[data-testid="hero-section"]');
    await expect(hero).toBeVisible();

    const featureGrid = page.locator('[data-testid="feature-grid"]');
    const boundingBox = await featureGrid.boundingBox();

    if (boundingBox) {
      expect(boundingBox.width).toBeLessThan(768);
    }

    const featureCards = featureGrid.locator('[data-testid="feature-card"]');
    const count = await featureCards.count();

    for (let i = 0; i < count - 1; i++) {
      const currentCard = featureCards.nth(i);
      const nextCard = featureCards.nth(i + 1);

      const currentBox = await currentCard.boundingBox();
      const nextBox = await nextCard.boundingBox();

      if (currentBox && nextBox) {
        expect(nextBox.y).toBeGreaterThan(currentBox.y + currentBox.height);
      }
    }
  });
});
