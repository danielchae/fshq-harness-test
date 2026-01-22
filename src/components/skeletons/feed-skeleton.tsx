'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface FeedSkeletonProps {
  count?: number;
}

export function FeedSkeleton({ count = 3 }: FeedSkeletonProps) {
  return (
    <div data-testid="feed-skeleton" className="space-y-4 animate-pulse">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                {/* Name */}
                <Skeleton className="h-4 w-32" />
                {/* Timestamp */}
                <Skeleton className="h-3 w-20" />
              </div>
              {/* Badge/type indicator */}
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Content lines */}
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            {/* Sometimes has an image */}
            {index % 2 === 0 && <Skeleton className="h-40 w-full rounded-md" />}
            {/* Action bar */}
            <div className="flex items-center gap-4 pt-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
