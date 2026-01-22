import { notFound } from 'next/navigation';

import { RoleSelectionOnboarding } from '@/components/onboarding/role-selection-onboarding';
import { getLeague } from '@/data/leagues/get-league';
import { getAllTeamsForSupport } from '@/data/teams/get-teams';
import { createLeagueMetadata } from '@/lib/metadata';

import type { Metadata } from 'next';

interface OnboardingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const league = await getLeague({ slug });

  if (!league) {
    return {
      title: 'Onboarding',
    };
  }

  return createLeagueMetadata({
    leagueName: league.name,
    pageTitle: 'Welcome',
    description: `Join ${league.name} on FSHQ.gg - Select your team and get started`,
    slug: league.slug,
  });
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { slug } = await params;

  // Fetch league data
  const league = await getLeague({ slug });

  if (!league) {
    notFound();
  }

  // Fetch all teams for the league
  const teams = await getAllTeamsForSupport(slug);

  return <RoleSelectionOnboarding leagueSlug={league.slug} leagueName={league.name} teams={teams} />;
}
