import { NextResponse } from 'next/server';

import { pinMoment } from '@/data/moderation/moderate-moment';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { momentId, pin = true } = body;

    if (!momentId) {
      return NextResponse.json({ success: false, error: 'momentId is required' }, { status: 400 });
    }

    // Pass userId for RLS validation
    const result = await pinMoment({
      momentId,
      pin,
      userId: session.user.id,
    });

    if (!result.success) {
      const status = result.error?.includes('permission') ? 403 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error pinning moment:', error);
    return NextResponse.json({ success: false, error: 'Failed to pin moment' }, { status: 500 });
  }
}
