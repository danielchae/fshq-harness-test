import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Role-Based Access Control Middleware for Next.js
 *
 * This middleware handles:
 * 1. Authentication checks for protected routes
 * 2. Redirects unauthenticated users to sign-in
 * 3. Allows public league access for unauthenticated visitors
 *
 * Route-level role authorization is handled by individual pages/components
 * since middleware runs on the Edge runtime with limited access to cookies.
 */

// Routes that ALWAYS require authentication (even for public leagues)
const PROTECTED_ROUTES = [
  '/leagues/*/desk',
  '/leagues/*/settings',
  '/leagues/*/moderation',
  '/dashboard',
  '/profile',
  '/connect-league',
];

// Routes that are always public (no auth check needed)
const PUBLIC_ROUTES = [
  '/', // Landing page is always public
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/images',
];

// League routes that can be accessed by public visitors (if league is public)
// These routes allow unauthenticated access - the page/API will check league visibility
const PUBLIC_LEAGUE_ROUTES = [
  '/leagues/*', // Base league page and all subpages (except protected ones above)
  '/api/leagues/*', // API routes for league data (API will check league visibility)
];

/**
 * Check if a path matches a pattern with wildcard support.
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Convert wildcard pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '[^/]+') // * matches any single segment
    .replace(/\//g, '\\/'); // Escape forward slashes

  const regex = new RegExp(`^${regexPattern}($|/)`);
  return regex.test(path);
}

/**
 * Check if the path is a public route.
 */
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path.startsWith(route));
}

/**
 * Check if the path requires authentication.
 */
function isProtectedRoute(path: string): boolean {
  return PROTECTED_ROUTES.some((pattern) => matchesPattern(path, pattern));
}

/**
 * Check if this is a league route that could be publicly accessible.
 * Public league visibility is checked at the page/API level.
 */
function isPotentiallyPublicLeagueRoute(path: string): boolean {
  return PUBLIC_LEAGUE_ROUTES.some((pattern) => matchesPattern(path, pattern));
}

/**
 * Check if the user is authenticated based on cookies.
 */
function isAuthenticated(request: NextRequest): boolean {
  // Check for test auth token (used in E2E tests)
  const authToken = request.cookies.get('auth-token')?.value;
  if (authToken && authToken.length > 0) {
    return true;
  }

  // Check for NextAuth session token
  // In development (HTTP): authjs.session-token
  // In production (HTTPS): __Secure-authjs.session-token
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;
  if (sessionToken) {
    return true;
  }

  // Check for explicit role cookie (for testing)
  const roleCookie = request.cookies.get('user-role')?.value;
  if (roleCookie) {
    return true;
  }

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip always-public routes (auth pages, static files, etc.)
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check strictly protected routes first (desk, settings, moderation)
  // These always require authentication regardless of league visibility
  if (isProtectedRoute(pathname)) {
    if (!isAuthenticated(request)) {
      // Redirect to sign-in with callback URL
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  // For league routes that could be public, allow through
  // The page/layout will check league visibility and handle appropriately
  if (isPotentiallyPublicLeagueRoute(pathname)) {
    return NextResponse.next();
  }

  // For all other routes, require authentication
  if (!isAuthenticated(request)) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files and API routes that don't need auth
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|images|public).*)',
  ],
};
