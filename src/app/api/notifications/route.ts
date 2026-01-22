import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getNotifications, getUnreadCount, markAllAsRead } from '@/lib/notifications';

/**
 * GET /api/notifications
 * Returns the current user's notifications
 */
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notifications = await getNotifications(userId);
    const unreadCount = await getUnreadCount(userId);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('[API] Failed to fetch notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

/**
 * POST /api/notifications
 * Mark all notifications as read
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'mark_all_read') {
      await markAllAsRead(userId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[API] Failed to process notification action:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
