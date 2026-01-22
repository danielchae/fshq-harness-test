import { CalendarDays } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { MatchupsDisplay } from '@/components/matchups/matchups-display';

interface MatchupsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function MatchupsPage({ params }: MatchupsPageProps) {
  const { slug } = await params;

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarDays} title="Matchups" description="View weekly matchups and head-to-head results" />
      <MatchupsDisplay leagueSlug={slug} />
    </div>
  );
}
