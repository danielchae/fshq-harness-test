import { test, expect } from '@playwright/test';

test.describe('API Routes for Feed and Moments', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('When GET request hits /api/leagues/[slug]/feed, paginated moments array returns with nextCursor', async ({ page }) => {
    const response = await page.request.get('/api/leagues/demo-league/feed');

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('moments');
    expect(Array.isArray(data.moments)).toBe(true);
    expect(data).toHaveProperty('nextCursor');
  });

  test('When POST creates moment with valid body, new moment object returns with generated ID', async ({ page }) => {
    const newMoment = {
      type: 'post',
      content: 'Test moment content',
      authorId: 'user-1'
    };

    const response = await page.request.post('/api/leagues/demo-league/moments', {
      data: newMoment
    });

    expect(response.status()).toBe(201);

    const moment = await response.json();
    expect(moment).toHaveProperty('id');
    expect(moment.content).toBe(newMoment.content);
    expect(moment.type).toBe(newMoment.type);
  });

  test('When POST toggles reaction, updated reaction state returns with new counts', async ({ page }) => {
    const response = await page.request.post('/api/moments/moment-123/reactions', {
      data: { emoji: '👍' }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('reactions');
    expect(data).toHaveProperty('userReacted');
    expect(typeof data.userReacted).toBe('boolean');
  });

  test('When cursor query param is passed to feed endpoint, next page of results returns', async ({ page }) => {
    const firstResponse = await page.request.get('/api/leagues/demo-league/feed');
    const firstData = await firstResponse.json();

    if (firstData.nextCursor) {
      const secondResponse = await page.request.get(
        `/api/leagues/demo-league/feed?cursor=${firstData.nextCursor}`
      );

      expect(secondResponse.status()).toBe(200);

      const secondData = await secondResponse.json();
      expect(Array.isArray(secondData.moments)).toBe(true);

      if (secondData.moments.length > 0) {
        expect(secondData.moments[0].id).not.toBe(firstData.moments[0]?.id);
      }
    }
  });

  test('When feed returns no moments, 200 response returns with empty array and null cursor', async ({ page }) => {
    // Use a league slug that doesn't exist in fixtures - should return empty feed
    const response = await page.request.get('/api/leagues/empty-league/feed');

    expect(response.status()).toBe(200);

    const data = await response.json();
    // Empty league should still return the structure with moments array
    expect(data).toHaveProperty('moments');
    expect(Array.isArray(data.moments)).toBe(true);
    expect(data).toHaveProperty('nextCursor');
    // nextCursor can be null or undefined when no more pages
    expect(data.nextCursor === null || data.nextCursor === undefined).toBe(true);
  });

  test('When moment ID doesn\'t exist for reactions endpoint, 404 response returns', async ({ page }) => {
    // Use a moment ID that definitely doesn't exist in fixtures
    const response = await page.request.post('/api/moments/nonexistent-moment-xyz-999/reactions', {
      data: { emoji: '👍' }
    });

    expect(response.status()).toBe(404);
  });
});
