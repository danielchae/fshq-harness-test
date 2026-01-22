'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details to console for debugging (without exposing to user)
    console.error('ErrorBoundary caught an error:', error.message);
    console.error('Component stack:', errorInfo.componentStack);

    // Call optional onError callback
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Return custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error fallback UI
      return <ErrorFallback onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  onReset?: () => void;
  title?: string;
  description?: string;
}

export function ErrorFallback({
  onReset,
  title = 'Something went wrong',
  description = 'An error occurred while loading this content. Please try again.',
}: ErrorFallbackProps) {
  return (
    <Card data-testid="error-fallback" className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
      {onReset && (
        <CardFooter className="justify-center">
          <Button onClick={onReset} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// Hook for functional components to trigger error boundary
export function useErrorTrigger() {
  return {
    triggerError: () => {
      throw new Error('Manually triggered error for testing');
    },
  };
}
