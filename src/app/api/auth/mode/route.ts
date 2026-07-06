// POST /api/auth/mode — lets the logged-in user switch their default mode
// (non-tech | developer) at any time, per PRD section 1.1. This is the
// user-level default; a later phase can override it per-API.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, publicUser } from '@/lib/auth';

const VALID_MODES = ['non-tech', 'developer'];

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const mode = body?.mode;
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json(
      { success: false, error: `mode must be one of: ${VALID_MODES.join(', ')}` },
      { status: 400 }
    );
  }

  const updated = await db.user.update({ where: { id: user.id }, data: { mode } });
  return NextResponse.json({ success: true, data: publicUser(updated) });
}
