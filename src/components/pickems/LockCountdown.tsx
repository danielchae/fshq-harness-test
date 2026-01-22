'use client';

import { AlertTriangle, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LockCountdownProps {
  lockTime: string;
  className?: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0:00';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}hr`;
  }

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')} hr`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')} min`;
}

export function LockCountdown({ lockTime, className }: LockCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    return new Date(lockTime).getTime() - Date.now();
  });

  useEffect(() => {
    const updateInterval = timeRemaining <= 60 * 60 * 1000 ? 1000 : 60000; // Update every second if within 1 hour, else every minute

    const timer = setInterval(() => {
      const remaining = new Date(lockTime).getTime() - Date.now();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, updateInterval);

    return () => clearInterval(timer);
  }, [lockTime, timeRemaining]);

  if (timeRemaining <= 0) {
    return (
      <Badge variant="secondary" className={cn('gap-1', className)}>
        <Clock className="h-3 w-3" />
        Locked
      </Badge>
    );
  }

  const isUrgent = timeRemaining <= 60 * 60 * 1000; // Within 1 hour

  return (
    <Badge
      variant={isUrgent ? 'destructive' : 'outline'}
      className={cn('gap-1', className)}
      data-testid="lock-countdown"
      data-countdown="true"
    >
      {isUrgent ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {formatTimeRemaining(timeRemaining)}
    </Badge>
  );
}
