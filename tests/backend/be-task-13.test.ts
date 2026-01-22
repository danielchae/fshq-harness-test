// tests/backend/be-task-13.test.ts
// Backend Test: Create Transactions Table Schema

import { describe, test, expect, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Transactions Table Schema (task-13)', () => {
  let testLeagueId: string | null = null;
  let testTeamId: string | null = null;

  afterEach(async () => {
    await prisma.transaction?.deleteMany({ where: { leagueId: testLeagueId || '' } }).catch(() => {});
    if (testTeamId) {
      await prisma.team?.delete({ where: { id: testTeamId } }).catch(() => {});
      testTeamId = null;
    }
    if (testLeagueId) {
      await prisma.league?.delete({ where: { id: testLeagueId } }).catch(() => {});
      testLeagueId = null;
    }
  });

  test('transactions table exists with required fields', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_transactions_league',
        name: 'TEST_Transactions League',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Transaction Team',
        ownerUsername: 'trans_owner',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });
    testTeamId = team?.id || null;

    const transaction = await prisma.transaction?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 8,
        type: 'add',
        teamId: team!.id,
        playerName: 'TEST_Patrick Mahomes',
        timestamp: new Date(),
      },
    });

    expect(transaction).toBeDefined();
    if (transaction) {
      expect(transaction.id).toBeDefined();
      expect(transaction.leagueId).toBe(league!.id);
      expect(transaction.weekNumber).toBe(8);
      expect(transaction.type).toBe('add');
      expect(transaction.teamId).toBe(team!.id);
      expect(transaction.playerName).toBe('TEST_Patrick Mahomes');
    }
  });

  test('supports all transaction types: trade, add, drop, waiver', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_trans_types',
        name: 'TEST_Transaction Types',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Multi Trans Team',
        ownerUsername: 'multi_trans',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });
    testTeamId = team?.id || null;

    const types = ['trade', 'add', 'drop', 'waiver'];

    for (const type of types) {
      const transaction = await prisma.transaction?.create({
        data: {
          leagueId: league!.id,
          weekNumber: 5,
          type: type,
          teamId: team!.id,
          playerName: `TEST_Player for ${type}`,
          timestamp: new Date(),
        },
      });

      expect(transaction?.type).toBe(type);
    }
  });

  test('orders transactions by timestamp descending', async () => {
    const league = await prisma.league?.create({
      data: {
        slug: 'test_trans_order',
        name: 'TEST_Transaction Order',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Order Team',
        ownerUsername: 'order_trans',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });
    testTeamId = team?.id || null;

    // Create transactions at different times
    const timestamps = [
      new Date('2025-01-01'),
      new Date('2025-01-05'),
      new Date('2025-01-03'),
    ];

    for (const timestamp of timestamps) {
      await prisma.transaction?.create({
        data: {
          leagueId: league!.id,
          weekNumber: 1,
          type: 'add',
          teamId: team!.id,
          playerName: `TEST_Player ${timestamp.toISOString()}`,
          timestamp,
        },
      });
    }

    const transactions = await prisma.transaction?.findMany({
      where: { leagueId: league!.id },
      orderBy: { timestamp: 'desc' },
    });

    expect(transactions?.length).toBe(3);
    expect(transactions?.[0].timestamp.getTime()).toBeGreaterThan(
      transactions?.[1].timestamp.getTime()
    );
    expect(transactions?.[1].timestamp.getTime()).toBeGreaterThan(
      transactions?.[2].timestamp.getTime()
    );
  });

  test('Transaction type matches frontend expectations', async () => {
    // Frontend expects Transaction with leagueId, weekNumber, type, teamId, playerName, timestamp
    const league = await prisma.league?.create({
      data: {
        slug: 'test_trans_type',
        name: 'TEST_Transaction Type',
        platform: 'sleeper',
        season: 2025,
        visibility: 'public',
      },
    });
    testLeagueId = league?.id || null;

    const team = await prisma.team?.create({
      data: {
        leagueId: league!.id,
        name: 'TEST_Type Team',
        ownerUsername: 'type_trans',
        wins: 0,
        losses: 0,
        ties: 0,
      },
    });
    testTeamId = team?.id || null;

    const transaction = await prisma.transaction?.create({
      data: {
        leagueId: league!.id,
        weekNumber: 3,
        type: 'trade',
        teamId: team!.id,
        playerName: 'TEST_Type Player',
        timestamp: new Date(),
      },
    });

    expect(transaction).toHaveProperty('id');
    expect(transaction).toHaveProperty('leagueId');
    expect(transaction).toHaveProperty('weekNumber');
    expect(transaction).toHaveProperty('type');
    expect(transaction).toHaveProperty('teamId');
    expect(transaction).toHaveProperty('playerName');
    expect(transaction).toHaveProperty('timestamp');
  });
});
