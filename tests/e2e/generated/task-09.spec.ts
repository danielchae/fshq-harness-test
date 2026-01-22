import { test, expect } from '@playwright/test';

test.describe('task-09: Feed Sorting and Type Filters', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/feed*', async (route) => {
      const url = new URL(route.request().url());
      const sort = url.searchParams.get('sort');

      if (sort === 'recent') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            moments: [
              { id: '2', type: 'post', content: 'Engaged post', reactions: { '👍': 10 } },
              { id: '1', type: 'post', content: 'Older post', reactions: {} },
            ],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            moments: [
              { id: '1', type: 'post', content: 'Older post', createdAt: '2024-01-02T12:00:00Z' },
              { id: '2', type: 'post', content: 'Engaged post', createdAt: '2024-01-01T12:00:00Z' },
            ],
          }),
        });
      }
    });

    await page.goto('/leagues/test-league');
  });

  test('When user toggles to \'Recent\' sort, moments reorder with recently-engaged content appearing higher', async ({ page }) => {
    const sortToggle = page.locator('[data-testid="sort-toggle"]');
    const recentButton = sortToggle.getByRole('radio', { name: /recent/i });

    await recentButton.click();

    const moments = page.locator('[data-testid="feed-moment"]');
    const firstMoment = moments.first();

    await expect(firstMoment).toContainText('Engaged post');
  });

  test('When user toggles to \'Chronological\' sort, moments reorder strictly by creation timestamp', async ({ page }) => {
    const sortToggle = page.locator('[data-testid="sort-toggle"]');
    const chronologicalButton = sortToggle.getByRole('radio', { name: /chronological/i });

    await chronologicalButton.click();

    const moments = page.locator('[data-testid="feed-moment"]');
    const firstMoment = moments.first();

    await expect(firstMoment).toContainText('Older post');
  });

  test('When viewing any moment card, type indicator badge (icon + label) displays in card header', async ({ page }) => {
    await page.route('**/api/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          moments: [
            { id: '1', type: 'trade', content: 'Trade moment' },
            { id: '2', type: 'rankings', content: 'Rankings moment' },
          ],
        }),
      });
    });

    await page.reload();

    const tradeMoment = page.locator('[data-testid="feed-moment"]').first();
    const tradeBadge = tradeMoment.locator('[data-testid="moment-type-badge"]');

    await expect(tradeBadge).toBeVisible();
    await expect(tradeBadge).toContainText(/trade/i);
  });

  test('When user selects type filter from dropdown, feed reloads showing only matching moment types', async ({ page }) => {
    await page.route('**/api/feed*', async (route) => {
      const url = new URL(route.request().url());
      const type = url.searchParams.get('type');

      if (type === 'trade') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            moments: [
              { id: '1', type: 'trade', content: 'Trade moment' },
            ],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            moments: [
              { id: '1', type: 'trade', content: 'Trade moment' },
              { id: '2', type: 'post', content: 'Post moment' },
            ],
          }),
        });
      }
    });

    const typeFilter = page.locator('[data-testid="type-filter"]');
    await typeFilter.click();

    const tradeOption = page.getByRole('option', { name: /trade/i });
    await tradeOption.click();

    const moments = page.locator('[data-testid="feed-moment"]');
    await expect(moments).toHaveCount(1);

    const tradeBadge = moments.first().locator('[data-testid="moment-type-badge"]');
    await expect(tradeBadge).toContainText(/trade/i);
  });
});
