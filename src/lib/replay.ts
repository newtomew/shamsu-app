// replay.ts — ported from shamsu-engine/src/replay.js. Same three-mode
// strategy, same auto-relogin trick, same output extraction. Adapted for:
//   - Prisma/Postgres session cache instead of SQLite (store calls are async)
//   - metering: measures chrome_duration_ms (time actually spent in a
//     Playwright browser) separately from total execution_time_ms, so
//     api_calls can log real numbers from call #1 (PRD section 3.6 note)
//   - a structured error (code/friendly message/developer message/details) so
//     the calling route can produce the non-tech vs developer response shapes
//     from PRD section 3.3, instead of only a single friendly string
//
// Strategy (unchanged from the engine):
//   1. network_replay  -> re-fire the captured HTTP request with injected variables. Fast. No browser.
//   2. hybrid          -> ensure a valid logged-in session (browser logs in ONCE, cached),
//                         then network-replay the data request WITH that session. Fast after login.
//   3. browser_replay  -> drive a real Chrome through the recorded steps (stateful actions).
//
// Auto-relogin: if a hybrid session is expired/rejected, it silently re-logs-in, refreshes
// the session, and retries once. Callers never see a login error.

import * as store from './store';
import type { Api } from '@/generated/prisma/client';
import type { RecordedFlow, RecordedStep, RecordedNetworkRequest } from './classifier';

export interface RunErrorInfo {
  code: string;
  friendlyMessage: string;
  developerMessage: string;
  details?: Record<string, unknown>;
}

export interface RunResult {
  success: boolean;
  data?: unknown;
  meta: {
    replay_mode: string;
    execution_time_ms: number;
    chrome_duration_ms: number;
  };
  errorInfo?: RunErrorInfo;
}

const DEFAULT_MAX_EXECUTION_SECONDS = 600; // 10 min, PRD section 3.8 default

// costPerCallBdt: the FULL per-call price (Phase 6 pricing). Charged in full
// on success; half on failure/timeout, since infra was still spent (PRD
// section 4.5). The caller (the /call route) is responsible for the actual
// credit-balance deduction/refund — this function only decides and LOGS the
// cost, it doesn't touch users.api_credits_balance itself.
export async function runApi(
  api: Api,
  inputs: Record<string, string> = {},
  callerId: string,
  costPerCallBdt: number
): Promise<RunResult> {
  const t0 = Date.now();
  const mode = api.replayMode;
  const timeoutMs = (api.maxExecutionTime || DEFAULT_MAX_EXECUTION_SECONDS) * 1000;
  const stepCount = ((api.recordedFlow as RecordedFlow)?.steps || []).length;

  let data: unknown;
  let chromeDurationMs = 0;
  let status: 'success' | 'failed' | 'timeout' = 'success';
  let errorInfo: RunErrorInfo | undefined;

  try {
    const work = runReplay(api, inputs, mode, callerId);
    const raced = await Promise.race([
      work.then((r) => ({ timedOut: false as const, ...r })),
      sleep(timeoutMs).then(() => ({ timedOut: true as const })),
    ]);
    if (raced.timedOut) {
      status = 'timeout';
      errorInfo = {
        code: 'TIMEOUT',
        friendlyMessage: 'This API took too long to respond and was stopped. Please try again.',
        developerMessage: `Execution exceeded the configured timeout of ${timeoutMs / 1000}s.`,
        details: { suggestion: 'Increase max_execution_time on this API, or investigate why the flow is slow.' },
      };
    } else {
      data = raced.data;
      chromeDurationMs = raced.chromeDurationMs;
    }
  } catch (err) {
    status = 'failed';
    errorInfo = describeError(err as Error & { code?: string });
  }

  const latency = Date.now() - t0;
  const costBdt = status === 'success' ? costPerCallBdt : costPerCallBdt / 2;

  await store.logCall(api.id, callerId, {
    status,
    latency_ms: latency,
    step_count: stepCount,
    error: errorInfo?.developerMessage,
    request_body: inputs,
    response_data: status === 'success' ? data : undefined,
    execution_time_ms: latency,
    chrome_duration_ms: chromeDurationMs,
    cost_bdt: costBdt,
  });

  if (status !== 'success') {
    // "Notify creator" (PRD section 3.4/4.5) — a log line is enough for MVP.
    console.warn(`[notify] API ${api.id} (creator ${api.creatorId}) call ${status}: ${errorInfo?.developerMessage}`);
  }

  const meta = { replay_mode: mode, execution_time_ms: latency, chrome_duration_ms: chromeDurationMs };
  return status === 'success' ? { success: true, data, meta } : { success: false, meta, errorInfo };
}

