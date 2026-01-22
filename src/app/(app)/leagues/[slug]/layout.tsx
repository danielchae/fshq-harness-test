import { notFound } from 'next/navigation';

import { LeagueHeader } from '@/components/layout/league-header';
import { LeagueSidebar } from '@/components/layout/league-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getLeague } from '@/data/leagues/get-league';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/auth/get-user-role';
import { createLeagueMetadata } from '@/lib/metadata';

import type { Metadata } from 'next';

interface LeagueLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const league = await getLeague({ slug });

  if (!league) {
    return {
      title: 'League Not Found',
    };
  }

  return createLeagueMetadata({
    leagueName: league.name,
    pageTitle: 'League Home',
    description: `${league.name} on FSHQ.gg - View feed, pick'ems, leaderboards, and more`,
    slug: league.slug,
  });
}

export default async function LeagueLayout({ children, params }: LeagueLayoutProps) {
  const { slug } = await params;

  // Fetch league data and user session in parallel
  const [league, session] = await Promise.all([
    getLeague({ slug }),
    auth(),
  ]);

  if (!league) {
    notFound();
  }

  // Get user's role for this league
  const userRole = await getUserRole(slug);

  return (
    <SidebarProvider>
      <LeagueSidebar
        leagueSlug={league.slug}
        leagueName={league.name}
        leagueAvatarUrl={league.avatarUrl}
        userRole={userRole}
      />
      <SidebarInset>
        <LeagueHeader
          leagueName={league.name}
          leagueSlug={league.slug}
          userName={session?.user?.name || undefined}
          userEmail={session?.user?.email || undefined}
          userAvatarUrl={session?.user?.image || undefined}
        />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
