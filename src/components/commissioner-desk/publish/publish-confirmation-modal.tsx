'use client';

import { CheckCircle2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { PublishResponse } from '@/types/publish';
import { asRoute } from '@/types/routes';

interface PublishConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  result: PublishResponse | null;
}

export function PublishConfirmationModal({ open, onClose, result }: PublishConfirmationModalProps) {
  if (!result || !result.success) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent aria-labelledby="success-dialog-title">
        <DialogHeader>
          <DialogTitle id="success-dialog-title" className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Content Published Successfully
          </DialogTitle>
          <DialogDescription>
            Your weekly content has been published and is now live for your league members.
            {result.feedMomentsCreated && result.feedMomentsCreated > 0 && (
              <span className="block mt-1">
                {result.feedMomentsCreated} feed moment{result.feedMomentsCreated !== 1 ? 's' : ''} created.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">View your published content:</p>
          <div className="flex flex-col gap-3">
            {result.rankingsUrl && (
              <Link href={asRoute(result.rankingsUrl)} className="flex items-center gap-2 text-primary hover:underline">
                <ExternalLink className="h-4 w-4" />
                View Power Rankings
              </Link>
            )}
            {result.feedUrl && (
              <Link href={asRoute(result.feedUrl)} className="flex items-center gap-2 text-primary hover:underline">
                <ExternalLink className="h-4 w-4" />
                View League Feed
              </Link>
            )}
            {result.matchupsUrl && (
              <Link href={asRoute(result.matchupsUrl)} className="flex items-center gap-2 text-primary hover:underline">
                <ExternalLink className="h-4 w-4" />
                View Matchups
              </Link>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
