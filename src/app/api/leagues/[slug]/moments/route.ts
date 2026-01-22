import { NextResponse } from 'next/server';

import { createMoment } from '@/data/feed/create-moment';
import { auth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  // Verify user is authenticated
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { slug } = await context.params;

  try {
    const body = await request.json();
    const { content, type } = body;

    if (!content) {
      return NextResponse.json({ error: 'Missing required field: content' }, { status: 400 });
    }

    const result = await createMoment({
      leagueSlug: slug,
      content,
      authorId: session.user.id,
      authorName: session.user.name || 'Unknown',
      authorAvatar: session.user.image || undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Return the moment with the type from request if provided
    const moment = {
      ...result.moment,
      type: type || result.moment?.type || 'post',
    };

    return NextResponse.json(moment, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create moment' }, { status: 500 });
  }
}
