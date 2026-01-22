'use client';

import { AlertTriangle, MessageSquare, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';

import { ErrorBoundary } from '@/components/error-boundary';
import { EmptyState } from '@/components/skeletons/empty-state';
import { FeedSkeleton } from '@/components/skeletons/feed-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { InfiniteScroll } from '@/components/ui/infinite-scroll';
import { useFeed } from '@/hooks/use-feed';
import { FeedMoment } from './feed-moment';
import { FeedSortToggle } from './feed-sort-toggle';
import { PostComposer } from './post-composer';
import { TypeFilterDropdown } from './type-filter-dropdown';

import type { Moment, MomentType } from '@/types/feed';
import type { FeedSortOption } from './feed-sort-toggle';
import type { TypeFilterValue } from './type-filter-dropdown';

interface FeedListProps {
  leagueSlug: string;
}

export function FeedList({ leagueSlug }: FeedListProps) {
  const [sortOption, setSortOption] = useState<FeedSortOption>('chronological');
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('all');
  const [optimisticMoments, setOptimisticMoments] = useState<Moment[]>([]);
  const [hiddenMomentIds, setHiddenMomentIds] = useState<Set<string>>(new Set());

  // Convert 'all' to undefined for the API call
  const typeForApi: MomentType | undefined = typeFilter === 'all' ? undefined : typeFilter;

  const { moments, isLoading, isLoadingMore, error, hasMore, loadMore, retry } = useFeed({
    leagueSlug,
    sort: sortOption,
    type: typeForApi,
  });

  const handleMomentHidden = useCallback((momentId: string) => {
    setHiddenMomentIds((prev) => {
      const next = new Set(prev);
      next.add(momentId);
      return next;
    });
  }, []);

  // Combine optimistic moments with fetched moments, prefer server data when available
  const serverMomentIds = new Set(moments.map((moment) => moment.id));
  const mergedMoments = [
    ...optimisticMoments.filter((moment) => !serverMomentIds.has(moment.id)),
    ...moments,
  ];
  const allMoments = mergedMoments.filter((moment) => !hiddenMomentIds.has(moment.id));

  // Handle new post created (optimistic update)
  const handlePostCreated = useCallback((newMoment: Moment) => {
    setOptimisticMoments((prev) => [newMoment, ...prev]);
  }, []);

  // Filter controls - always show above feed
  const filterControls = (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <FeedSortToggle value={sortOption} onValueChange={setSortOption} />
      <TypeFilterDropdown value={typeFilter} onValueChange={setTypeFilter} />
    </div>
  );

  // Post composer - always visible
  const postComposer = <PostComposer leagueSlug={leagueSlug} onPostCreated={handlePostCreated} />;

  // Loading state
  if (isLoading) {
    return (
      <>
        {postComposer}
        {filterControls}
        <FeedSkeleton count={3} />
      </>
    );
  }

  // Error state - with error-fallback data-testid for e2e testing
  if (error) {
    // Log error to console for debugging (without exposing details to user)
    console.error('Feed loading error:', error.message);

    return (
      <>
        {postComposer}
        {filterControls}
        <Card data-testid="error-fallback" className="mx-auto max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-lg">Something went wrong</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">An error occurred while loading the feed. Please try again.</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={retry} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </>
    );
  }

  // Empty state - still show composer and optimistic posts
  if (allMoments.length === 0) {
    return (
      <>
        {postComposer}
        {filterControls}
        <EmptyState
          icon={MessageSquare}
          title="No Activity Yet"
          description={
            typeFilter !== 'all'
              ? `No ${typeFilter} moments found - try a different filter`
              : 'No activity yet - be the first to post!'
          }
        />
      </>
    );
  }

  // Feed with moments - wrapped in ErrorBoundary for catching render errors
  return (
    <ErrorBoundary>
      {postComposer}
      {filterControls}
      <InfiniteScroll
        onLoadMore={loadMore}
        hasMore={hasMore}
        isLoading={isLoadingMore}
        threshold={200}
        className="h-[calc(100vh-300px)] min-h-[400px]"
        endMessage="No more items"
      >
        <div className="space-y-4">
          {allMoments.map((moment) => (
            <FeedMoment key={moment.id} moment={moment} onMomentHidden={handleMomentHidden} />
          ))}
        </div>
      </InfiniteScroll>
    </ErrorBoundary>
  );
}
