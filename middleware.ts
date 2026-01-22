import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Role-Based Access Control Middleware for Next.js
 *
 * This middleware handles:
 * 1. Authentication checks for protected routes
 * 2. Redirects unauthenticated users to sign-in
 *
 * Route-level role authorization is handled by individual pages/components
 * since middleware runs on the Edge runtime with limited access to cookies.
 */

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/leagues/*/desk',
  '/leagues/*/settings',
  '/leagues/*/moderation',
  '/dashboard',
  '/profile',
];

// Routes that are always public
const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/api/auth',
  '/_next',
  '/favicon.ico',
  '/images',
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
 * Check if the user is authenticated based on cookies.
 */
function isAuthenticated(request: NextRequest): boolean {
  // Check for test auth token (used in E2E tests)
  const authToken = request.cookies.get('auth-token')?.value;
  if (authToken && authToken.length > 0) {
    return true;
  }

  // Check for NextAuth session token
  const sessionToken = request.cookies.get('authjs.session-token')?.value;
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

  // Skip public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check protected routes
  if (isProtectedRoute(pathname)) {
    if (!isAuthenticated(request)) {
      // Redirect to sign-in with callback URL
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
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
