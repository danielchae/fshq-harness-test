import { History } from 'lucide-react';

import { SeasonArchiveList } from '@/components/history/season-archive-list';
import { PageHeader } from '@/components/layout/page-header';

interface HistoryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function HistoryPage({ params }: HistoryPageProps) {
  const { slug } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={History}
        title="League History"
        description="View past seasons, champions, and all-time records"
      />
      <SeasonArchiveList leagueSlug={slug} />
    </div>
  );
}
