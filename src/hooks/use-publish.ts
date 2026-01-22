'use client';

import { useCallback, useState } from 'react';

import type { PublishResponse, ValidationError, ValidationResult } from '@/types/publish';

interface UsePublishOptions {
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
  onValidationError?: (errors: ValidationError[]) => void;
  onPublishSuccess?: (response: PublishResponse) => void;
  onPublishError?: (error: string) => void;
}

interface UsePublishReturn {
  isValidating: boolean;
  isPublishing: boolean;
  validationErrors: ValidationError[];
  lastPublishResult: PublishResponse | null;
  validate: () => Promise<ValidationResult>;
  publish: () => Promise<PublishResponse>;
  clearErrors: () => void;
}

export function usePublish({
  leagueSlug,
  seasonId,
  weekNumber,
  onValidationError,
  onPublishSuccess,
  onPublishError,
}: UsePublishOptions): UsePublishReturn {
  const [isValidating, setIsValidating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [lastPublishResult, setLastPublishResult] = useState<PublishResponse | null>(null);

  const validate = useCallback(async (): Promise<ValidationResult> => {
    setIsValidating(true);
    setValidationErrors([]);

    try {
      const response = await fetch(`/api/desk/publish?leagueSlug=${leagueSlug}&weekNumber=${weekNumber}`);
      const result: ValidationResult = await response.json();

      if (!result.isValid) {
        setValidationErrors(result.errors);
        onValidationError?.(result.errors);
      }

      return result;
    } catch (_error) {
      const errorResult: ValidationResult = {
        isValid: false,
        errors: [
          {
            section: 'power-rankings',
            message: 'Validation failed',
            details: 'Unable to validate content. Please try again.',
          },
        ],
      };
      setValidationErrors(errorResult.errors);
      onValidationError?.(errorResult.errors);
      return errorResult;
    } finally {
      setIsValidating(false);
    }
  }, [leagueSlug, weekNumber, onValidationError]);

  const publish = useCallback(async (): Promise<PublishResponse> => {
    setIsPublishing(true);
    setValidationErrors([]);

    try {
      const response = await fetch('/api/desk/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueSlug,
          seasonId,
          weekNumber,
        }),
      });

      const result: PublishResponse = await response.json();
      setLastPublishResult(result);

      if (result.success) {
        onPublishSuccess?.(result);
      } else {
        // If publish failed due to validation, show those errors
        if (result.error) {
          onPublishError?.(result.error);
        }
      }

      return result;
    } catch (_error) {
      const errorResponse: PublishResponse = {
        success: false,
        error: 'Failed to publish. Please try again.',
      };
      setLastPublishResult(errorResponse);
      onPublishError?.(errorResponse.error || 'Unknown error');
      return errorResponse;
    } finally {
      setIsPublishing(false);
    }
  }, [leagueSlug, seasonId, weekNumber, onPublishSuccess, onPublishError]);

  const clearErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  return {
    isValidating,
    isPublishing,
    validationErrors,
    lastPublishResult,
    validate,
    publish,
    clearErrors,
  };
}
