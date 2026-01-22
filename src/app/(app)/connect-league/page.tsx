'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { LeagueIdInput } from '@/components/connect-league/league-id-input';
import { LeaguePreviewCard } from '@/components/connect-league/league-preview-card';
import { SyncProgress } from '@/components/connect-league/sync-progress';
import { leagueRoute } from '@/types/routes';

import type { SleeperLeague } from '@/types/sleeper';

type WizardStep = 'input' | 'confirmation' | 'sync';

export default function ConnectLeaguePage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('input');
  const [selectedLeague, setSelectedLeague] = useState<SleeperLeague | null>(null);
  const [savedUsername, setSavedUsername] = useState('');

  const handleLeagueSelect = useCallback((league: SleeperLeague) => {
    setSelectedLeague(league);
    setStep('confirmation');
  }, []);

  const handleConfirm = useCallback(() => {
    setStep('sync');
  }, []);

  const handleBack = useCallback(() => {
    setStep('input');
    // Keep selectedLeague so we can re-select if needed, but clear it
    setSelectedLeague(null);
  }, []);

  const handleJoinExisting = useCallback(
    (leagueSlug: string) => {
      // Navigate to the existing league
      router.push(leagueRoute(leagueSlug));
    },
    [router]
  );

  const handleSyncComplete = useCallback(
    (leagueSlug?: string) => {
      if (leagueSlug) {
        router.push(leagueRoute(leagueSlug));
      } else {
        router.push('/dashboard');
      }
    },
    [router]
  );

  const handleSyncContinue = useCallback(
    (leagueSlug?: string) => {
      // For partial success, also navigate to the league
      if (leagueSlug) {
        router.push(leagueRoute(leagueSlug));
      } else {
        router.push('/dashboard');
      }
    },
    [router]
  );

  // Track username changes for back navigation
  const handleUsernameChange = useCallback((username: string) => {
    setSavedUsername(username);
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Connect Your League</h1>
        <p className="text-muted-foreground">Link your fantasy league to access advanced features and analytics.</p>
      </div>

      {step === 'input' && (
        <LeagueIdInputWrapper
          initialUsername={savedUsername}
          onLeagueSelect={handleLeagueSelect}
          onUsernameChange={handleUsernameChange}
        />
      )}

      {step === 'confirmation' && selectedLeague && (
        <LeaguePreviewCard
          league={selectedLeague}
          onConfirm={handleConfirm}
          onBack={handleBack}
          onJoinExisting={handleJoinExisting}
        />
      )}

      {step === 'sync' && selectedLeague && (
        <SyncProgress league={selectedLeague} onComplete={handleSyncComplete} onContinue={handleSyncContinue} />
      )}
    </div>
  );
}

// Wrapper component to track username changes
interface LeagueIdInputWrapperProps {
  initialUsername: string;
  onLeagueSelect: (league: SleeperLeague) => void;
  onUsernameChange: (username: string) => void;
}

function LeagueIdInputWrapper({ initialUsername, onLeagueSelect, onUsernameChange }: LeagueIdInputWrapperProps) {
  const handleLeagueSelect = useCallback(
    (league: SleeperLeague) => {
      // Get the username from the input before transitioning
      const input = document.querySelector<HTMLInputElement>('input[name="username"]');
      if (input) {
        onUsernameChange(input.value);
      }
      onLeagueSelect(league);
    },
    [onLeagueSelect, onUsernameChange]
  );

  return <LeagueIdInput initialUsername={initialUsername} onLeagueSelect={handleLeagueSelect} />;
}
