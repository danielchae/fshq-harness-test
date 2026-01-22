import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Check for test auth token (used in E2E tests)
  // MOCK: Backend will rely solely on NextAuth sessions
  const cookieStore = await cookies();
  const testAuthToken = cookieStore.get('auth-token')?.value;

  // Allow access if either NextAuth session or test token exists
  if (!session?.user && !testAuthToken) {
    redirect('/sign-in');
  }

  return <div className="min-h-screen bg-background">{children}</div>;
}
