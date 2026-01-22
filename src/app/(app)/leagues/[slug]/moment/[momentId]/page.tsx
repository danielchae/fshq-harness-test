import { MomentDetailPage } from '@/components/moment-detail';

interface MomentDetailPageRouteProps {
  params: Promise<{
    slug: string;
    momentId: string;
  }>;
}

export default async function MomentDetailPageRoute({ params }: MomentDetailPageRouteProps) {
  const { slug, momentId } = await params;

  return <MomentDetailPage momentId={momentId} leagueSlug={slug} />;
}
