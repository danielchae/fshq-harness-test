import { Home, Trophy } from 'lucide-react';
import Link from 'next/link';

import { UserMenu } from '@/components/connect-league/user-menu';
import { Button } from '@/components/ui/button';
import { getUserLeagues } from '@/data/leagues/get-user-leagues';
import { auth } from '@/lib/auth';
import { leagueRoute } from '@/types/routes';

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;
  const leagues = await getUserLeagues(userId);
  const hasLeagues = leagues.length > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9">
            <Link href="/">
              <Home className="h-4 w-4" />
              <span className="sr-only">Home</span>
            </Link>
          </Button>
          {hasLeagues && (
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <Link href={leagueRoute(leagues[0].slug)}>
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">{leagues[0].name}</span>
              </Link>
            </Button>
          )}
        </div>
        <UserMenu
          userName={session?.user?.name || undefined}
          userEmail={session?.user?.email || undefined}
          userAvatarUrl={session?.user?.image || undefined}
        />
      </header>
      <main className="container mx-auto flex-1 py-8 px-4">
        {children}
      </main>
    </div>
  );
}
