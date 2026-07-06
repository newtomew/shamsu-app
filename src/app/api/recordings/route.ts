// POST /api/recordings — ported from shamsu-engine server.js `POST /recordings`.
// Submit a recorded flow -> classify it (Claude or rules) -> return a draft to confirm.
// Requires a session; the recording is owned by whoever is logged in.
//
// CORS (Phase 9): this is the one endpoint the Chrome extension calls
// directly from its background/popup context (a `chrome-extension://` origin).
// The extension's own `host_permissions` grant already exempts its fetches
// from CORS entirely, but we still answer the preflight and set explicit
// headers here — belt-and-suspenders, and it means the endpoint also works
// from a plain browser fetch for testing. `Access-Control-Allow-Origin: *`
// is safe here specifically because auth is a Bearer token in a header, not
// a cookie — we never send `Access-Control-Allow-Credentials`, so no cookie
// ever crosses origins.

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { classifyFlow } from '@/lib/classifier';
import { describeFlow } from '@/lib/narrator';
import { getSessionUser } from '@/lib/auth';
import { validateRecordingInput } from '@/lib/validation';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return withCors(NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }));
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return withCors(NextResponse.json({ success: false, error: 'Request body must be valid JSON.' }, { status: 400 }));
  }
  const { name, recorded_flow } = body;

  const validation = validateRecordingInput(name, recorded_flow);
  if (!validation.valid) {
    return withCors(NextResponse.json({ success: false, error: validation.error }, { status: 400 }));
  }

  const apiId = await store.createApi(name, recorded_flow, user.id);
  const [classification, narration] = await Promise.all([
    classifyFlow(recorded_flow),
    describeFlow(recorded_flow),
  ]);
  const enriched = {
    ...classification,
    plain_summary: narration.summary,
    // combined cost of setting up this recording (classification + plain-language narration)
    claude_tokens_used: classification.claude_tokens_used + narration.claude_tokens_used,
  };
  await store.saveClassification(apiId, enriched);

  return withCors(
    NextResponse.json({
      success: true,
      data: {
        api_id: apiId,
        classification: enriched, // { replay_mode, needs_login, variables, output_fields, reason, plain_summary, claude_tokens_used }
        next_step: 'POST /api/apis/:id/confirm to activate',
      },
    })
  );
}
