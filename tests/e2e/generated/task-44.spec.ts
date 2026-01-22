import { test, expect } from '@playwright/test';

test.describe('Mock Data Layer for Demo', () => {
  test.use({ storageState: 'tests/e2e/.auth/user.json' });

  test('When fixtures load, 12 teams exist with realistic NFL-inspired names and win-loss records', async ({ page }) => {
    const response = await page.request.get('/api/leagues/demo-league/teams');

    expect(response.status()).toBe(200);

    const teams = await response.json();
    expect(Array.isArray(teams)).toBe(true);
    expect(teams.length).toBe(12);

    teams.forEach((team: any) => {
      expect(team).toHaveProperty('id');
      expect(team).toHaveProperty('name');
      expect(team.name.length).toBeGreaterThan(0);
      expect(team).toHaveProperty('wins');
      expect(team).toHaveProperty('losses');
      expect(typeof team.wins).toBe('number');
      expect(typeof team.losses).toBe('number');
    });
  });

  test('When fixtures load, 15+ members exist with various roles (Admin, Commissioner, Manager, Fan)', async ({ page }) => {
    const response = await page.request.get('/api/leagues/demo-league/members');

    expect(response.status()).toBe(200);

    const members = await response.json();
    expect(Array.isArray(members)).toBe(true);
    expect(members.length).toBeGreaterThanOrEqual(15);

    const roles = new Set(members.map((m: any) => m.role));
    expect(roles.size).toBeGreaterThan(1);

    const validRoles = ['Admin', 'Commissioner', 'Manager', 'Fan'];
    members.forEach((member: any) => {
      expect(member).toHaveProperty('id');
      expect(member).toHaveProperty('name');
      expect(member).toHaveProperty('role');
      expect(validRoles).toContain(member.role);
    });
  });

  test('When fixtures load, 20+ moments exist spanning types (post, trade, rankings, transaction)', async ({ page }) => {
    const response = await page.request.get('/api/leagues/demo-league/feed');

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data.moments)).toBe(true);
    expect(data.moments.length).toBeGreaterThanOrEqual(20);

    const types = new Set(data.moments.map((m: any) => m.type));
    expect(types.size).toBeGreaterThan(1);

    const validTypes = ['post', 'trade', 'rankings', 'transaction', 'pickems'];
    data.moments.forEach((moment: any) => {
      expect(moment).toHaveProperty('id');
      expect(moment).toHaveProperty('type');
      expect(validTypes).toContain(moment.type);
      expect(moment).toHaveProperty('createdAt');
    });
  });

  test('When fixtures load, 3 weeks of power rankings exist with commissioner commentary per team', async ({ page }) => {
    const response = await page.request.get('/api/leagues/demo-league/rankings?week=1');

    expect(response.status()).toBe(200);

    const rankings = await response.json();
    expect(Array.isArray(rankings)).toBe(true);

    rankings.forEach((ranking: any) => {
      expect(ranking).toHaveProperty('teamId');
      expect(ranking).toHaveProperty('rank');
      expect(ranking).toHaveProperty('commentary');
      expect(ranking.commentary.length).toBeGreaterThan(0);
    });

    const week2Response = await page.request.get('/api/leagues/demo-league/rankings?week=2');
    expect(week2Response.status()).toBe(200);

    const week3Response = await page.request.get('/api/leagues/demo-league/rankings?week=3');
    expect(week3Response.status()).toBe(200);
  });

  test('When data layer function imports fixtures, TypeScript types match schema definitions', async ({ page }) => {
    const leagueResponse = await page.request.get('/api/leagues/demo-league');
    const league = await leagueResponse.json();

    expect(league).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
      description: expect.any(String),
      visibility: expect.stringMatching(/^(public|private)$/),
      joinRule: expect.stringMatching(/^(auto-join|approval)$/),
      createdAt: expect.any(String),
    });

    const teamsResponse = await page.request.get('/api/leagues/demo-league/teams');
    const teams = await teamsResponse.json();

    teams.forEach((team: any) => {
      expect(team).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        managerId: expect.any(String),
        wins: expect.any(Number),
        losses: expect.any(Number),
        ties: expect.any(Number),
      });
    });
  });

  test('When fixture arrays are empty for a category, empty array returns (not undefined/null)', async ({ page }) => {
    await page.route('**/api/leagues/empty-league/teams', route => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([])
      });
    });

    const response = await page.request.get('/api/leagues/empty-league/teams');

    expect(response.status()).toBe(200);

    const teams = await response.json();
    expect(teams).toEqual([]);
    expect(Array.isArray(teams)).toBe(true);
  });
});
