import { PickemsContent } from '@/components/pickems';

interface PickemsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PickemsPage({ params }: PickemsPageProps) {
  const { slug } = await params;

  return <PickemsContent leagueSlug={slug} />;
}
