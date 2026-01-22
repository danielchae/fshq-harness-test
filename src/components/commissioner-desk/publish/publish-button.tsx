'use client';

import { Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface PublishButtonProps {
  onClick: () => void;
  isPublishing: boolean;
  isValidating: boolean;
  disabled?: boolean;
}

export function PublishButton({ onClick, isPublishing, isValidating, disabled = false }: PublishButtonProps) {
  const isLoading = isPublishing || isValidating;

  return (
    <Button onClick={onClick} disabled={disabled || isLoading} size="lg" className="min-w-[140px]">
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {isValidating ? 'Validating...' : 'Publishing...'}
        </>
      ) : (
        <>
          <Send className="h-4 w-4 mr-2" />
          Publish
        </>
      )}
    </Button>
  );
}
