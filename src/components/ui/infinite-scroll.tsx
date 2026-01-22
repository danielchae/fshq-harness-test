'use client';

import { useCallback, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { LoadingSpinner } from './loading-spinner';

interface InfiniteScrollProps {
  children: React.ReactNode;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number;
  className?: string;
  endMessage?: string;
}

export function InfiniteScroll({
  children,
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 200,
  className,
  endMessage = 'No more items',
}: InfiniteScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Handle scroll-based loading using IntersectionObserver
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target && target.isIntersecting && hasMore && !isLoading) {
        onLoadMore();
      }
    },
    [hasMore, isLoading, onLoadMore]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: containerRef.current,
      rootMargin: `${threshold}px`,
      threshold: 0,
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [handleObserver, threshold]);

  // Also handle scroll events for precise threshold detection
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isLoading || !hasMore) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      if (distanceFromBottom <= threshold) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoading, onLoadMore, threshold]);

  return (
    <div ref={containerRef} data-testid="infinite-scroll-container" className={cn('overflow-auto', className)}>
      {children}

      {/* Load more trigger element */}
      <div ref={loadMoreRef} className="h-1" />

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="md" />
        </div>
      )}

      {/* End of content indicator */}
      {!hasMore && !isLoading && <p className="text-center text-sm text-muted-foreground py-4">{endMessage}</p>}
    </div>
  );
}
