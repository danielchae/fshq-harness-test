'use client';

import { CheckCircle2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PicksSummaryProps {
  pickedCount: number;
  totalMatchups: number;
  className?: string;
}

export function PicksSummary({ pickedCount, totalMatchups, className }: PicksSummaryProps) {
  const isComplete = pickedCount === totalMatchups && totalMatchups > 0;
  const hasStarted = pickedCount > 0;

  return (
    <div
      data-testid="picks-summary"
      data-picks-count={pickedCount}
      className={cn('flex items-center gap-2', className)}
    >
      {isComplete && <CheckCircle2 className="h-4 w-4 text-green-500" />}
      <Badge variant={isComplete ? 'default' : hasStarted ? 'secondary' : 'outline'}>
        {pickedCount}/{totalMatchups} picks
      </Badge>
    </div>
  );
}
