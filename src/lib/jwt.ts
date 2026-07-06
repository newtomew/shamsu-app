// jwt.ts — session token sign/verify only. Deliberately kept free of `bcrypt`
// and Prisma imports so it can run in Next.js Edge Middleware (jose uses
// WebCrypto, not Node's native crypto/bindings). auth.ts (Node-only, uses
// bcrypt + the DB) imports from here rather than duplicating this logic.

import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'shamsu_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set — copy .env.example to .env and fill it in.');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

// Long-lived token for the Chrome extension (Phase 9): the extension can't
// read the httpOnly session cookie, so a logged-in user generates one of
// these from the dashboard and pastes it into the extension popup instead.
// Same signing mechanism as the session cookie (just a userId JWT with a
// longer expiry) — no separate token table/schema needed. Stateless, so
// there's no server-side revocation list yet; noted as a known MVP gap.
const EXTENSION_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days

export async function createExtensionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, purpose: 'extension' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXTENSION_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

// Returns the userId encoded in the token, or null if missing/invalid/expired.
// Signature-only check — does not confirm the user still exists in the DB
// (that's left to auth.ts's getSessionUser, which route handlers use for
// anything that needs real user data or an ownership check).
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;
