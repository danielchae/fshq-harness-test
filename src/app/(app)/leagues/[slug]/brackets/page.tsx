import { Trophy } from 'lucide-react';

import { BracketView } from '@/components/brackets';
import { PageHeader } from '@/components/layout/page-header';

interface BracketsPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function BracketsPage({ params }: BracketsPageProps) {
  const { slug } = await params;

  return (
    <div className="space-y-6">
      <PageHeader icon={Trophy} title="Playoff Brackets" description="View playoff matchups and championship path" />
      <BracketView leagueSlug={slug} />
    </div>
  );
}
