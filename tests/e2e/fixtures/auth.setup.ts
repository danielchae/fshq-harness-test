import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, 'auth.json');

setup('authenticate test user', async ({ page, context }) => {
  const baseURL = 'http://localhost:3000';
  
  // Step 1: Get CSRF token from NextAuth
  const csrfResponse = await context.request.get(`${baseURL}/api/auth/csrf`);
  const csrfData = await csrfResponse.json();
  const csrfToken = csrfData.csrfToken;
  
  // Step 2: Authenticate via NextAuth credentials API directly
  // This bypasses UI form issues with React controlled inputs
  await context.request.post(`${baseURL}/api/auth/callback/credentials`, {
    form: {
      csrfToken,
      email: 'test@samus.ai',
      password: '12345',
      json: 'true',
    },
  });
  
  // Step 3: Verify authentication succeeded
  const sessionResponse = await context.request.get(`${baseURL}/api/auth/session`);
  const session = await sessionResponse.json();
  
  if (!session?.user?.email) {
    throw new Error('Authentication failed - no session created');
  }
  
  // Step 4: Navigate to dashboard to populate page cookies
  await page.goto(`${baseURL}/dashboard`, { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/dashboard/);
  
  // Step 5: Save auth state
  await page.context().storageState({ path: authFile });
});
