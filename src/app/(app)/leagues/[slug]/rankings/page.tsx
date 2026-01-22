import { BarChart3 } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { PowerRankingsDisplay } from '@/components/rankings/power-rankings-display';

interface RankingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function RankingsPage({ params }: RankingsPageProps) {
  const { slug } = await params;

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title="Power Rankings" description="Commissioner-curated weekly power rankings" />
      <PowerRankingsDisplay leagueSlug={slug} />
    </div>
  );
}
