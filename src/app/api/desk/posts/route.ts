import { NextResponse } from 'next/server';

import { getPostDrafts, savePostDraft, publishPost, deletePostDraft } from '@/data/desk/posts';

/**
 * GET /api/desk/posts
 * Get post drafts for a specific league/season/week
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueSlug = searchParams.get('leagueSlug');
    const seasonId = searchParams.get('seasonId');
    const weekNumber = searchParams.get('weekNumber');

    if (!leagueSlug || !seasonId || !weekNumber) {
      return NextResponse.json(
        { error: 'Missing required parameters: leagueSlug, seasonId, weekNumber' },
        { status: 400 }
      );
    }

    const drafts = await getPostDrafts({
      leagueSlug,
      seasonId,
      weekNumber: parseInt(weekNumber, 10),
    });

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('[API] Failed to get post drafts:', error);
    return NextResponse.json({ error: 'Failed to get post drafts' }, { status: 500 });
  }
}

/**
 * POST /api/desk/posts
 * Save a post draft or publish a post
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, leagueSlug, seasonId, weekNumber, content, title } = body;

    if (!leagueSlug || !seasonId || weekNumber === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters: leagueSlug, seasonId, weekNumber' },
        { status: 400 }
      );
    }

    if (action === 'publish') {
      if (!content) {
        return NextResponse.json({ error: 'Content is required for publishing' }, { status: 400 });
      }

      const result = await publishPost({
        leagueSlug,
        seasonId,
        weekNumber,
        content,
        title,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, momentId: result.momentId });
    } else {
      // Default action is to save draft
      const result = await savePostDraft({
        leagueSlug,
        seasonId,
        weekNumber,
        content: content || '',
        title,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, draft: result.draft, lastSaved: result.draft?.lastSaved });
    }
  } catch (error) {
    console.error('[API] Failed to save/publish post:', error);
    return NextResponse.json({ error: 'Failed to process post' }, { status: 500 });
  }
}

/**
 * DELETE /api/desk/posts
 * Delete a post draft
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId parameter' }, { status: 400 });
    }

    const result = await deletePostDraft(draftId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Failed to delete post draft:', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}
