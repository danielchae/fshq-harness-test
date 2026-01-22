import { SeasonDetail } from '@/components/history/season-detail';

interface SeasonDetailPageProps {
  params: Promise<{ slug: string; year: string }>;
}

export default async function SeasonDetailPage({ params }: SeasonDetailPageProps) {
  const { slug, year } = await params;
  const yearNum = parseInt(year, 10);

  return <SeasonDetail leagueSlug={slug} year={yearNum} />;
}
