// admin.ts — all admin-panel queries/mutations (PRD section 4). Every
// function here assumes the caller has already verified admin.isAdmin via
// getAdminUser — this module itself doesn't re-check, it's meant to be used
// only from routes under src/app/api/admin/*.

import { db } from './db';
import { runApi } from './replay';
import { COST_PER_CALL_BDT } from './pricing';
import { RATE_LIMIT_CONFIG } from './rateLimiter';

// ---------------------------------------------------------------------------
// 1. Payment confirmation (PRD 4.3) — target 30-60 min manual turnaround
// ---------------------------------------------------------------------------
export async function listCreditPurchases(status?: string) {
  const purchases = await db.creditPurchase.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
  });
  return purchases.map((p: typeof purchases[0]) => ({
    id: p.id,
    user_email: p.user.email,
    amount_bdt: Number(p.amountBdt),
    credits_added: p.creditsAdded,
    payment_reference: p.paymentReference,
    status: p.status,
    created_at: p.createdAt,
    confirmed_at: p.confirmedAt,
  }));
}

export async function confirmCreditPurchase(id: string, adminId: string) {
  const purchase = await db.creditPurchase.findUnique({ where: { id } });
  if (!purchase) return { ok: false as const, error: 'Not found.' };
  if (purchase.status !== 'pending') return { ok: false as const, error: 'This request was already resolved.' };

  await db.$transaction([
    db.creditPurchase.update({
      where: { id },
      data: { status: 'confirmed', confirmedByAdminId: adminId, confirmedAt: new Date() },
    }),
    db.user.update({
      where: { id: purchase.userId },
      data: { apiCreditsBalance: { increment: purchase.creditsAdded } },
    }),
  ]);
  return { ok: true as const };
}

export async function rejectCreditPurchase(id: string, adminId: string) {
  const purchase = await db.creditPurchase.findUnique({ where: { id } });
  if (!purchase) return { ok: false as const, error: 'Not found.' };
  if (purchase.status !== 'pending') return { ok: false as const, error: 'This request was already resolved.' };

  await db.creditPurchase.update({
    where: { id },
    data: { status: 'failed', confirmedByAdminId: adminId, confirmedAt: new Date() },
  });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// 2. Disputes (PRD 4.2/4.3)
// ---------------------------------------------------------------------------
export async function listDisputes(status?: string) {
  const disputes = await db.dispute.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { buyer: { select: { email: true } }, api: { select: { name: true, creatorId: true } } },
  });
  return disputes.map((d) => ({
    id: d.id,
    buyer_email: d.buyer.email,
    api_id: d.apiId,
    api_name: d.api.name,
    reason: d.reason,
    status: d.status,
    resolution: d.resolution,
    admin_notes: d.adminNotes,
    test_result: d.testResult,
    created_at: d.createdAt,
    resolved_at: d.resolvedAt,
  }));
}

// Runs the API exactly like the creator's own Test button (Phase 7) — same
// engine, no credit charge — so the admin can see with their own eyes
// whether the buyer's complaint holds up, before deciding a refund.
export async function testDisputeApi(disputeId: string, adminId: string) {
  const dispute = await db.dispute.findUnique({ where: { id: disputeId }, include: { api: true } });
  if (!dispute) return { ok: false as const, error: 'Dispute not found.' };

  const api = dispute.api;
  const variables = ((api.variableSchema as { inputs?: { name: string; example?: string }[] } | null)?.inputs || []);
  const inputs = Object.fromEntries(variables.map((v) => [v.name, v.example || 'value']));

  const result = await runApi(api, inputs, adminId, COST_PER_CALL_BDT);
  await db.dispute.update({ where: { id: disputeId }, data: { testResult: result as unknown as object } });
  return { ok: true as const, result };
}

export type DisputeResolution = 'refunded_50' | 'refunded_100' | 'denied';

export async function resolveDispute(
  disputeId: string,
  adminId: string,
  resolution: DisputeResolution,
  notes: string | undefined,
  flagCreator: boolean
) {
  const dispute = await db.dispute.findUnique({ where: { id: disputeId }, include: { purchase: true } });
  if (!dispute) return { ok: false as const, error: 'Dispute not found.' };
  if (dispute.status !== 'open') return { ok: false as const, error: 'This dispute was already resolved.' };

  // Refund base = what the buyer actually paid at purchase time (the
  // subscription upfront fee, 0 for per_call) PLUS everything they've spent
  // calling this API since (0 for a paid-up subscription, real money for
  // per_call). Using price_paid alone would always refund 0 for per_call
  // purchases — the common case — which would make disputes pointless there.
  const pricePaid = Number(dispute.purchase.pricePaid || 0);
  const callSpendAgg = await db.apiCall.aggregate({
    where: { apiId: dispute.apiId, callerId: dispute.buyerId },
    _sum: { costBdt: true },
  });
  const totalSpent = pricePaid + Number(callSpendAgg._sum.costBdt || 0);

  let refundAmount = 0;
  if (resolution === 'refunded_50') refundAmount = totalSpent * 0.5;
  if (resolution === 'refunded_100') refundAmount = totalSpent;

  const purchaseStatus = resolution === 'denied' ? 'active' : 'refunded';

  await db.$transaction([
    db.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'resolved',
        resolution,
        adminNotes: notes,
        resolvedByAdminId: adminId,
        resolvedAt: new Date(),
      },
    }),
    db.marketplacePurchase.update({ where: { id: dispute.purchaseId }, data: { status: purchaseStatus } }),
    ...(refundAmount > 0
      ? [db.user.update({ where: { id: dispute.buyerId }, data: { apiCreditsBalance: { increment: refundAmount } } })]
      : []),
  ]);

  if (flagCreator) {
    const api = await db.api.findUnique({ where: { id: dispute.apiId }, select: { creatorId: true } });
    if (api) await moderateCreator(api.creatorId, 'warning');
  }

  return { ok: true as const, refundAmount };
}

