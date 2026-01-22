'use client';

import { Check, Cloud, Loader2 } from 'lucide-react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSaved?: string;
}

export function AutosaveIndicator({ status, lastSaved }: AutosaveIndicatorProps) {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div data-testid="autosave-indicator" className="flex items-center gap-2 text-sm text-muted-foreground">
      {status === 'saving' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-4 w-4 text-green-500" />
          <span data-testid="save-indicator">
            All changes saved
            {lastSaved && ` at ${formatTime(lastSaved)}`}
          </span>
        </>
      )}
      {status === 'idle' && (
        <>
          <Cloud className="h-4 w-4" />
          <span>Ready</span>
        </>
      )}
      {status === 'error' && (
        <>
          <Cloud className="h-4 w-4 text-destructive" />
          <span className="text-destructive">Failed to save</span>
        </>
      )}
    </div>
  );
}
