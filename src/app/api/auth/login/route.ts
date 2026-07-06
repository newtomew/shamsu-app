// POST /api/auth/login — verifies email + password, starts a session.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, publicUser } from '@/lib/auth';
import { createSessionToken, COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email || '').trim().toLowerCase();
  const password = body?.password || '';

  // Generic message on both "no such user" and "wrong password" — don't leak
  // which one it was.
  const invalid = () =>
    NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });

  if (!email || !password) return invalid();

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return invalid();

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return invalid();

  const token = await createSessionToken(user.id);
  const res = NextResponse.json({ success: true, data: publicUser(user) });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
