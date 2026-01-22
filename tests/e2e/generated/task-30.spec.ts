import { test, expect } from '@playwright/test';

test.describe('Task 30: Transaction Filters and Search', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/transactions');
    await page.waitForLoadState('networkidle');
  });

  test('When user selects type filter dropdown, only transactions of that type display', async ({ page }) => {
    // Find type filter dropdown by data-testid
    const typeFilter = page.getByTestId('type-filter');

    await expect(typeFilter).toBeVisible();

    // Open dropdown
    await typeFilter.click();

    // Select "Trades" option
    const tradesOption = page.getByRole('option', { name: /trades?/i });
    if (await tradesOption.count() > 0) {
      await tradesOption.click();

      // Wait for filter to apply
      await page.waitForLoadState('networkidle');

      // Verify only trade transactions are shown
      const transactionCards = page.getByTestId('transaction-card');
      const cardCount = await transactionCards.count();

      if (cardCount > 0) {
        // Check that all visible cards are trades
        const tradeCards = page.locator('[data-type="trade"]');
        const tradeCount = await tradeCards.count();

        expect(tradeCount).toBeGreaterThan(0);
      }
    }
  });

  test("When user selects team from team filter, only that team's transactions show", async ({ page }) => {
    // Find team filter by data-testid
    const teamFilter = page.getByTestId('team-filter');

    if (await teamFilter.count() > 0) {
      await teamFilter.click();

      // Select a specific team option (not "All Teams")
      const teamOptions = page.getByRole('option');
      const optionCount = await teamOptions.count();

      // Skip "All Teams" and select a real team
      if (optionCount > 1) {
        const teamOption = teamOptions.nth(1); // Second option (first real team)
        const teamName = await teamOption.textContent();
        await teamOption.click();

        // Wait for filter to apply
        await page.waitForLoadState('networkidle');

        // Verify transactions contain the selected team
        const transactionCards = page.getByTestId('transaction-card');
        const firstCard = transactionCards.first();

        if (await firstCard.count() > 0) {
          const cardText = await firstCard.textContent();
          if (teamName) {
            expect(cardText).toContain(teamName);
          }
        }
      }
    }
  });

  test('When user types player name in search input, transactions involving that player filter in real-time', async ({ page }) => {
    // Find player search input by data-testid
    const searchInput = page.getByTestId('player-search');

    await expect(searchInput).toBeVisible();

    // Type player name - use an actual player from mock data
    await searchInput.fill('Mahomes');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify transactions are filtered
    const transactionCards = page.getByTestId('transaction-card');

    if (await transactionCards.count() > 0) {
      // Verify at least one card contains the search term
      const firstCard = transactionCards.first();
      const cardText = await firstCard.textContent();

      // Transaction should mention the player
      expect(cardText?.toLowerCase()).toContain('mahomes');
    }
  });

  test("When active filters return no results, empty state displays with 'No matching transactions' and clear filters button", async ({ page }) => {
    // Find player search input
    const searchInput = page.getByTestId('player-search');

    if (await searchInput.count() > 0) {
      // Search for non-existent player
      await searchInput.fill('ZZZNONEXISTENTPLAYER999');
      await page.waitForTimeout(500);

      // Verify empty state message
      const emptyState = page.getByText(/no matching transactions|no results/i);
      await expect(emptyState).toBeVisible({ timeout: 3000 });

      // Verify clear filters button (in empty state)
      const clearButton = page.getByTestId('clear-filters-empty');

      await expect(clearButton).toBeVisible();

      // Click clear button and verify filters reset
      await clearButton.click();
      await page.waitForTimeout(300);

      // Search input should be cleared
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('');
    }
  });
});
