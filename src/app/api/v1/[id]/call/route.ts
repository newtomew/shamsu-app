// POST /api/v1/:id/call — the money endpoint. Ported from shamsu-engine
// server.js `POST /api/v1/:id/call`, hardened in Phase 6 with auth, credits,
// rate limiting/concurrency, and timeout enforcement (PRD sections 3.3/3.7/3.8),
// extended in Phase 8 for marketplace pricing + the 60/40 commission split.
//
// This route is intentionally NOT session-cookie-authenticated — it's the
// programmatic endpoint buyers/callers hit with an API key, same as the
// original engine. (Auth in earlier phases protects the dashboard/creator
// side: recordings, confirm, logs.)
//
// Order of checks mirrors PRD section 3.3's call execution flow: key ->
// credits + rate limit + concurrency -> deduct -> execute -> log.
//
// Pricing: if the caller holds an active marketplace purchase for this API,
// the LISTING's price applies (per_call: charged every call; subscription:
// already paid at purchase time, so calls are free) and a successful/failed
// charge is split 60/40 into creator_earnings. Otherwise (the creator using
// their own key) the flat platform rate from Phase 6 applies, with no split
// — there's no third-party buyer to split revenue with.

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { runApi } from '@/lib/replay';
import { db } from '@/lib/db';
import { COST_PER_CALL_BDT } from '@/lib/pricing';
import { checkRateLimit, tryReserveConcurrencySlot, releaseConcurrencySlot } from '@/lib/rateLimiter';
import { getActivePurchase, recordEarnings } from '@/lib/marketplace';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // 1. Auth: valid, non-revoked key that actually belongs to this API id.
  const authHeader = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const queryKey = req.nextUrl.searchParams.get('api_key') || req.nextUrl.searchParams.get('key');
  const providedKey = authHeader || queryKey || '';

  if (!providedKey) {
    return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });
  }
  const resolved = await store.getApiKeyRecord(providedKey);
  if (!resolved || resolved.api.id !== params.id) {
    return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });
  }
  const { api, callerId } = resolved;

  if (api.status !== 'active') {
    return NextResponse.json({ success: false, error: 'API is not active' }, { status: 400 });
  }

  // Admin enforcement (Phase 10, PRD 4.3): a banned creator's APIs stop
  // accepting calls, even if the API row itself is still 'active'.
  const creatorRecord = await db.user.findUnique({ where: { id: api.creatorId }, select: { moderationStatus: true } });
  if (creatorRecord?.moderationStatus === 'banned') {
    return NextResponse.json({ success: false, error: 'This API is unavailable.' }, { status: 403 });
  }

  const inputs = (await req.json().catch(() => ({}))) || {};

  // 3a. Rate limit — 50 calls/sec per API (PRD section 3.8).
  if (!checkRateLimit(api.id)) {
    await store.logCall(api.id, callerId, { status: 'rate_limited', latency_ms: 0, request_body: inputs });
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded (50 calls/sec for this API). Please retry shortly.' },
      { status: 429, headers: { 'Retry-After': '1' } }
    );
  }

  // 3b. Concurrency — max 50 concurrent Chrome instances per API; beyond that,
  // queue via replay_queue and reject this request with retry info. (The
  // worker that dequeues and actually replays queued requests isn't built
  // yet — this phase records the overflow durably; it doesn't process it
  // asynchronously. Hitting 50 truly concurrent calls in testing is
  // extremely unlikely, so this path is verified by temporarily lowering the
  // cap, not by actually launching 50 browsers.)
  if (!tryReserveConcurrencySlot(api.id)) {
    await store.enqueueReplay(api.id, callerId, inputs);
    await store.logCall(api.id, callerId, { status: 'rate_limited', latency_ms: 0, request_body: inputs });
    return NextResponse.json(
      {
        success: false,
        error: 'This API is at its concurrent execution limit (50). Your request has been queued — please retry shortly.',
      },
      { status: 429, headers: { 'Retry-After': '5' } }
    );
  }

  try {
    // Determine pricing: a marketplace purchase overrides the flat platform
    // rate with the listing's own price (and triggers the 60/40 split).
    const purchase = await getActivePurchase(api.id, callerId);
    let costPerCallBdt = COST_PER_CALL_BDT;
    let isSubscription = false;
    let isMarketplaceCall = false;
    if (purchase) {
      isMarketplaceCall = true;
      const listing = await db.marketplaceListing.findUnique({ where: { apiId: api.id } });
      if (listing) {
        isSubscription = listing.pricingModel === 'subscription';
        costPerCallBdt = isSubscription ? 0 : Number(listing.price);
      }
    }
    const failedCostBdt = costPerCallBdt / 2;

    // 2. Credits — check, then deduct the FULL cost immediately (PRD section
    // 3.3 step 3); refunded to half afterward if the call fails (section 4.5).
    // A paid-up subscription costs 0 per call, so this always passes.
    const balance = await store.getUserCreditsBalance(callerId);
    if (balance < costPerCallBdt) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient credits. This call costs ${costPerCallBdt} BDT but your balance is ${balance} BDT. Please top up.`,
        },
        { status: 402 }
      );
    }
    if (costPerCallBdt > 0) await store.deductCredits(callerId, costPerCallBdt);

    const modeParam = req.nextUrl.searchParams.get('mode');
    let mode: 'developer' | 'non-tech' = 'non-tech';
    if (modeParam === 'developer' || modeParam === 'non-tech') {
      mode = modeParam;
    } else {
      const creator = await db.user.findUnique({ where: { id: api.creatorId }, select: { mode: true } });
      mode = creator?.mode === 'developer' ? 'developer' : 'non-tech';
    }

    const result = await runApi(api, inputs, callerId, costPerCallBdt);

    let actuallyChargedBdt = costPerCallBdt;
    if (!result.success && costPerCallBdt > 0) {
      // Net effective charge becomes half — refund the other half of what
      // was deducted upfront.
      await store.refundCredits(callerId, failedCostBdt);
      actuallyChargedBdt = failedCostBdt;
    }

    // Commission split (PRD 2.8/section 6): only for real marketplace calls,
    // and only on whatever was actually charged (full on success, half on
    // failure) — a subscription call charges 0 per call, so nothing to split.
    if (isMarketplaceCall && actuallyChargedBdt > 0) {
      await recordEarnings(api.creatorId, actuallyChargedBdt);
    }

    const newBalance = await store.getUserCreditsBalance(callerId);
    const callsRemaining = costPerCallBdt > 0 ? Math.floor(newBalance / costPerCallBdt) : null;

    if (result.success) {
      return NextResponse.json(
        { success: true, data: result.data, meta: { ...result.meta, calls_remaining: callsRemaining } },
        { status: 200 }
      );
    }

    const info = result.errorInfo!;
    const errorBody =
      mode === 'developer'
        ? { success: false, error: info.developerMessage, code: info.code, details: info.details }
        : { success: false, error: info.friendlyMessage };

    return NextResponse.json(
      { ...errorBody, meta: { ...result.meta, calls_remaining: callsRemaining } },
      { status: 502 }
    );
  } finally {
    releaseConcurrencySlot(api.id);
  }
}
