import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

import { LeagueHeader } from '@/components/layout/league-header';
import { LeagueSidebar } from '@/components/layout/league-sidebar';
import { PublicAccessBanner } from '@/components/layout/public-access-banner';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getLeague } from '@/data/leagues/get-league';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/auth/get-user-role';
import { checkLeaguePublicAccess } from '@/lib/auth/public-access';
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
  const [league, session, publicAccess] = await Promise.all([
    getLeague({ slug }),
    auth(),
    checkLeaguePublicAccess(slug),
  ]);

  if (!league) {
    notFound();
  }

  const isAuthenticated = !!session?.user?.id;

  // Get user's role for this league (null if not authenticated or not a member)
  const userRole = isAuthenticated ? await getUserRole(slug) : null;

  // Determine if user has member access
  const isMember = !!userRole;

  // If league is private and user is not a member, handle appropriately
  if (!publicAccess.isPublic && !isMember) {
    if (!isAuthenticated) {
      // Redirect to sign-in for private leagues when not authenticated
      redirect(`/sign-in?callbackUrl=/leagues/${slug}`);
    }
    // User is authenticated but not a member of this private league
    notFound();
  }

  // Determine if this is a public visitor (viewing a public league without being a member)
  const isPublicVisitor = publicAccess.isPublic && !isMember;

  return (
    <SidebarProvider>
      <LeagueSidebar
        leagueSlug={league.slug}
        leagueName={league.name}
        leagueAvatarUrl={league.avatarUrl}
        userRole={userRole}
        isPublicVisitor={isPublicVisitor}
      />
      <SidebarInset>
        <LeagueHeader
          leagueName={league.name}
          leagueSlug={league.slug}
          userName={session?.user?.name || undefined}
          userEmail={session?.user?.email || undefined}
          userAvatarUrl={session?.user?.image || undefined}
          isPublicVisitor={isPublicVisitor}
        />
        {isPublicVisitor && <PublicAccessBanner leagueSlug={slug} isAuthenticated={isAuthenticated} />}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
