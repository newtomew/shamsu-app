// rateLimiter.ts — per-API rate limiting and concurrency capping (PRD
// section 3.8: 50 calls/sec per API, max 50 concurrent Chrome instances per
// API). In-process, in-memory — correct for a single Node process (this
// app's current deployment shape); a multi-instance deployment would need
// this moved to something shared like Redis.

// Overridable via env for load-testing the limiter itself without needing to
// actually launch 50 concurrent Chrome instances; defaults match PRD 3.8.
const RATE_LIMIT_PER_SEC = Number(process.env.SHAMSU_RATE_LIMIT_PER_SEC) || 50;
const MAX_CONCURRENT_PER_API = Number(process.env.SHAMSU_MAX_CONCURRENT_PER_API) || 50;
const WINDOW_MS = 1000;

const callTimestamps = new Map<string, number[]>();
const concurrentCounts = new Map<string, number>();

// Sliding-window check: records this attempt's timestamp and reports whether
// the count within the last second (including this one) is within budget.
export function checkRateLimit(apiId: string): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const recent = (callTimestamps.get(apiId) || []).filter((t) => t > windowStart);
  recent.push(now);
  callTimestamps.set(apiId, recent);
  return recent.length <= RATE_LIMIT_PER_SEC;
}

// Reserves a concurrency slot; returns false if the API is already at its cap.
// Callers MUST pair a successful reservation with releaseConcurrencySlot in a
// finally block.
export function tryReserveConcurrencySlot(apiId: string): boolean {
  const current = concurrentCounts.get(apiId) || 0;
  if (current >= MAX_CONCURRENT_PER_API) return false;
  concurrentCounts.set(apiId, current + 1);
  return true;
}

export function releaseConcurrencySlot(apiId: string): void {
  const current = concurrentCounts.get(apiId) || 0;
  concurrentCounts.set(apiId, Math.max(0, current - 1));
}

// Sum of in-flight executions across every API, right now, in THIS process
// (Phase 10 admin monitoring's "Chrome pool usage" — real, but single-process
// and point-in-time, not a distributed pool metric; there's no actual
// browser-pool infrastructure behind this app).
function currentTotalConcurrency(): number {
  let total = 0;
  concurrentCounts.forEach((v) => {
    total += v;
  });
  return total;
}

export const RATE_LIMIT_CONFIG = { RATE_LIMIT_PER_SEC, MAX_CONCURRENT_PER_API, currentTotalConcurrency };
