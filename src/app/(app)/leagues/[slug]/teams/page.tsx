'use client';

import { AlertCircle, RefreshCw, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { use, useMemo } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/skeletons/empty-state';
import { TableSkeleton } from '@/components/skeletons/table-skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTeams } from '@/hooks/use-teams';

import type { Route } from 'next';

interface TeamsPageProps {
  params: Promise<{ slug: string }>;
}

export default function TeamsPage({ params }: TeamsPageProps) {
  const { slug } = use(params);
  const { teams, isLoading, error, refetch } = useTeams({ leagueSlug: slug });

  const hasAvailableTeams = useMemo(() => teams.some((team) => !team.claimed), [teams]);

  // Static header for loading state (no conditional content to avoid hydration mismatch)
  const loadingHeader = (
    <div className="flex items-center justify-between gap-4">
      <PageHeader icon={Users} title="Teams" description="View all teams in this league and claim your team" />
    </div>
  );

  // Full header with conditional "Claim Team" button (only used after data loads)
  const header = (
    <div className="flex items-center justify-between gap-4">
      <PageHeader icon={Users} title="Teams" description="View all teams in this league and claim your team" />
      {hasAvailableTeams && (
        <Link href={`/leagues/${slug}/teams/create` as Route}>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Claim Team
          </Button>
        </Link>
      )}
    </div>
  );

  // Loading state - use static header to avoid hydration mismatch
  if (isLoading) {
    return (
      <div className="space-y-6">
        {loadingHeader}
        <Card>
          <CardContent className="p-6">
            <TableSkeleton rows={6} columns={4} showHeader={true} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state - use static header to avoid hydration mismatch
  if (error) {
    return (
      <div className="space-y-6">
        {loadingHeader}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center gap-4">
            <span>Failed to load teams. Please try again.</span>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state
  if (teams.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="No Teams Yet"
              description="This league doesn't have any teams synced yet. Teams will appear after syncing with Sleeper."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Teams list
  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardHeader>
          <CardTitle>League Teams</CardTitle>
          <CardDescription>All teams in this league. Claimed teams have an active manager.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="hidden sm:table-cell">Manager</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={team.avatarUrl} alt={team.name} />
                        <AvatarFallback>{team.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium">{team.name}</span>
                        <span className="text-xs text-muted-foreground sm:hidden">
                          {team.ownerUsername || team.sleeperUsername || 'Unclaimed'}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {team.ownerUsername || team.sleeperUsername || 'Unclaimed'}
                  </TableCell>
                  <TableCell>
                    {typeof team.record === 'object'
                      ? `${team.record.wins}-${team.record.losses}-${team.record.ties}`
                      : team.record}
                  </TableCell>
                  <TableCell>
                    <Badge variant={team.claimed ? 'default' : 'secondary'}>
                      {team.claimed ? 'Claimed' : 'Available'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
