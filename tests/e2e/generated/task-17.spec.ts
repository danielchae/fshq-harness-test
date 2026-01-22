import { test, expect } from '@playwright/test';

test.describe('Task 17: Matchup Predictions Editor', () => {
  test.use({ storageState: 'tests/e2e/auth/commissioner.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/desk');
    const predictionsTab = page.getByRole('tab', { name: /predictions/i });
    await predictionsTab.click();
    await page.waitForLoadState('networkidle');
  });

  test("When commissioner opens predictions tab, current week's matchups display as editable cards", async ({ page }) => {
    // Wait for matchup cards to be present (uses Playwright's auto-waiting)
    const matchupCards = page.getByTestId('matchup-prediction-card');
    await expect(matchupCards.first()).toBeVisible({ timeout: 10000 });

    // Verify at least one card is present
    const cardCount = await matchupCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify each card shows both teams
    const firstCard = matchupCards.first();
    const teamNames = firstCard.getByTestId('team-name');
    await expect(teamNames.first()).toBeVisible();
    const teamCount = await teamNames.count();
    expect(teamCount).toBe(2);

    // Verify hype text input is present
    const hypeTextarea = firstCard.getByRole('textbox', { name: /hype|prediction/i });
    await expect(hypeTextarea).toBeVisible();
    await expect(hypeTextarea).toBeEditable();
  });

  test("When commissioner clicks 'Feature' toggle on matchup card, matchup is marked as featured with visual indicator", async ({ page }) => {
    // Wait for cards to load
    const matchupCards = page.getByTestId('matchup-prediction-card');
    await expect(matchupCards.first()).toBeVisible({ timeout: 10000 });

    const firstCard = matchupCards.first();

    // Find and toggle the feature switch
    const featureSwitch = firstCard.getByRole('switch', { name: /feature/i });
    await expect(featureSwitch).toBeVisible();

    // Check initial state
    const initialChecked = await featureSwitch.isChecked();

    // Toggle the switch
    await featureSwitch.click();

    // Wait for state change
    await page.waitForTimeout(300);

    // Verify switch state changed
    const newChecked = await featureSwitch.isChecked();
    expect(newChecked).toBe(!initialChecked);

    // If now featured, verify visual indicator
    if (newChecked) {
      const featuredIndicator = firstCard.getByTestId('featured-indicator')
        .or(firstCard.locator('[data-featured="true"]'));
      await expect(featuredIndicator).toBeVisible();
    }
  });

  test('When commissioner types prediction/hype text in matchup card, text autosaves after typing stops', async ({ page }) => {
    // Wait for cards to load
    const matchupCards = page.getByTestId('matchup-prediction-card');
    await expect(matchupCards.first()).toBeVisible({ timeout: 10000 });

    const firstCard = matchupCards.first();
    const hypeTextarea = firstCard.getByRole('textbox', { name: /hype|prediction/i });

    // Clear and type new hype text
    await hypeTextarea.clear();
    await hypeTextarea.fill('Battle of the undefeated! Expect fireworks in this high-scoring affair.');

    // Wait for autosave
    await page.waitForTimeout(1500);

    // Verify save indicator
    const saveIndicator = page.getByText(/saved/i).or(page.getByTestId('save-indicator'));
    await expect(saveIndicator).toBeVisible();

    // Refresh and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    const predictionsTab = page.getByRole('tab', { name: /predictions/i });
    await predictionsTab.click();

    const reloadedCard = page.getByTestId('matchup-prediction-card').first();
    const reloadedTextarea = reloadedCard.getByRole('textbox', { name: /hype|prediction/i });
    const value = await reloadedTextarea.inputValue();
    expect(value).toBe('Battle of the undefeated! Expect fireworks in this high-scoring affair.');
  });

  test('When commissioner clicks Preview, featured matchup displays with special styling and hype text', async ({ page }) => {
    // Wait for cards to load
    const matchupCards = page.getByTestId('matchup-prediction-card');
    await expect(matchupCards.first()).toBeVisible({ timeout: 10000 });

    // First, feature a matchup and add hype text
    const firstCard = matchupCards.first();
    const featureSwitch = firstCard.getByRole('switch', { name: /feature/i });

    if (!await featureSwitch.isChecked()) {
      await featureSwitch.click();
      await page.waitForTimeout(300);
    }

    const hypeTextarea = firstCard.getByRole('textbox', { name: /hype|prediction/i });
    await hypeTextarea.clear();
    await hypeTextarea.fill('Clash of titans this week!');
    await page.waitForTimeout(1500);

    // Click preview
    const previewButton = page.getByRole('button', { name: /preview/i });
    await previewButton.click();

    // Verify modal opens
    const modal = page.getByRole('dialog', { name: /preview/i });
    await expect(modal).toBeVisible();

    // Verify featured matchup has special styling
    const featuredMatchup = modal.getByTestId('featured-matchup')
      .or(modal.locator('[data-featured="true"]'));
    await expect(featuredMatchup).toBeVisible();

    // Verify hype text displays
    const hypeText = modal.getByText('Clash of titans this week!');
    await expect(hypeText).toBeVisible();

    // Close modal
    const closeButton = modal.getByRole('button', { name: /close/i });
    await closeButton.click();
  });
});
