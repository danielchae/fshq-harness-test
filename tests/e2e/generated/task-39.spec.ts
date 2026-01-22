import { test, expect } from '@playwright/test';

test.describe('Error Boundary Component', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('When child component throws during render, error boundary catches and renders fallback UI', async ({ page }) => {
    await page.goto('/leagues/demo-league/feed');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Click the trigger-error button via JavaScript dispatch
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="trigger-error"]') as HTMLButtonElement;
      if (button) {
        button.click();
      }
    });

    // Wait for the error fallback to appear
    const errorFallback = page.locator('[data-testid="error-fallback"]');
    await expect(errorFallback).toBeVisible({ timeout: 5000 });
  });

  test('When viewing error fallback, friendly message displays with \'Try Again\' button', async ({ page }) => {
    // Intercept the actual feed API endpoint
    await page.route('**/api/feed*', route => {
      route.fulfill({ status: 500, body: 'Internal server error' });
    });

    await page.goto('/leagues/demo-league/feed');

    const errorFallback = page.locator('[data-testid="error-fallback"]');
    await expect(errorFallback).toBeVisible();

    await expect(errorFallback).toContainText(/something went wrong|error occurred/i);

    const tryAgainButton = page.getByRole('button', { name: /try again/i });
    await expect(tryAgainButton).toBeVisible();
  });

  test('When user clicks \'Try Again\' button, error boundary resets and attempts re-render', async ({ page }) => {
    let requestCount = 0;

    // Intercept the actual feed API endpoint
    await page.route('**/api/feed*', route => {
      requestCount++;
      if (requestCount === 1) {
        route.fulfill({ status: 500, body: 'Server error' });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ moments: [], nextCursor: null })
        });
      }
    });

    await page.goto('/leagues/demo-league/feed');

    const errorFallback = page.locator('[data-testid="error-fallback"]');
    await expect(errorFallback).toBeVisible();

    const tryAgainButton = page.getByRole('button', { name: /try again/i });
    await tryAgainButton.click();

    await expect(errorFallback).not.toBeVisible({ timeout: 2000 });
    expect(requestCount).toBe(2);
  });

  test('When error occurs, error details log to console without exposing stack trace to users', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });

    // Intercept the actual feed API endpoint
    await page.route('**/api/feed*', route => {
      route.fulfill({ status: 500, body: 'Server error' });
    });

    await page.goto('/leagues/demo-league/feed');

    const errorFallback = page.locator('[data-testid="error-fallback"]');
    await expect(errorFallback).toBeVisible();

    expect(consoleMessages.length).toBeGreaterThan(0);

    const errorText = await errorFallback.textContent();
    expect(errorText).not.toContain('at ');
    expect(errorText).not.toContain('.tsx');
    expect(errorText).not.toContain('stack');
  });
});
