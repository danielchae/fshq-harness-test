'use client';

import { AlertCircle, ArrowLeft, Check, Loader2, Search, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeams } from '@/hooks/use-teams';
import { clearCache, getTeamsCacheKey } from '@/lib/cache';
import { cn } from '@/lib/utils';

// Consistent description used across all states to prevent hydration mismatch
const PAGE_DESCRIPTION = 'Find and claim your team to become its manager';

import type { Route } from 'next';

interface ClaimTeamPageProps {
  params: Promise<{ slug: string }>;
}

export default function ClaimTeamPage({ params }: ClaimTeamPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { teams, isLoading, error, refetch } = useTeams({ leagueSlug: slug });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // Filter teams based on search query
  const availableTeams = useMemo(() => {
    const unclaimed = teams.filter((team) => !team.claimed);
    if (!searchQuery.trim()) return unclaimed;
    
    const query = searchQuery.toLowerCase();
    return unclaimed.filter(
      (team) =>
        team.name.toLowerCase().includes(query) ||
        team.sleeperUsername?.toLowerCase().includes(query) ||
        team.ownerUsername?.toLowerCase().includes(query)
    );
  }, [teams, searchQuery]);

  const claimedTeams = useMemo(() => teams.filter((team) => team.claimed), [teams]);

  const handleClaimTeam = async () => {
    if (!selectedTeamId) return;

    setIsClaiming(true);
    try {
      const response = await fetch('/api/claim-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: selectedTeamId, leagueSlug: slug }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || 'Failed to claim team');
      }

      toast.success('Team claimed successfully!', {
        description: `You are now the manager of ${result.team?.name || 'your team'}.`,
      });

      // Clear the teams cache so the list refreshes with updated claim status
      clearCache(getTeamsCacheKey(slug));

      // Redirect to teams page
      router.push(`/leagues/${slug}/teams` as Route);
      router.refresh();
    } catch (err) {
      toast.error('Failed to claim team', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setIsClaiming(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/leagues/${slug}/teams` as Route}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Teams
            </Button>
          </Link>
        </div>
        <PageHeader icon={UserPlus} title="Claim Your Team" description={PAGE_DESCRIPTION} />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/leagues/${slug}/teams` as Route}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Teams
            </Button>
          </Link>
        </div>
        <PageHeader icon={UserPlus} title="Claim Your Team" description={PAGE_DESCRIPTION} />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center gap-4">
            <span>Failed to load teams. Please try again.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No available teams
  if (availableTeams.length === 0 && !searchQuery) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/leagues/${slug}/teams` as Route}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Teams
            </Button>
          </Link>
        </div>
        <PageHeader icon={UserPlus} title="Claim Your Team" description={PAGE_DESCRIPTION} />
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Check className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">All Teams Claimed</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  All teams in this league have already been claimed by their managers.
                </p>
              </div>
              <Link href={`/leagues/${slug}/teams` as Route}>
                <Button variant="outline">View All Teams</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/leagues/${slug}/teams` as Route}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Teams
          </Button>
        </Link>
      </div>

      <PageHeader
        icon={UserPlus}
        title="Claim Your Team"
        description={PAGE_DESCRIPTION}
      />

      <Card>
        <CardHeader>
          <CardTitle>Available Teams</CardTitle>
          <CardDescription>
            Select the team you manage on Sleeper. Search by team name or Sleeper username.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by team name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Available Teams Grid */}
          {availableTeams.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {availableTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id === selectedTeamId ? null : team.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-4 text-left transition-all',
                    team.id === selectedTeamId
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'hover:border-primary/50 hover:bg-accent/50'
                  )}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={team.avatarUrl} alt={team.name} />
                    <AvatarFallback>{team.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{team.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {team.sleeperUsername || team.ownerUsername || 'Unknown owner'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {typeof team.record === 'object'
                        ? `${team.record.wins}-${team.record.losses}-${team.record.ties}`
                        : team.record}
                    </p>
                  </div>
                  {team.id === selectedTeamId && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No teams match your search.
            </div>
          )}

          {/* Claim Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleClaimTeam} disabled={!selectedTeamId || isClaiming}>
              {isClaiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isClaiming ? 'Claiming...' : 'Claim Selected Team'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Already Claimed Teams Reference */}
      {claimedTeams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Already Claimed</CardTitle>
            <CardDescription>These teams have already been claimed by their managers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {claimedTeams.map((team) => (
                <Badge key={team.id} variant="secondary" className="gap-2 py-1.5">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={team.avatarUrl} alt={team.name} />
                    <AvatarFallback className="text-[8px]">{team.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {team.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
