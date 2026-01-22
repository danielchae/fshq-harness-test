'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

import type { PickemTeam, RevealedPick } from '@/types/pickems';

interface UserPicksListProps {
  picks: RevealedPick[];
  homeTeam: PickemTeam;
  awayTeam: PickemTeam;
  className?: string;
}

export function UserPicksList({ picks, homeTeam, awayTeam, className }: UserPicksListProps) {
  // Group picks by team
  const homeTeamPicks = picks.filter((p) => p.teamId === homeTeam.id);
  const awayTeamPicks = picks.filter((p) => p.teamId === awayTeam.id);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Home team picks */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Picked {homeTeam.name}:</p>
        <div className="flex flex-wrap gap-1">
          {homeTeamPicks.map((pick) => (
            <div
              key={pick.userId}
              data-testid="user-pick"
              data-user-pick={pick.userId}
              data-picked-team={pick.teamId}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5"
            >
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-[10px]">{pick.userName.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-xs">{pick.userName}</span>
            </div>
          ))}
          {homeTeamPicks.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
        </div>
      </div>

      {/* Away team picks */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Picked {awayTeam.name}:</p>
        <div className="flex flex-wrap gap-1">
          {awayTeamPicks.map((pick) => (
            <div
              key={pick.userId}
              data-testid="user-pick"
              data-user-pick={pick.userId}
              data-picked-team={pick.teamId}
              className="flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5"
            >
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-[10px]">{pick.userName.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="text-xs">{pick.userName}</span>
            </div>
          ))}
          {awayTeamPicks.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
        </div>
      </div>
    </div>
  );
}
