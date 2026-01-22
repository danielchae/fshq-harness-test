import { NextResponse } from 'next/server';

import { getHiddenMoments } from '@/data/moderation/get-hidden-moments';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ hiddenMoments: [], error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let leagueId = searchParams.get('leagueId');
    const leagueSlug = searchParams.get('leagueSlug');
    const contentType = searchParams.get('contentType') || undefined;
    const moderator = searchParams.get('moderator') || undefined;

    if (!leagueId && !leagueSlug) {
      return NextResponse.json({ hiddenMoments: [], error: 'leagueSlug or leagueId is required' }, { status: 400 });
    }

    if (!leagueId && leagueSlug) {
      const league = await prisma.league.findUnique({
        where: { slug: leagueSlug },
        select: { id: true },
      });

      if (!league) {
        return NextResponse.json({ hiddenMoments: [], error: 'League not found' }, { status: 404 });
      }

      leagueId = league.id;
    }

    // Pass userId for RLS validation
    const result = await getHiddenMoments({
      leagueId: leagueId!,
      userId: session.user.id,
      contentType,
      moderator,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching hidden moments:', error);
    return NextResponse.json({ hiddenMoments: [], error: 'Failed to fetch hidden moments' }, { status: 500 });
  }
}
