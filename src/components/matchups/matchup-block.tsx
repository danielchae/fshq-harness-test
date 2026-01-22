'use client';

import { Check, Star } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { DisplayMatchup, MatchupTeamDisplay } from '@/types/matchups';

interface MatchupBlockProps {
  matchup: DisplayMatchup;
}

interface TeamDisplayProps {
  team: MatchupTeamDisplay;
  isWinner: boolean;
  isComplete: boolean;
  side: 'home' | 'away';
}

function TeamDisplay({ team, isWinner, isComplete, side }: TeamDisplayProps) {
  const isAway = side === 'away';

  return (
    <div
      className={cn(
        'grid items-center gap-4',
        isAway ? 'grid-cols-[auto,1fr] text-right' : 'grid-cols-[1fr,auto] text-left'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 min-w-0',
          isAway ? 'flex-row-reverse justify-start' : 'justify-start'
        )}
      >
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={team.avatarUrl} alt={team.name} />
            <AvatarFallback>{team.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {isWinner && (
            <div
              data-testid="winner-indicator"
              data-winner="true"
              className="absolute -bottom-1 -right-1 rounded-full bg-green-500 p-0.5 text-white"
              aria-label="Winner"
            >
              <Check className="h-3 w-3" />
            </div>
          )}
        </div>
        <div className={cn('flex flex-col min-w-0', isComplete && !isWinner && 'opacity-60', isAway && 'items-end')}>
          <p
            data-testid="team-name"
            className={cn('font-semibold text-sm', isWinner && 'text-green-600')}
          >
            {team.name}
          </p>
          {team.record && (
            <p className="text-xs text-muted-foreground">
              {team.record.wins}-{team.record.losses}
              {team.record.ties > 0 && `-${team.record.ties}`}
            </p>
          )}
          {team.ownerUsername && (
            <p className="text-xs text-muted-foreground truncate">{team.ownerUsername}</p>
          )}
        </div>
      </div>
      {team.score !== undefined && (
        <div
          data-testid="team-score"
          data-score={team.score}
          className={cn(
            'text-2xl font-bold tabular-nums',
            isComplete ? (isWinner ? 'text-green-600' : 'text-muted-foreground') : '',
            isAway && 'justify-self-end'
          )}
        >
          {team.score.toFixed(1)}
        </div>
      )}
    </div>
  );
}

export function MatchupBlock({ matchup }: MatchupBlockProps) {
  const { homeTeam, awayTeam, isComplete, winnerId, isFeatured, hypeText } = matchup;

  const homeIsWinner = isComplete && winnerId === homeTeam.id;
  const awayIsWinner = isComplete && winnerId === awayTeam.id;

  return (
    <Card
      data-testid="matchup-block"
      data-featured={isFeatured}
      className={cn(isFeatured && 'ring-2 ring-yellow-400 featured-matchup')}
    >
      <CardContent className="pt-4">
        {isFeatured && (
          <div className="mb-3 flex items-center gap-2">
            <Badge
              data-testid="featured-badge"
              variant="secondary"
              className="bg-yellow-100 text-yellow-800"
            >
              <Star className="h-3 w-3 mr-1 fill-current" />
              Featured Matchup
            </Badge>
          </div>
        )}

        <div className="space-y-4">
          <TeamDisplay team={awayTeam} isWinner={awayIsWinner} isComplete={isComplete} side="away" />

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">{isComplete ? 'FINAL' : 'vs'}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <TeamDisplay team={homeTeam} isWinner={homeIsWinner} isComplete={isComplete} side="home" />
        </div>

        {isFeatured && hypeText && (
          <div
            data-testid="hype-text"
            data-hype
            className="mt-4 p-3 rounded-lg bg-muted text-sm italic text-muted-foreground"
          >
            &ldquo;{hypeText}&rdquo;
          </div>
        )}
      </CardContent>
    </Card>
  );
}
