import { test, expect } from '@playwright/test';

test.describe('Member Management Page', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('When admin visits members page, all members display with name, avatar, and role badge', async ({ page }) => {
    await page.goto('/leagues/demo-league/members');

    const memberCards = page.locator('[data-testid="member-card"]');
    await expect(memberCards.first()).toBeVisible();

    const firstMember = memberCards.first();
    await expect(firstMember.locator('[data-testid="member-name"]')).toBeVisible();
    await expect(firstMember.locator('[data-testid="member-avatar"]')).toBeVisible();
    await expect(firstMember.locator('[data-testid="role-badge"]')).toBeVisible();
  });

  test('When pending membership requests exist, approval queue section renders at top of page', async ({ page }) => {
    // Set up route BEFORE navigating
    await page.route('**/api/leagues/*/members/pending', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '1', name: 'Pending User', email: 'pending@example.com' }
        ])
      });
    });

    await page.goto('/leagues/demo-league/members');

    const approvalQueue = page.locator('[data-testid="approval-queue"]');
    await expect(approvalQueue).toBeVisible();

    const queuePosition = await approvalQueue.boundingBox();
    const firstMemberPosition = await page.locator('[data-testid="member-card"]').first().boundingBox();

    if (queuePosition && firstMemberPosition) {
      expect(queuePosition.y).toBeLessThan(firstMemberPosition.y);
    }
  });

  test('When admin clicks Approve on pending member, member gains access and queue updates', async ({ page }) => {
    // Track whether the pending member should be shown (starts true, becomes false after approval)
    let showPending = true;

    // Set up route BEFORE navigating
    await page.route('**/api/leagues/*/members/pending', route => {
      const request = route.request();
      if (request.method() === 'GET') {
        // Return pending member only if not yet approved
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(showPending ? [
            { id: 'pending-1', name: 'New Member', email: 'new@example.com' }
          ] : [])
        });
      } else if (request.method() === 'POST') {
        // Mock approval success
        showPending = false;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, member: { id: 'member-new', name: 'New Member' } })
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/leagues/demo-league/members');

    // Wait for approval queue to be visible
    const approvalQueue = page.locator('[data-testid="approval-queue"]');
    await expect(approvalQueue).toBeVisible();

    const approveButton = page.locator('[data-testid="approve-button"]').first();
    await approveButton.click();

    // Sonner toasts use [data-sonner-toast] attribute
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/approved/i);

    await expect(page.locator('[data-testid="approval-queue"]')).not.toBeVisible({ timeout: 2000 });
  });

  test('When admin clicks Change Role button, confirmation dialog appears before role update', async ({ page }) => {
    await page.goto('/leagues/demo-league/members');

    const changeRoleButton = page.locator('[data-testid="change-role-button"]').first();
    await changeRoleButton.click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();

    await expect(confirmDialog).toContainText(/change role/i);

    const confirmButton = confirmDialog.getByRole('button', { name: /confirm/i });
    await expect(confirmButton).toBeVisible();
  });
});
