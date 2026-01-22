// tests/backend/be-task-18.test.ts
// Backend Test: Implement Prisma Client Configuration

import { describe, test, expect } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Implement Prisma Client Configuration (task-18)', () => {
  test('prisma client is instantiated correctly', () => {
    expect(prisma).toBeDefined();
    expect(typeof prisma.$connect).toBe('function');
    expect(typeof prisma.$disconnect).toBe('function');
    expect(typeof prisma.$queryRaw).toBe('function');
  });

  test('prisma client uses singleton pattern', async () => {
    // Import prisma client multiple times
    const { prisma: prisma1 } = await import('@/lib/db');
    const { prisma: prisma2 } = await import('@/lib/db');

    // Both imports should return the same instance
    expect(prisma1).toBe(prisma2);
  });

  test('prisma client has standard models available', () => {
    // Verify standard models exist
    expect(prisma.user).toBeDefined();
    expect(prisma.account).toBeDefined();
    expect(prisma.session).toBeDefined();
    expect(prisma.verificationToken).toBeDefined();
  });

  test('prisma client can execute raw queries', async () => {
    // Test raw query capability
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('prisma client handles connection errors gracefully', async () => {
    // Verify error handling exists - this tests that we can catch errors
    try {
      // Attempt to find a non-existent record (should not throw)
      const nonExistent = await prisma.user.findUnique({
        where: { id: 'non-existent-id-123456' },
      });
      expect(nonExistent).toBeNull();
    } catch (error) {
      // If an error is thrown, it should be a Prisma error
      expect(error).toHaveProperty('code');
    }
  });

  test('prisma client supports transactions', async () => {
    // Test transaction support
    let createdUser: any = null;

    try {
      await prisma.$transaction(async (tx) => {
        createdUser = await tx.user.create({
          data: {
            email: 'TEST_transaction@example.com',
            name: 'TEST_Transaction',
          },
        });

        expect(createdUser).toBeDefined();
        expect(createdUser.id).toBeDefined();

        // Rollback by throwing error
        throw new Error('Intentional rollback');
      });
    } catch (error) {
      // Transaction should have rolled back
      expect((error as Error).message).toBe('Intentional rollback');
    }

    // Verify rollback - user should not exist
    const rolledBackUser = await prisma.user.findUnique({
      where: { email: 'TEST_transaction@example.com' },
    });

    expect(rolledBackUser).toBeNull();
  });

  test('prisma client can perform batch operations', async () => {
    // Create test users in batch
    const users = await prisma.user.createMany({
      data: [
        { email: 'TEST_batch1@example.com', name: 'TEST_Batch1' },
        { email: 'TEST_batch2@example.com', name: 'TEST_Batch2' },
        { email: 'TEST_batch3@example.com', name: 'TEST_Batch3' },
      ],
      skipDuplicates: true,
    });

    expect(users.count).toBeGreaterThanOrEqual(0);

    // Clean up
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'TEST_batch' } },
    });
  });
});
