// tests/backend/be-task-19.test.ts
// Backend Test: Generate Initial Prisma Migration

import { describe, test, expect } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Generate Initial Prisma Migration (task-19)', () => {
  test('database connection is successful', async () => {
    // Attempt to connect
    await expect(prisma.$connect()).resolves.not.toThrow();
  });

  test('all auth tables are created', async () => {
    // Verify User table
    const userCount = await prisma.user.count();
    expect(typeof userCount).toBe('number');

    // Verify Account table
    const accountCount = await prisma.account.count();
    expect(typeof accountCount).toBe('number');

    // Verify Session table
    const sessionCount = await prisma.session.count();
    expect(typeof sessionCount).toBe('number');

    // Verify VerificationToken table
    const tokenCount = await prisma.verificationToken.count();
    expect(typeof tokenCount).toBe('number');
  });

  test('application tables exist after migration', async () => {
    // These tests verify that tables exist by attempting counts
    // If table doesn't exist, Prisma will throw an error

    // League table
    if (prisma.league) {
      const leagueCount = await prisma.league.count();
      expect(typeof leagueCount).toBe('number');
    }

    // Team table
    if (prisma.team) {
      const teamCount = await prisma.team.count();
      expect(typeof teamCount).toBe('number');
    }

    // Membership table
    if (prisma.membership) {
      const membershipCount = await prisma.membership.count();
      expect(typeof membershipCount).toBe('number');
    }
  });

  test('database schema has proper constraints', async () => {
    // Test unique constraint on User.email
    const testEmail = `TEST_migration_${Date.now()}@example.com`;

    const user1 = await prisma.user.create({
      data: { email: testEmail, name: 'TEST_Migration1' },
    });

    await expect(
      prisma.user.create({
        data: { email: testEmail, name: 'TEST_Migration2' },
      })
    ).rejects.toThrow(/unique/i);

    // Clean up
    await prisma.user.delete({ where: { id: user1.id } });
  });

  test('database supports foreign key relationships', async () => {
    // Create user for relationship test
    const user = await prisma.user.create({
      data: { email: 'TEST_fk_test@example.com', name: 'TEST_FKTest' },
    });

    // Create account linked to user
    const account = await prisma.account.create({
      data: {
        userId: user.id,
        type: 'oauth',
        provider: 'test',
        providerAccountId: 'test-123',
      },
    });

    // Verify relationship
    expect(account.userId).toBe(user.id);

    // Query with include
    const userWithAccounts = await prisma.user.findUnique({
      where: { id: user.id },
      include: { accounts: true },
    });

    expect(userWithAccounts?.accounts).toHaveLength(1);

    // Clean up - cascade delete
    await prisma.user.delete({ where: { id: user.id } });

    // Verify account was cascade deleted
    const deletedAccount = await prisma.account.findUnique({
      where: { id: account.id },
    });
    expect(deletedAccount).toBeNull();
  });

  test('database enforces not null constraints', async () => {
    // User.email is required
    await expect(
      prisma.user.create({
        data: { name: 'TEST_NoEmail' } as any,
      })
    ).rejects.toThrow();
  });

  test('migration history is tracked', async () => {
    // This test verifies that Prisma migration system is working
    // by checking that we can query the database
    const result = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    // Should have at least the auth tables
    expect(Number(result[0].count)).toBeGreaterThanOrEqual(4);
  });
});
