// middleware.ts — protects app PAGE routes. Unauthenticated visitors are
// redirected to /login. API routes are deliberately excluded here: they
// enforce their own session check and return 401 JSON (a redirect would
// break API/fetch callers expecting JSON, not an HTML login page).
//
// Uses jwt.ts (jose, WebCrypto) rather than auth.ts (bcrypt + Prisma) —
// Edge Middleware can't run native addons or Prisma's engine.

import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from '@/lib/jwt';

const PUBLIC_PAGE_PATHS = ['/', '/login', '/signup'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isApiRoute = pathname.startsWith('/api/');
  const isPublicPage = PUBLIC_PAGE_PATHS.includes(pathname);
  if (isApiRoute || isPublicPage) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const userId = token ? await verifySessionToken(token) : null;

  if (!userId) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next's static assets and favicon — new app pages are
  // protected by default as soon as they're added, with no per-page opt-in.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
