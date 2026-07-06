// POST /api/auth/signup — creates a user (mode defaults to 'non-tech',
// api_credits_balance defaults to 0, per the PRD) and starts a session.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, publicUser } from '@/lib/auth';
import { createSessionToken, COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/jwt';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email || '').trim().toLowerCase();
  const password = body?.password || '';
  const name = body?.name || null;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ success: false, error: 'A valid email is required' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json(
      { success: false, error: 'Password must be at least 8 characters' },
      { status: 400 }
    );
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ success: false, error: 'An account with this email already exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      name,
      mode: 'non-tech',
      apiCreditsBalance: 0,
    },
  });

  const token = await createSessionToken(user.id);
  const res = NextResponse.json({ success: true, data: publicUser(user) }, { status: 201 });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
