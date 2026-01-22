import { NextResponse } from 'next/server';

import { toggleReaction } from '@/data/reactions/toggle-reaction';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetId, targetType, emoji } = body;

    if (!targetId || !targetType || !emoji) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await toggleReaction({ targetId, targetType, emoji, userId });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to toggle reaction' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // Get authenticated user
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get('targetId');
    const targetType = searchParams.get('targetType') as 'moment' | 'comment' | null;
    const emoji = searchParams.get('emoji');

    if (!targetId || !targetType || !emoji) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // DELETE is the same as toggle when already reacted
    const result = await toggleReaction({ targetId, targetType, emoji, userId });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to remove reaction' }, { status: 500 });
  }
}
