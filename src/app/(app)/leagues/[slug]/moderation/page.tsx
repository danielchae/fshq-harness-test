import { Shield } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { ModerationQueue } from '@/components/moderation/moderation-queue';

interface ModerationPageProps {
  params: Promise<{ slug: string }>;
}

export default async function ModerationPage({ params }: ModerationPageProps) {
  const { slug } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Shield}
        title="Moderation Queue"
        description="Review and manage hidden content in your league"
      />
      <ModerationQueue leagueSlug={slug} />
    </div>
  );
}
