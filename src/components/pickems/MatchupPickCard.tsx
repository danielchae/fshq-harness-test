'use client';

import { Lock } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PickDistribution } from './PickDistribution';
import { UserPicksList } from './UserPicksList';

import type { PickemMatchup, PickemTeam } from '@/types/pickems';

interface MatchupPickCardProps {
  matchup: PickemMatchup;
  selectedTeamId?: string;
  onSelectTeam?: (matchupId: string, teamId: string) => void;
}

function TeamButton({
  team,
  isSelected,
  isLocked,
  onClick,
}: {
  team: PickemTeam;
  isSelected: boolean;
  isLocked: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative">
      {/* Lock icon overlay when locked */}
      {isLocked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/50 backdrop-blur-[1px]">
          <Lock className="h-6 w-6 text-muted-foreground" data-icon="lock" />
        </div>
      )}
      <Button
        variant={isSelected ? 'default' : 'outline'}
        className={cn(
          'flex h-auto w-full flex-col items-center gap-2 p-4 transition-all relative sm:w-auto',
          isSelected && 'ring-2 ring-primary ring-offset-2 selected',
          isLocked && 'cursor-not-allowed opacity-60'
        )}
        onClick={onClick}
        disabled={isLocked}
        aria-pressed={isSelected}
        data-selected={isSelected}
        data-testid={`team-button-${team.id}`}
      >
        <Avatar className="h-12 w-12">
          <AvatarImage src={team.avatarUrl} alt={team.name} />
          <AvatarFallback>{team.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold">Team: {team.name}</span>
        <span className="text-xs text-muted-foreground">@{team.ownerUsername}</span>
        {team.record && (
          <span className="text-xs text-muted-foreground">
            {team.record.wins}-{team.record.losses}
            {team.record.ties > 0 && `-${team.record.ties}`}
          </span>
        )}
        {team.projectedScore && <Badge variant="secondary">{team.projectedScore} pts</Badge>}
      </Button>
    </div>
  );
}

export function MatchupPickCard({ matchup, selectedTeamId, onSelectTeam }: MatchupPickCardProps) {
  const handleSelectTeam = (teamId: string) => {
    if (!matchup.isLocked && onSelectTeam) {
      onSelectTeam(matchup.id, teamId);
    }
  };

  // If no onSelectTeam handler, treat as read-only (locked)
  const isReadOnly = !onSelectTeam;
  const effectivelyLocked = matchup.isLocked || isReadOnly;

  return (
    <Card data-testid="matchup-pick-card" data-locked={matchup.isLocked} className="relative">
      {matchup.isLocked && (
        <div className="absolute right-4 top-4 z-20">
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" data-icon="lock" />
            Locked
          </Badge>
        </div>
      )}

      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <TeamButton
            team={matchup.homeTeam}
            isSelected={selectedTeamId === matchup.homeTeam.id}
            isLocked={effectivelyLocked}
            onClick={() => handleSelectTeam(matchup.homeTeam.id)}
          />

          <div className="flex flex-col items-center gap-1">
            <span className="text-lg font-bold text-muted-foreground">VS</span>
            {!effectivelyLocked && <span className="text-xs text-muted-foreground">Week {matchup.weekNumber}</span>}
          </div>

          <TeamButton
            team={matchup.awayTeam}
            isSelected={selectedTeamId === matchup.awayTeam.id}
            isLocked={effectivelyLocked}
            onClick={() => handleSelectTeam(matchup.awayTeam.id)}
          />
        </div>

        {/* Show distribution and revealed picks for locked matchups */}
        {matchup.isLocked && matchup.distribution && (
          <div className="mt-6 space-y-4 border-t pt-4">
            <PickDistribution
              distribution={matchup.distribution}
              homeTeam={matchup.homeTeam}
              awayTeam={matchup.awayTeam}
            />

            {matchup.picks && matchup.picks.length > 0 && (
              <UserPicksList picks={matchup.picks} homeTeam={matchup.homeTeam} awayTeam={matchup.awayTeam} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
