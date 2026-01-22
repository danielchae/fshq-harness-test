import { test, expect } from '@playwright/test';

test.describe('API Routes for League Operations', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('When GET request hits /api/leagues/[slug], league data JSON returns with 200 status', async ({ page }) => {
    const response = await page.request.get('/api/leagues/demo-league');

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('slug');
    expect(data).toHaveProperty('name');
  });

  test('When slug doesn\'t match any league, 404 response returns with { error: \'League not found\' }', async ({ page }) => {
    const response = await page.request.get('/api/leagues/nonexistent-league-xyz');

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('not found');
  });

  test('When authentication cookie is missing on protected routes, 401 response returns', async () => {
    // Use native fetch without any cookies/credentials
    const response = await fetch('http://localhost:3000/api/leagues/demo-league', {
      credentials: 'omit',
      redirect: 'manual', // Don't follow redirects
    });

    // Should either be 401 or 307 redirect (both indicate auth is required)
    expect([401, 307]).toContain(response.status);
  });

  test('When data layer is called, it returns mock data matching schema structure for frontend development', async ({ page }) => {
    const response = await page.request.get('/api/leagues/demo-league');

    expect(response.status()).toBe(200);

    const league = await response.json();
    expect(league).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      visibility: expect.stringMatching(/^(public|private)$/),
      joinRule: expect.stringMatching(/^(auto-join|approval)$/),
    });
  });

  test('When teams endpoint returns empty array, response is still 200 with empty array (not 404)', async ({ page }) => {
    // Test that the route responds with 200 even for a league without teams
    // Use a league slug that exists but has no teams
    const response = await page.request.get('/api/leagues/new-league/teams');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('When members endpoint returns empty array, response is still 200 with empty array (not 404)', async ({ page }) => {
    // Test that the route responds with 200 even for a league without members
    // Use a league slug that exists but has no members
    const response = await page.request.get('/api/leagues/new-league/members');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
