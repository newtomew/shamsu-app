// marketplace.ts — browsing, listing management, purchasing, buyer usage,
// earnings, and disaster recovery (PRD sections 2.5, 2.8, 4.5, 5.2).
//
// PRIVACY (PRD 2.7/2.8, critical): browseListings and getListingPublic never
// return recorded_flow, creator identity, or revenue — only what PRD 2.8
// lists as listing fields. Buyer-usage queries are always scoped by
// callerId = the requesting buyer, never another buyer's rows.

import { db } from './db';
import { createApiKey } from './creatorData';
import { encrypt, decrypt } from './crypto';

const VALID_PRICING_MODELS = ['per_call', 'subscription'];

export { VALID_PRICING_MODELS };

// ---------------------------------------------------------------------------
// Browsing (public listing fields only — see privacy note above)
// ---------------------------------------------------------------------------
export interface BrowseFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: 'rating' | 'popularity' | 'price_asc' | 'price_desc';
}

export async function browseListings(filters: BrowseFilters) {
  const listings = await db.marketplaceListing.findMany({
    where: {
      isActive: true,
      api: { status: 'active' },
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.minPrice != null ? { price: { gte: filters.minPrice } } : {}),
      ...(filters.maxPrice != null ? { price: { lte: filters.maxPrice } } : {}),
      ...(filters.minRating != null ? { rating: { gte: filters.minRating } } : {}),
    },
    include: { api: { select: { id: true, name: true } } },
  });

  let popularityByApiId = new Map<string, number>();
  if (filters.sort === 'popularity') {
    const counts = await db.apiCall.groupBy({
      by: ['apiId'],
      where: { apiId: { in: listings.map((l) => l.apiId) } },
      _count: { _all: true },
    });
    popularityByApiId = new Map(counts.map((c) => [c.apiId, c._count._all]));
  }

  const results = listings.map((l) => ({
    api_id: l.apiId,
    name: l.api.name,
    description: l.description,
    price: Number(l.price),
    pricing_model: l.pricingModel,
    category: l.category,
    rating: Number(l.rating),
    review_count: l.reviewCount,
    documentation: l.documentation,
    example_request: l.exampleRequest,
    example_response: l.exampleResponse,
    popularity: popularityByApiId.get(l.apiId) || 0,
  }));

  switch (filters.sort) {
    case 'rating':
      results.sort((a, b) => b.rating - a.rating);
      break;
    case 'popularity':
      results.sort((a, b) => b.popularity - a.popularity);
      break;
    case 'price_asc':
      results.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      results.sort((a, b) => b.price - a.price);
      break;
  }
  return results;
}

// ---------------------------------------------------------------------------
// Listing creation/update (creator side, PRD 2.8)
// ---------------------------------------------------------------------------
export interface ListingInput {
  price: number;
  pricing_model: string;
  category: string;
  description: string;
  documentation?: string;
  example_request?: unknown;
  example_response?: unknown;
  rate_limit_per_sec?: number;
  max_concurrent?: number;
}

export async function upsertListing(apiId: string, input: ListingInput) {
  await db.marketplaceListing.upsert({
    where: { apiId },
    create: {
      apiId,
      price: input.price,
      pricingModel: input.pricing_model,
      category: input.category,
      description: input.description,
      documentation: input.documentation,
      exampleRequest: (input.example_request as object) ?? undefined,
      exampleResponse: (input.example_response as object) ?? undefined,
    },
    update: {
      isActive: true, // (re-)listing always means active, including after a prior unlist/delete
      price: input.price,
      pricingModel: input.pricing_model,
      category: input.category,
      description: input.description,
      documentation: input.documentation,
      exampleRequest: (input.example_request as object) ?? undefined,
      exampleResponse: (input.example_response as object) ?? undefined,
    },
  });

  // rate_limit_per_sec / max_concurrent are existing `apis` columns (PRD 3.6),
  // not marketplace_listings columns — "SLA"/"version notes" mentioned as
  // optional in PRD 2.8 have no dedicated column anywhere in the schema, so
  // they aren't captured as distinct fields; fold them into `documentation`
  // free text if a creator wants to state them.
  await db.api.update({
    where: { id: apiId },
    data: {
      isListedInMarketplace: true,
      marketplacePrice: input.price,
      marketplaceCategory: input.category,
      ...(input.rate_limit_per_sec ? { rateLimitPerSec: input.rate_limit_per_sec } : {}),
      ...(input.max_concurrent ? { maxConcurrent: input.max_concurrent } : {}),
    },
  });
}

