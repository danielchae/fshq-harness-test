import { cookies } from 'next/headers';

import { auth } from '@/lib/auth';
import { getUserRoleBySlug, hasRolePermission } from '@/lib/auth/rls-policies';

export type UserRole = 'commissioner' | 'admin' | 'manager' | 'fan' | null;

/**
 * Get the user's role for a league.
 * First checks cookies for testing, then falls back to database lookup.
 *
 * @param leagueSlug - The league slug to check role for
 * @returns The user's role in the league
 */
export async function getUserRole(leagueSlug: string): Promise<UserRole> {
  const cookieStore = await cookies();

  // For testing: if a role cookie is set, use it
  const roleCookie = cookieStore.get('user-role');
  if (roleCookie?.value) {
    const role = roleCookie.value as UserRole;
    if (['commissioner', 'admin', 'manager', 'fan'].includes(role as string)) {
      return role;
    }
  }

  // Get the current user session
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  // Look up the user's role in the database
  const dbRole = await getUserRoleBySlug(session.user.id, leagueSlug);

  // Map Prisma MembershipRole to UserRole
  return dbRole as UserRole;
}

/**
 * Check if user has a specific role or higher permission level.
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns true if userRole meets or exceeds requiredRole
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  if (!userRole || !requiredRole) return false;

  return hasRolePermission(userRole, requiredRole);
}