// ---------------------------------------------------------------------------
// 3. Creator/API management + 3-stage enforcement (PRD 4.3)
// ---------------------------------------------------------------------------
// take: 200 is a safety cap, not real pagination — this is an internal ops
// list, not expected to need thousands of rows in one screen. Prevents an
// unbounded table scan as the platform grows; the admin UI further reveals
// these progressively (Table + "Show more") rather than rendering all 200
// rows at once.
const ADMIN_LIST_CAP = 200;

export async function listCreators() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { apis: true } } },
    take: ADMIN_LIST_CAP,
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    is_admin: u.isAdmin,
    moderation_status: u.moderationStatus,
    api_count: u._count.apis,
    created_at: u.createdAt,
  }));
}

const MODERATION_STAGES = ['none', 'warning', 'final_warning', 'banned'];

export async function moderateCreator(userId: string, action: 'warning' | 'final_warning' | 'banned' | 'reinstate') {
  const status = action === 'reinstate' ? 'none' : action;
  if (!MODERATION_STAGES.includes(status)) {
    return { ok: false as const, error: 'Invalid moderation action.' };
  }
  await db.user.update({ where: { id: userId }, data: { moderationStatus: status } });
  return { ok: true as const, status };
}

export async function listAllApis() {
  const apis = await db.api.findMany({
    orderBy: { createdAt: 'desc' },
    include: { creator: { select: { email: true, moderationStatus: true } } },
    take: ADMIN_LIST_CAP,
  });
  return apis.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    replay_mode: a.replayMode,
    creator_email: a.creator.email,
    creator_moderation_status: a.creator.moderationStatus,
    is_listed_in_marketplace: a.isListedInMarketplace,
    has_backup: !!a.encryptedBackup,
    created_at: a.createdAt,
  }));
}

export async function flagApi(apiId: string) {
  await db.api.update({ where: { id: apiId }, data: { status: 'flagged', isListedInMarketplace: false } });
  await db.marketplaceListing.updateMany({ where: { apiId }, data: { isActive: false } });
}

export async function unflagApi(apiId: string) {
  await db.api.update({ where: { id: apiId }, data: { status: 'active' } });
}

// ---------------------------------------------------------------------------
// 4. Monitoring (PRD 4.1) — Info/Warning alerts only, no Critical
// ---------------------------------------------------------------------------
export async function getMonitoring() {
  const oneHourAgo = new Date(Date.now() - 60 * 60_000);
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000);

  const [activeApiCount, callsLastHour, failedLastHour, recentCalls, queueDepth] = await Promise.all([
    db.api.count({ where: { status: 'active' } }),
    db.apiCall.count({ where: { timestamp: { gte: oneHourAgo } } }),
    db.apiCall.count({ where: { timestamp: { gte: oneHourAgo }, status: { in: ['failed', 'timeout', 'rate_limited'] } } }),
    db.apiCall.findMany({
      where: { timestamp: { gte: fiveMinAgo }, executionTimeMs: { not: null } },
      select: { executionTimeMs: true },
    }),
    db.replayQueue.count({ where: { status: 'queued' } }),
  ]);

  const failureRate = callsLastHour > 0 ? failedLastHour / callsLastHour : 0;
  const avgResponseMs =
    recentCalls.length > 0 ? recentCalls.reduce((sum, c) => sum + (c.executionTimeMs || 0), 0) / recentCalls.length : 0;

  // Real in-process concurrency snapshot (Phase 6's rate limiter) — a
  // single-process figure, not a distributed Chrome-pool metric (this app
  // doesn't run a real browser pool infrastructure), disclosed as such.
  const chromePoolInUse = RATE_LIMIT_CONFIG.currentTotalConcurrency ? RATE_LIMIT_CONFIG.currentTotalConcurrency() : 0;

  // Alert thresholds match PRD section 4.1 exactly, except queue depth's
  // 5,000 default is overridable via env for demo/testing — see Phase 6's
  // rate limiter for the same pattern (hitting 5,000 queued items for real
  // in a demo isn't practical).
  const queueWarnThreshold = Number(process.env.SHAMSU_QUEUE_WARN_THRESHOLD) || 5000;

  const alerts: Array<{ level: 'info' | 'warning'; message: string }> = [];
  if (failureRate > 0.1) {
    alerts.push({ level: 'warning', message: `API failure rate ${(failureRate * 100).toFixed(1)}% in the last hour (>10%, escalate).` });
  } else if (failureRate > 0.05) {
    alerts.push({ level: 'warning', message: `API failure rate ${(failureRate * 100).toFixed(1)}% in the last hour (>5%).` });
  }
  if (avgResponseMs > 10_000) {
    alerts.push({ level: 'warning', message: `Average response time ${Math.round(avgResponseMs)}ms over the last 5 minutes (>10s).` });
  }
  if (queueDepth > queueWarnThreshold) {
    alerts.push({ level: 'warning', message: `Queue depth ${queueDepth} pending (>${queueWarnThreshold}).` });
  }
  if (queueDepth > 0) {
    alerts.push({ level: 'info', message: `${queueDepth} request(s) currently queued.` });
  }

  return {
    active_apis: activeApiCount,
    calls_last_hour: callsLastHour,
    failure_rate: failureRate,
    avg_response_time_ms: Math.round(avgResponseMs),
    chrome_pool_in_use: chromePoolInUse,
    chrome_pool_max: RATE_LIMIT_CONFIG.MAX_CONCURRENT_PER_API,
    queue_depth: queueDepth,
    alerts,
  };
}
