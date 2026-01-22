'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface LeagueErrorProps {
  error: Error | string;
  onRetry?: () => void;
}

export function LeagueError({ error, onRetry }: LeagueErrorProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const isNotFound = errorMessage.toLowerCase().includes('not found');

  return (
    <Alert variant="destructive" role="alert" data-testid="error-message">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{isNotFound ? 'League Not Found' : 'Error'}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>
          {isNotFound
            ? 'The league you are looking for was not found. Please check the URL and try again.'
            : errorMessage || 'An error occurred while loading the league.'}
        </span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="w-fit">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
