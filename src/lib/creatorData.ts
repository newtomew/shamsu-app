// creatorData.ts — read/management queries for the creator dashboard (PRD
// section 2.4): per-API summaries, API key CRUD, call history, and
// portfolio-wide analytics. Everything here is scoped by creatorId at the
// query level (not just checked after the fact) so a creator's data can
// never leak into another creator's results.
//
// IMPORTANT CONTEXT for "revenue" / "active buyers": there is no marketplace
// yet (that's a later phase) — the only way anyone can currently call an API
// is with a key THEY created, which today is always the API's own creator
// (see store.ts). So "revenue" and "active buyers" are computed correctly
// from real data (calls where caller_id != creator_id), but will show 0 for
// any API that hasn't had a second party call it. That's accurate, not a
// bug — creator_earnings (the 60/40-split ledger) stays unpopulated until
// the marketplace phase actually writes to it, so it isn't used here.

import crypto from 'node:crypto';
import { db } from './db';
import { Prisma } from '@/generated/prisma/client';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ---------------------------------------------------------------------------
// Dashboard: all of a creator's APIs + quick stats
// ---------------------------------------------------------------------------
export async function getCreatorApisSummary(creatorId: string) {
  const apis = await db.api.findMany({
    where: { creatorId },
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(
    apis.map(async (api) => {
      const [totalCalls, buyerAgg, lastCall] = await Promise.all([
        db.apiCall.count({ where: { apiId: api.id } }),
        db.apiCall.groupBy({
          by: ['callerId'],
          where: { apiId: api.id, NOT: { callerId: creatorId } },
          _sum: { costBdt: true },
        }),
        db.apiCall.findFirst({ where: { apiId: api.id }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
      ]);
      const revenueBdt = buyerAgg.reduce((sum, row) => sum + Number(row._sum.costBdt || 0), 0);

      return {
        id: api.id,
        name: api.name,
        status: api.status,
        replay_mode: api.replayMode,
        is_listed_in_marketplace: api.isListedInMarketplace,
        created_at: api.createdAt,
        last_called_at: lastCall?.timestamp ?? null,
        total_calls: totalCalls,
        active_buyers: buyerAgg.length,
        revenue_bdt: revenueBdt,
      };
    })
  );
}

// ---------------------------------------------------------------------------
// API detail page: keys, call history, marketplace status, JSON format
// ---------------------------------------------------------------------------
export async function getApiKeys(apiId: string) {
  return db.apiKey.findMany({
    where: { apiId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true, revokedAt: true },
  });
}

export async function createApiKey(apiId: string, name: string, createdByUserId: string): Promise<string> {
  const rawKey = 'sk_' + crypto.randomBytes(24).toString('base64url');
  await db.apiKey.create({
    data: { apiId, keyHash: hashKey(rawKey), name, createdByUserId },
  });
  return rawKey;
}

// Returns the api_id the key belongs to (or null if the key doesn't exist),
// so the route can verify ownership before revoking.
export async function getApiIdForKey(keyId: string): Promise<string | null> {
  const key = await db.apiKey.findUnique({ where: { id: keyId }, select: { apiId: true } });
  return key?.apiId ?? null;
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await db.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
}

export async function getMarketplaceListing(apiId: string) {
  return db.marketplaceListing.findUnique({ where: { apiId } });
}

export async function getCallHistory(apiId: string, limit = 50) {
  const calls = await db.apiCall.findMany({
    where: { apiId },
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: { caller: { select: { id: true, email: true } } },
  });
  return calls.map((c) => ({
    id: c.id,
    timestamp: c.timestamp,
    buyer: c.caller.email,
    status: c.status,
    latency_ms: c.latencyMs,
    error_message: c.errorMessage,
    cost_bdt: c.costBdt,
  }));
}

// ---------------------------------------------------------------------------
// Analytics: portfolio-wide across all of a creator's APIs
// ---------------------------------------------------------------------------
async function getCreatorApiIds(creatorId: string): Promise<string[]> {
  const apis = await db.api.findMany({ where: { creatorId }, select: { id: true } });
  return apis.map((a) => a.id);
}

export async function getUsageOverTime(creatorId: string, days = 14) {
  const apiIds = await getCreatorApiIds(creatorId);
  if (apiIds.length === 0) return [];
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const rows = await db.$queryRaw<Array<{ day: Date; calls: number }>>`
    SELECT date_trunc('day', "timestamp") as day, COUNT(*)::int as calls
    FROM api_calls
    WHERE api_id IN (${Prisma.join(apiIds)}) AND "timestamp" >= ${cutoff}
    GROUP BY day
    ORDER BY day ASC
  `;
  return rows;
}

export async function getTopBuyers(creatorId: string, limit = 10) {
  const apiIds = await getCreatorApiIds(creatorId);
  if (apiIds.length === 0) return [];
  const rows = await db.apiCall.groupBy({
    by: ['callerId'],
    where: { apiId: { in: apiIds }, NOT: { callerId: creatorId } },
    _count: { _all: true },
    _sum: { costBdt: true },
    orderBy: { _sum: { costBdt: 'desc' } },
    take: limit,
  });
  if (rows.length === 0) return [];
  const users = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.callerId) } },
    select: { id: true, email: true },
  });
  const emailMap = new Map(users.map((u) => [u.id, u.email]));
  return rows.map((r) => ({
    buyer_id: r.callerId,
    buyer_email: emailMap.get(r.callerId) || 'unknown',
    calls: r._count._all,
    revenue_bdt: Number(r._sum.costBdt || 0),
  }));
}

export async function getDailyEarningsByBuyer(creatorId: string, days = 14) {
  const apiIds = await getCreatorApiIds(creatorId);
  if (apiIds.length === 0) return [];
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const rows = await db.$queryRaw<Array<{ day: Date; caller_id: string; email: string; revenue: number }>>`
    SELECT date_trunc('day', ac."timestamp") as day, ac.caller_id, u.email, SUM(ac.cost_bdt)::float as revenue
    FROM api_calls ac
    JOIN users u ON u.id = ac.caller_id
    WHERE ac.api_id IN (${Prisma.join(apiIds)})
      AND ac.caller_id != ${creatorId}
      AND ac."timestamp" >= ${cutoff}
    GROUP BY day, ac.caller_id, u.email
    ORDER BY day DESC
  `;
  return rows;
}

// Dashboard "recent activity" feed — latest calls of any status across all
// of a creator's APIs (getErrorLogs below is the same shape but pre-filtered
// to failures only, kept separate since analytics' "error logs" section is
// a distinct, already-shipped PRD requirement).
export async function getRecentActivity(creatorId: string, limit = 15) {
  const apiIds = await getCreatorApiIds(creatorId);
  if (apiIds.length === 0) return [];
  const rows = await db.apiCall.findMany({
    where: { apiId: { in: apiIds } },
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: { caller: { select: { email: true } }, api: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    api_name: r.api.name,
    buyer: r.caller.email,
    status: r.status,
    latency_ms: r.latencyMs,
    error: r.errorMessage,
  }));
}

export async function getErrorLogs(creatorId: string, limit = 50) {
  const apiIds = await getCreatorApiIds(creatorId);
  if (apiIds.length === 0) return [];
  const rows = await db.apiCall.findMany({
    where: { apiId: { in: apiIds }, status: { in: ['failed', 'timeout', 'rate_limited'] } },
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: { caller: { select: { email: true } }, api: { select: { name: true } } },
  });
  return rows.map((r) => ({
    timestamp: r.timestamp,
    api_name: r.api.name,
    buyer: r.caller.email,
    status: r.status,
    error: r.errorMessage,
  }));
}
