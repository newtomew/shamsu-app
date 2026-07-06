// POST /api/auth/extension-token — mints a long-lived token (180 days) for
// the Chrome extension (Phase 9). Session-cookie-authenticated only (the
// extension itself calls /api/recordings with the token this returns, not
// this endpoint) — a user must be logged into the web dashboard to generate
// one. Shown once, same "copy it now" pattern as API keys.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { createExtensionToken } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const token = await createExtensionToken(user.id);
  return NextResponse.json({ success: true, data: { token } });
}
