import { test, expect } from '@playwright/test';

test.describe('task-12: Reaction Picker Component', () => {
  // Uses default storageState from playwright.config.ts (tests/e2e/fixtures/auth.json)

  test.beforeEach(async ({ page }) => {
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
              createdAt: '2024-01-15T10:00:00Z',
              reactions: { '👍': 5, '🔥': 3 }
            },
          ],
        }),
      });
    });

    await page.goto('/leagues/test-league');
  });

  test('When user clicks reaction button on moment/comment, picker popover opens with emoji options', async ({ page }) => {
    const moment = page.locator('[data-testid="feed-moment"]').first();
    const reactionButton = moment.getByRole('button', { name: /react|add.*reaction/i });

    await reactionButton.click();

    const picker = page.locator('[data-testid="reaction-picker"]');
    await expect(picker).toBeVisible();

    const emojiOptions = picker.locator('button');
    const count = await emojiOptions.count();
    expect(count).toBeGreaterThan(0);
  });

  test('When user selects reaction from picker, reaction count increments immediately (optimistic)', async ({ page }) => {
    await page.route('**/api/reactions*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    const moment = page.locator('[data-testid="feed-moment"]').first();
    const reactionDisplay = moment.locator('[data-testid="reaction-display"]');
    await expect(reactionDisplay).toContainText('5');

    const reactionButton = moment.getByRole('button', { name: /react|add.*reaction/i });
    await reactionButton.click();

    const picker = page.locator('[data-testid="reaction-picker"]');
    const thumbsUpEmoji = picker.getByRole('button', { name: /👍|thumbs.*up/i });
    await thumbsUpEmoji.click();

    await expect(reactionDisplay).toContainText('6');
  });

  test('When user clicks their own existing reaction, reaction is removed and count decrements', async ({ page }) => {
    await page.route('**/api/reactions*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

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
              createdAt: '2024-01-15T10:00:00Z',
              reactions: { '👍': 5 },
              userReactions: ['👍']
            },
          ],
        }),
      });
    });

    await page.reload();

    const moment = page.locator('[data-testid="feed-moment"]').first();
    const reactionDisplay = moment.locator('[data-testid="reaction-display"]');
    const activeReaction = moment.locator('[data-testid="active-reaction"]');

    await activeReaction.click();

    await expect(reactionDisplay).toContainText('4');
  });

  test('When viewing reactions on content, aggregated counts display per emoji type (e.g., \'👍 5 🔥 3\')', async ({ page }) => {
    const moment = page.locator('[data-testid="feed-moment"]').first();
    const reactionDisplay = moment.locator('[data-testid="reaction-display"]');

    await expect(reactionDisplay).toBeVisible();
    await expect(reactionDisplay).toContainText('👍');
    await expect(reactionDisplay).toContainText('5');
    await expect(reactionDisplay).toContainText('🔥');
    await expect(reactionDisplay).toContainText('3');
  });

  test('When reaction toggle API fails, toast displays error and UI reverts to previous state', async ({ page }) => {
    await page.route('**/api/reactions*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to add reaction' }),
        });
      }
    });

    const moment = page.locator('[data-testid="feed-moment"]').first();
    const reactionDisplay = moment.locator('[data-testid="reaction-display"]');
    await expect(reactionDisplay).toContainText('5');

    const reactionButton = moment.getByRole('button', { name: /react|add.*reaction/i });
    await reactionButton.click();

    const picker = page.locator('[data-testid="reaction-picker"]');
    const thumbsUpEmoji = picker.getByRole('button', { name: /👍|thumbs.*up/i });
    await thumbsUpEmoji.click();

    const toast = page.locator('[role="alert"], [data-testid="toast"]');
    await expect(toast).toBeVisible();

    // Verify count reverts back to 5
    await expect(reactionDisplay).toContainText('5');
  });
});
