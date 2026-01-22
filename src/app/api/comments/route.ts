import { NextResponse } from 'next/server';

import { createComment } from '@/data/comments/create-comment';
import { deleteComment } from '@/data/comments/delete-comment';
import { updateComment } from '@/data/comments/update-comment';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { momentId, content, parentId } = body;

    if (!momentId || !content) {
      return NextResponse.json({ error: 'momentId and content are required' }, { status: 400 });
    }

    const result = await createComment({
      momentId,
      content,
      parentId,
      authorId: session.user.id,
    });

    if (!result.success) {
      // Handle specific error cases
      if (result.error === 'Moment not found') {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      if (
        result.error?.includes('not a member') ||
        result.error?.includes('pending approval') ||
        result.error?.includes('rejected')
      ) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.comment);
  } catch (error) {
    console.error('[POST /api/comments] Error:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { commentId, content } = body;

    if (!commentId || !content) {
      return NextResponse.json({ error: 'commentId and content are required' }, { status: 400 });
    }

    const result = await updateComment({
      commentId,
      content,
      userId: session.user.id,
    });

    if (!result.success) {
      if (result.error === 'Comment not found') {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      if (result.error?.includes('only edit your own')) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.comment);
  } catch (error) {
    console.error('[PATCH /api/comments] Error:', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json({ error: 'commentId is required' }, { status: 400 });
    }

    const result = await deleteComment({
      commentId,
      userId: session.user.id,
    });

    if (!result.success) {
      if (result.error === 'Comment not found') {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      if (result.error?.includes('only delete your own')) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/comments] Error:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
