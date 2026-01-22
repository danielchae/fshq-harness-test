'use client';

import { Check, Loader2, Search, User } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type { Team } from '@/data/teams/get-teams';

interface TeamClaimingInterfaceProps {
  teams: Team[];
  selectedTeamId: string | null;
  onTeamSelect: (teamId: string) => void;
  onClaimSuccess?: (team: Team) => void;
}

type ClaimState = 'idle' | 'validating' | 'claiming' | 'success' | 'error';

export function TeamClaimingInterface({
  teams,
  selectedTeamId,
  onTeamSelect,
  onClaimSuccess,
}: TeamClaimingInterfaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [claimState, setClaimState] = useState<ClaimState>('idle');
  const [claimingTeamId, setClaimingTeamId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [claimedTeamId, setClaimedTeamId] = useState<string | null>(null);

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams;
    const query = searchQuery.toLowerCase();
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(query) ||
        team.ownerUsername.toLowerCase().includes(query) ||
        (team.sleeperUsername?.toLowerCase().includes(query) ?? false)
    );
  }, [teams, searchQuery]);

  const availableTeams = filteredTeams.filter((team) => !team.isClaimed && team.id !== claimedTeamId);
  const claimedTeams = filteredTeams.filter((team) => team.isClaimed || team.id === claimedTeamId);

  const handleTeamClick = useCallback(
    async (team: Team) => {
      if (team.isClaimed || team.id === claimedTeamId) return;

      setClaimingTeamId(team.id);
      setClaimState('validating');
      setErrorMessage(null);

      try {
        // Step 1: Validate the claim against Sleeper identity
        const validateResponse = await fetch('/api/validate-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: team.id,
            userSleeperUsername: team.sleeperUsername, // In production, this would come from the user's connected Sleeper account
            leagueSlug: 'test-league',
          }),
        });

        const validateResult = await validateResponse.json();

        if (!validateResult.valid) {
          setClaimState('error');
          setErrorMessage(validateResult.message || 'Validation failed');
          return;
        }

        // Step 2: Claim the team
        setClaimState('claiming');
        const claimResponse = await fetch('/api/claim-team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            teamId: team.id,
            leagueSlug: 'test-league',
          }),
        });

        const claimResult = await claimResponse.json();

        if (!claimResult.success) {
          setClaimState('error');
          setErrorMessage(claimResult.message || 'Failed to claim team');
          return;
        }

        // Success!
        setClaimState('success');
        setClaimedTeamId(team.id);
        onTeamSelect(team.id);
        onClaimSuccess?.(claimResult.team || team);
      } catch (error) {
        console.error('Error claiming team:', error);
        setClaimState('error');
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    },
    [claimedTeamId, onTeamSelect, onClaimSuccess]
  );

  const isProcessing = claimState === 'validating' || claimState === 'claiming';

  return (
    <div data-testid="team-claiming-interface" className="space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold">Claim Your Team</h3>
        <p className="text-sm text-muted-foreground">
          Select the team you own from the list below. Your Sleeper username should match the team owner.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by team name or Sleeper username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error message */}
      {claimState === 'error' && errorMessage && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Success message */}
      {claimState === 'success' && (
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700">
          Team claimed successfully! You can now proceed.
        </div>
      )}

      <div className="space-y-3">
        {availableTeams.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Available to Claim</p>
            <div className="grid gap-2">
              {availableTeams.map((team) => (
                <TeamClaimCard
                  key={team.id}
                  team={team}
                  isSelected={selectedTeamId === team.id || claimedTeamId === team.id}
                  isValidating={claimingTeamId === team.id && claimState === 'validating'}
                  isClaiming={claimingTeamId === team.id && claimState === 'claiming'}
                  isSuccess={claimedTeamId === team.id && claimState === 'success'}
                  onSelect={() => handleTeamClick(team)}
                  disabled={isProcessing}
                  claimed={false}
                />
              ))}
            </div>
          </div>
        )}

        {claimedTeams.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Already Claimed</p>
            <div className="grid gap-2">
              {claimedTeams.map((team) => (
                <TeamClaimCard
                  key={team.id}
                  team={team}
                  isSelected={false}
                  isValidating={false}
                  isClaiming={false}
                  isSuccess={team.id === claimedTeamId}
                  onSelect={() => undefined}
                  disabled={true}
                  claimed={true}
                />
              ))}
            </div>
          </div>
        )}

        {filteredTeams.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No teams match your search.</p>
        )}
      </div>
    </div>
  );
}

interface TeamClaimCardProps {
  team: Team;
  isSelected: boolean;
  isValidating: boolean;
  isClaiming: boolean;
  isSuccess: boolean;
  onSelect: () => void;
  disabled: boolean;
  claimed: boolean;
}

function TeamClaimCard({
  team,
  isSelected,
  isValidating,
  isClaiming,
  isSuccess,
  onSelect,
  disabled,
  claimed,
}: TeamClaimCardProps) {
  const isProcessing = isValidating || isClaiming;

  return (
    <div data-testid="team-card" className="relative">
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled || claimed}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
          claimed || disabled
            ? 'cursor-not-allowed opacity-60 bg-muted/30'
            : isSelected || isSuccess
              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
              : 'hover:border-primary/30 hover:bg-accent/50'
        )}
      >
        <Avatar className="h-10 w-10" data-testid="team-logo">
          <AvatarImage src={team.avatarUrl} alt={team.name} />
          <AvatarFallback>{team.name.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{team.name}</p>
            {claimed && (
              <Badge variant="secondary" className="text-xs" data-testid="claimed-badge">
                Claimed
              </Badge>
            )}
            {isSuccess && !claimed && (
              <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600">
                Claimed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{team.sleeperUsername}</span>
            <span className="mx-1">•</span>
            <span>
              {team.record.wins}-{team.record.losses}
              {team.record.ties > 0 && `-${team.record.ties}`}
            </span>
          </div>
        </div>
        {isProcessing && (
          <div data-testid="validation-spinner" role="status" className="flex h-6 w-6 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="sr-only">{isValidating ? 'Validating claim...' : 'Claiming team...'}</span>
          </div>
        )}
        {(isSelected || isSuccess) && !isProcessing && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-4 w-4" />
          </div>
        )}
      </button>
    </div>
  );
}