function runReplay(
  api: Api,
  inputs: Record<string, string>,
  mode: string,
  callerId: string
): Promise<{ data: unknown; chromeDurationMs: number }> {
  if (mode === 'network_replay') {
    return networkReplay(api, inputs, null).then((data) => ({ data, chromeDurationMs: 0 }));
  }
  if (mode === 'hybrid') {
    return hybridReplay(api, inputs, callerId);
  }
  return browserReplay(api, inputs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- network replay ----------
async function networkReplay(
  api: Api,
  inputs: Record<string, string>,
  cookies: Array<{ name: string; value: string }> | null
): Promise<unknown> {
  const flow = api.recordedFlow as RecordedFlow;
  const dataReq = pickDataRequest(flow);
  if (!dataReq) throw Object.assign(new Error('NO_DATA_REQUEST'), { code: 'NO_DATA_REQUEST' });

  // inject variables into the URL / body
  let url = dataReq.url;
  let body = dataReq.body ? JSON.stringify(dataReq.body) : undefined;
  for (const [k, v] of Object.entries(inputs)) {
    const enc = encodeURIComponent(v);
    url = url.replaceAll(`{${k}}`, enc).replace(new RegExp(`([?&]${k}=)[^&]*`), `$1${enc}`);
    if (body) body = body.replaceAll(`{${k}}`, v);
  }

  const headers: Record<string, string> = { ...(dataReq.headers || {}) };
  if (cookies && cookies.length) {
    headers['cookie'] = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  const res = await fetch(url, {
    method: dataReq.method || 'GET',
    headers,
    body: dataReq.method === 'POST' || dataReq.method === 'PUT' ? body : undefined,
  });

  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('SESSION_REJECTED'), { code: 'SESSION_REJECTED' });
  }
  const json = await res.json().catch(() => null);
  if (json == null) throw Object.assign(new Error('BAD_RESPONSE'), { code: 'BAD_RESPONSE' });
  return extractOutput(json, api.outputSchema as { fields?: { name: string; path: string }[] } | null);
}

// ---------- hybrid: session reuse + auto-relogin ----------
async function hybridReplay(
  api: Api,
  inputs: Record<string, string>,
  callerId: string
): Promise<{ data: unknown; chromeDurationMs: number }> {
  let session = await store.getSession(api.id);
  let chromeDurationMs = 0;

  // no valid session -> log in once via browser, cache it
  if (!session || !session.valid) {
    const login = await browserLogin(api);
    chromeDurationMs += login.chromeDurationMs;
    await store.saveSession(api.id, login.cookies, 30);
    session = { cookies: login.cookies, valid: true };
  }

  try {
    const data = await networkReplay(api, inputs, session.cookies as Array<{ name: string; value: string }>);
    return { data, chromeDurationMs };
  } catch (err) {
    // session got rejected mid-call -> auto-relogin ONCE, refresh, retry
    if ((err as { code?: string }).code === 'SESSION_REJECTED') {
      await store.logCall(api.id, callerId, { status: 'relogin', latency_ms: 0 });
      const login = await browserLogin(api);
      chromeDurationMs += login.chromeDurationMs;
      await store.saveSession(api.id, login.cookies, 30);
      const data = await networkReplay(api, inputs, login.cookies);
      return { data, chromeDurationMs };
    }
    throw err;
  }
}

// ---------- browser login (runs once per session window) ----------
async function browserLogin(api: Api): Promise<{ cookies: Array<{ name: string; value: string }>; chromeDurationMs: number }> {
  const t0 = Date.now();
  const { chromium } = await import('playwright');
  const flow = api.recordedFlow as RecordedFlow;
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    for (const step of flow.steps || []) {
      if (step.type === 'navigate') await page.goto(step.url!, { waitUntil: 'domcontentloaded', timeout: 30000 });
      else if (step.type === 'fill') await page.fill(step.selector!, resolveSecret(step.value, api));
      else if (step.type === 'click') await page.click(step.selector!).catch(() => {});
      else if (step.type === 'submit') {
        await page.click(step.submitSelector || step.selector!).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      }
      // stop after login is done — data comes from network replay
      if (/login|signin|submit/i.test(JSON.stringify(step))) break;
    }
    const cookies = await ctx.cookies();
    return { cookies, chromeDurationMs: Date.now() - t0 };
  } finally {
    await browser.close();
  }
}

