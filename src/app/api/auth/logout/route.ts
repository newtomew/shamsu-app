// POST /api/auth/logout — clears the session cookie.

import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/jwt';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
