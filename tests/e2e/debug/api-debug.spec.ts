import { test, expect } from '@playwright/test';

test.describe('Debug API calls', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('debug API call patterns', async ({ page }) => {
    const requests: string[] = [];
    
    // Log all requests
    page.on('request', request => {
      requests.push(request.url());
    });

    // Set up route handler
    let apiCalled = false;
    await page.route('**/api/leagues/demo-league', route => {
      console.log('Route handler called!');
      apiCalled = true;
      route.fulfill({
        status: 200,
        body: JSON.stringify({ id: '1', slug: 'demo-league', name: 'Demo League' })
      });
    });

    await page.goto('/leagues/demo-league/feed');
    await page.waitForLoadState('networkidle');

    // Print all API requests
    const apiRequests = requests.filter(r => r.includes('/api/'));
    console.log('All API requests:', apiRequests);
    console.log('API called:', apiCalled);
    console.log('Total requests:', requests.length);
    
    // Check if league-name shows
    const leagueName = page.locator('[data-testid="league-name"]');
    const nameText = await leagueName.textContent();
    console.log('League name text:', nameText);
    
    expect(true).toBe(true);
  });
});
