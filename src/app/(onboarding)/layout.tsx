import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

// Onboarding layout - minimal shell without league sidebar
// Used for role selection flow before user has joined the league
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto py-8 px-4">{children}</main>
    </div>
  );
}
