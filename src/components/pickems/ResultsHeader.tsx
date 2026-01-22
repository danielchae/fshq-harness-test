'use client';

import { Trophy } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

import type { WeeklyScore } from '@/types/pickems';

interface ResultsHeaderProps {
  weeklyScore: WeeklyScore;
  weekNumber: number;
}

export function ResultsHeader({ weeklyScore, weekNumber }: ResultsHeaderProps) {
  const { correct, total, percentage } = weeklyScore;

  // Determine result quality for styling
  const isGoodResult = percentage >= 60;
  const isGreatResult = percentage >= 80;

  return (
    <Card data-testid="results-header" data-results-summary className="bg-gradient-to-r from-primary/10 to-primary/5">
      <CardContent className="py-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Trophy
                className={`h-6 w-6 ${isGreatResult ? 'text-yellow-500' : isGoodResult ? 'text-primary' : 'text-muted-foreground'}`}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold">Week {weekNumber} Results</h2>
              <p className="text-sm text-muted-foreground">Your pick&apos;ems performance</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">
                {correct}/{total}
              </div>
              <div className="text-sm text-muted-foreground">correct</div>
            </div>

            <div className="h-12 w-px bg-border" />

            <div className="text-center">
              <div
                className={`text-3xl font-bold ${isGreatResult ? 'text-green-600' : isGoodResult ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {percentage}%
              </div>
              <div className="text-sm text-muted-foreground">accuracy</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
