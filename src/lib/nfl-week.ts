/**
 * Shared utility for calculating/fetching the current NFL week
 *
 * Uses the Sleeper API as the source of truth when available,
 * with a fallback calculation based on the typical NFL season start date.
 */

import { fetchSleeperNFLState } from '@/integrations/sleeper/fetch-nfl-state';

import type { SleeperSeasonType } from '@/types/sleeper';

/** Total weeks in the NFL regular season */
export const NFL_TOTAL_WEEKS = 18;

/** Default fantasy championship week (most leagues end here) */
export const DEFAULT_CHAMPIONSHIP_WEEK = 17;

/** Default week to use when all else fails */
const FALLBACK_WEEK = 1;

/**
 * Season status for determining app behavior
 */
export type SeasonStatus = 'preseason' | 'regular' | 'postseason' | 'offseason';

/**
 * Extended NFL state with computed properties for app logic
 */
export interface NFLSeasonState {
  /** Current NFL week (for regular season) or last regular season week */
  week: number;
  /** NFL season year (e.g., 2025) */
  season: number;
  /** Raw season type from Sleeper API */
  seasonType: SleeperSeasonType;
  /** Computed season status for app logic */
  status: SeasonStatus;
  /** Whether the fantasy regular season is likely complete */
  isFantasySeasonComplete: boolean;
  /** Whether picks can currently be made (regular season, games not started) */
  isPicksEnabled: boolean;
  /** Human-readable status message */
  statusMessage: string;
}

/**
 * Calculate the current NFL week based on date
 * This is a fallback when the Sleeper API is unavailable
 *
 * NFL regular season typically starts the first Thursday after Labor Day
 * (first Monday of September), which is the Thursday of the week following Labor Day.
 */
export function calculateNFLWeekFromDate(date: Date = new Date()): number {
  const year = date.getFullYear();

  // Find the first Monday of September (Labor Day)
  const laborDay = new Date(year, 8, 1); // September 1st
  while (laborDay.getDay() !== 1) {
    laborDay.setDate(laborDay.getDate() + 1);
  }

  // NFL season typically starts the Thursday after Labor Day
  const seasonStart = new Date(laborDay);
  seasonStart.setDate(laborDay.getDate() + 3); // Thursday = Monday + 3 days

  // If we're before the season, return week 1
  if (date < seasonStart) {
    return 1;
  }

  // Calculate weeks since season start
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((date.getTime() - seasonStart.getTime()) / msPerWeek);

  // NFL regular season is 18 weeks, cap at 18
  return Math.min(Math.max(1, weeksSinceStart + 1), NFL_TOTAL_WEEKS);
}

/**
 * Get the full NFL season state with computed properties
 * This is the primary function to use for season-aware logic.
 */
export async function getNFLSeasonState(): Promise<NFLSeasonState> {
  try {
    const nflState = await fetchSleeperNFLState();

    if (nflState) {
      const season = parseInt(nflState.season, 10) || new Date().getFullYear();
      const seasonType = nflState.season_type;

      // Determine season status and week
      let week: number;
      let status: SeasonStatus;
      let isFantasySeasonComplete: boolean;
      let isPicksEnabled: boolean;
      let statusMessage: string;

      switch (seasonType) {
        case 'pre':
          week = 1;
          status = 'preseason';
          isFantasySeasonComplete = false;
          isPicksEnabled = false;
          statusMessage = 'Preseason - Season starts soon';
          break;

        case 'regular':
          week = nflState.week > 0 ? nflState.week : 1;
          status = 'regular';
          // Fantasy is typically complete after week 17 (championship)
          isFantasySeasonComplete = week > DEFAULT_CHAMPIONSHIP_WEEK;
          isPicksEnabled = week <= DEFAULT_CHAMPIONSHIP_WEEK;
          statusMessage = `Week ${week}`;
          break;

        case 'post':
          // During NFL playoffs, fantasy regular season is complete
          // Return the championship week as the "current" fantasy week
          week = DEFAULT_CHAMPIONSHIP_WEEK;
          status = 'postseason';
          isFantasySeasonComplete = true;
          isPicksEnabled = false;
          statusMessage = 'Season Complete - NFL Playoffs';
          break;

        case 'off':
        default:
          week = 1;
          status = 'offseason';
          isFantasySeasonComplete = true;
          isPicksEnabled = false;
          statusMessage = 'Offseason';
          break;
      }

      return {
        week,
        season,
        seasonType,
        status,
        isFantasySeasonComplete,
        isPicksEnabled,
        statusMessage,
      };
    }
  } catch (error) {
    console.warn('[getNFLSeasonState] Failed to fetch from Sleeper API, using fallback calculation:', error);
  }

  // Fallback to date-based calculation
  const week = calculateNFLWeekFromDate();
  return {
    week,
    season: new Date().getFullYear(),
    seasonType: 'regular',
    status: 'regular',
    isFantasySeasonComplete: false,
    isPicksEnabled: true,
    statusMessage: `Week ${week}`,
  };
}

/**
 * Get the current NFL week from the Sleeper API
 * Falls back to date-based calculation if API is unavailable
 *
 * This is the primary function to use throughout the app.
 * It's cached for 1 hour via the Sleeper integration.
 * 
 * @deprecated Prefer getNFLSeasonState() for season-aware logic
 */
export async function getCurrentNFLWeek(): Promise<number> {
  const state = await getNFLSeasonState();
  return state.week;
}

/**
 * Synchronous version that only uses date-based calculation
 * Use this when you can't use async (e.g., in component default props)
 */
export function getCurrentNFLWeekSync(): number {
  return calculateNFLWeekFromDate();
}

/**
 * Get the current NFL season year
 * Uses Sleeper API with fallback to current year logic
 */
export async function getCurrentNFLSeason(): Promise<number> {
  try {
    const nflState = await fetchSleeperNFLState();

    if (nflState) {
      return parseInt(nflState.season, 10);
    }
  } catch (error) {
    console.warn('[getCurrentNFLSeason] Failed to fetch from Sleeper API, using fallback:', error);
  }

  // Fallback: If we're before September, use current year; otherwise use current year
  // NFL season spans two calendar years but is named after the year it starts
  const now = new Date();
  return now.getFullYear();
}
