'use client';

import { Info, Trophy, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import type { SleeperLeague } from '@/types/sleeper';

interface LeagueExistsInfo {
  exists: boolean;
  leagueSlug?: string;
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

  const handleJoinExisting = () => {
    if (existsInfo?.leagueSlug && onJoinExisting) {
      onJoinExisting(existsInfo.leagueSlug);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <Card data-testid="league-preview-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-5" />
            Confirm League Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            {league.avatar ? (
              <img
                src={
                  league.avatar.startsWith('http')
                    ? league.avatar
                    : `https://sleepercdn.com/avatars/${league.avatar}`
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
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>
              You are about to connect <strong>{league.name}</strong> to Fantasy Sports HQ. This will sync your league
              data and allow you to access advanced analytics.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onConfirm} className="flex-1">
            Confirm
          </Button>
        </CardFooter>
      </Card>

      {!isChecking && existsInfo?.exists && (
        <Alert role="alert" data-testid="info-message">
          <Info className="size-4" />
          <AlertDescription className="flex flex-col gap-2">
            <span>
              This league already exists in Fantasy Sports HQ. You can join the existing league instead of creating a
              new connection.
            </span>
            <Button variant="outline" size="sm" onClick={handleJoinExisting} className="w-fit">
              Join Existing League
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
