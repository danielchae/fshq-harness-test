import { NextResponse } from 'next/server';

import { joinLeague, getMembershipStatus } from '@/data/leagues/join-league';
import { auth } from '@/lib/auth';

import type { JoinLeagueResult } from '@/data/leagues/join-league';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/leagues/[slug]/join - Check user's membership status
 * Returns whether the user can join and their current status if any
 */
export async function GET(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const { slug } = await context.params;

  try {
    const status = await getMembershipStatus(session.user.id, slug);

    return NextResponse.json({
      canJoin: !status.exists || status.status === 'rejected',
      ...status,
    });
  } catch (error) {
    console.error('Error checking membership status:', error);
    return NextResponse.json(
      { error: 'Failed to check membership status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leagues/[slug]/join - Join a league
 * Creates a membership (approved for auto_join, pending for approval_required)
 */
export async function POST(
  request: Request,
  context: RouteContext
): Promise<NextResponse<JoinLeagueResult>> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        message: 'Please sign in to join this league',
      },
      { status: 401 }
    );
  }

  const { slug } = await context.params;

  try {
    const result = await joinLeague({
      leagueSlug: slug,
      userId: session.user.id,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error joining league:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to join league. Please try again.',
      },
      { status: 500 }
    );
  }
}
