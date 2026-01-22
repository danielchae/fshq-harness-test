import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

const publicRoutes = ['/', '/sign-in', '/sign-up', '/api/auth'];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // MOCK: Allow requests with user-role cookie for development/testing
  // Backend task-45 will implement proper RBAC
  const userRoleCookie = req.cookies.get('user-role')?.value;
  const hasTestRole = userRoleCookie && ['admin', 'commissioner', 'manager', 'fan'].includes(userRoleCookie);

  // Redirect unauthenticated users to sign-in
  if (!req.auth && !hasTestRole) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
