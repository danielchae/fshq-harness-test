'use client';

import { AlertCircle, Inbox, RefreshCw, Shield } from 'lucide-react';
import { useState } from 'react';

import { HiddenMomentCard } from '@/components/moderation/hidden-moment-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useHiddenMoments } from '@/hooks/use-hidden-moments';

interface ModerationQueueProps {
  leagueSlug: string;
}

export function ModerationQueue({ leagueSlug }: ModerationQueueProps) {
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');
  const [moderatorFilter, setModeratorFilter] = useState<string>('all');

  const { hiddenMoments, isLoading, error, refetch, unhideMoment, deleteMoment } = useHiddenMoments({
    leagueSlug,
    contentType: contentTypeFilter !== 'all' ? contentTypeFilter : undefined,
    moderator: moderatorFilter !== 'all' ? moderatorFilter : undefined,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-[180px]" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[200px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" role="alert" data-testid="error-message">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading moderation queue</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={refetch} className="w-fit">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted-foreground">Content Type</label>
          <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="post">Posts</SelectItem>
              <SelectItem value="comment">Comments</SelectItem>
              <SelectItem value="trade">Trades</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted-foreground">Moderator</label>
          <Select value={moderatorFilter} onValueChange={setModeratorFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All moderators" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Moderators</SelectItem>
              <SelectItem value="admin-user">Admin User</SelectItem>
              <SelectItem value="mod-user">Mod User</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button variant="ghost" size="icon" onClick={refetch} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {hiddenMoments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Inbox className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No hidden content to review</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            All content in this league is currently visible. Hidden items will appear here when moderation actions are
            taken.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {hiddenMoments.length} hidden {hiddenMoments.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {hiddenMoments.map((moment) => (
              <HiddenMomentCard key={moment.id} moment={moment} onUnhide={unhideMoment} onDelete={deleteMoment} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
