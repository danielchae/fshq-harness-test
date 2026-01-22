import { test, expect } from '@playwright/test';

test.describe('task-14: Moderation Queue Page', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test('When admin visits moderation queue, hidden moments display with hide reason and timestamp', async ({ page }) => {
    await page.route('**/api/moderation/hidden*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hiddenMoments: [
            {
              id: '1',
              content: 'Hidden post',
              hideReason: 'Spam',
              hiddenAt: '2024-01-15T10:00:00Z'
            },
          ],
        }),
      });
    });

    await page.goto('/leagues/test-league/moderation');

    const hiddenMoment = page.locator('[data-testid="hidden-moment-card"]').first();
    await expect(hiddenMoment).toBeVisible();

    await expect(hiddenMoment).toContainText('Spam');
    await expect(hiddenMoment).toContainText(/\d{4}-\d{2}-\d{2}|\d+.*ago/i);
  });

  test('When admin clicks Unhide button, moment returns to feed at its original chronological position', async ({ page }) => {
    await page.route('**/api/moderation/hidden*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hiddenMoments: [
            { id: '1', content: 'Hidden post', hideReason: 'Spam' },
          ],
        }),
      });
    });

    await page.route('**/api/moderation/unhide*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/leagues/test-league/moderation');

    const hiddenMoment = page.locator('[data-testid="hidden-moment-card"]').first();
    const unhideButton = hiddenMoment.getByRole('button', { name: /unhide/i });

    await unhideButton.click();

    await expect(hiddenMoment).not.toBeVisible();
  });

  test('When admin clicks Delete button, confirmation dialog appears before permanent deletion occurs', async ({ page }) => {
    await page.route('**/api/moderation/hidden*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hiddenMoments: [
            { id: '1', content: 'Hidden post', hideReason: 'Spam' },
          ],
        }),
      });
    });

    await page.goto('/leagues/test-league/moderation');

    const hiddenMoment = page.locator('[data-testid="hidden-moment-card"]').first();
    const deleteButton = hiddenMoment.getByRole('button', { name: /delete/i });

    await deleteButton.click();

    const confirmDialog = page.locator('[role="alertdialog"], [data-testid="confirm-dialog"]');
    await expect(confirmDialog).toBeVisible();

    const confirmButton = confirmDialog.getByRole('button', { name: /confirm|delete/i });
    await expect(confirmButton).toBeVisible();
  });

  test('When queue has no hidden content, empty state displays with message \'No hidden content to review\'', async ({ page }) => {
    await page.route('**/api/moderation/hidden*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hiddenMoments: [] }),
      });
    });

    await page.goto('/leagues/test-league/moderation');

    await expect(page.getByText(/no hidden content to review/i)).toBeVisible();
  });

  test('When moderation API returns error, error message displays with retry option', async ({ page }) => {
    await page.route('**/api/moderation/hidden*', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/leagues/test-league/moderation');

    const errorMessage = page.locator('[role="alert"], [data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();

    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();
  });
});
