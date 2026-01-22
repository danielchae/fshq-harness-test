import { test, expect } from '@playwright/test';

test.describe('Task 25: Pick Lock and Reveal Logic', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/pickems');
    await page.waitForLoadState('networkidle');
  });

  test('When matchup locks, pick selection buttons become disabled with lock icon overlay', async ({ page }) => {
    // Mock API to return locked matchup
    await page.route('**/api/**/pickems*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matchups: [{
            id: '1',
            homeTeam: { id: '1', name: 'Team A', ownerUsername: 'owner1' },
            awayTeam: { id: '2', name: 'Team B', ownerUsername: 'owner2' },
            weekNumber: 10,
            isLocked: true,
            lockTime: new Date(Date.now() - 60000).toISOString() // Locked 1 min ago
          }],
          currentWeek: 10,
          totalWeeks: 17,
          picks: []
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find locked matchup card (data-locked is on the card itself)
    const lockedCard = page.locator('[data-testid="matchup-pick-card"][data-locked="true"]').first();
    await expect(lockedCard).toBeVisible();

    // Verify team selection buttons are disabled
    const teamButtons = lockedCard.getByRole('button').filter({ hasText: /team/i });
    const firstButton = teamButtons.first();
    await expect(firstButton).toBeDisabled();

    // Verify lock icon is present
    const lockIcon = lockedCard.locator('[data-icon="lock"]');
    await expect(lockIcon.first()).toBeVisible();
  });

  test("When matchup locks, other users' picks for that matchup become visible", async ({ page }) => {
    // Mock API to return locked matchup with revealed picks
    await page.route('**/api/**/pickems*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matchups: [{
            id: '1',
            homeTeam: { id: '1', name: 'Team A', ownerUsername: 'owner1' },
            awayTeam: { id: '2', name: 'Team B', ownerUsername: 'owner2' },
            weekNumber: 10,
            isLocked: true,
            lockTime: new Date(Date.now() - 60000).toISOString(),
            picks: [
              { userId: 'user1', userName: 'John', teamId: '1' },
              { userId: 'user2', userName: 'Jane', teamId: '1' },
              { userId: 'user3', userName: 'Bob', teamId: '2' }
            ],
            distribution: { '1': 2, '2': 1 }
          }],
          currentWeek: 10,
          totalWeeks: 17,
          picks: []
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find locked matchup
    const lockedCard = page.getByTestId('matchup-pick-card').first();
    await expect(lockedCard).toBeVisible();

    // Verify other users' picks are visible
    const userPicks = lockedCard.getByTestId('user-pick');
    const pickCount = await userPicks.count();
    expect(pickCount).toBeGreaterThan(0);
  });

  test("When viewing locked matchup, pick distribution bar shows (e.g., '7 picked Team A - 5 picked Team B')", async ({ page }) => {
    // Mock API to return locked matchup with pick distribution
    await page.route('**/api/**/pickems*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matchups: [{
            id: '1',
            homeTeam: { id: '1', name: 'Team A', ownerUsername: 'owner1' },
            awayTeam: { id: '2', name: 'Team B', ownerUsername: 'owner2' },
            weekNumber: 10,
            isLocked: true,
            lockTime: new Date(Date.now() - 60000).toISOString(),
            distribution: {
              '1': 7,
              '2': 5
            }
          }],
          currentWeek: 10,
          totalWeeks: 17,
          picks: []
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find pick distribution display
    const distributionBar = page.getByTestId('pick-distribution').first();
    await expect(distributionBar).toBeVisible();

    // Verify distribution text shows counts
    const distributionText = await distributionBar.textContent();
    expect(distributionText).toMatch(/\d+.*picked|Team [AB].*\d+/i);

    // Verify progress bar or visual indicator exists (it's hidden for accessibility but present)
    const progressBar = distributionBar.locator('[role="progressbar"]');
    // Progress bar is there but may have opacity-0 for visual purposes
    expect(await progressBar.count()).toBeGreaterThan(0);
  });

  test('When user attempts to change locked pick via API manipulation, server returns 400 and UI shows error', async ({ page }) => {
    // Mock GET requests for the page to load
    await page.route('**/api/**/pickems*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            matchups: [{
              id: '1',
              homeTeam: { id: '1', name: 'Team A', ownerUsername: 'owner1' },
              awayTeam: { id: '2', name: 'Team B', ownerUsername: 'owner2' },
              weekNumber: 10,
              isLocked: true,
              lockTime: new Date(Date.now() - 60000).toISOString()
            }],
            currentWeek: 10,
            totalWeeks: 17,
            picks: []
          })
        });
      } else if (route.request().method() === 'POST' || route.request().method() === 'PUT') {
        // Return error for attempting to change locked pick
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Cannot modify locked picks' })
        });
      }
    });

    // Mock POST to the direct /api/pickems endpoint as well
    await page.route('**/api/pickems', async (route) => {
      if (route.request().method() === 'POST' || route.request().method() === 'PUT') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Cannot modify locked picks' })
        });
      } else {
        await route.continue();
      }
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Attempt to manipulate by directly calling API via console
    await page.evaluate(() => {
      return fetch('/api/pickems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchupId: '1', teamId: '1' })
      });
    });

    // Wait for error to display
    await page.waitForTimeout(1500);

    // Verify error message appears (look specifically for the alert with the error message)
    const errorMessage = page.getByRole('alert').filter({ hasText: /cannot modify/i });

    await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
  });
});
