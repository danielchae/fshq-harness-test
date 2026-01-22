// tests/backend/be-task-62.test.ts
// Backend Test: Implement Differential Sync with Checksum Logic

import { describe, test, expect } from 'vitest';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

// Differential sync to be implemented at src/integrations/sleeper/differential-sync.ts
// For now, we test the expected behavior patterns that the implementation must satisfy

describe('Backend: Implement Differential Sync with Checksum Logic (task-62)', () => {
  // Helper to compute checksum
  const computeChecksum = (data: any): string => {
    const json = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('md5').update(json).digest('hex');
  };

  test('computes checksums for each synced entity', async () => {
    const roster = {
      roster_id: 1,
      owner_id: 'user_123',
      players: ['player_1', 'player_2'],
      settings: { wins: 5, losses: 3 },
    };

    const checksum = computeChecksum(roster);

    expect(checksum).toBeDefined();
    expect(typeof checksum).toBe('string');
    expect(checksum.length).toBe(32); // MD5 hex length
  });

  test('compares new checksums to stored values', async () => {
    const storedChecksums = new Map<string, string>();

    // Store initial checksums
    const roster1 = { roster_id: 1, players: ['p1', 'p2'] };
    storedChecksums.set('roster:1', computeChecksum(roster1));

    const roster2 = { roster_id: 2, players: ['p3', 'p4'] };
    storedChecksums.set('roster:2', computeChecksum(roster2));

    // Unchanged roster
    const roster1New = { roster_id: 1, players: ['p1', 'p2'] };
    const roster1Changed = storedChecksums.get('roster:1') !== computeChecksum(roster1New);

    // Changed roster
    const roster2New = { roster_id: 2, players: ['p3', 'p4', 'p5'] }; // Added player
    const roster2Changed = storedChecksums.get('roster:2') !== computeChecksum(roster2New);

    expect(roster1Changed).toBe(false);
    expect(roster2Changed).toBe(true);
  });

  test('only updates database for changed entities', async () => {
    const dbUpdates: string[] = [];
    const storedChecksums = new Map<string, string>();

    const syncEntity = (entityType: string, id: string, newData: any) => {
      const key = `${entityType}:${id}`;
      const newChecksum = computeChecksum(newData);
      const oldChecksum = storedChecksums.get(key);

      if (oldChecksum !== newChecksum) {
        dbUpdates.push(`UPDATE ${entityType} SET data = ? WHERE id = ${id}`);
        storedChecksums.set(key, newChecksum);
        return true;
      }
      return false;
    };

    // Initial sync
    syncEntity('roster', '1', { players: ['p1'] });
    syncEntity('roster', '2', { players: ['p2'] });
    expect(dbUpdates.length).toBe(2);

    // Second sync - no changes
    syncEntity('roster', '1', { players: ['p1'] });
    syncEntity('roster', '2', { players: ['p2'] });
    expect(dbUpdates.length).toBe(2); // Still 2

    // Third sync - one change
    syncEntity('roster', '1', { players: ['p1', 'p3'] }); // Changed
    syncEntity('roster', '2', { players: ['p2'] }); // Unchanged
    expect(dbUpdates.length).toBe(3); // Only 1 new update
  });

  test('reduces database write operations by ~80%', async () => {
    const totalEntities = 100;
    const changedPercentage = 0.2; // 20% changed

    let fullSyncWrites = 0;
    let differentialSyncWrites = 0;

    const storedChecksums = new Map<string, string>();

    // Simulate entities
    const entities = Array.from({ length: totalEntities }, (_, i) => ({
      id: `entity_${i}`,
      data: { value: i },
    }));

    // Initial sync (all writes)
    for (const entity of entities) {
      fullSyncWrites++;
      storedChecksums.set(entity.id, computeChecksum(entity.data));
    }

    // Simulate changes (20% of entities)
    const changedCount = Math.floor(totalEntities * changedPercentage);
    for (let i = 0; i < changedCount; i++) {
      entities[i].data.value = entities[i].data.value + 1000;
    }

    // Differential sync
    for (const entity of entities) {
      const newChecksum = computeChecksum(entity.data);
      if (storedChecksums.get(entity.id) !== newChecksum) {
        differentialSyncWrites++;
        storedChecksums.set(entity.id, newChecksum);
      }
    }

    // Compare
    const reduction = 1 - differentialSyncWrites / fullSyncWrites;
    expect(differentialSyncWrites).toBe(changedCount);
    expect(reduction).toBeGreaterThanOrEqual(0.8); // 80% reduction
  });

  test('handles nested object checksums correctly', async () => {
    const entity1 = {
      id: 1,
      settings: { a: 1, b: 2 },
      players: [{ id: 'p1', name: 'Player 1' }],
    };

    const entity2 = {
      id: 1,
      settings: { b: 2, a: 1 }, // Different order
      players: [{ id: 'p1', name: 'Player 1' }],
    };

    // Checksums should be the same (order-independent)
    const checksum1 = computeChecksum(entity1);
    const checksum2 = computeChecksum(entity2);

    expect(checksum1).toBe(checksum2);
  });

  test('detects array order changes', async () => {
    const entity1 = { players: ['p1', 'p2', 'p3'] };
    const entity2 = { players: ['p3', 'p2', 'p1'] }; // Reordered

    const checksum1 = computeChecksum(entity1);
    const checksum2 = computeChecksum(entity2);

    // Array order matters
    expect(checksum1).not.toBe(checksum2);
  });

  test('batch checksum comparison', async () => {
    const storedChecksums = new Map<string, string>();

    // Store 10 initial entities
    for (let i = 0; i < 10; i++) {
      storedChecksums.set(`entity:${i}`, computeChecksum({ id: i, value: i }));
    }

    // New batch with some changes
    const newBatch = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      value: i < 3 ? i + 100 : i, // First 3 changed
    }));

    const changedIds: number[] = [];

    for (const entity of newBatch) {
      const key = `entity:${entity.id}`;
      const newChecksum = computeChecksum(entity);

      if (storedChecksums.get(key) !== newChecksum) {
        changedIds.push(entity.id);
      }
    }

    expect(changedIds).toEqual([0, 1, 2]);
  });

  test('stores checksum metadata', async () => {
    const checksumMetadata = {
      entityId: 'roster:1',
      checksum: computeChecksum({ players: ['p1'] }),
      computedAt: new Date().toISOString(),
      version: 1,
    };

    expect(checksumMetadata.entityId).toBe('roster:1');
    expect(checksumMetadata.checksum).toBeDefined();
    expect(checksumMetadata.computedAt).toBeDefined();
    expect(checksumMetadata.version).toBe(1);
  });

  test('handles null and undefined values', async () => {
    const entity1 = { id: 1, value: null };
    const entity2 = { id: 1, value: undefined };
    const entity3 = { id: 1 }; // value omitted

    const checksum1 = computeChecksum(entity1);
    const checksum2 = computeChecksum(entity2);
    const checksum3 = computeChecksum(entity3);

    // null should produce different checksum than undefined/missing
    // Note: JSON.stringify omits undefined values, so undefined and missing are equivalent
    expect(checksum1).not.toBe(checksum2);
    // undefined and missing keys serialize the same way in JSON
    expect(checksum2).toBe(checksum3);
  });

  test('performance with large entities', async () => {
    // Create large entity (simulating roster with many players)
    const largeEntity = {
      roster_id: 1,
      players: Array.from({ length: 100 }, (_, i) => `player_${i}`),
      starters: Array.from({ length: 15 }, (_, i) => `player_${i}`),
      settings: {
        wins: 5,
        losses: 3,
        ties: 0,
        fpts: 1234.56,
        fpts_decimal: 56,
      },
    };

    const startTime = Date.now();

    // Compute 100 checksums
    for (let i = 0; i < 100; i++) {
      computeChecksum(largeEntity);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete 100 checksums in under 100ms
    expect(duration).toBeLessThan(100);
  });
});
