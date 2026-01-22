import { test, expect } from '@playwright/test';

test.describe('task-08: Newsfeed with Moment Cards', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league');
  });

  test('When user visits league feed, moments render in reverse chronological order (newest first)', async ({ page }) => {
    await page.route('**/api/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          moments: [
            { id: '3', type: 'post', content: 'Latest post', createdAt: '2024-01-03T12:00:00Z' },
            { id: '2', type: 'trade', content: 'Trade happened', createdAt: '2024-01-02T12:00:00Z' },
            { id: '1', type: 'rankings', content: 'Old rankings', createdAt: '2024-01-01T12:00:00Z' },
          ],
        }),
      });
    });

    await page.reload();

    const moments = page.locator('[data-testid="feed-moment"]');
    await expect(moments).toHaveCount(3);

    const firstMoment = moments.first();
    await expect(firstMoment).toContainText('Latest post');
  });

  test('When user scrolls toward bottom, older moments load via infinite scroll without page refresh', async ({ page }) => {
    let allowSecondPage = false;

    await page.route('**/api/feed*', async (route) => {
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get('cursor');

      if (!cursor) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            moments: [
              { id: '1', type: 'post', content: 'First post', createdAt: '2024-01-01T12:00:00Z' },
            ],
            nextCursor: 'cursor2',
          }),
        });
      } else if (allowSecondPage) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            moments: [
              { id: '2', type: 'post', content: 'Second post', createdAt: '2024-01-02T12:00:00Z' },
            ],
            nextCursor: null,
          }),
        });
      } else {
        // Block the second page until we're ready
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            moments: [
              { id: '2', type: 'post', content: 'Second post', createdAt: '2024-01-02T12:00:00Z' },
            ],
            nextCursor: null,
          }),
        });
      }
    });

    await page.reload();

    const initialMoments = page.locator('[data-testid="feed-moment"]');
    await expect(initialMoments).toHaveCount(1);

    // Now allow the second page to load
    allowSecondPage = true;

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect(initialMoments).toHaveCount(2);
  });

  test('When moment has reactions, aggregated reaction counts display below moment content', async ({ page }) => {
    await page.route('**/api/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          moments: [
            {
              id: '1',
              type: 'post',
              content: 'Test post',
              reactions: { '👍': 5, '🔥': 3 }
            },
          ],
        }),
      });
    });

    await page.reload();

    const moment = page.locator('[data-testid="feed-moment"]').first();
    const reactions = moment.locator('[data-testid="reaction-display"]');

    await expect(reactions).toBeVisible();
    await expect(reactions).toContainText('5');
    await expect(reactions).toContainText('3');
  });

  test('When moment type is \'trade\', trade-specific card format renders showing teams and players exchanged', async ({ page }) => {
    await page.route('**/api/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          moments: [
            {
              id: '1',
              type: 'trade',
              tradeDetails: {
                team1: 'Team Alpha',
                team2: 'Team Beta',
                players1: ['Player A'],
                players2: ['Player B'],
              }
            },
          ],
        }),
      });
    });

    await page.reload();

    const tradeMoment = page.locator('[data-testid="feed-moment-trade"]');
    await expect(tradeMoment).toBeVisible();

    await expect(tradeMoment).toContainText('Team Alpha');
    await expect(tradeMoment).toContainText('Team Beta');
    await expect(tradeMoment).toContainText('Player A');
    await expect(tradeMoment).toContainText('Player B');
  });

  test('When feed returns no moments, empty state displays with message \'No activity yet - be the first to post!\'', async ({ page }) => {
    await page.route('**/api/feed*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ moments: [] }),
      });
    });

    await page.reload();

    await expect(page.getByText(/no activity yet.*be the first to post/i)).toBeVisible();
  });

  test('When feed API returns error, error message displays with retry button', async ({ page }) => {
    await page.route('**/api/feed*', async (route) => {
      await route.abort('failed');
    });

    await page.reload();

    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();

    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();
  });
});
