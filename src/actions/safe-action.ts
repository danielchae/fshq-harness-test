import { createSafeActionClient } from 'next-safe-action';

import { auth } from '@/lib/auth';

// Base action client (no auth required)
export const actionClient = createSafeActionClient({
  handleServerError: (error) => {
    console.error('Action error:', error);
    return 'An unexpected error occurred';
  },
});

// Authenticated action client
export const authActionClient = actionClient.use(async ({ next }) => {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  return next({
    ctx: {
      userId: session.user.id,
      user: session.user,
    },
  });
});
