// Data layer for publishing commissioner content
// Wires to publishContentAction server action with real database validation

import { publishContentAction, validateContentFromDb } from '@/actions/desk/publish-content';
import { prisma } from '@/lib/db';

import type { PublishRequest, PublishResponse, ValidationResult } from '@/types/publish';

// Validate all content sections from database
export async function validateContent(
  leagueSlug: string,
  weekNumber: number,
  skipSections: ('power-rankings' | 'matchup-predictions' | 'posts')[] = []
): Promise<ValidationResult> {
  // Lookup league by slug to get leagueId
  const league = await prisma.league.findUnique({
    where: { slug: leagueSlug },
    select: { id: true, season: true },
  });

  if (!league) {
    return {
      isValid: false,
      errors: [
        {
          section: 'general',
          message: 'League not found',
          details: 'Could not find the specified league.',
        },
      ],
    };
  }

  // Use the database validation from server action
  return validateContentFromDb(league.id, league.season, weekNumber, skipSections);
}

// Publish all content atomically via server action
export async function publishContent(input: PublishRequest): Promise<PublishResponse> {
  const { leagueSlug, seasonId, weekNumber, skipSections = [] } = input;

  // Call the server action which handles:
  // - Commissioner role validation
  // - Database validation
  // - Atomic transaction for publishing
  // - Feed moment creation
  // - Cache revalidation
  const result = await publishContentAction({
    leagueSlug,
    seasonId,
    weekNumber,
    skipSections,
  });

  // Handle next-safe-action response format
  if (result?.data) {
    return result.data;
  }

  // Handle server error or validation error from next-safe-action
  if (result?.serverError) {
    return {
      success: false,
      error: typeof result.serverError === 'string' ? result.serverError : 'Server error occurred',
    };
  }

  if (result?.validationErrors) {
    return {
      success: false,
      error: 'Validation failed',
    };
  }

  // Fallback error
  return {
    success: false,
    error: 'Failed to publish content. Please try again.',
  };
}
