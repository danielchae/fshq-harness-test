'use client';

import { CheckCircle, Clock, Info, Loader2, Trophy, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import type { SleeperLeague } from '@/types/sleeper';

interface LeagueExistsInfo {
  exists: boolean;
  leagueSlug?: string;
  leagueName?: string;
  joinRule?: 'auto_join' | 'approval_required';
  visibility?: 'public' | 'private';
}

interface LeaguePreviewCardProps {
  league: SleeperLeague;
  onConfirm: () => void;
  onBack: () => void;
  onJoinExisting?: (leagueSlug: string) => void;
}

export function LeaguePreviewCard({ league, onConfirm, onBack, onJoinExisting }: LeaguePreviewCardProps) {
  const [existsInfo, setExistsInfo] = useState<LeagueExistsInfo | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joinResult, setJoinResult] = useState<{
    success: boolean;
    status?: string;
    message: string;
  } | null>(null);

  const leagueId = league.league_id || league.id;

  useEffect(() => {
    const checkLeagueExists = async () => {
      setIsChecking(true);
      try {
        const response = await fetch(`/api/leagues/check-exists?sleeper_league_id=${leagueId}`);
        if (response.ok) {
          const data = await response.json();
          setExistsInfo(data);
        } else {
          setExistsInfo({ exists: false });
        }
      } catch (error) {
        console.error('Error checking league existence:', error);
        setExistsInfo({ exists: false });
      } finally {
        setIsChecking(false);
      }
    };

    checkLeagueExists();
  }, [leagueId]);

  const handleJoinExisting = async () => {
    if (!existsInfo?.leagueSlug) return;

    setIsJoining(true);
    setJoinResult(null);

    try {
      const response = await fetch(`/api/leagues/${existsInfo.leagueSlug}/join`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        setJoinResult({
          success: true,
          status: result.status,
          message: result.message,
        });

        // If joined or already a member, navigate after a brief delay
        if (result.status === 'joined' || result.status === 'already_member') {
          setTimeout(() => {
            if (onJoinExisting) {
              onJoinExisting(existsInfo.leagueSlug!);
            }
          }, 1500);
        }
      } else {
        setJoinResult({
          success: false,
          message: result.message || 'Failed to join league',
        });
      }
    } catch (error) {
      console.error('Error joining league:', error);
      setJoinResult({
        success: false,
        message: 'Failed to join league. Please try again.',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const leagueExists = !isChecking && existsInfo?.exists;

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <Card data-testid="league-preview-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5" />
            {leagueExists ? 'Join League' : 'Confirm League Connection'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            {league.avatar ? (
              <img
                src={
                  league.avatar.startsWith('http') ? league.avatar : `https://sleepercdn.com/avatars/${league.avatar}`
                }
                alt={league.name}
                className="size-16 rounded-lg object-cover"
              />
            ) : (
              <div className="size-16 rounded-lg bg-muted flex items-center justify-center">
                <Trophy className="size-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-semibold">{league.name}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="size-3" />
                  {league.total_rosters || league.team_count} teams
                </Badge>
                <Badge variant="outline">{league.season}</Badge>
                {league.status && (
                  <Badge variant="outline" className="capitalize">
                    {league.status.replace('_', ' ')}
                  </Badge>
                )}
                {leagueExists && (
                  <Badge variant="default" className="bg-green-600">
                    Already on FSHQ
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {leagueExists ? (
              <p>
                <strong>{league.name}</strong> is already on Fantasy Sports HQ.{' '}
                {existsInfo?.joinRule === 'auto_join'
                  ? 'You can join instantly and start using advanced analytics.'
                  : 'Request to join and the commissioner will review your request.'}
              </p>
            ) : (
              <p>
                You are about to connect <strong>{league.name}</strong> to Fantasy Sports HQ. This will sync your league
                data and allow you to access advanced analytics.
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button variant="outline" onClick={onBack} disabled={isJoining}>
            Back
          </Button>
          {leagueExists ? (
            <Button
              onClick={handleJoinExisting}
              className="flex-1"
              disabled={isJoining || joinResult?.success}
            >
              {isJoining ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Joining...
                </>
              ) : joinResult?.success ? (
                <>
                  <CheckCircle className="mr-2 size-4" />
                  {joinResult.status === 'pending' ? 'Request Sent' : 'Joined!'}
                </>
              ) : existsInfo?.joinRule === 'auto_join' ? (
                'Join League'
              ) : (
                'Request to Join'
              )}
            </Button>
          ) : (
            <Button onClick={onConfirm} className="flex-1" disabled={isChecking}>
              {isChecking ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Connect League'
              )}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Success/Pending Message */}
      {joinResult?.success && (
        <Alert
          role="alert"
          data-testid="join-result-message"
          className={joinResult.status === 'pending' ? 'border-yellow-500' : 'border-green-500'}
        >
          {joinResult.status === 'pending' ? (
            <Clock className="size-4 text-yellow-500" />
          ) : (
            <CheckCircle className="size-4 text-green-500" />
          )}
          <AlertTitle>
            {joinResult.status === 'pending' ? 'Request Submitted' : 'Success!'}
          </AlertTitle>
          <AlertDescription>{joinResult.message}</AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {joinResult && !joinResult.success && (
        <Alert role="alert" variant="destructive" data-testid="join-error-message">
          <Info className="size-4" />
          <AlertTitle>Could not join league</AlertTitle>
          <AlertDescription>{joinResult.message}</AlertDescription>
        </Alert>
      )}

      {/* Info for new leagues that will be synced */}
      {!leagueExists && !isChecking && (
        <Alert role="alert" data-testid="info-message" className="border-blue-500/50 bg-blue-500/10">
          <Info className="size-4 text-blue-500" />
          <AlertDescription>
            You&apos;ll become the commissioner of this league on FSHQ. Other members can join later by searching for the
            league or using the same Sleeper username.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
