'use client';

import { AlertCircle, X } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import type { ValidationError } from '@/types/publish';

interface ValidationAlertProps {
  errors: ValidationError[];
  onDismiss?: () => void;
}

export function ValidationAlert({ errors, onDismiss }: ValidationAlertProps) {
  if (errors.length === 0) return null;

  return (
    <Alert variant="destructive" role="alert" data-testid="validation-error">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>Cannot Publish - Incomplete Content</span>
        {onDismiss && (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0 hover:bg-destructive/20">
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        )}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-2">
          {errors.map((error, index) => (
            <li key={`${error.section}-${index}`} className="text-sm">
              <span className="font-medium capitalize">{error.section.replace('-', ' ')}:</span> {error.message}
              {error.details && <p className="mt-1 text-xs opacity-90">{error.details}</p>}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