export async function unlistApi(apiId: string) {
  await db.marketplaceListing.update({ where: { apiId }, data: { isActive: false } });
  await db.api.update({ where: { id: apiId }, data: { isListedInMarketplace: false } });
}

// ---------------------------------------------------------------------------
// Purchasing (PRD 2.5/5.2)
// ---------------------------------------------------------------------------
export async function getActivePurchase(apiId: string, buyerId: string) {
  return db.marketplacePurchase.findFirst({
    where: { apiId, buyerId, status: 'active' },
  });
}

export interface PurchaseResult {
  ok: boolean;
  error?: string;
  apiKey?: string;
  endpoint?: string;
}

export async function purchaseApi(apiId: string, buyerId: string): Promise<PurchaseResult> {
  const api = await db.api.findUnique({ where: { id: apiId } });
  if (!api || api.status !== 'active') return { ok: false, error: 'This API is not available.' };
  if (api.creatorId === buyerId) return { ok: false, error: 'You cannot buy your own API.' };

  const listing = await db.marketplaceListing.findUnique({ where: { apiId } });
  if (!listing || !listing.isActive) return { ok: false, error: 'This API is not listed in the marketplace.' };

  const existing = await getActivePurchase(apiId, buyerId);
  if (existing) return { ok: false, error: 'You already have access to this API.' };

  const price = Number(listing.price);
  let pricePaidNow = 0; // per_call: nothing is charged at purchase time

  if (listing.pricingModel === 'subscription') {
    const balance = await db.user.findUnique({ where: { id: buyerId }, select: { apiCreditsBalance: true } });
    if (!balance || Number(balance.apiCreditsBalance) < price) {
      return { ok: false, error: `Insufficient credits. Subscribing costs ${price} BDT.` };
    }
    await db.user.update({ where: { id: buyerId }, data: { apiCreditsBalance: { decrement: price } } });
    await recordEarnings(api.creatorId, price);
    pricePaidNow = price;
  }
  // per_call: purchasing itself is free — access is granted now, each call is
  // billed individually at listing.price (see the /call route).

  await db.marketplacePurchase.create({
    data: { apiId, buyerId, pricePaid: pricePaidNow, status: 'active' },
  });

  const apiKey = await createApiKey(apiId, 'marketplace', buyerId);
  return { ok: true, apiKey, endpoint: api.endpointUrl };
}

// ---------------------------------------------------------------------------
// Buyer dashboard (PRD 2.5) — always scoped to the requesting buyer
// ---------------------------------------------------------------------------
export async function getBuyerPurchases(buyerId: string) {
  const purchases = await db.marketplacePurchase.findMany({
    where: { buyerId },
    orderBy: { purchaseDate: 'desc' },
    include: { api: { select: { id: true, name: true, status: true, endpointUrl: true } } },
  });
  return purchases.map((p) => ({
    api_id: p.apiId,
    name: p.api.name,
    api_status: p.api.status, // 'deleted' means recovery may be needed
    endpoint: p.api.endpointUrl,
    purchase_date: p.purchaseDate,
    price_paid: Number(p.pricePaid || 0),
    status: p.status,
  }));
}

// Buyer opens a dispute (PRD 4.2/4.3) — one open dispute per purchase at a
// time; the admin panel (Phase 10) tests the API and resolves it.
export async function fileDispute(apiId: string, buyerId: string, reason: string) {
  const purchase = await db.marketplacePurchase.findFirst({ where: { apiId, buyerId } });
  if (!purchase) return { ok: false as const, error: 'You have not purchased this API.' };

  const existingOpen = await db.dispute.findFirst({ where: { purchaseId: purchase.id, status: 'open' } });
  if (existingOpen) return { ok: false as const, error: 'You already have an open dispute for this purchase.' };

  await db.marketplacePurchase.update({ where: { id: purchase.id }, data: { status: 'disputed' } });
  const dispute = await db.dispute.create({
    data: { purchaseId: purchase.id, buyerId, apiId, reason },
  });
  return { ok: true as const, disputeId: dispute.id };
}

