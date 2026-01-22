import { test, expect } from '@playwright/test';

test.describe('task-10: Post Composer', () => {
  // Uses default storageState from playwright.config.ts (tests/e2e/fixtures/auth.json)

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league');
  });

  test('When user clicks compose area, text input field expands with submit button visible', async ({ page }) => {
    const composer = page.locator('[data-testid="post-composer"]');
    await composer.click();

    const textInput = page.getByRole('textbox', { name: /compose|post|write/i });
    await expect(textInput).toBeVisible();
    await expect(textInput).toBeFocused();

    const submitButton = page.getByRole('button', { name: /post|submit|publish/i });
    await expect(submitButton).toBeVisible();
  });

  test('When user types in composer, character count updates showing remaining characters (e.g., \'140 remaining\')', async ({ page }) => {
    const textInput = page.getByRole('textbox', { name: /compose|post|write/i });
    await textInput.fill('Test post content');

    const charCount = page.locator('[data-testid="char-count"]');
    await expect(charCount).toBeVisible();
    await expect(charCount).toContainText(/\d+.*remaining/i);
  });

  test('When user submits valid post, new moment appears immediately at top of feed (optimistic update)', async ({ page }) => {
    await page.route('**/api/feed*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-moment',
            type: 'post',
            content: 'My new post',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ moments: [] }),
        });
      }
    });

    const textInput = page.getByRole('textbox', { name: /compose|post|write/i });
    await textInput.fill('My new post');

    const submitButton = page.getByRole('button', { name: /post|submit|publish/i });
    await submitButton.click();

    const moments = page.locator('[data-testid="feed-moment"]');
    const firstMoment = moments.first();

    await expect(firstMoment).toContainText('My new post');
  });

  test('When post submission fails, error toast displays and draft text is preserved for retry', async ({ page }) => {
    await page.route('**/api/feed*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to create post' }),
        });
      }
    });

    const textInput = page.getByRole('textbox', { name: /compose|post|write/i });
    await textInput.fill('Draft post content');

    const submitButton = page.getByRole('button', { name: /post|submit|publish/i });
    await submitButton.click();

    const toast = page.locator('[role="alert"], [data-testid="toast"]');
    await expect(toast).toBeVisible();

    const inputValue = await textInput.inputValue();
    expect(inputValue).toBe('Draft post content');
  });

  test('When user submits empty post, submit button is disabled and validation message appears', async ({ page }) => {
    const textInput = page.getByRole('textbox', { name: /compose|post|write/i });
    await textInput.fill('');

    const submitButton = page.getByRole('button', { name: /post|submit|publish/i });
    const isDisabled = await submitButton.isDisabled();
    expect(isDisabled).toBe(true);

    await textInput.blur();

    const validationMessage = page.locator('[data-testid="validation-error"]');
    await expect(validationMessage).toBeVisible();
  });
});
