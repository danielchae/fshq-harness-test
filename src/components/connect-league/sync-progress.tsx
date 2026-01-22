'use client';

import { AlertTriangle, CheckCircle, HelpCircle, Loader2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import type { SleeperLeague } from '@/types/sleeper';
import type { SyncResult, SyncState } from '@/types/sync';

interface SyncProgressProps {
  league: SleeperLeague;
  onComplete?: (leagueSlug?: string) => void;
  onContinue?: (leagueSlug?: string) => void;
}

interface SyncStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

const SYNC_STEPS: Omit<SyncStep, 'status'>[] = [
  { id: 'league', label: 'Syncing league settings' },
  { id: 'rosters', label: 'Importing team rosters' },
  { id: 'users', label: 'Loading league members' },
  { id: 'complete', label: 'Finalizing connection' },
];

export function SyncProgress({ league, onComplete, onContinue }: SyncProgressProps) {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [steps, setSteps] = useState<SyncStep[]>(SYNC_STEPS.map((step) => ({ ...step, status: 'pending' as const })));
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Initializing sync...');
  const [result, setResult] = useState<SyncResult | null>(null);
  const syncStartedRef = useRef(false);

  const startSync = useCallback(async () => {
    if (syncStartedRef.current) return;
    syncStartedRef.current = true;

    setSyncState('syncing');

    try {
      // Simulate progress through steps
      for (let i = 0; i < SYNC_STEPS.length; i++) {
        // Set current step to in_progress
        setSteps((prev) =>
          prev.map((step, idx) => ({
            ...step,
            status: idx === i ? 'in_progress' : idx < i ? 'completed' : 'pending',
          }))
        );
        setProgress(((i + 0.5) / SYNC_STEPS.length) * 100);
        const currentStep = SYNC_STEPS[i];
        if (currentStep) {
          setStatusMessage(currentStep.label);
        }

        // Wait for "sync" step to complete
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Mark as completed
        setSteps((prev) =>
          prev.map((step, idx) => ({
            ...step,
            status: idx <= i ? 'completed' : 'pending',
          }))
        );
        setProgress(((i + 1) / SYNC_STEPS.length) * 100);
      }

      // Call actual sync API
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleeperLeagueId: league.league_id || league.id }),
      });

      const data: SyncResult = await response.json();
      setResult(data);

      if (!response.ok) {
        // Complete failure (500 error)
        setSyncState('error');
        setSteps((prev) =>
          prev.map((step) => ({
            ...step,
            status: step.status === 'completed' ? 'failed' : step.status,
          }))
        );
      } else if (data.success) {
        // Success
        setSyncState('success');
        setStatusMessage('Sync complete!');
      } else if (data.partial) {
        // Partial failure
        setSyncState('partial');
        setSteps((prev) =>
          prev.map((step, idx) => ({
            ...step,
            status: idx < prev.length - 1 ? 'completed' : 'failed',
          }))
        );
      } else {
        // Other failure
        setSyncState('error');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncState('error');
      setResult({
        success: false,
        error: 'Sync failed completely',
      });
    }
  }, [league.league_id, league.id]);

  useEffect(() => {
    startSync();
  }, [startSync]);

  const handleRetry = () => {
    syncStartedRef.current = false;
    setSyncState('idle');
    setProgress(0);
    setResult(null);
    setSteps(SYNC_STEPS.map((step) => ({ ...step, status: 'pending' as const })));
    setStatusMessage('Initializing sync...');
    startSync();
  };

  const handleGoToLeague = () => {
    if (result?.leagueSlug) {
      onComplete?.(result.leagueSlug);
    } else {
      onComplete?.();
    }
  };

  const handleContinue = () => {
    if (result?.leagueSlug) {
      onContinue?.(result.leagueSlug);
    } else {
      onContinue?.();
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4" data-testid="sync-progress">
      <Card>
        <CardHeader>
          <CardTitle>Connecting {league.name}</CardTitle>
          <CardDescription>
            {syncState === 'syncing'
              ? 'Please wait while we sync your league data...'
              : syncState === 'success'
                ? 'Your league has been connected successfully!'
                : syncState === 'partial'
                  ? 'Some data could not be imported.'
                  : syncState === 'error'
                    ? 'There was a problem syncing your league.'
                    : 'Preparing to sync...'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <Progress
              value={progress}
              className="h-2"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              data-testid="sync-progress-bar"
            />
            <p className="text-sm text-muted-foreground text-center" data-testid="sync-status">
              {statusMessage} ({Math.round(progress)}%)
            </p>
          </div>

          {/* Step list */}
          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-3">
                {step.status === 'completed' ? (
                  <CheckCircle className="size-5 text-green-500" />
                ) : step.status === 'failed' ? (
                  <XCircle className="size-5 text-destructive" />
                ) : step.status === 'in_progress' ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <div className="size-5 rounded-full border-2 border-muted" />
                )}
                <span
                  className={
                    step.status === 'completed'
                      ? 'text-muted-foreground'
                      : step.status === 'failed'
                        ? 'text-destructive'
                        : step.status === 'in_progress'
                          ? 'font-medium'
                          : 'text-muted-foreground'
                  }
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Success state */}
      {syncState === 'success' && result && (
        <Card className="border-green-500/50 bg-gradient-to-br from-green-500/10 via-background to-emerald-500/10 overflow-hidden">
          <CardContent className="pt-8 pb-6 text-center space-y-6">
            {/* Success icon with glow effect */}
            <div className="relative mx-auto w-fit">
              <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl scale-150" />
              <div className="relative flex items-center justify-center size-20 rounded-full bg-green-500/20 ring-4 ring-green-500/30">
                <CheckCircle className="size-10 text-green-500" />
              </div>
            </div>

            {/* Success message */}
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">You&apos;re All Set!</h3>
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">{league.name}</span> has been connected successfully.
              </p>
            </div>

            {/* Stats summary */}
            {result.message && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 text-sm text-muted-foreground">
                <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                {result.message}
              </div>
            )}

            {/* CTA Button */}
            <Button onClick={handleGoToLeague} size="lg" className="w-full max-w-xs mx-auto gap-2">
              Enter Your League
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Partial failure state */}
      {syncState === 'partial' && result && (
        <Alert role="alert" className="border-yellow-500 bg-yellow-50">
          <AlertTriangle className="size-4 text-yellow-600" />
          <AlertTitle>Partial Import</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{result.message || 'Some data could not be imported.'}</p>
            <p className="text-sm text-muted-foreground">You can continue with the imported data or retry the sync.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRetry}>
                Retry
              </Button>
              <Button onClick={handleContinue}>Continue</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Complete failure state */}
      {syncState === 'error' && (
        <Alert role="alert" variant="destructive">
          <XCircle className="size-4" />
          <AlertTitle>Sync Failed</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{result?.error || 'We were unable to sync your league data.'}</p>
            <p className="text-sm">
              Please try again. If the problem persists,{' '}
              <a href="/support" className="underline font-medium">
                contact support
              </a>{' '}
              for help.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRetry}>
                Retry
              </Button>
              <Button variant="secondary" asChild>
                <a href="/support">
                  <HelpCircle className="size-4 mr-2" />
                  Get Help
                </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
