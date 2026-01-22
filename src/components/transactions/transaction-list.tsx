'use client';

import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useTransactions } from '@/hooks/use-transactions';
import { TransactionCard } from './transaction-card';
import { TransactionFilters } from './transaction-filters';

import type { TransactionType } from '@/types/transactions';
import type { Team } from './transaction-filters';

interface TransactionListProps {
  leagueSlug: string;
}

// Mock teams data - backend will provide this
const mockTeams: Team[] = [
  { id: 'team-1', name: 'Touchdown Titans' },
  { id: 'team-2', name: 'Dynasty Dragons' },
  { id: 'team-3', name: 'Gridiron Giants' },
  { id: 'team-4', name: 'Fantasy Phenoms' },
  { id: 'team-5', name: 'Sunday Slayers' },
  { id: 'team-6', name: 'End Zone Experts' },
];

export function TransactionList({ leagueSlug }: TransactionListProps) {
  // Filter state
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [playerSearch, setPlayerSearch] = useState<string>('');
  const [debouncedPlayerSearch, setDebouncedPlayerSearch] = useState<string>('');

  // Debounce player search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPlayerSearch(playerSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [playerSearch]);

  const { transactions, isLoading, isLoadingMore, error, hasMore, loadMore, retry } = useTransactions({
    leagueSlug,
    type: typeFilter === 'all' ? undefined : typeFilter,
    teamId: teamFilter === 'all' ? undefined : teamFilter,
    playerSearch: debouncedPlayerSearch || undefined,
  });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () => typeFilter !== 'all' || teamFilter !== 'all' || playerSearch !== '',
    [typeFilter, teamFilter, playerSearch]
  );

  // Clear all filters
  const handleClearFilters = () => {
    setTypeFilter('all');
    setTeamFilter('all');
    setPlayerSearch('');
  };

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, loadMore]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <TransactionFilters
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        teamFilter={teamFilter}
        onTeamFilterChange={setTeamFilter}
        playerSearch={playerSearch}
        onPlayerSearchChange={setPlayerSearch}
        onClearFilters={handleClearFilters}
        teams={mockTeams}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">Unable to load transactions</p>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={retry} variant="outline">
            Try Again
          </Button>
        </div>
      )}

      {/* Empty state - no transactions at all */}
      {!isLoading && !error && transactions.length === 0 && !hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">No transactions yet this season</p>
          <p className="text-sm text-muted-foreground">Trades, waivers, and roster moves will appear here.</p>
        </div>
      )}

      {/* Empty state - no matching transactions (filtered) */}
      {!isLoading && !error && transactions.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">No matching transactions</p>
          <p className="text-sm text-muted-foreground mb-4">
            Try adjusting your filters to find what you&apos;re looking for.
          </p>
          <Button onClick={handleClearFilters} variant="outline" data-testid="clear-filters-empty">
            Clear Filters
          </Button>
        </div>
      )}

      {/* Transaction list */}
      {!isLoading && !error && transactions.length > 0 && (
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <TransactionCard key={transaction.id} transaction={transaction} />
          ))}

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="h-4" />

          {/* Loading more indicator */}
          {isLoadingMore && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
