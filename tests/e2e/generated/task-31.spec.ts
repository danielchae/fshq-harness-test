import { test, expect } from '@playwright/test';

test.describe('League History and Season Archive Page', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/demo-league/history');
  });

  test('When user visits history page, seasons display in reverse chronological order (most recent first)', async ({ page }) => {
    const seasonCards = page.locator('[data-testid="season-card"]');
    await expect(seasonCards.first()).toBeVisible();

    const firstSeasonYear = await seasonCards.first().locator('[data-testid="season-year"]').textContent();
    const secondSeasonYear = await seasonCards.nth(1).locator('[data-testid="season-year"]').textContent();

    if (firstSeasonYear && secondSeasonYear) {
      const firstYear = parseInt(firstSeasonYear);
      const secondYear = parseInt(secondSeasonYear);
      expect(firstYear).toBeGreaterThanOrEqual(secondYear);
    }
  });

  test('When viewing season summary card, champion name, runner-up, and final standings show', async ({ page }) => {
    const firstCard = page.locator('[data-testid="season-card"]').first();
    await expect(firstCard).toBeVisible();

    await expect(firstCard.locator('[data-testid="champion-name"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="runner-up-name"]')).toBeVisible();
    await expect(firstCard.locator('[data-testid="final-standings"]')).toBeVisible();
  });

  test('When user clicks season card, detailed season summary page loads', async ({ page }) => {
    const firstCard = page.locator('[data-testid="season-card"]').first();
    await firstCard.click();

    await expect(page).toHaveURL(/\/leagues\/demo-league\/history\/\d{4}/);
    await expect(page.locator('[data-testid="season-detail"]')).toBeVisible();
  });

  test('When viewing all-time records section, most championships and best regular season records display', async ({ page }) => {
    const recordsSection = page.locator('[data-testid="all-time-records"]');
    await expect(recordsSection).toBeVisible();

    await expect(recordsSection.locator('[data-testid="most-championships"]')).toBeVisible();
    await expect(recordsSection.locator('[data-testid="best-regular-season"]')).toBeVisible();
  });

  test('When league has no completed seasons, empty state displays with \'League history will appear after first completed season\'', async ({ page }) => {
    await page.goto('/leagues/new-league/history');

    const emptyState = page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('League history will appear after first completed season');
  });

  test('When history API returns error, error message displays with retry button', async ({ page }) => {
    await page.route('**/api/leagues/*/history', route => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal server error' }) });
    });

    await page.reload();

    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();

    const retryButton = page.locator('button', { hasText: 'Retry' });
    await expect(retryButton).toBeVisible();
  });
});
