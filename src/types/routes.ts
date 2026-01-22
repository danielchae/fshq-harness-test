/**
 * Type-safe route definitions for Next.js App Router
 *
 * This module provides typed route helpers that work with Next.js's strict
 * route typing (typedRoutes: true) while supporting dynamic route segments.
 *
 * The Route type from 'next' expects template literals that match generated
 * route patterns. When using dynamic slugs at runtime, TypeScript can't
 * verify the pattern match statically, so we use typed route builders that
 * return the correct type.
 */

import type { Route } from 'next';

/**
 * League sub-routes available under /leagues/[slug]
 */
export type LeagueSubRoute =
  | ''
  | '/feed'
  | '/pickems'
  | '/rankings'
  | '/matchups'
  | '/brackets'
  | '/leaderboard'
  | '/transactions'
  | '/desk'
  | '/settings'
  | '/members'
  | '/moderation'
  | '/teams'
  | '/teams/create'
  | '/history'
  | '/onboarding';

/**
 * Type-safe route builder for league routes.
 * Returns a properly typed Route for use with Link href and router.push.
 *
 * @example
 * // Basic league route
 * router.push(leagueRoute('my-league'));
 * // Result: '/leagues/my-league'
 *
 * @example
 * // League sub-route
 * <Link href={leagueRoute('my-league', '/feed')}>
 * // Result: '/leagues/my-league/feed'
 */
export function leagueRoute<T extends LeagueSubRoute = ''>(
  slug: string,
  subRoute: T = '' as T
): Route<`/leagues/${string}${T}`> {
  return `/leagues/${slug}${subRoute}` as Route<`/leagues/${string}${T}`>;
}

/**
 * Type-safe route builder for league history year routes.
 *
 * @example
 * <Link href={leagueHistoryRoute('my-league', '2024')}>
 * // Result: '/leagues/my-league/history/2024'
 */
export function leagueHistoryRoute(
  slug: string,
  year: string | number
): Route<`/leagues/${string}/history/${string}`> {
  return `/leagues/${slug}/history/${year}` as Route<`/leagues/${string}/history/${string}`>;
}

/**
 * Type-safe route builder for league moment routes.
 *
 * @example
 * <Link href={leagueMomentRoute('my-league', 'moment-123')}>
 * // Result: '/leagues/my-league/moment/moment-123'
 */
export function leagueMomentRoute(
  slug: string,
  momentId: string
): Route<`/leagues/${string}/moment/${string}`> {
  return `/leagues/${slug}/moment/${momentId}` as Route<`/leagues/${string}/moment/${string}`>;
}

/**
 * Type assertion helper for routes that are dynamically constructed
 * but known to be valid at runtime. This is safer than `as any` because:
 * 1. It documents the intent (this is a route)
 * 2. It returns a proper Route type
 * 3. All route handling is centralized in this module
 *
 * Use this sparingly - prefer the specific route builders above when possible.
 *
 * @example
 * // When you have a URL from an API response
 * <Link href={asRoute(result.rankingsUrl)}>
 */
export function asRoute<T extends string>(path: T): Route<T> {
  return path as Route<T>;
}
