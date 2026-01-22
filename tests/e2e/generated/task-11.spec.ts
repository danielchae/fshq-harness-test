import { test, expect } from '@playwright/test';

test.describe('task-11: Moment Detail Page with Comments', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/moments/*', async (route) => {
      const momentId = route.request().url().split('/').pop();

      if (momentId === 'valid-moment') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'valid-moment',
            type: 'post',
            content: 'Test moment content',
            comments: [
              { id: '1', content: 'First comment', author: 'User A' },
              { id: '2', content: 'Second comment', author: 'User B', parentId: '1' },
            ],
          }),
        });
      } else {
        await route.fulfill({ status: 404 });
      }
    });
  });

  test('When user navigates to moment detail page, full moment content renders with all comments visible', async ({ page }) => {
    await page.goto('/leagues/test-league/moment/valid-moment');

    const momentContent = page.locator('[data-testid="moment-content"]');
    await expect(momentContent).toBeVisible();
    await expect(momentContent).toContainText('Test moment content');

    const comments = page.locator('[data-testid="comment"]');
    await expect(comments).toHaveCount(2);

    await expect(page.getByText('First comment')).toBeVisible();
    await expect(page.getByText('Second comment')).toBeVisible();
  });

  test('When user submits comment via input field, comment appears immediately in thread (optimistic update)', async ({ page }) => {
    await page.route('**/api/comments*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-comment',
            content: 'My new comment',
            author: 'Current User',
            isOwner: true,
          }),
        });
      }
    });

    await page.goto('/leagues/test-league/moment/valid-moment');

    const commentInput = page.getByRole('textbox', { name: /comment|reply/i });
    await commentInput.fill('My new comment');

    const submitButton = page.getByRole('button', { name: /submit|post.*comment/i });
    await submitButton.click();

    await expect(page.getByText('My new comment')).toBeVisible();
  });

  test('When user clicks reply button on existing comment, nested reply input field appears indented below', async ({ page }) => {
    await page.goto('/leagues/test-league/moment/valid-moment');

    const firstComment = page.locator('[data-testid="comment"]').first();
    const replyButton = firstComment.getByRole('button', { name: /reply/i });

    await replyButton.click();

    const nestedInput = firstComment.locator('[data-testid="nested-reply-input"]');
    await expect(nestedInput).toBeVisible();
  });

  test('When user owns a comment, edit and delete action buttons appear on hover', async ({ page }) => {
    await page.route('**/api/moments/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'valid-moment',
          type: 'post',
          content: 'Test moment',
          comments: [
            { id: '1', content: 'My comment', author: 'Current User', isOwner: true },
          ],
        }),
      });
    });

    await page.goto('/leagues/test-league/moment/valid-moment');

    const ownComment = page.locator('[data-testid="comment"]').first();
    await ownComment.hover();

    const editButton = ownComment.getByRole('button', { name: /edit/i });
    await expect(editButton).toBeVisible();

    const deleteButton = ownComment.getByRole('button', { name: /delete/i });
    await expect(deleteButton).toBeVisible();
  });

  test('When moment ID does not exist, 404 page renders with message \'Moment not found\'', async ({ page }) => {
    await page.goto('/leagues/test-league/moment/invalid-moment');

    await expect(page.getByText(/moment not found/i)).toBeVisible();
  });

  test('When moment has no comments, empty state displays with message \'Be the first to comment!\'', async ({ page }) => {
    await page.route('**/api/moments/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'valid-moment',
          type: 'post',
          content: 'Test moment',
          comments: [],
        }),
      });
    });

    await page.goto('/leagues/test-league/moment/valid-moment');

    await expect(page.getByText(/be the first to comment/i)).toBeVisible();
  });
});
