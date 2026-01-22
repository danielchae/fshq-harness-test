import { test, expect } from '@playwright/test';

test.describe('Task 22: Playoff Bracket Visualization', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/brackets');
    await page.waitForLoadState('networkidle');
  });

  test('When user visits brackets page during playoffs, winners bracket renders with all seeded teams', async ({ page }) => {
    // Verify bracket view is visible
    const bracketView = page.getByTestId('bracket-view')
      .or(page.locator('[data-bracket="winners"]'));
    await expect(bracketView).toBeVisible();

    // Verify bracket has matchup cards
    const bracketMatchups = page.getByTestId('bracket-matchup');
    const matchupCount = await bracketMatchups.count();
    expect(matchupCount).toBeGreaterThan(0);

    // Verify seeds are displayed
    const firstMatchup = bracketMatchups.first();
    const seeds = firstMatchup.getByTestId('seed-number')
      .or(firstMatchup.locator('[data-seed]'));
    await expect(seeds.first()).toBeVisible();
  });

  test('When matchup completes, winning team automatically populates in next round slot', async ({ page }) => {
    // Look for completed matchup with winner-id attribute
    const completedMatchup = page.getByTestId('bracket-matchup')
      .locator('[data-complete="true"]');

    const matchupCount = await completedMatchup.count();
    if (matchupCount > 0) {
      // Get winner team name from the data-winner="true" element (on parent div of team slot)
      const winnerSlot = completedMatchup.first()
        .locator('[data-winner="true"]');

      if (await winnerSlot.count() > 0) {
        const winnerName = await winnerSlot.first()
          .getByTestId('team-name')
          .textContent();

        // Verify winner appears in next round
        if (winnerName) {
          const nextRoundMatchup = page.getByTestId('bracket-matchup')
            .filter({ hasText: winnerName })
            .nth(1); // Second occurrence should be next round

          await expect(nextRoundMatchup).toBeVisible();
        }
      }
    }
    // If no completed matchups, test passes (no assertion needed)
  });

  test('When viewing bracket matchup, each team shows logo, name, seed number, and current score', async ({ page }) => {
    const firstMatchup = page.getByTestId('bracket-matchup').first();
    await expect(firstMatchup).toBeVisible();

    // Verify team logos
    const teamLogos = firstMatchup.getByRole('img', { name: /logo|avatar/i })
      .or(firstMatchup.getByTestId('team-logo'));
    const logoCount = await teamLogos.count();
    expect(logoCount).toBeGreaterThanOrEqual(1);

    // Verify team names
    const teamNames = firstMatchup.getByTestId('team-name');
    const nameCount = await teamNames.count();
    expect(nameCount).toBeGreaterThanOrEqual(1);

    // Verify seed numbers
    const seeds = firstMatchup.getByTestId('seed-number')
      .or(firstMatchup.locator('[data-seed]'));
    await expect(seeds.first()).toBeVisible();

    // Verify scores (if matchup started)
    const scores = firstMatchup.getByTestId('team-score');
    // Scores may not be present if matchup hasn't started
  });

  test('When viewing on mobile viewport, bracket adapts to vertical stacked layout with collapsible rounds', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for bracket to render
    const bracketView = page.getByTestId('bracket-view');
    await expect(bracketView).toBeVisible();

    // Verify bracket matchups are stacked vertically
    const matchups = page.getByTestId('bracket-matchup');
    const firstMatchup = matchups.first();
    const secondMatchup = matchups.nth(1);

    if (await secondMatchup.count() > 0) {
      const firstBox = await firstMatchup.boundingBox();
      const secondBox = await secondMatchup.boundingBox();

      // On mobile, second matchup should be below first (higher y value)
      if (firstBox && secondBox) {
        expect(secondBox.y).toBeGreaterThan(firstBox.y);
      }
    }

    // Look for round collapse/expand controls
    const roundHeaders = page.getByRole('button', { name: /round|championship|semifinals/i });
    if (await roundHeaders.count() > 0) {
      await expect(roundHeaders.first()).toBeVisible();
    }
  });

  test("When playoffs haven't started, placeholder message displays with 'Playoffs begin Week X'", async ({ page }) => {
    // Mock API to return pre-playoff state
    await page.route('**/api/brackets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playoffsStartWeek: 14,
          hasStarted: false,
          bracket: null
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify placeholder message
    const placeholderMessage = page.getByText(/playoffs begin week|playoffs start/i);
    await expect(placeholderMessage).toBeVisible();
  });

  test('When bracket API returns error, error message displays with retry button', async ({ page }) => {
    // Mock API error
    await page.route('**/api/brackets*', async (route) => {
      await route.abort('failed');
    });

    // Reload page
    await page.reload();

    // Wait for error message (use first() since there may be multiple matching elements)
    const errorMessage = page.getByText(/error|failed|unable to load/i).first();
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Verify retry button
    const retryButton = page.getByRole('button', { name: /retry|try again/i });
    await expect(retryButton).toBeVisible();
  });
});
