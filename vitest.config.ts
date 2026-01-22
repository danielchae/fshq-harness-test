import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/backend/**/*.test.ts'],
    setupFiles: ['tests/backend/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['verbose', 'json'],
    outputFile: {
      json: 'test-results/vitest-results.json'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
