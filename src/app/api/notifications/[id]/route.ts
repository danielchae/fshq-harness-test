import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { markAsRead } from '@/lib/notifications';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/notifications/[id]
 * Mark a specific notification as read
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await markAsRead(userId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to mark notification as read:', error);
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
  }
}
