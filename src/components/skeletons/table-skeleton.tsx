'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export function TableSkeleton({ rows = 8, columns = 5, showHeader = true }: TableSkeletonProps) {
  return (
    <div data-testid="table-skeleton" className="w-full animate-pulse">
      {/* Table container with responsive overflow */}
      <div className="rounded-md border">
        <div className="w-full">
          {/* Header row */}
          {showHeader && (
            <div className="border-b bg-muted/50">
              <div className="flex">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div
                    key={`header-${colIndex}`}
                    data-testid="skeleton-cell"
                    className={`p-4 ${colIndex === 0 ? 'w-16' : 'flex-1'}`}
                  >
                    <Skeleton className="h-4 w-full max-w-24" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Body rows */}
          <div className="divide-y">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div key={`row-${rowIndex}`} className="flex">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div
                    key={`cell-${rowIndex}-${colIndex}`}
                    data-testid="skeleton-cell"
                    className={`p-4 ${colIndex === 0 ? 'w-16' : 'flex-1'}`}
                  >
                    {colIndex === 0 ? (
                      // First column - rank number
                      <Skeleton className="h-4 w-8" />
                    ) : colIndex === 1 ? (
                      // Second column - often avatar + name
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    ) : (
                      // Other columns - values
                      <Skeleton className="h-4 w-16" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
