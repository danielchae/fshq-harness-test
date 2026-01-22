import { test, expect } from '@playwright/test';

test.describe('task-06: Role Selection Onboarding', () => {
  test.use({ storageState: 'tests/e2e/fixtures/auth.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/onboarding');
  });

  test('When user visits onboarding page, Manager and Fan role cards display with descriptions of each role', async ({ page }) => {
    const managerCard = page.locator('[data-testid="role-card-manager"]');
    await expect(managerCard).toBeVisible();
    await expect(managerCard.getByText(/manager/i)).toBeVisible();

    const fanCard = page.locator('[data-testid="role-card-fan"]');
    await expect(fanCard).toBeVisible();
    await expect(fanCard.getByText(/fan/i)).toBeVisible();

    const managerDescription = managerCard.locator('p, [data-testid="role-description"]');
    await expect(managerDescription).toBeVisible();
    await expect(managerDescription).not.toBeEmpty();

    const fanDescription = fanCard.locator('p, [data-testid="role-description"]');
    await expect(fanDescription).toBeVisible();
    await expect(fanDescription).not.toBeEmpty();
  });

  test('When user clicks Manager role card, team claiming interface appears below', async ({ page }) => {
    const managerCard = page.locator('[data-testid="role-card-manager"]');
    await managerCard.click();

    const teamClaimingInterface = page.locator('[data-testid="team-claiming-interface"]');
    await expect(teamClaimingInterface).toBeVisible();
  });

  test('When user clicks Fan role card, optional team support selection appears below', async ({ page }) => {
    const fanCard = page.locator('[data-testid="role-card-fan"]');
    await fanCard.click();

    const teamSupportSelection = page.locator('[data-testid="team-support-selection"]');
    await expect(teamSupportSelection).toBeVisible();
  });

  test('When user completes role selection and clicks Continue, they are redirected to league newsfeed', async ({ page }) => {
    const fanCard = page.locator('[data-testid="role-card-fan"]');
    await fanCard.click();

    const continueButton = page.getByRole('button', { name: /continue/i });
    await continueButton.click();

    await expect(page).toHaveURL(/\/leagues\/test-league\/?$/);
  });
});
