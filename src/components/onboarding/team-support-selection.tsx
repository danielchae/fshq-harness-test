'use client';

import { Check, Heart, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type { Team } from '@/data/teams/get-teams';

interface TeamSupportSelectionProps {
  teams: Team[];
  selectedTeamId: string | null;
  onTeamSelect: (teamId: string | null) => void;
}

export function TeamSupportSelection({ teams, selectedTeamId, onTeamSelect }: TeamSupportSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams;
    const query = searchQuery.toLowerCase();
    return teams.filter((team) => team.name.toLowerCase().includes(query));
  }, [teams, searchQuery]);

  return (
    <div data-testid="team-support-selection" className="space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold">Choose a Team to Support (Optional)</h3>
        <p className="text-sm text-muted-foreground">
          Select a favorite team to follow. You&apos;ll receive updates and can show your allegiance in posts and
          comments.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search teams..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-2">
        {/* No team selected option */}
        <button
          type="button"
          onClick={() => onTeamSelect(null)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
            selectedTeamId === null
              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
              : 'hover:border-primary/30 hover:bg-accent/50'
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Heart className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium">No Team Preference</p>
            <p className="text-xs text-muted-foreground">Join as a neutral fan</p>
          </div>
          {selectedTeamId === null && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-4 w-4" />
            </div>
          )}
        </button>

        {filteredTeams.map((team) => (
          <TeamSupportCard
            key={team.id}
            team={team}
            isSelected={selectedTeamId === team.id}
            onSelect={() => onTeamSelect(team.id)}
          />
        ))}
      </div>

      {filteredTeams.length === 0 && searchQuery && (
        <p className="py-4 text-center text-sm text-muted-foreground">No teams match your search.</p>
      )}
    </div>
  );
}

interface TeamSupportCardProps {
  team: Team;
  isSelected: boolean;
  onSelect: () => void;
}

function TeamSupportCard({ team, isSelected, onSelect }: TeamSupportCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
        isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'hover:border-primary/30 hover:bg-accent/50'
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={team.avatarUrl} alt={team.name} />
        <AvatarFallback>{team.name.substring(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{team.name}</p>
        <p className="text-xs text-muted-foreground">
          {team.record.wins}-{team.record.losses}
          {team.record.ties > 0 && `-${team.record.ties}`}
        </p>
      </div>
      {isSelected && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </div>
      )}
    </button>
  );
}
