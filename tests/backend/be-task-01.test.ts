// tests/backend/be-task-01.test.ts
// Backend Test: Create Users Table Schema

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/db';

describe('Backend: Create Users Table Schema (task-01)', () => {
  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({ where: { email: { startsWith: 'TEST_' } } }).catch(() => {});
  });

  test('users table exists with required fields', async () => {
    // Create a test user to verify schema
    const user = await prisma.user.create({
      data: {
        email: 'TEST_user@example.com',
        name: 'TEST_User',
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('TEST_user@example.com');
    expect(user.name).toBe('TEST_User');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  test('enforces unique constraint on email', async () => {
    await prisma.user.create({
      data: {
        email: 'TEST_unique@example.com',
        name: 'TEST_First',
      },
    });

    await expect(
      prisma.user.create({
        data: {
          email: 'TEST_unique@example.com',
          name: 'TEST_Duplicate',
        },
      })
    ).rejects.toThrow(/unique/i);
  });

  test('allows null for optional fields (password, name, image)', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'TEST_minimal@example.com',
      },
    });

    expect(user.password).toBeNull();
    expect(user.image).toBeNull();
  });

  test('sets createdAt and updatedAt timestamps automatically', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'TEST_timestamps@example.com',
        name: 'TEST_Timestamps',
      },
    });

    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });
});
