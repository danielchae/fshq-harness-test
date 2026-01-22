import { NextResponse } from 'next/server';

import { unhideMoment } from '@/data/moderation/get-hidden-moments';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { momentId } = body;

    if (!momentId) {
      return NextResponse.json({ success: false, error: 'momentId is required' }, { status: 400 });
    }

    // Pass userId for RLS validation
    const result = await unhideMoment({
      momentId,
      userId: session.user.id,
    });

    if (!result.success) {
      const status = result.error?.includes('permission') ? 403 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error unhiding moment:', error);
    return NextResponse.json({ success: false, error: 'Failed to unhide moment' }, { status: 500 });
  }
}
