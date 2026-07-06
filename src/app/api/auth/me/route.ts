// GET /api/auth/me — returns the current session's user, or 401.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, publicUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ success: true, data: publicUser(user) });
}
