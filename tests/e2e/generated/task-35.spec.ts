import { test, expect } from '@playwright/test';

test.describe('League Switcher Component', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/demo-league');
  });

  test('When user clicks league name in header, switcher dropdown opens with animation', async ({ page }) => {
    const leagueName = page.locator('[data-testid="league-name"]');
    await expect(leagueName).toBeVisible();

    await leagueName.click();

    const dropdown = page.locator('[data-testid="league-switcher-dropdown"]');
    await expect(dropdown).toBeVisible();
  });

  test('When user has multiple leagues, all leagues display with logo and name in dropdown', async ({ page }) => {
    await page.route('**/api/user/leagues', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([
          { id: '1', slug: 'league-1', name: 'League One', logoUrl: '/logo1.png' },
          { id: '2', slug: 'league-2', name: 'League Two', logoUrl: '/logo2.png' }
        ])
      });
    });

    // Reload the page to ensure the route mock is applied
    await page.reload();

    const leagueName = page.locator('[data-testid="league-name"]');
    await leagueName.click();

    const leagueItems = page.locator('[data-testid="league-item"]');
    await expect(leagueItems).toHaveCount(2);

    const firstLeague = leagueItems.first();
    await expect(firstLeague.locator('[data-testid="league-logo"]')).toBeVisible();
    await expect(firstLeague.locator('[data-testid="league-name-text"]')).toBeVisible();
  });

  test('When user clicks different league in dropdown, navigation occurs to that league\'s feed', async ({ page }) => {
    await page.route('**/api/user/leagues', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([
          { id: '1', slug: 'demo-league', name: 'Demo League' },
          { id: '2', slug: 'other-league', name: 'Other League' }
        ])
      });
    });

    // Reload the page to ensure the route mock is applied
    await page.reload();

    const leagueName = page.locator('[data-testid="league-name"]');
    await leagueName.click();

    const otherLeague = page.locator('[data-testid="league-item"]', { hasText: 'Other League' });
    await otherLeague.click();

    // The component navigates to /leagues/{slug}
    await expect(page).toHaveURL(/\/leagues\/other-league/);
  });

  test('When user has only one league, dropdown still shows with \'Connect Another League\' option', async ({ page }) => {
    await page.route('**/api/user/leagues', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([
          { id: '1', slug: 'demo-league', name: 'Demo League' }
        ])
      });
    });

    await page.reload();

    const leagueName = page.locator('[data-testid="league-name"]');
    await leagueName.click();

    const connectOption = page.locator('text=Connect Another League');
    await expect(connectOption).toBeVisible();
  });

  test('When user leagues API returns error, dropdown shows error state with retry', async ({ page }) => {
    await page.route('**/api/user/leagues', route => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Server error' }) });
    });

    await page.reload();

    const leagueName = page.locator('[data-testid="league-name"]');
    await leagueName.click();

    const errorState = page.locator('[data-testid="dropdown-error"]');
    await expect(errorState).toBeVisible();

    const retryButton = page.getByRole('button', { name: /retry/i });
    await expect(retryButton).toBeVisible();
  });

  test('When user has no leagues, dropdown shows \'Connect your first league\' CTA', async ({ page }) => {
    await page.route('**/api/user/leagues', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([])
      });
    });

    await page.reload();

    const leagueName = page.locator('[data-testid="league-name"]');
    await leagueName.click();

    const ctaButton = page.locator('text=Connect your first league');
    await expect(ctaButton).toBeVisible();
  });
});
