import { NextResponse } from 'next/server';

import { getSeasonDetail } from '@/data/history/get-league-history';

interface RouteContext {
  params: Promise<{ slug: string; year: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug, year } = await context.params;
    const yearNum = parseInt(year, 10);

    if (isNaN(yearNum)) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    const data = await getSeasonDetail(slug, yearNum);

    if (!data) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching season detail:', error);
    return NextResponse.json({ error: 'Failed to fetch season detail' }, { status: 500 });
  }
}
