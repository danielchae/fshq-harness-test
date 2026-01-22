'use client';

import { AlertTriangle, Clock, Eye, Trash2, User } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import type { HiddenMoment } from '@/types/moderation';

interface HiddenMomentCardProps {
  moment: HiddenMoment;
  onUnhide: (momentId: string) => Promise<boolean>;
  onDelete: (momentId: string) => Promise<boolean>;
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);

  // Handle invalid dates
  if (isNaN(date.getTime())) return 'Unknown';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} minutes ago`;
    }
    return `${diffHours} hours ago`;
  }
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;

  try {
    return date.toISOString().split('T')[0] ?? date.toLocaleDateString();
  } catch {
    return date.toLocaleDateString();
  }
}

function getReasonBadgeVariant(reason: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (reason.toLowerCase()) {
    case 'spam':
      return 'secondary';
    case 'harassment':
      return 'destructive';
    case 'misinformation':
      return 'destructive';
    case 'off-topic':
      return 'outline';
    default:
      return 'default';
  }
}

export function HiddenMomentCard({ moment, onUnhide, onDelete }: HiddenMomentCardProps) {
  const [isUnhiding, setIsUnhiding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleUnhide = async () => {
    setIsUnhiding(true);
    await onUnhide(moment.id);
    setIsUnhiding(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await onDelete(moment.id);
    setIsDeleting(false);
    if (success) {
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <Card data-testid="hidden-moment-card" className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {moment.authorAvatar && (
              <img src={moment.authorAvatar} alt={moment.authorName || 'Author'} className="h-8 w-8 rounded-full" />
            )}
            <div className="min-w-0">
              <CardTitle className="text-sm font-medium truncate">{moment.authorName || 'Unknown Author'}</CardTitle>
              {moment.type && <span className="text-xs text-muted-foreground capitalize">{moment.type}</span>}
            </div>
          </div>
          <Badge variant={getReasonBadgeVariant(moment.hideReason)}>{moment.hideReason}</Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground line-clamp-3">{moment.content}</p>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Hidden: {formatDate(moment.hiddenAt)}</span>
          </div>
          {moment.hiddenBy && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>By: {moment.hiddenBy}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-3 border-t">
        <Button variant="outline" size="sm" onClick={handleUnhide} disabled={isUnhiding} className="flex-1">
          <Eye className="h-4 w-4 mr-1" />
          {isUnhiding ? 'Unhiding...' : 'Unhide'}
        </Button>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="flex-1">
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent data-testid="confirm-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirm Permanent Deletion
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete this content? This action cannot be undone. The content will
                be removed from the database entirely.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4 p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground line-clamp-2">{moment.content}</p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
