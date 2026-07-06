// POST /api/apis/:id/test — the dashboard "Test" button (PRD section 2.6).
// Session-authenticated (not API-key), owner-only. Runs the exact same
// engine as a real call (so it's a true "does this work" check and gets
// logged to call history like any other call), but does NOT touch the
// creator's credit balance — this is the creator previewing their own API,
// not a monetized call. Always returns full developer-level detail
// (PRD 2.6/section "Test results: creators see full logs") regardless of
// the creator's saved mode preference.

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { getSessionUser } from '@/lib/auth';
import { runApi } from '@/lib/replay';
import { COST_PER_CALL_BDT } from '@/lib/pricing';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const api = await store.getApi(params.id);
  if (!api) {
    return NextResponse.json({ success: false, error: 'api not found' }, { status: 404 });
  }
  if (api.creatorId !== user.id) {
    return NextResponse.json({ success: false, error: 'You do not own this API' }, { status: 403 });
  }
  if (api.status !== 'active') {
    return NextResponse.json({ success: false, error: 'Confirm this API before testing it.' }, { status: 400 });
  }

  const inputs = (await req.json().catch(() => ({}))) || {};

  // costPerCallBdt is passed only so the call-history log shows what this
  // would have cost as a real call — no balance is deducted here.
  const result = await runApi(api, inputs, user.id, COST_PER_CALL_BDT);

  if (result.success) {
    return NextResponse.json({ success: true, data: result.data, meta: result.meta });
  }

  const info = result.errorInfo!;
  return NextResponse.json(
    { success: false, error: info.developerMessage, code: info.code, details: info.details, meta: result.meta },
    { status: 502 }
  );
}
