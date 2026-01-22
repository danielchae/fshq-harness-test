'use client';

import { Crown, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { RoleCard } from './role-card';
import { TeamClaimingInterface } from './team-claiming-interface';
import { TeamSupportSelection } from './team-support-selection';

import type { Team } from '@/data/fixtures/teams';
import { leagueRoute } from '@/types/routes';

export interface RoleSelectionOnboardingProps {
  leagueSlug: string;
  leagueName: string;
  teams: Team[];
}

type SelectedRole = 'manager' | 'fan' | null;

export function RoleSelectionOnboarding({ leagueSlug, leagueName, teams }: RoleSelectionOnboardingProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const handleContinue = useCallback(() => {
    // In production, this would submit the role selection to the backend
    // For now, just navigate to the league feed
    router.push(leagueRoute(leagueSlug));
  }, [router, leagueSlug]);

  const canContinue = selectedRole !== null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">Join {leagueName}</h1>
        <p className="mt-2 text-muted-foreground">Select your role in this league to get started.</p>
      </div>

      {/* Role Selection Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <RoleCard
          role="manager"
          title="Manager"
          description="Claim your team, post updates, and compete in weekly matchups as a team owner."
          icon={<Crown className="h-8 w-8" />}
          isSelected={selectedRole === 'manager'}
          onSelect={() => {
            setSelectedRole('manager');
            setSelectedTeamId(null);
          }}
        />
        <RoleCard
          role="fan"
          title="Fan"
          description="Follow the league action, support your favorite team, and engage with the community."
          icon={<Users className="h-8 w-8" />}
          isSelected={selectedRole === 'fan'}
          onSelect={() => {
            setSelectedRole('fan');
            setSelectedTeamId(null);
          }}
        />
      </div>

      {/* Conditional Team Selection */}
      {selectedRole === 'manager' && (
        <div className="rounded-xl border bg-card p-6">
          <TeamClaimingInterface teams={teams} selectedTeamId={selectedTeamId} onTeamSelect={setSelectedTeamId} />
        </div>
      )}

      {selectedRole === 'fan' && (
        <div className="rounded-xl border bg-card p-6">
          <TeamSupportSelection teams={teams} selectedTeamId={selectedTeamId} onTeamSelect={setSelectedTeamId} />
        </div>
      )}

      {/* Continue Button */}
      <div className="flex justify-center">
        <Button size="lg" disabled={!canContinue} onClick={handleContinue} className="min-w-[200px]">
          Continue
        </Button>
      </div>
    </div>
  );
}
