import { test, expect } from '@playwright/test';

test.describe('Task 16: Power Rankings Editor with Drag-Drop', () => {
  test.use({ storageState: 'tests/e2e/auth/commissioner.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/leagues/test-league/desk');
    const rankingsTab = page.getByRole('tab', { name: /rankings/i });
    await rankingsTab.click();
    await page.waitForLoadState('networkidle');
  });

  test('When commissioner opens rankings tab, all teams display in draggable list with current order', async ({ page }) => {
    // Wait for teams list to load
    const teamsList = page.getByTestId('rankings-editor-list');
    await expect(teamsList).toBeVisible();

    // Verify all teams are present
    const teams = page.getByTestId('ranking-row');
    const teamCount = await teams.count();
    expect(teamCount).toBeGreaterThan(0);

    // Verify draggable attribute
    const firstTeam = teams.first();
    await expect(firstTeam).toHaveAttribute('draggable', 'true');

    // Verify rank numbers are in order
    const ranks = await page.getByTestId('rank-number').allTextContents();
    const ranksAsNumbers = ranks.map(r => parseInt(r, 10));
    const isSorted = ranksAsNumbers.every((val, idx, arr) => {
      if (idx === 0) return true;
      const prevVal = arr[idx - 1];
      return prevVal !== undefined && prevVal <= val;
    });
    expect(isSorted).toBe(true);
  });

  test('When commissioner drags team to new position, ranking order updates visually with smooth animation', async ({ page }) => {
    const teams = page.getByTestId('ranking-row');

    // Get first and third team elements
    const firstTeam = teams.nth(0);
    const thirdTeam = teams.nth(2);

    // Get original positions
    const firstTeamName = await firstTeam.getByTestId('team-name').textContent();

    // Use JavaScript to simulate drag-drop events directly
    await page.evaluate(() => {
      const rows = document.querySelectorAll('[data-testid="ranking-row"]');
      const source = rows[0];
      const target = rows[2];

      if (!source || !target) return;

      // Create and dispatch dragstart
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', '0');

      const dragStartEvent = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      source.dispatchEvent(dragStartEvent);

      // Create and dispatch dragover on target (required for drop to work)
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      target.dispatchEvent(dragOverEvent);

      // Create and dispatch dragenter on target
      const dragEnterEvent = new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      target.dispatchEvent(dragEnterEvent);

      // Create and dispatch drop on target
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      target.dispatchEvent(dropEvent);

      // Create and dispatch dragend on source
      const dragEndEvent = new DragEvent('dragend', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      source.dispatchEvent(dragEndEvent);
    });

    // Wait for animation
    await page.waitForTimeout(500);

    // Verify new order
    const newSecondTeam = teams.nth(1);
    const newSecondTeamName = await newSecondTeam.getByTestId('team-name').textContent();
    expect(newSecondTeamName).toBe(firstTeamName);

    // Verify ranks updated
    const newSecondRank = await newSecondTeam.getByTestId('rank-number').textContent();
    expect(newSecondRank).toBe('2');
  });

  test('When commissioner enters commentary in team row, text autosaves after typing stops', async ({ page }) => {
    const firstTeam = page.getByTestId('ranking-row').first();
    const commentaryTextarea = firstTeam.getByRole('textbox', { name: /commentary/i });

    // Clear existing text and type new commentary
    await commentaryTextarea.clear();
    await commentaryTextarea.fill('Dominant performance this week with stellar quarterback play');

    // Wait for autosave delay (typically 500-1000ms)
    await page.waitForTimeout(1500);

    // Verify save indicator appears
    const saveIndicator = page.getByText(/saved/i).or(page.getByTestId('save-indicator'));
    await expect(saveIndicator).toBeVisible();

    // Refresh page and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    const rankingsTab = page.getByRole('tab', { name: /rankings/i });
    await rankingsTab.click();

    const reloadedTextarea = page.getByTestId('ranking-row').first().getByRole('textbox', { name: /commentary/i });
    const value = await reloadedTextarea.inputValue();
    expect(value).toBe('Dominant performance this week with stellar quarterback play');
  });

  test('When commissioner clicks Preview button, modal displays rankings as league members will see them', async ({ page }) => {
    const previewButton = page.getByRole('button', { name: /preview/i });
    await previewButton.click();

    // Verify modal opens
    const modal = page.getByRole('dialog', { name: /preview/i });
    await expect(modal).toBeVisible();

    // Verify rankings display in readonly format
    const rankingCards = modal.getByTestId('preview-ranking-card');
    const cardCount = await rankingCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify no editable elements in preview
    const editableInputs = modal.getByRole('textbox');
    const inputCount = await editableInputs.count();
    expect(inputCount).toBe(0);

    // Verify rank numbers and commentary display
    const firstCard = rankingCards.first();
    await expect(firstCard.getByTestId('rank-number')).toBeVisible();
    await expect(firstCard.getByTestId('team-name')).toBeVisible();

    // Close modal
    const closeButton = modal.getByRole('button', { name: /close/i });
    await closeButton.click();
    await expect(modal).not.toBeVisible();
  });
});
