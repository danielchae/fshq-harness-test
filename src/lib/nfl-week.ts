/**
 * Shared utility for calculating/fetching the current NFL week
 *
 * Uses the Sleeper API as the source of truth when available,
 * with a fallback calculation based on the typical NFL season start date.
 */

import { fetchSleeperNFLState } from '@/integrations/sleeper/fetch-nfl-state';

/** Total weeks in the NFL regular season */
export const NFL_TOTAL_WEEKS = 18;

/** Default week to use when all else fails */
const FALLBACK_WEEK = 1;

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
 * Get the current NFL week from the Sleeper API
 * Falls back to date-based calculation if API is unavailable
 *
 * This is the primary function to use throughout the app.
 * It's cached for 1 hour via the Sleeper integration.
 */
export async function getCurrentNFLWeek(): Promise<number> {
  try {
    const nflState = await fetchSleeperNFLState();

    if (nflState) {
      // Use display_week for UI purposes (accounts for bye weeks, etc.)
      // Only use it during regular season; otherwise fall back to calculation
      if (nflState.season_type === 'regular' && nflState.week > 0) {
        return nflState.week;
      }

      // During preseason, return week 1
      if (nflState.season_type === 'pre') {
        return 1;
      }

      // During postseason, return the last regular season week
      if (nflState.season_type === 'post') {
        return NFL_TOTAL_WEEKS;
      }

      // During offseason, calculate based on upcoming season
      if (nflState.season_type === 'off') {
        return 1;
      }
    }
  } catch (error) {
    console.warn('[getCurrentNFLWeek] Failed to fetch from Sleeper API, using fallback calculation:', error);
  }

  // Fallback to date-based calculation
  return calculateNFLWeekFromDate();
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
