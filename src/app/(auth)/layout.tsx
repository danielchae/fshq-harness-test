import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Check for test auth token (used in E2E tests)
  const cookieStore = await cookies();
  const testAuthToken = cookieStore.get('auth-token')?.value;

  // If user is already authenticated, redirect to dashboard
  if (session?.user || testAuthToken) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex h-14 items-center px-6">
        <Link href="/" className="text-sm font-medium text-foreground hover:text-foreground/80">
          ← Back to home
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