// MY usage only — never another buyer's calls, even for the same API.
export async function getBuyerCallHistory(apiId: string, buyerId: string, limit = 50) {
  const calls = await db.apiCall.findMany({
    where: { apiId, callerId: buyerId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  return calls.map((c) => ({
    id: c.id,
    timestamp: c.timestamp,
    status: c.status,
    latency_ms: c.latencyMs,
    cost_bdt: c.costBdt,
  }));
}

// ---------------------------------------------------------------------------
// Commission split (PRD 2.8: 60% creator / 40% Shamsu). Shamsu's 40% isn't
// persisted anywhere — there's no platform-revenue table in the schema —
// it's simply whatever isn't credited to creator_earnings.
// ---------------------------------------------------------------------------
const CREATOR_SHARE = 0.6;

export async function recordEarnings(creatorId: string, chargedAmountBdt: number): Promise<void> {
  const creatorCut = chargedAmountBdt * CREATOR_SHARE;
  await db.creatorEarnings.upsert({
    where: { creatorId },
    create: { creatorId, totalEarnings: creatorCut, pendingPayout: creatorCut },
    update: {
      totalEarnings: { increment: creatorCut },
      pendingPayout: { increment: creatorCut },
    },
  });
}

export async function getCreatorEarnings(creatorId: string) {
  return db.creatorEarnings.findUnique({ where: { creatorId } });
}

// ---------------------------------------------------------------------------
// Disaster recovery (PRD 4.5)
// ---------------------------------------------------------------------------
export async function deleteApiWithBackup(apiId: string): Promise<{ notifiedBuyerCount: number }> {
  const api = await db.api.findUnique({ where: { id: apiId } });
  if (!api) return { notifiedBuyerCount: 0 };

  const encryptedBackup = encrypt(JSON.stringify(api.recordedFlow));
  await db.api.update({
    where: { id: apiId },
    data: { status: 'deleted', isListedInMarketplace: false, encryptedBackup },
  });
  if (api.isListedInMarketplace) {
    await db.marketplaceListing.updateMany({ where: { apiId }, data: { isActive: false } });
  }

  const activeBuyers = await db.marketplacePurchase.findMany({
    where: { apiId, status: 'active' },
    include: { buyer: { select: { email: true } } },
  });
  for (const purchase of activeBuyers) {
    // "Notify buyers" (PRD 4.5) — a log line is enough for MVP, same pattern
    // as the call-failure notification in Phase 6.
    console.warn(`[notify] API ${apiId} was deleted; buyer ${purchase.buyer.email} should expect it to stop working.`);
  }
  return { notifiedBuyerCount: activeBuyers.length };
}

export interface RecoveryResult {
  ok: boolean;
  error?: string;
}

// Buyer-initiated (PRD 4.5: "a buyer can request a new endpoint"). Simplified
// for this phase: restores the SAME api id/endpoint from the encrypted
// backup rather than minting a brand-new id and migrating purchases to it —
// soft-delete never actually destroyed the row, so the same endpoint working
// again is a faithful (if smaller-scope) recovery. Full re-issuance to a new
// endpoint with buyer migration is a further increment, not built here.
export async function requestRecovery(apiId: string, buyerId: string): Promise<RecoveryResult> {
  const purchase = await db.marketplacePurchase.findFirst({ where: { apiId, buyerId, status: 'active' } });
  if (!purchase) return { ok: false, error: 'You do not have access to this API.' };

  const api = await db.api.findUnique({ where: { id: apiId } });
  if (!api) return { ok: false, error: 'API not found.' };
  if (api.status !== 'deleted') return { ok: false, error: 'This API has not been deleted — no recovery needed.' };
  if (!api.encryptedBackup) return { ok: false, error: 'No backup is available for this API.' };

  const restoredFlow = JSON.parse(decrypt(api.encryptedBackup));
  await db.api.update({
    where: { id: apiId },
    data: { status: 'active', recordedFlow: restoredFlow },
  });
  console.warn(`[notify] API ${apiId} recovered from encrypted backup at buyer request (buyer ${buyerId}).`);
  return { ok: true };
}
