import { beforeAll, afterAll, afterEach } from 'vitest';

// Import prisma client - will be available after workspace setup
let prisma: any;

beforeAll(async () => {
  try {
    // Dynamic import to handle case where @/lib/db doesn't exist yet
    const { prisma: prismaClient } = await import('@/lib/db');
    prisma = prismaClient;
  } catch (e) {
    console.log('[vitest setup] Prisma client not available yet - tests will import directly');
  }
});

afterEach(async () => {
  // Clean up test data after each test
  // Tests should prefix test data with TEST_ for easy cleanup
  if (prisma) {
    try {
      // Add model-specific cleanup as needed
      // Example: await prisma.someModel.deleteMany({ where: { name: { startsWith: 'TEST_' } } });
    } catch (e) {
      // Ignore cleanup errors - model might not exist yet
    }
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});
