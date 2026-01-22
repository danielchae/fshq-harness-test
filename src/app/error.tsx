'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Alert variant="destructive" role="alert" data-testid="error-message" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>
            An unexpected error occurred. Please try again or return to the home page.
          </span>
          {error.digest && (
            <span className="text-xs text-muted-foreground">
              Error ID: {error.digest}
            </span>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset} className="w-fit">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" size="sm" asChild className="w-fit">
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
