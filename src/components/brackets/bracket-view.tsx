'use client';

import { AlertCircle, CalendarClock, RefreshCw, Trophy } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBracket } from '@/hooks/use-bracket';
import { cn } from '@/lib/utils';
import { BracketRound } from './bracket-round';
import { SeasonSelector } from './season-selector';

import type { PlayoffBracket } from '@/types/brackets';

interface BracketViewProps {
  leagueSlug: string;
  initialSeason?: number;
}

export function BracketView({ leagueSlug, initialSeason }: BracketViewProps) {
  const { data, isLoading, error, retry } = useBracket(leagueSlug, initialSeason);
  const [selectedSeason, setSelectedSeason] = useState<number | undefined>(initialSeason);

  const handleSeasonChange = (season: number) => {
    setSelectedSeason(season);
  };

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="bracket-view" className="space-y-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading bracket...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div data-testid="bracket-view" className="space-y-4">
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center min-h-[200px] gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Unable to load bracket</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button variant="outline" onClick={retry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pre-playoffs state
  if (!data?.hasStarted || !data?.bracket) {
    return (
      <div data-testid="bracket-view" className="space-y-4">
        {/* Season Selector for historical viewing */}
        {data?.availableSeasons && data.availableSeasons.length > 1 && (
          <div className="flex justify-end">
            <SeasonSelector
              seasons={data.availableSeasons}
              selectedSeason={selectedSeason || data.season}
              onSeasonChange={handleSeasonChange}
            />
          </div>
        )}
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
            <CalendarClock className="h-16 w-16 text-muted-foreground" />
            <div>
              <p className="font-semibold text-lg">Playoffs Haven&apos;t Started Yet</p>
              <p className="text-muted-foreground mt-1">Playoffs begin Week {data?.playoffsStartWeek || 'TBD'}</p>
            </div>
            <Badge variant="secondary" className="text-sm">
              Current Week: {data?.currentWeek || 'Regular Season'}
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { bracket, consolationBracket, hasConsolation, availableSeasons, season } = data;
  const showConsolationTab = hasConsolation && consolationBracket;

  return (
    <div data-testid="bracket-view" className="space-y-4">
      {/* Header with Season Selector */}
      {availableSeasons && availableSeasons.length > 1 && (
        <div className="flex justify-end">
          <SeasonSelector
            seasons={availableSeasons}
            selectedSeason={selectedSeason || season}
            onSeasonChange={handleSeasonChange}
          />
        </div>
      )}

      {/* Champion Banner (if playoffs complete) */}
      {bracket.champion && (
        <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
          <CardContent className="flex items-center justify-center gap-4 py-4">
            <Trophy className="h-8 w-8 text-amber-500" data-icon="trophy" />
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={bracket.champion.avatarUrl} alt={`${bracket.champion.name} logo`} />
                <AvatarFallback>{bracket.champion.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-lg">{bracket.champion.name}</p>
                <p className="text-sm text-muted-foreground">{bracket.season} League Champion</p>
              </div>
            </div>
            <Trophy className="h-8 w-8 text-amber-500" data-icon="trophy" />
          </CardContent>
        </Card>
      )}

      {/* Bracket Tabs (Winners / Consolation) */}
      {showConsolationTab ? (
        <Tabs defaultValue="winners" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="winners">
              <Trophy className="h-4 w-4 mr-2" />
              Winners Bracket
            </TabsTrigger>
            <TabsTrigger value="consolation">Consolation Bracket</TabsTrigger>
          </TabsList>

          <TabsContent value="winners" data-bracket="winners">
            <BracketDisplay bracket={bracket} currentWeek={data.currentWeek} />
          </TabsContent>

          <TabsContent value="consolation" data-testid="consolation-bracket" data-bracket="consolation">
            <BracketDisplay
              bracket={consolationBracket}
              currentWeek={data.currentWeek}
              isConsolation
            />
          </TabsContent>
        </Tabs>
      ) : (
        // Single bracket view (no consolation)
        <div data-bracket="winners">
          <BracketDisplay bracket={bracket} currentWeek={data.currentWeek} />
        </div>
      )}

      {/* Bracket Info Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
        <span>Season {bracket.season} Playoffs</span>
        <span>Week {data.currentWeek}</span>
      </div>
    </div>
  );
}

// Internal component for rendering bracket display
interface BracketDisplayProps {
  bracket: PlayoffBracket;
  currentWeek: number;
  isConsolation?: boolean;
}

function BracketDisplay({ bracket, isConsolation = false }: BracketDisplayProps) {
  const isChampionshipRound = (index: number) => index === bracket.rounds.length - 1;

  return (
    <div className="space-y-4">
      {/* Consolation Champion Banner */}
      {isConsolation && bracket.champion && (
        <Card className="bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200">
          <CardContent className="flex items-center justify-center gap-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={bracket.champion.avatarUrl} alt={`${bracket.champion.name} logo`} />
                <AvatarFallback>{bracket.champion.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{bracket.champion.name}</p>
                <p className="text-xs text-muted-foreground">5th Place Winner</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bracket Display - CSS-first responsive approach to avoid hydration mismatch */}
      {/* Mobile: Vertical stacked layout */}
      <div className="flex flex-col gap-2 md:hidden">
        {bracket.rounds.map((round) => (
          <Card key={round.index} className="overflow-hidden py-0">
            <BracketRound
              round={round}
              isChampionship={isChampionshipRound(round.index) && !isConsolation}
              isMobile={true}
              bracketType={bracket.type}
            />
          </Card>
        ))}
      </div>

      {/* Desktop: Horizontal bracket layout */}
      <div className="hidden md:block">
        <ScrollArea className="w-full">
          <div className="flex gap-8 p-4 min-w-max">
            {bracket.rounds.map((round, index) => (
              <div
                key={round.index}
                className={cn(
                  'min-w-[240px] flex flex-col',
                  // Align matchups in a bracket pattern
                  index === 0 && 'pt-0',
                  index === 1 && bracket.rounds[0]?.matchups.length === 2 && 'pt-[60px]',
                  index === 2 && bracket.rounds[0]?.matchups.length === 2 && 'pt-[140px]'
                )}
                data-round={round.name}
              >
                <BracketRound
                  round={round}
                  isChampionship={isChampionshipRound(round.index) && !isConsolation}
                  isMobile={false}
                  bracketType={bracket.type}
                />
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}
