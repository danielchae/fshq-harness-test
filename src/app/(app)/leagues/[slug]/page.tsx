'use client';

import { Home } from 'lucide-react';
import { use } from 'react';

import { FeedList } from '@/components/feed/feed-list';
import { PageHeader } from '@/components/layout/page-header';

interface FeedPageProps {
  params: Promise<{ slug: string }>;
}

export default function FeedPage({ params }: FeedPageProps) {
  const { slug } = use(params);

  return (
    <div className="space-y-6">
      <PageHeader icon={Home} title="Feed" description="Latest activity, trades, and moments from your league" />
      <FeedList leagueSlug={slug} />
    </div>
  );
}
