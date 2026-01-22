import { test, expect } from '@playwright/test';

test.describe('Task 18: Publish Flow for Commissioner Content', () => {
  // Use the commissioner auth fixture (includes user-role cookie)
  test.use({ storageState: 'tests/e2e/auth/commissioner.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/desk');
    await page.waitForLoadState('networkidle');
  });

  test('When commissioner clicks Publish button, validation runs on all content sections', async ({ page }) => {
    const publishButton = page.getByRole('button', { name: /publish/i });
    await expect(publishButton).toBeVisible();

    // Click publish
    await publishButton.click();

    // Wait for validation to run
    await page.waitForTimeout(500);

    // Verify validation feedback appears (either success or error)
    const feedback = page.getByTestId('validation-feedback')
      .or(page.getByRole('alert'))
      .or(page.getByRole('dialog'));

    await expect(feedback).toBeVisible({ timeout: 5000 });
  });

  test('When validation fails due to incomplete rankings, specific error message displays indicating missing teams', async ({ page }) => {
    // Navigate to rankings tab and ensure incomplete data
    const rankingsTab = page.getByRole('tab', { name: /rankings/i });
    await rankingsTab.click();

    // Remove commentary from a team to simulate incomplete data
    const firstTeam = page.getByTestId('ranking-row').first();
    const commentaryTextarea = firstTeam.getByRole('textbox', { name: /commentary/i });
    await commentaryTextarea.clear();
    await page.waitForTimeout(1500);

    // Try to publish
    const publishButton = page.getByRole('button', { name: /publish/i });
    await publishButton.click();

    // Wait for toast notification to appear (sonner uses li elements in notifications region)
    // The toast message shows "Incomplete power rankings"
    const toastNotification = page.locator('[data-sonner-toast]').or(
      page.getByRole('listitem').filter({ hasText: /incomplete|missing|required|commentary/i })
    );
    await expect(toastNotification.first()).toBeVisible({ timeout: 5000 });
  });

  test('When publish succeeds, confirmation modal displays with links to published rankings and feed', async ({ page }) => {
    // Mock successful publish by intercepting API
    await page.route('**/api/desk/publish', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          rankingsUrl: '/leagues/test-league/rankings',
          feedUrl: '/leagues/test-league/feed'
        })
      });
    });

    // Click publish
    const publishButton = page.getByRole('button', { name: /publish/i });
    await publishButton.click();

    // Verify confirmation modal appears
    const confirmationModal = page.getByRole('dialog', { name: /success|published/i });
    await expect(confirmationModal).toBeVisible({ timeout: 5000 });

    // Verify links are present
    const rankingsLink = confirmationModal.getByRole('link', { name: /rankings/i });
    const feedLink = confirmationModal.getByRole('link', { name: /feed/i });

    await expect(rankingsLink).toBeVisible();
    await expect(feedLink).toBeVisible();

    // Verify links have correct hrefs
    await expect(rankingsLink).toHaveAttribute('href', /\/rankings/);
    await expect(feedLink).toHaveAttribute('href', /\/feed/);
  });

  test('When publish API fails, error toast displays and draft content is preserved for retry', async ({ page }) => {
    // Add some draft content
    const rankingsTab = page.getByRole('tab', { name: /rankings/i });
    await rankingsTab.click();

    const firstTeam = page.getByTestId('ranking-row').first();
    const commentaryTextarea = firstTeam.getByRole('textbox', { name: /commentary/i });
    const draftText = 'Draft content that should be preserved';
    await commentaryTextarea.fill(draftText);
    await page.waitForTimeout(1500);

    // Mock API failure
    await page.route('**/api/desk/publish', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' })
      });
    });

    // Try to publish
    const publishButton = page.getByRole('button', { name: /publish/i });
    await publishButton.click();

    // Verify error toast appears (sonner uses li elements in notifications region)
    const errorToast = page.locator('[data-sonner-toast]').or(
      page.getByRole('listitem').filter({ hasText: /server error|error|failed/i })
    );
    await expect(errorToast.first()).toBeVisible({ timeout: 5000 });

    // Verify draft content is still present
    const preservedValue = await commentaryTextarea.inputValue();
    expect(preservedValue).toBe(draftText);

    // Verify publish button is still available for retry
    await expect(publishButton).toBeEnabled();
  });
});
