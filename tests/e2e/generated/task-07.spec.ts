import { test, expect } from '@playwright/test';

test.describe('task-07: Team Claiming Interface', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to onboarding page
    await page.goto('/leagues/test-league/onboarding');

    // Click on the Manager role card to reveal team claiming interface
    const managerCard = page.locator('[data-testid="role-card-manager"]');
    await managerCard.click();

    // Wait for the team claiming interface to be visible
    await expect(page.locator('[data-testid="team-claiming-interface"]')).toBeVisible();
  });

  test('When user views team grid, each team card displays team name, logo, and associated Sleeper username', async ({ page }) => {
    const teamCards = page.locator('[data-testid="team-card"]');
    // Our mock data has 6 teams (4 unclaimed, 2 claimed)
    await expect(teamCards).toHaveCount(6);

    // Check the first unclaimed team card (Touchdown Titans - first available team)
    const firstTeamCard = teamCards.first();
    await expect(firstTeamCard.getByText('Touchdown Titans')).toBeVisible();
    await expect(firstTeamCard.getByText('johndoe123')).toBeVisible();

    const teamLogo = firstTeamCard.locator('[data-testid="team-logo"], img');
    await expect(teamLogo).toBeVisible();
  });

  test('When user clicks an unclaimed team, validation runs against their Sleeper identity', async ({ page }) => {
    // Mock the validation API to show spinner
    await page.route('**/api/validate-claim*', async (route) => {
      // Add a small delay to ensure spinner is visible
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true }),
      });
    });

    // Mock the claim API
    await page.route('**/api/claim-team*', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Click the first unclaimed team (Touchdown Titans)
    const unclaimedTeam = page.locator('[data-testid="team-card"]').filter({ hasText: 'Touchdown Titans' });
    await unclaimedTeam.click();

    // Check for validation spinner
    const spinner = page.locator('[data-testid="validation-spinner"], [role="status"]');
    await expect(spinner).toBeVisible();
  });

  test('When validation passes, team status updates to claimed and user proceeds to completion', async ({ page }) => {
    await page.route('**/api/validate-claim*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true }),
      });
    });

    await page.route('**/api/claim-team*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    // Click the first unclaimed team (Touchdown Titans)
    const unclaimedTeam = page.locator('[data-testid="team-card"]').filter({ hasText: 'Touchdown Titans' });
    await unclaimedTeam.click();

    // Wait for success message (specifically the success banner, not badges)
    await expect(page.getByText('Team claimed successfully!')).toBeVisible({ timeout: 15000 });
  });

  test('When user clicks a team already claimed by another manager, team card shows \'Claimed\' badge and selection is blocked', async ({ page }) => {
    // Fantasy Champions is a claimed team in our mock data
    const claimedTeam = page.locator('[data-testid="team-card"]').filter({ hasText: 'Fantasy Champions' });

    const claimedBadge = claimedTeam.locator('[data-testid="claimed-badge"]');
    await expect(claimedBadge).toBeVisible();
    await expect(claimedBadge).toContainText(/claimed/i);

    // Check that the button inside the claimed team card is disabled
    const isDisabled = await claimedTeam.locator('button').first().isDisabled();
    expect(isDisabled).toBe(true);
  });
});
