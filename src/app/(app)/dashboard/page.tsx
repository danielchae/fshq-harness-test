import { redirect } from 'next/navigation';

import { getUserLeagues } from '@/data/leagues/get-user-leagues';
import { auth } from '@/lib/auth';
import { createMetadata } from '@/lib/metadata';
import { leagueRoute } from '@/types/routes';

export const metadata = createMetadata({
  title: 'Dashboard',
  description: 'Your FSHQ.gg dashboard - View your leagues, recent activity, and quick actions',
  path: '/dashboard',
});

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Fetch user's leagues to determine where to redirect
  const leagues = await getUserLeagues(userId);
  const firstLeague = leagues[0];

  if (!firstLeague) {
    // No leagues - redirect to connect a league
    redirect('/connect-league');
  } else {
    // Has leagues - redirect to their most recent league's feed
    redirect(leagueRoute(firstLeague.slug));
  }
}
