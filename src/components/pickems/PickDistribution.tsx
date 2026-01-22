'use client';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import type { PickDistribution as PickDistributionType, PickemTeam } from '@/types/pickems';

interface PickDistributionProps {
  distribution: PickDistributionType;
  homeTeam: PickemTeam;
  awayTeam: PickemTeam;
  className?: string;
}

export function PickDistribution({ distribution, homeTeam, awayTeam, className }: PickDistributionProps) {
  const homeCount = distribution[homeTeam.id] || 0;
  const awayCount = distribution[awayTeam.id] || 0;
  const total = homeCount + awayCount;

  if (total === 0) {
    return (
      <div
        data-testid="pick-distribution"
        data-distribution="true"
        className={cn('text-sm text-muted-foreground text-center', className)}
      >
        No picks submitted
      </div>
    );
  }

  const homePercentage = Math.round((homeCount / total) * 100);
  const awayPercentage = 100 - homePercentage;

  return (
    <div data-testid="pick-distribution" data-distribution="true" className={cn('space-y-2', className)}>
      {/* Distribution bar */}
      <div className="relative h-6 rounded-md overflow-hidden bg-muted">
        {/* Home team side */}
        <div
          className="absolute left-0 top-0 h-full bg-primary/70 transition-all duration-300"
          style={{ width: `${homePercentage}%` }}
        />
        {/* Away team side */}
        <div
          className="absolute right-0 top-0 h-full bg-secondary transition-all duration-300"
          style={{ width: `${awayPercentage}%` }}
        />
        {/* Progress bar for accessibility */}
        <Progress
          value={homePercentage}
          className="absolute inset-0 opacity-0"
          aria-label={`${homeCount} picked ${homeTeam.name}, ${awayCount} picked ${awayTeam.name}`}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs">
        <span className="font-medium">
          Team {homeTeam.name}: {homeCount} picked
        </span>
        <span className="font-medium">
          Team {awayTeam.name}: {awayCount} picked
        </span>
      </div>

      {/* Percentages */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{homePercentage}%</span>
        <span>{awayPercentage}%</span>
      </div>
    </div>
  );
}
