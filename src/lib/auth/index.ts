/**
 * Auth Module Index
 *
 * Exports all authentication and authorization utilities
 * including Row-Level Security policies.
 */

// Re-export from main auth module
export { auth, signIn, signOut, handlers } from '@/lib/auth';

// Export RLS policies
export {
  RLSError,
  checkLeagueMembership,
  getUserRoleInLeague,
  getUserRoleBySlug,
  hasRolePermission,
  canAccessLeague,
  canModifyLeagueSettings,
  canModerateLeague,
  canPostInLeague,
  requireLeagueAccess,
  requireLeagueRole,
  requireCommissioner,
  getUserLeagueIds,
  getUserLeagues,
  getLeagueAccessFilter,
  getAccessibleLeague,
  getAccessibleLeagueBySlug,
  type MembershipCheckResult,
} from './rls-policies';

// Export RLS middleware
export {
  withAuth,
  withLeagueAccess,
  withCommissionerAccess,
  withLeagueRole,
  checkLeagueAccess,
  type RLSContext,
} from './rls-middleware';

// Export RBAC utilities
export {
  AuthorizationError,
  getAuthState,
  checkRole,
  hasPermission,
  requireRole,
  assertRole,
  getLeagueAuthState,
} from './rbac';

// Export role utilities
export { getUserRole, hasRole } from './get-user-role';

// Export public access utilities
export {
  checkLeaguePublicAccess,
  isLeaguePublicById,
  getPublicContentSettings,
  getAccessContext,
  type PublicAccessContext,
} from './public-access';
