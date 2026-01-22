import { NextResponse } from 'next/server';

import { getLeagueHistory } from '@/data/history/get-league-history';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const data = await getLeagueHistory({ leagueSlug: slug });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching league history:', error);
    return NextResponse.json({ error: 'Failed to fetch league history' }, { status: 500 });
  }
}
