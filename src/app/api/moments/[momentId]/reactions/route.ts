import { NextResponse } from 'next/server';

import { getReactionCounts, getUserReactionsForTarget, toggleReaction } from '@/data/reactions/toggle-reaction';
import { auth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ momentId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { momentId } = await context.params;

  try {
    // Get authenticated user
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { emoji } = body;

    if (!emoji) {
      return NextResponse.json({ error: 'Missing required field: emoji' }, { status: 400 });
    }

    const result = await toggleReaction({
      targetId: momentId,
      targetType: 'moment',
      emoji,
      userId,
    });

    if (!result.success) {
      // Return appropriate error status code
      if (result.error === 'Moment not found') {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Get updated reaction counts from database
    const reactions = await getReactionCounts(momentId, 'moment');

    // Get current user reactions for this moment
    const userReactions = await getUserReactionsForTarget(momentId, 'moment', userId);

    return NextResponse.json({
      success: true,
      action: result.action,
      reactions,
      userReacted: userReactions.includes(emoji),
      userReactions,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to toggle reaction' }, { status: 500 });
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { momentId } = await context.params;

  try {
    // Get authenticated user (optional for getting reactions)
    const session = await auth();
    const userId = session?.user?.id;

    // Get reaction counts
    const reactions = await getReactionCounts(momentId, 'moment');

    // Get user's reactions if logged in
    const userReactions = userId ? await getUserReactionsForTarget(momentId, 'moment', userId) : [];

    return NextResponse.json({
      reactions,
      userReactions,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to get reactions' }, { status: 500 });
  }
}
