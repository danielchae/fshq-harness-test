'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMomentDetail } from '@/hooks/use-moment-detail';
import { MomentDetailView } from './moment-detail-view';

interface MomentDetailPageProps {
  momentId: string;
  leagueSlug: string;
}

export function MomentDetailPage({ momentId, leagueSlug }: MomentDetailPageProps) {
  const { moment, isLoading, error, notFound, refetch } = useMomentDetail({ momentId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-2xl font-bold">Moment not found</h1>
            <p className="text-muted-foreground">
              The moment you&apos;re looking for doesn&apos;t exist or may have been removed.
            </p>
            <Button asChild>
              <Link href={`/leagues/${leagueSlug}` as `/leagues/${string}`}>Return to Feed</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Error loading moment</h1>
            <p className="text-muted-foreground">{error.message}</p>
            <Button onClick={refetch}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!moment) {
    return null;
  }

  return <MomentDetailView moment={moment} leagueSlug={leagueSlug} />;
}
