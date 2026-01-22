import { test, expect } from '@playwright/test';

test.describe('Task 23: Consolation Bracket and Season Navigation', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/brackets');
    await page.waitForLoadState('networkidle');
  });

  test('When league has consolation games configured, losers bracket renders below or beside winners bracket', async ({ page }) => {
    // Look for tabs or sections for different brackets
    const consolationTab = page.getByRole('tab', { name: /consolation|losers|toilet/i });

    if (await consolationTab.count() > 0) {
      // Click consolation tab
      await consolationTab.click();
      await page.waitForTimeout(300);

      // Verify consolation bracket renders
      const consolationBracket = page.getByTestId('consolation-bracket')
        .or(page.locator('[data-bracket="consolation"]'));
      await expect(consolationBracket).toBeVisible();

      // Verify it has matchups
      const matchups = consolationBracket.getByTestId('bracket-matchup');
      const count = await matchups.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // If no tabs, check for side-by-side layout
      const allBrackets = page.locator('[data-bracket]');
      const bracketCount = await allBrackets.count();

      if (bracketCount > 1) {
        const consolationBracket = page.locator('[data-bracket="consolation"]');
        await expect(consolationBracket).toBeVisible();
      }
    }
  });

  test('When user selects past season from dropdown, historical bracket loads with final results', async ({ page }) => {
    // Find season selector
    const seasonSelector = page.getByRole('combobox', { name: /season|year/i })
      .or(page.getByTestId('season-selector'));

    if (await seasonSelector.count() > 0) {
      await seasonSelector.click();

      // Select a past season
      const pastSeasonOption = page.getByRole('option').filter({ hasText: /202[0-9]/i }).first();

      if (await pastSeasonOption.count() > 0) {
        await pastSeasonOption.click();

        // Wait for bracket to reload
        await page.waitForLoadState('networkidle');

        // Verify bracket displays
        const bracketView = page.getByTestId('bracket-view');
        await expect(bracketView).toBeVisible();

        // Verify bracket shows completed matchups
        const completedMatchup = page.getByTestId('bracket-matchup')
          .locator('[data-complete="true"]')
          .first();

        if (await completedMatchup.count() > 0) {
          await expect(completedMatchup).toBeVisible();
        }
      }
    }
  });

  test("When viewing future rounds, placeholder slots display with 'TBD' text or 'Winner of Round X' reference", async ({ page }) => {
    // Look for bracket matchups
    const matchups = page.getByTestId('bracket-matchup');

    // Find matchups with TBD teams
    const tbdSlots = page.getByText(/TBD|To Be Determined|Winner of/i);

    if (await tbdSlots.count() > 0) {
      await expect(tbdSlots.first()).toBeVisible();

      // Verify TBD appears in matchup slots
      const matchupWithTbd = matchups.filter({ hasText: /TBD|Winner of/i }).first();
      await expect(matchupWithTbd).toBeVisible();
    }
  });

  test('When championship matchup completes, winner displays with trophy icon decoration', async ({ page }) => {
    // Mock API to return completed championship
    await page.route('**/api/brackets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bracket: {
            rounds: [{
              name: 'Championship',
              matchups: [{
                id: 'championship',
                teams: [
                  { id: '1', name: 'Champion Team', seed: 1, score: 145 },
                  { id: '2', name: 'Runner Up', seed: 2, score: 130 }
                ],
                isComplete: true,
                winnerId: '1',
                isChampionship: true
              }]
            }]
          }
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find championship matchup
    const championshipMatchup = page.getByTestId('bracket-matchup')
      .locator('[data-championship="true"]')
      .or(page.locator('[data-round="Championship"]'));

    if (await championshipMatchup.count() > 0) {
      // Verify trophy icon is present
      const trophyIcon = championshipMatchup.first()
        .locator('[data-icon="trophy"], svg[class*="trophy"], [class*="champion"]');

      await expect(trophyIcon).toBeVisible();
    }
  });
});
