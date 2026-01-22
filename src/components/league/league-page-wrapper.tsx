'use client';

import { useEffect, useState } from 'react';

import { LeagueError } from '@/components/league/league-error';
import { LeagueHeader } from '@/components/league/league-header';
import { LeagueSkeleton } from '@/components/skeletons/league-skeleton';
import { useLeague } from '@/hooks/use-league';

interface LeaguePageWrapperProps {
  slug: string;
  children: React.ReactNode;
}

export function LeaguePageWrapper({ slug, children }: LeaguePageWrapperProps) {
  // Track hydration to prevent server/client mismatch
  const [hasMounted, setHasMounted] = useState(false);
  const { data: league, isLoading, error, refetch } = useLeague({ slug });

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // During SSR and initial hydration, render a consistent skeleton
  // This prevents hydration mismatch since we can't know loading state on server
  if (!hasMounted) {
    return <LeagueSkeleton />;
  }

  if (isLoading) {
    return <LeagueSkeleton />;
  }

  if (error || !league) {
    return <LeagueError error={error || new Error('League not found')} onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <LeagueHeader league={league} />
      {children}
    </div>
  );
}
