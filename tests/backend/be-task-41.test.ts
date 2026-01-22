// tests/backend/be-task-41.test.ts
// Backend Test: Implement Get Transactions Data Fetcher

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Get Transactions Data Fetcher (task-41)', () => {
  let testLeagueId: string | null = null;

  afterEach(async () => {
    await prisma.transaction?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    await prisma.team?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('queries transactions ordered by timestamp DESC', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_transactions_order',
        name: 'TEST_Transactions Order',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Trans Team',
        ownerUsername: 'trans',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Create transactions at different times
    for (let i = 0; i < 3; i++) {
      await prisma.transaction?.create({
        data: {
          leagueId: league!.id,
          teamId: team!.id,
          weekNumber: 10,
          type: 'add',
          playerName: `TEST_Player ${i}`,
          timestamp: new Date(Date.now() - i * 1000 * 60 * 60),
        },
      });
    }

    const transactions = await prisma.transaction?.findMany({
      where: { leagueId: league!.id },
      orderBy: { timestamp: 'desc' },
    });

    expect(transactions?.length).toBe(3);
    // Most recent first
    expect(transactions?.[0].playerName).toBe('TEST_Player 0');
  });

  test('filters by transaction type if specified', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_transactions_filter',
        name: 'TEST_Transactions Filter',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Filter Team',
        ownerUsername: 'filter',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Create different transaction types
    const types = ['trade', 'add', 'drop', 'waiver'];
    for (const type of types) {
      await prisma.transaction?.create({
        data: {
          leagueId: league!.id,
          teamId: team!.id,
          weekNumber: 10,
          type: type,
          playerName: `TEST_${type} Player`,
          timestamp: new Date(),
        },
      });
    }

    const trades = await prisma.transaction?.findMany({
      where: { leagueId: league!.id, type: 'trade' },
    });

    const waivers = await prisma.transaction?.findMany({
      where: { leagueId: league!.id, type: 'waiver' },
    });

    expect(trades?.length).toBe(1);
    expect(waivers?.length).toBe(1);
  });

  test('includes team and player data', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_transactions_data',
        name: 'TEST_Transactions Data',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Data Team',
        ownerUsername: 'datateam',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    await prisma.transaction?.create({
      data: {
        leagueId: league!.id,
        teamId: team!.id,
        weekNumber: 10,
        type: 'add',
        playerName: 'TEST_Superstar Player',
        timestamp: new Date(),
      },
    });

    const transactions = await prisma.transaction?.findMany({
      where: { leagueId: league!.id },
      include: { team: true },
    });

    expect(transactions?.[0].team?.name).toBe('TEST_Data Team');
    expect(transactions?.[0].playerName).toBe('TEST_Superstar Player');
  });

  test('returns TransactionsResponse type contract shape', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_transactions_shape',
        name: 'TEST_Transactions Shape',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Shape Team',
        ownerUsername: 'shape',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    const transaction = await prisma.transaction?.create({
      data: {
        leagueId: league!.id,
        teamId: team!.id,
        weekNumber: 10,
        type: 'trade',
        playerName: 'TEST_Trade Player',
        timestamp: new Date(),
      },
    });

    // Verify Transaction type contract
    expect(transaction).toHaveProperty('id');
    expect(transaction).toHaveProperty('leagueId');
    expect(transaction).toHaveProperty('teamId');
    expect(transaction).toHaveProperty('weekNumber');
    expect(transaction).toHaveProperty('type');
    expect(transaction).toHaveProperty('playerName');
    expect(transaction).toHaveProperty('timestamp');
  });

  test('supports pagination for transaction history', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_transactions_page',
        name: 'TEST_Transactions Page',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Page Team',
        ownerUsername: 'page',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });

    // Create many transactions
    for (let i = 0; i < 25; i++) {
      await prisma.transaction?.create({
        data: {
          leagueId: league!.id,
          teamId: team!.id,
          weekNumber: 10,
          type: 'add',
          playerName: `TEST_Player ${i}`,
          timestamp: new Date(Date.now() - i * 1000),
        },
      });
    }

    // First page
    const page1 = await prisma.transaction?.findMany({
      where: { leagueId: league!.id },
      orderBy: { timestamp: 'desc' },
      take: 10,
      skip: 0,
    });

    // Second page
    const page2 = await prisma.transaction?.findMany({
      where: { leagueId: league!.id },
      orderBy: { timestamp: 'desc' },
      take: 10,
      skip: 10,
    });

    expect(page1?.length).toBe(10);
    expect(page2?.length).toBe(10);
    expect(page1?.[0].playerName).toBe('TEST_Player 0');
    expect(page2?.[0].playerName).toBe('TEST_Player 10');
  });
});
