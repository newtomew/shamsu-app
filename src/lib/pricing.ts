// pricing.ts — MVP flat pricing (PRD section 5.1): 150 BDT / 10,000 calls,
// pre-paid credit pool, balance decreases per call. Weighted per-replay-mode
// tiers are explicitly Phase 2 in the PRD — not built here.

export const FLAT_PRICE_BDT = 150;
export const CALLS_PER_BATCH = 10_000;
export const COST_PER_CALL_BDT = FLAT_PRICE_BDT / CALLS_PER_BATCH; // 0.015

// On a failed/timed-out call the creator's infra cost was still spent (PRD
// section 4.5), so only half the per-call cost is charged.
export const FAILED_CALL_COST_BDT = COST_PER_CALL_BDT / 2;
