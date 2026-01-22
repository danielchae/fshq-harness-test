import { test, expect } from '@playwright/test';

test.describe('Role-Based Access Control Middleware', () => {
  test('When unauthenticated user visits /leagues/[slug]/desk, redirect to sign-in occurs', async ({ page }) => {
    await page.context().clearCookies();

    await page.goto('/leagues/demo-league/desk');

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('When non-commissioner visits /leagues/[slug]/desk while authenticated, access denied page renders', async ({ page }) => {
    await page.context().clearCookies();
    await page.context().addCookies([{
      name: 'auth-token',
      value: 'non-commissioner-user-token',
      domain: 'localhost',
      path: '/'
    }]);

    await page.goto('/leagues/demo-league/desk');

    const accessDenied = page.locator('[data-testid="access-denied"]');
    await expect(accessDenied).toBeVisible();

    await expect(accessDenied).toContainText(/access denied|unauthorized|permission/i);
  });

  test('When checkRole(\'commissioner\') is called for commissioner user, true returns', async ({ page }) => {
    await page.context().addCookies([{
      name: 'auth-token',
      value: 'commissioner-user-token',
      domain: 'localhost',
      path: '/'
    }]);

    await page.goto('/leagues/demo-league/desk');

    const deskContent = page.locator('[data-testid="commissioner-desk"]');
    await expect(deskContent).toBeVisible();
  });

  test('When requireRole wrapper protects server action, unauthorized request throws AuthorizationError', async ({ page }) => {
    await page.context().clearCookies();
    await page.context().addCookies([{
      name: 'auth-token',
      value: 'fan-user-token',
      domain: 'localhost',
      path: '/'
    }]);

    const response = await page.request.post('/api/leagues/demo-league/settings', {
      data: {
        visibility: 'private',
        joinRule: 'approval'
      }
    });

    expect(response.status()).toBe(403);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error.toLowerCase()).toContain('unauthorized');
  });
});
