import { revalidateTag, unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db';

import type { LeagueSettings, LeagueSettingsUpdate } from '@/types/league-settings';

export interface GetLeagueSettingsInput {
  slug: string;
}

/**
 * Helper to parse publicContent JSON with type safety
 */
function parsePublicContent(json: unknown): LeagueSettings['publicContent'] {
  const defaults = {
    rankings: true,
    matchups: true,
    brackets: true,
    transactions: false,
    history: true,
  };

  if (!json || typeof json !== 'object') {
    return defaults;
  }

  const parsed = json as Record<string, unknown>;
  return {
    rankings: typeof parsed.rankings === 'boolean' ? parsed.rankings : defaults.rankings,
    matchups: typeof parsed.matchups === 'boolean' ? parsed.matchups : defaults.matchups,
    brackets: typeof parsed.brackets === 'boolean' ? parsed.brackets : defaults.brackets,
    transactions: typeof parsed.transactions === 'boolean' ? parsed.transactions : defaults.transactions,
    history: typeof parsed.history === 'boolean' ? parsed.history : defaults.history,
  };
}

/**
 * Core implementation of getLeagueSettings - queries by league slug
 */
async function getLeagueSettingsImpl(slug: string): Promise<LeagueSettings | null> {
  // Query league by slug and include its settings
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      settings: true,
    },
  });

  // Return null if league not found
  if (!league) {
    return null;
  }

  // Return null if settings not found (settings might not exist yet)
  if (!league.settings) {
    return null;
  }

  const settings = league.settings;

  // Map Prisma model to frontend LeagueSettings type contract
  return {
    id: settings.id,
    leagueId: settings.leagueId,
    leagueSlug: league.slug,
    platform: league.platform,
    platformLeagueId: league.platformLeagueId,
    visibility: league.visibility as 'public' | 'private',
    joinRule: league.joinRule === 'auto_join' ? 'auto-join' : 'approval-required',
    fanAccessEnabled: settings.fanAccessEnabled,
    fanLimit: settings.fanLimit,
    currentFanCount: settings.currentFanCount,
    description: settings.description ?? '',
    publicContent: parsePublicContent(settings.publicContent),
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

/**
 * Get league settings by slug
 * Cached with unstable_cache using tag: settings-{slug}
 */
export async function getLeagueSettings(input: GetLeagueSettingsInput): Promise<LeagueSettings | null> {
  const { slug } = input;

  // Use unstable_cache for caching with a tag for invalidation
  const cachedGetSettings = unstable_cache(async () => getLeagueSettingsImpl(slug), [`settings-${slug}`], {
    tags: [`settings-${slug}`],
    revalidate: 300, // Cache for 5 minutes
  });

  return cachedGetSettings();
}

export interface UpdateLeagueSettingsInput {
  slug: string;
  updates: LeagueSettingsUpdate;
}

/**
 * Update league settings by slug
 */
export async function updateLeagueSettings(input: UpdateLeagueSettingsInput): Promise<LeagueSettings | null> {
  const { slug, updates } = input;

  // Find the league by slug
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { settings: true },
  });

  if (!league || !league.settings) {
    return null;
  }

  // Build the update data
  const updateData: Parameters<typeof prisma.leagueSettings.update>[0]['data'] = {};

  // Map frontend update fields to Prisma fields
  if (updates.fanAccessEnabled !== undefined) {
    updateData.fanAccessEnabled = updates.fanAccessEnabled;
  }
  if (updates.fanLimit !== undefined) {
    updateData.fanLimit = updates.fanLimit;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }

  // Handle publicContent partial update
  if (updates.publicContent) {
    const existingPublicContent = parsePublicContent(league.settings.publicContent);
    updateData.publicContent = {
      ...existingPublicContent,
      ...updates.publicContent,
    };
  }

  // Update settings in database
  const updatedSettings = await prisma.leagueSettings.update({
    where: { leagueId: league.id },
    data: updateData,
  });

  // Also update league visibility/joinRule if needed
  if (updates.visibility !== undefined || updates.joinRule !== undefined) {
    const leagueUpdateData: { visibility?: 'public' | 'private'; joinRule?: 'auto_join' | 'approval_required' } = {};

    if (updates.visibility !== undefined) {
      leagueUpdateData.visibility = updates.visibility as 'public' | 'private';
    }
    if (updates.joinRule !== undefined) {
      leagueUpdateData.joinRule = updates.joinRule === 'auto-join' ? 'auto_join' : 'approval_required';
    }

    await prisma.league.update({
      where: { id: league.id },
      data: leagueUpdateData,
    });

    // Invalidate the league cache since visibility changed
    revalidateTag(`league-${slug}`, 'max');
  }

  // Invalidate settings cache
  revalidateTag(`settings-${slug}`, 'max');

  // Fetch the updated league for the response
  const updatedLeague = await prisma.league.findUnique({
    where: { id: league.id },
  });

  if (!updatedLeague) {
    return null;
  }

  // Return the updated settings in frontend format
  return {
    id: updatedSettings.id,
    leagueId: updatedSettings.leagueId,
    leagueSlug: updatedLeague.slug,
    platform: updatedLeague.platform,
    platformLeagueId: updatedLeague.platformLeagueId,
    visibility: updatedLeague.visibility as 'public' | 'private',
    joinRule: updatedLeague.joinRule === 'auto_join' ? 'auto-join' : 'approval-required',
    fanAccessEnabled: updatedSettings.fanAccessEnabled,
    fanLimit: updatedSettings.fanLimit,
    currentFanCount: updatedSettings.currentFanCount,
    description: updatedSettings.description ?? '',
    publicContent: parsePublicContent(updatedSettings.publicContent),
    createdAt: updatedSettings.createdAt.toISOString(),
    updatedAt: updatedSettings.updatedAt.toISOString(),
  };
}
