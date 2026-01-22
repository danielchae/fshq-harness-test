import { test, expect } from '@playwright/test';

test.describe('Task 26: Pick\'ems Results View with Grading', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    // Navigate to pickems page with completed week
    await page.goto('/leagues/test-league/pickems?week=1');
    await page.waitForLoadState('networkidle');
  });

  test('When week is complete, each pick card shows green checkmark (correct) or red X (incorrect)', async ({ page }) => {
    // Mock API to return graded picks
    await page.route('**/api/leagues/**/pickems*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matchups: [
            {
              id: '1',
              homeTeam: { id: '1', name: 'Team A', score: 120, ownerUsername: 'user1' },
              awayTeam: { id: '2', name: 'Team B', score: 95, ownerUsername: 'user2' },
              isComplete: true,
              isLocked: true,
              winnerId: '1',
              userPick: '1',
              isCorrect: true,
              weekNumber: 1,
              lockTime: '2024-01-01T00:00:00.000Z'
            },
            {
              id: '2',
              homeTeam: { id: '3', name: 'Team C', score: 88, ownerUsername: 'user3' },
              awayTeam: { id: '4', name: 'Team D', score: 110, ownerUsername: 'user4' },
              isComplete: true,
              isLocked: true,
              winnerId: '4',
              userPick: '3',
              isCorrect: false,
              weekNumber: 1,
              lockTime: '2024-01-01T00:00:00.000Z'
            }
          ],
          currentWeek: 1,
          totalWeeks: 17,
          picks: [],
          weeklyScore: {
            correct: 1,
            total: 2,
            percentage: 50
          },
          hasSubmittedPicks: true,
          isWeekComplete: true
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find graded pick cards
    const pickCards = page.getByTestId('pick-result-card');

    // Check first card for correct indicator (green checkmark)
    const correctCard = pickCards.filter({ has: page.locator('[data-correct="true"]') }).first();
    const checkmark = correctCard.getByTestId('correct-indicator');
    await expect(checkmark).toBeVisible();

    // Check incorrect card (red X)
    const incorrectCard = pickCards.filter({ has: page.locator('[data-correct="false"]') }).first();
    const xIcon = incorrectCard.getByTestId('incorrect-indicator');
    await expect(xIcon).toBeVisible();
  });

  test("When viewing results header, weekly score displays prominently (e.g., '6/10 correct - 60%')", async ({ page }) => {
    // Mock API with score data
    await page.route('**/api/leagues/**/pickems*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matchups: [
            {
              id: '1',
              homeTeam: { id: '1', name: 'Team A', score: 120, ownerUsername: 'user1' },
              awayTeam: { id: '2', name: 'Team B', score: 95, ownerUsername: 'user2' },
              isComplete: true,
              isLocked: true,
              winnerId: '1',
              userPick: '1',
              isCorrect: true,
              weekNumber: 1,
              lockTime: '2024-01-01T00:00:00.000Z'
            }
          ],
          currentWeek: 1,
          totalWeeks: 17,
          picks: [],
          weeklyScore: {
            correct: 6,
            total: 10,
            percentage: 60
          },
          hasSubmittedPicks: true,
          isWeekComplete: true
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find results header
    const resultsHeader = page.getByTestId('results-header')
      .or(page.locator('[data-results-summary]'));

    await expect(resultsHeader).toBeVisible();

    // Verify score format
    const headerText = await resultsHeader.textContent();
    expect(headerText).toMatch(/6\/10|60%/i);
  });

  test('When pick result was affected by stat correction, small badge displays indicating correction', async ({ page }) => {
    // Mock API with stat correction
    await page.route('**/api/leagues/**/pickems*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matchups: [{
            id: '1',
            homeTeam: { id: '1', name: 'Team A', score: 119.5, ownerUsername: 'user1' },
            awayTeam: { id: '2', name: 'Team B', score: 120, ownerUsername: 'user2' },
            isComplete: true,
            isLocked: true,
            winnerId: '2',
            userPick: '1',
            isCorrect: false,
            hasStatCorrection: true,
            weekNumber: 1,
            lockTime: '2024-01-01T00:00:00.000Z'
          }],
          currentWeek: 1,
          totalWeeks: 17,
          picks: [],
          weeklyScore: {
            correct: 0,
            total: 1,
            percentage: 0
          },
          hasSubmittedPicks: true,
          isWeekComplete: true
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find card with stat correction
    const cardWithCorrection = page.getByTestId('pick-result-card')
      .filter({ has: page.locator('[data-stat-correction="true"]') })
      .first();

    // Verify stat correction badge
    const correctionBadge = cardWithCorrection.getByTestId('stat-correction-badge')
      .or(cardWithCorrection.locator('[data-badge="correction"]'));

    await expect(correctionBadge).toBeVisible();

    // Verify badge text mentions correction
    const badgeText = await correctionBadge.textContent();
    expect(badgeText).toMatch(/correction|adjusted/i);
  });

  test("When user didn't submit picks for week, results section shows 'No picks submitted for this week'", async ({ page }) => {
    // Mock API with no picks
    await page.route('**/api/leagues/**/pickems*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matchups: [],
          currentWeek: 1,
          totalWeeks: 17,
          picks: [],
          hasSubmittedPicks: false,
          isWeekComplete: true
        })
      });
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify no picks message
    const noPicks = page.getByText(/no picks submitted|you didn.*t submit/i).first();
    await expect(noPicks).toBeVisible();
  });

  test('When grading API returns error, error message displays with retry option', async ({ page }) => {
    // Mock API error
    await page.route('**/api/leagues/**/pickems*', async (route) => {
      await route.abort('failed');
    });

    // Reload page
    await page.reload();

    // Wait for error message
    const errorMessage = page.getByText(/error|failed|unable to load/i).first();
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Verify retry button
    const retryButton = page.getByRole('button', { name: /retry|try again/i });
    await expect(retryButton).toBeVisible();
  });
});
