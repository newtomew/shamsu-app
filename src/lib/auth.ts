// auth.ts — password hashing (bcrypt) + DB-backed session resolution.
// Node-only (bcrypt is a native addon) — never import this from middleware.ts;
// use jwt.ts there instead.

import type { NextRequest } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from './db';
import { COOKIE_NAME, verifySessionToken } from './jwt';
import type { User } from '@/generated/prisma/client';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Resolves the authenticated user from a Route Handler's request: either the
// httpOnly session cookie (the web dashboard) OR an `Authorization: Bearer`
// token (the Chrome extension, Phase 9 — it can't read the httpOnly cookie).
// Both are the same kind of JWT (see jwt.ts), just different lifetimes, so
// either is accepted anywhere this is used. Returns null if neither is
// present, the token is invalid/expired, or the user no longer exists.
export async function getSessionUser(req: NextRequest): Promise<User | null> {
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const token = bearer || req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

// Resolves the request's user AND confirms they're an admin (Phase 10).
// Returns null for anyone not logged in or not flagged isAdmin — routes
// should treat both cases identically (403), never revealing which.
export async function getAdminUser(req: NextRequest): Promise<User | null> {
  const user = await getSessionUser(req);
  if (!user || !user.isAdmin) return null;
  return user;
}

// Same as above, for Server Components (which read cookies via next/headers
// instead of a NextRequest).
export async function getSessionUserFromCookieStore(
  cookieStore: { get(name: string): { value: string } | undefined }
): Promise<User | null> {
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}

// Shape safe to send to the client — never include passwordHash. Decimal is
// stringified: Prisma's Decimal is a class instance, not a plain value, so it
// can't cross the Server->Client Component boundary or survive JSON.stringify
// with full precision otherwise.
export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    mode: user.mode,
    api_credits_balance: user.apiCreditsBalance.toString(),
  };
}

export type PublicUser = ReturnType<typeof publicUser>;
