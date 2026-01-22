import { test, expect } from '@playwright/test';

test.describe('Debug click', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('Click and log', async ({ page }) => {
    await page.goto('/leagues/test-league/pickems');
    await page.waitForLoadState('networkidle');

    // Get first card
    const firstCard = page.getByTestId('matchup-pick-card').first();

    // Get team buttons - filter by team text
    const teamButtons = firstCard.getByRole('button').filter({ hasText: /Team:/i });
    const buttonCount = await teamButtons.count();
    console.log('Found buttons:', buttonCount);

    // Log button details before click
    const firstTeam = teamButtons.first();
    const beforeAttrs = await firstTeam.evaluate(el => ({
      dataSelected: el.getAttribute('data-selected'),
      ariaPressed: el.getAttribute('aria-pressed'),
      disabled: (el as HTMLButtonElement).disabled,
      testId: el.getAttribute('data-testid'),
    }));
    console.log('Before click:', beforeAttrs);

    // Click
    await firstTeam.click();
    console.log('Clicked!');

    // Wait and check again
    await page.waitForTimeout(1000);

    const afterAttrs = await firstTeam.evaluate(el => ({
      dataSelected: el.getAttribute('data-selected'),
      ariaPressed: el.getAttribute('aria-pressed'),
      disabled: (el as HTMLButtonElement).disabled,
    }));
    console.log('After click:', afterAttrs);

    // Check picks summary
    const summary = page.getByTestId('picks-summary');
    const summaryText = await summary.textContent();
    console.log('Picks summary:', summaryText);

    // Assert something just so test completes
    expect(buttonCount).toBeGreaterThan(0);
  });
});
