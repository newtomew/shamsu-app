// store.ts — replaces shamsu-engine/src/storage.js. Same function shapes
// (createApi, confirmApi, getApi, getApiByKey, saveSession, getSession,
// logCall, recentLogs), backed by Prisma/Postgres instead of better-sqlite3.
//
// Two differences forced by the move to Postgres, not logic changes:
//   1. Every function is now async (Postgres is a network call; SQLite was sync).
//   2. api_keys.key_hash stores a SHA-256 hash of the raw key, matching the
//      PRD column name (`key_hash`, not `key`) — callers still get the raw
//      key once, at confirm time, exactly like the original engine.
//
// Auth landed in Phase 3 (recordings/confirm/logs use the real logged-in
// user). Phase 6 retires the demo-user bridge for the call path too: the
// caller is now whoever minted the API key being used (api_keys.created_by_
// user_id) — currently always the API's creator (only they can confirm/mint
// keys), but this will keep working correctly once marketplace purchases
// mint keys for buyers instead, with no further change needed here.

import crypto from 'node:crypto';
import { db } from './db';
import type { Api } from '@/generated/prisma/client';
import type { Classification } from './classifier';

export async function createApi(name: string, recordedFlow: unknown, creatorId: string): Promise<string> {
  const api = await db.api.create({
    data: {
      name,
      creatorId,
      endpointUrl: '', // filled in on confirm, once we know the api id
      status: 'draft',
      recordedFlow: recordedFlow as object,
    },
  });
  return api.id;
}

// Persists the classifier's raw output on the (still-draft) api row: the full
// object verbatim in last_classification (plain_summary included), plus its
// replay_mode/variables/output_fields pre-filled into the normal schema
// columns as an editable starting point for confirmation — confirm() can
// still override all of it.
export async function saveClassification(
  apiId: string,
  classification: Classification & { plain_summary?: string }
): Promise<void> {
  await db.api.update({
    where: { id: apiId },
    data: {
      replayMode: classification.replay_mode,
      variableSchema: { inputs: classification.variables } as object,
      outputSchema: { fields: classification.output_fields } as object,
      lastClassification: classification as unknown as object,
    },
  });
}

export async function confirmApi(
  id: string,
  {
    replay_mode,
    variable_schema,
    output_schema,
    credential_type,
  }: { replay_mode: string; variable_schema: unknown; output_schema: unknown; credential_type: string },
  confirmedByUserId: string,
  keyName = 'production'
): Promise<string> {
  const endpointUrl = `/api/v1/${id}/call`;
  await db.api.update({
    where: { id },
    data: {
      status: 'active',
      replayMode: replay_mode,
      variableSchema: variable_schema as object,
      outputSchema: output_schema as object,
      credentialType: credential_type,
      endpointUrl,
    },
  });

  // Every confirm mints a new named key rather than reusing/overwriting one —
  // the schema supports multiple keys per API (api_keys has no one-per-api
  // constraint) so a creator can call confirm again later for a fresh key
  // (e.g. "testing") without disturbing an already-distributed one.
  const rawKey = 'sk_' + crypto.randomBytes(24).toString('base64url');
  const keyHash = hashKey(rawKey);
  await db.apiKey.create({
    data: {
      apiId: id,
      keyHash,
      name: keyName,
      createdByUserId: confirmedByUserId,
    },
  });
  return rawKey;
}

export async function getApi(id: string): Promise<Api | null> {
  return db.api.findUnique({ where: { id } });
}

// Creator-facing pause/resume (PRD section 3.6 schema: status is
// 'active' | 'paused' | 'deleted'). Deliberately restricted to those two
// values here — 'deleted' stays exclusive to the soft-delete-with-backup
// flow in marketplace.ts's deleteApiWithBackup, never a plain status write.
export async function setApiStatus(id: string, status: 'active' | 'paused'): Promise<void> {
  await db.api.update({ where: { id }, data: { status } });
}

export interface ResolvedApiKey {
  api: Api;
  apiKeyId: string;
  callerId: string; // api_keys.created_by_user_id — see note above
}

// Resolves a raw caller-supplied key to its API + the user who should be
// billed/attributed for this call. Returns null for unknown or revoked keys.
export async function getApiKeyRecord(key: string): Promise<ResolvedApiKey | null> {
  const keyHash = hashKey(key);
  const apiKey = await db.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || apiKey.revokedAt) return null;
  const api = await getApi(apiKey.apiId);
  if (!api) return null;
  return { api, apiKeyId: apiKey.id, callerId: apiKey.createdByUserId };
}

export async function getUserCreditsBalance(userId: string): Promise<number> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { apiCreditsBalance: true } });
  return user ? Number(user.apiCreditsBalance) : 0;
}

export async function deductCredits(userId: string, amountBdt: number): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { apiCreditsBalance: { decrement: amountBdt } } });
}

export async function refundCredits(userId: string, amountBdt: number): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { apiCreditsBalance: { increment: amountBdt } } });
}

// Records an overflow request (past the concurrency cap) for later async
// processing. The dequeue-and-process worker is not built yet — see Phase 6
// notes — so this is currently a durable record of what got queued, not a
// live retry mechanism.
export async function enqueueReplay(apiId: string, callerId: string, requestBody: unknown): Promise<void> {
  await db.replayQueue.create({
    data: { apiId, callerId, requestBody: (requestBody as object) ?? undefined, status: 'queued' },
  });
}

export async function saveSession(apiId: string, cookies: unknown[], ttlMinutes = 30) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
  await db.session.upsert({
    where: { apiId },
    update: { cookies: cookies as object, capturedAt: now, expiresAt },
    create: { apiId, cookies: cookies as object, capturedAt: now, expiresAt },
  });
}

export async function getSession(apiId: string): Promise<{ cookies: unknown[]; valid: boolean } | null> {
  const s = await db.session.findUnique({ where: { apiId } });
  if (!s) return null;
  const valid = s.expiresAt > new Date();
  return { cookies: (s.cookies as unknown[]) || [], valid };
}

export interface LogCallInput {
  status: string;
  latency_ms?: number;
  step_count?: number;
  error?: string;
  request_body?: unknown;
  response_data?: unknown;
  execution_time_ms?: number;
  chrome_duration_ms?: number;
  claude_tokens_used?: number;
  cost_bdt?: number;
}

export async function logCall(apiId: string, callerId: string, input: LogCallInput) {
  await db.apiCall.create({
    data: {
      apiId,
      callerId,
      status: input.status,
      latencyMs: input.latency_ms ?? null,
      stepCount: input.step_count ?? null,
      errorMessage: input.error ?? null,
      // Never persist credentials or full sensitive bodies (PRD section 3.6
      // note) — redact anything that looks like one before it ever reaches the DB.
      requestBody: (redact(input.request_body) as object) ?? undefined,
      responseData: (redact(input.response_data) as object) ?? undefined,
      executionTimeMs: input.execution_time_ms ?? null,
      chromeDurationMs: input.chrome_duration_ms ?? null,
      claudeTokensUsed: input.claude_tokens_used ?? null,
      costBdt: input.cost_bdt ?? null,
    },
  });
}

const SENSITIVE_KEY_RE = /password|passwd|pwd|secret|token|credential|authorization/i;

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEY_RE.test(k) ? '[redacted]' : redact(v),
      ])
    );
  }
  return value;
}

export async function recentLogs(apiId: string, limit = 10) {
  return db.apiCall.findMany({
    where: { apiId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}
