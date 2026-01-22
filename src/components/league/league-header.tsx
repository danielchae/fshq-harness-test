'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import type { League } from '@/types/league';

interface LeagueHeaderProps {
  league: League;
}

export function LeagueHeader({ league }: LeagueHeaderProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <Avatar className="h-12 w-12">
        <AvatarImage src={league.avatarUrl} alt={league.name} />
        <AvatarFallback>{league.name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div>
        <h1 data-testid="league-name" className="text-xl font-bold">
          {league.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {league.teamCount} teams • {league.season} Season • {league.platform}
        </p>
      </div>
    </div>
  );
}
