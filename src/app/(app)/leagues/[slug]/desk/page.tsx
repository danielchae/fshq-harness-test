import { UserCog } from 'lucide-react';

import { AccessDenied } from '@/components/commissioner-desk/access-denied';
import { DeskContent } from '@/components/commissioner-desk/desk-content';
import { PageHeader } from '@/components/layout/page-header';
import { getDeskData } from '@/data/desk/get-desk-data';
import { getUserRole } from '@/lib/auth/get-user-role';

interface DeskPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DeskPage({ params }: DeskPageProps) {
  const { slug } = await params;

  // Check user role for commissioner access using actual database lookup
  const userRole = await getUserRole(slug);
  const isCommissioner = userRole === 'commissioner';

  // If user is not a commissioner, show access denied
  if (!isCommissioner) {
    return <AccessDenied leagueSlug={slug} />;
  }

  // Fetch desk data
  const deskData = await getDeskData({ leagueSlug: slug });

  return (
    <div className="space-y-6" data-testid="commissioner-desk">
      <PageHeader
        icon={UserCog}
        title="Commissioner Desk"
        description="Create and manage weekly content for your league"
      />
      <DeskContent
        leagueSlug={slug}
        seasons={deskData.seasons}
        weeks={deskData.weeks}
        initialSeason={deskData.currentSeason}
        initialWeek={deskData.currentWeek}
        initialDrafts={deskData.drafts}
      />
    </div>
  );
}
