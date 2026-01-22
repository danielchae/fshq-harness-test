'use client';

import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export function StatCorrectionBadge() {
  return (
    <Badge
      variant="outline"
      data-testid="stat-correction-badge"
      data-badge="correction"
      className="gap-1 border-amber-500/50 bg-amber-50 text-amber-700"
    >
      <AlertTriangle className="h-3 w-3" />
      Stat Correction
    </Badge>
  );
}