// ---------- full browser replay (stateful) ----------
async function browserReplay(
  api: Api,
  inputs: Record<string, string>
): Promise<{ data: unknown; chromeDurationMs: number }> {
  const t0 = Date.now();
  const { chromium } = await import('playwright');
  const flow = api.recordedFlow as RecordedFlow;
  const browser = await chromium.launch({ headless: true });
  const captured: unknown[] = [];
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('response', async (r) => {
      const ct = r.headers()['content-type'] || '';
      if (ct.includes('application/json')) {
        const j = await r.json().catch(() => null);
        if (j) captured.push(j);
      }
    });
    for (const step of flow.steps || []) {
      if (step.type === 'navigate') await page.goto(step.url!, { waitUntil: 'domcontentloaded', timeout: 30000 });
      else if (step.type === 'fill') {
        let val = step.value;
        for (const [k, v] of Object.entries(inputs)) if (step._var === k) val = v;
        await page.fill(step.selector!, resolveSecret(val, api)).catch(() => {});
      } else if (step.type === 'click') await page.click(step.selector!).catch(() => {});
      else if (step.type === 'submit') {
        await page.click(step.submitSelector || step.selector!).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      }
    }
    const last = captured[captured.length - 1] || { ok: true };
    const data = extractOutput(last, api.outputSchema as { fields?: { name: string; path: string }[] } | null);
    return { data, chromeDurationMs: Date.now() - t0 };
  } finally {
    await browser.close();
  }
}

// ---------- helpers ----------
function pickDataRequest(flow: RecordedFlow): RecordedNetworkRequest | null {
  const net = flow.network_requests || [];
  return (
    net.find((r) => r._isData) ||
    net.find((r) => r.response && typeof r.response === 'object') ||
    net[net.length - 1] ||
    null
  );
}

function extractOutput(json: unknown, schema: { fields?: { name: string; path: string }[] } | null): unknown {
  if (!schema || !schema.fields || !schema.fields.length) return json;
  // unwrap common list containers
  let rows: unknown = json;
  if (!Array.isArray(rows)) {
    const obj = json as Record<string, unknown>;
    rows = obj.results || obj.data || obj.items || [json];
  }
  const arr = Array.isArray(rows) ? rows : [rows];
  return arr.map((row) => Object.fromEntries(schema.fields!.map((f) => [f.name, getPath(row, f.path)])));
}

// resolves ".name.official" AND ".capital.0" (array index) AND "results.0.name"
function getPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  return path
    .replace(/^\./, '')
    .split('.')
    .reduce((o: unknown, k: string) => {
      if (o == null) return undefined;
      const idx = /^\d+$/.test(k) ? Number(k) : k;
      return (o as Record<string | number, unknown>)[idx];
    }, obj);
}

function resolveSecret(value: string | undefined, api: Api): string {
  // credentials injected from env for the working spine (never hardcode).
  // e.g. value "{{SHAMSU_LOGIN_USER}}" pulls process.env.SHAMSU_LOGIN_USER
  void api; // reserved: per-API credential vault lookup lands with the auth phase
  if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
    return process.env[value.slice(2, -2)] || '';
  }
  return value || '';
}

function describeError(err: Error & { code?: string }): RunErrorInfo {
  const key = err.code || err.message;
  const map: Record<string, RunErrorInfo> = {
    NO_DATA_REQUEST: {
      code: 'NO_DATA_REQUEST',
      friendlyMessage: 'This API has no data source recorded. Re-record and make sure the data loads.',
      developerMessage: 'No data request found in the recorded flow.',
      details: { suggestion: 'Re-record and make sure a JSON XHR/fetch response is captured.' },
    },
    SESSION_REJECTED: {
      code: 'SESSION_REJECTED',
      friendlyMessage: 'The login session was rejected and could not refresh. Please re-record the login.',
      developerMessage: 'The cached session was rejected (401/403) and auto-relogin also failed.',
      details: { suggestion: 'Re-record the login step; credentials may have changed.' },
    },
    BAD_RESPONSE: {
      code: 'BAD_RESPONSE',
      friendlyMessage: 'The website returned something unexpected. It may have changed or be temporarily down.',
      developerMessage: 'The replayed request did not return valid JSON.',
      details: { suggestion: 'The site may have changed its response shape or is temporarily down.' },
    },
  };
  return (
    map[key] || {
      code: 'RUN_FAILED',
      friendlyMessage: 'The API run failed. Please try again in a moment.',
      developerMessage: err.message || 'Unknown error',
      details: { suggestion: 'Check server logs for the full stack trace.' },
    }
  );
}
