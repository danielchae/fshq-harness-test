/**
 * Commissioner Posts Data Layer
 *
 * Handles CRUD operations for commissioner posts/announcements.
 * Posts are stored as Moment records with type 'post' and
 * can be published to the league feed.
 */

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

// Types for posts
export interface PostDraft {
  id?: string;
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
  title?: string;
  content: string;
  status: 'draft' | 'published';
  lastSaved?: string;
  publishedAt?: string;
}

export interface GetPostDraftsInput {
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
}

export interface SavePostDraftInput {
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
  content: string;
  title?: string;
}

export interface PublishPostInput {
  leagueSlug: string;
  seasonId: string;
  weekNumber: number;
  content: string;
  title?: string;
}

/**
 * Get post drafts for a specific week
 * Returns unpublished posts stored in user preferences as drafts
 */
export async function getPostDrafts(input: GetPostDraftsInput): Promise<PostDraft[]> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return [];
  }

  // Get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: input.leagueSlug },
  });

  if (!league) {
    return [];
  }

  // Get user's draft posts from preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) ?? {};
  const postDrafts = (prefs.postDrafts as PostDraft[]) ?? [];

  // Filter drafts for the specific league/season/week
  return postDrafts.filter(
    (draft) =>
      draft.leagueSlug === input.leagueSlug &&
      draft.seasonId === input.seasonId &&
      draft.weekNumber === input.weekNumber &&
      draft.status === 'draft'
  );
}

/**
 * Save a post draft
 * Stores the draft in user preferences for later publishing
 */
export async function savePostDraft(input: SavePostDraftInput): Promise<{ success: boolean; draft?: PostDraft; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Verify league exists
  const league = await prisma.league.findUnique({
    where: { slug: input.leagueSlug },
  });

  if (!league) {
    return { success: false, error: 'League not found' };
  }

  // Verify user is commissioner
  const membership = await prisma.leagueMembership.findUnique({
    where: {
      user_league_unique: {
        userId,
        leagueId: league.id,
      },
    },
  });

  if (membership?.role !== 'commissioner') {
    return { success: false, error: 'Unauthorized: Commissioner role required' };
  }

  // Get user's current drafts
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) ?? {};
  const existingDrafts = (prefs.postDrafts as PostDraft[]) ?? [];

  // Create or update draft
  const draftId = `draft_${input.leagueSlug}_${input.seasonId}_${input.weekNumber}_${Date.now()}`;
  const now = new Date().toISOString();

  // Remove any existing draft for this week (we only keep one draft per week)
  const otherDrafts = existingDrafts.filter(
    (d) =>
      !(
        d.leagueSlug === input.leagueSlug &&
        d.seasonId === input.seasonId &&
        d.weekNumber === input.weekNumber &&
        d.status === 'draft'
      )
  );

  const newDraft: PostDraft = {
    id: draftId,
    leagueSlug: input.leagueSlug,
    seasonId: input.seasonId,
    weekNumber: input.weekNumber,
    title: input.title,
    content: input.content,
    status: 'draft',
    lastSaved: now,
  };

  // Save updated drafts
  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: {
        ...prefs,
        postDrafts: [...otherDrafts, newDraft],
      },
    },
  });

  return { success: true, draft: newDraft };
}

/**
 * Publish a post to the league feed
 * Creates a Moment record with type 'post'
 */
export async function publishPost(input: PublishPostInput): Promise<{ success: boolean; momentId?: string; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Get the league by slug
  const league = await prisma.league.findUnique({
    where: { slug: input.leagueSlug },
  });

  if (!league) {
    return { success: false, error: 'League not found' };
  }

  // Verify user is commissioner
  const membership = await prisma.leagueMembership.findUnique({
    where: {
      user_league_unique: {
        userId,
        leagueId: league.id,
      },
    },
  });

  if (membership?.role !== 'commissioner') {
    return { success: false, error: 'Unauthorized: Commissioner role required' };
  }

  // Create the moment
  const content = input.title ? `**${input.title}**\n\n${input.content}` : input.content;

  const moment = await prisma.moment.create({
    data: {
      leagueId: league.id,
      authorId: userId,
      type: 'post',
      content,
      isPinned: false,
      isHidden: false,
    },
  });

  // Clear the draft for this week
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) ?? {};
  const existingDrafts = (prefs.postDrafts as PostDraft[]) ?? [];

  const updatedDrafts = existingDrafts.filter(
    (d) =>
      !(
        d.leagueSlug === input.leagueSlug &&
        d.seasonId === input.seasonId &&
        d.weekNumber === input.weekNumber &&
        d.status === 'draft'
      )
  );

  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: {
        ...prefs,
        postDrafts: updatedDrafts,
      },
    },
  });

  // Revalidate feed
  revalidatePath(`/leagues/${input.leagueSlug}/feed`);
  revalidatePath(`/leagues/${input.leagueSlug}`);

  return { success: true, momentId: moment.id };
}

/**
 * Delete a draft
 */
export async function deletePostDraft(draftId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: 'Unauthorized' };
  }

  // Get user's current drafts
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) ?? {};
  const existingDrafts = (prefs.postDrafts as PostDraft[]) ?? [];

  // Filter out the draft to delete
  const updatedDrafts = existingDrafts.filter((d) => d.id !== draftId);

  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: {
        ...prefs,
        postDrafts: updatedDrafts,
      },
    },
  });

  return { success: true };
}
