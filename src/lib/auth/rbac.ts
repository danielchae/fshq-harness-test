import { cookies } from 'next/headers';

import type { UserRole } from '@/types/user';

/**
 * Custom error class for authorization failures.
 * Thrown when a user lacks the required role/permissions for an action.
 */
export class AuthorizationError extends Error {
  constructor(message = 'Unauthorized: Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Role hierarchy levels for permission comparison.
 * Higher numbers indicate more permissions.
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  commissioner: 4,
  admin: 3,
  manager: 2,
  fan: 1,
};

/**
 * Token patterns for determining user roles from auth tokens.
 * Order matters - more specific patterns come first to avoid substring issues.
 * e.g., 'non-commissioner' should match as 'fan', not 'commissioner'.
 * MOCK: In production, this would validate against a real auth service.
 */
const TOKEN_ROLE_PATTERNS: { pattern: string; role: UserRole }[] = [
  // More specific patterns first
  { pattern: 'non-commissioner', role: 'fan' },
  { pattern: 'non-admin', role: 'fan' },
  // Standard role patterns
  { pattern: 'commissioner', role: 'commissioner' },
  { pattern: 'admin', role: 'admin' },
  { pattern: 'manager', role: 'manager' },
  { pattern: 'fan', role: 'fan' },
];

/**
 * Get user authentication status and role from request cookies.
 * Supports both real NextAuth sessions and test tokens.
 *
 * MOCK: Backend will replace with proper session validation.
 */
export async function getAuthState(): Promise<{
  isAuthenticated: boolean;
  role: UserRole | null;
  userId: string | null;
}> {
  const cookieStore = await cookies();

  // Check for test auth token first (used in E2E tests)
  const authToken = cookieStore.get('auth-token')?.value;
  if (authToken) {
    // Parse role from test token (e.g., 'commissioner-user-token' -> 'commissioner')
    // Uses ordered patterns to handle substrings correctly
    for (const { pattern, role } of TOKEN_ROLE_PATTERNS) {
      if (authToken.includes(pattern)) {
        return {
          isAuthenticated: true,
          role,
          userId: `mock-${pattern}-user`,
        };
      }
    }
    // Generic authenticated token without specific role
    if (authToken.length > 0) {
      return {
        isAuthenticated: true,
        role: 'fan',
        userId: 'mock-user',
      };
    }
  }

  // Check for NextAuth session token
  // In development (HTTP): authjs.session-token
  // In production (HTTPS): __Secure-authjs.session-token
  const sessionToken =
    cookieStore.get('authjs.session-token')?.value ||
    cookieStore.get('__Secure-authjs.session-token')?.value;
  if (sessionToken) {
    // Check role from session token pattern (for testing)
    for (const { pattern, role } of TOKEN_ROLE_PATTERNS) {
      if (sessionToken.includes(pattern)) {
        return {
          isAuthenticated: true,
          role,
          userId: `session-${pattern}-user`,
        };
      }
    }
    // Default to fan role for generic sessions
    return {
      isAuthenticated: true,
      role: 'fan',
      userId: 'session-user',
    };
  }

  // Check for explicit role cookie (for testing)
  const roleCookie = cookieStore.get('user-role')?.value as UserRole | undefined;
  if (roleCookie && Object.keys(ROLE_HIERARCHY).includes(roleCookie)) {
    return {
      isAuthenticated: true,
      role: roleCookie,
      userId: `role-${roleCookie}-user`,
    };
  }

  // No authentication found
  return {
    isAuthenticated: false,
    role: null,
    userId: null,
  };
}

/**
 * Check if the current user has a specific role or higher permission level.
 *
 * @param requiredRole - The minimum role required
 * @returns true if user has the required role or higher, false otherwise
 */
export async function checkRole(requiredRole: UserRole): Promise<boolean> {
  const { isAuthenticated, role } = await getAuthState();

  if (!isAuthenticated || !role) {
    return false;
  }

  const userLevel = ROLE_HIERARCHY[role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  return userLevel >= requiredLevel;
}

/**
 * Check if one role has permission level equal to or higher than another.
 *
 * @param userRole - The user's current role
 * @param requiredRole - The minimum required role
 * @returns true if userRole meets or exceeds requiredRole
 */
export function hasPermission(userRole: UserRole | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;

  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  return userLevel >= requiredLevel;
}

/**
 * Higher-order function to protect server actions with role requirements.
 * Throws AuthorizationError if user doesn't have required role.
 *
 * @param requiredRole - The minimum role required to execute the action
 * @param action - The server action to protect
 * @returns A wrapped action that checks permissions before execution
 *
 * @example
 * ```typescript
 * const protectedAction = requireRole('commissioner', async (data) => {
 *   // Only commissioners can execute this
 *   return await saveSettings(data);
 * });
 * ```
 */
export function requireRole<TArgs extends unknown[], TReturn>(
  requiredRole: UserRole,
  action: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const hasAccess = await checkRole(requiredRole);

    if (!hasAccess) {
      throw new AuthorizationError(`Unauthorized: ${requiredRole} role or higher is required`);
    }

    return action(...args);
  };
}

/**
 * Check authorization and throw if insufficient permissions.
 * Use this in API routes or server components for imperative checks.
 *
 * @param requiredRole - The minimum role required
 * @throws AuthorizationError if user lacks required permissions
 */
export async function assertRole(requiredRole: UserRole): Promise<void> {
  const hasAccess = await checkRole(requiredRole);

  if (!hasAccess) {
    throw new AuthorizationError(`Unauthorized: ${requiredRole} role or higher is required`);
  }
}

/**
 * Get authentication state with a specific league context.
 * MOCK: Backend will implement league-specific role lookup.
 *
 * @param leagueSlug - The league identifier for context
 * @returns Auth state with league-specific role
 */
export async function getLeagueAuthState(leagueSlug: string): Promise<{
  isAuthenticated: boolean;
  role: UserRole | null;
  userId: string | null;
  leagueSlug: string;
}> {
  const baseState = await getAuthState();

  // MOCK: In production, would check user's role in this specific league
  return {
    ...baseState,
    leagueSlug,
  };
}
