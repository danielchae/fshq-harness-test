import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      // Only set executablePath when env var is provided (Docker)
      // Otherwise let Playwright find/download its own browser (local dev)
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      }),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    }
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests/e2e/fixtures',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      testDir: './tests/e2e/generated',
      use: {
        ...devices['Desktop Chrome'],
        hasTouch: true,
        storageState: 'tests/e2e/fixtures/auth.json'
      },
      dependencies: ['setup']
    }
  ],
  webServer: {
    command: 'echo "Using existing dev server on port 3000"',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 5000
  }
});
