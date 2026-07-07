// billing.ts — manual bKash credit purchase requests (PRD sections 2.4/4.3).
// A user submits "I sent X BDT, here's the transaction number"; an admin
// matches it against the real bKash receipt out-of-band and confirms it in
// the admin panel, which is where the actual balance credit happens.
//
// creditsAdded == amountBdt: this app's ledger is denominated directly in
// BDT (see Phase 6 pricing), not an abstracted "credits" unit, so there's no
// separate conversion rate to apply here.

import { db } from './db';

export async function submitCreditPurchase(userId: string, amountBdt: number, paymentReference: string) {
  return db.creditPurchase.create({
    data: {
      userId,
      amountBdt,
      creditsAdded: Math.round(amountBdt),
      paymentMethod: 'bkash',
      paymentReference,
      status: 'pending',
    },
  });
}

export async function getUserCreditPurchases(userId: string) {
  return db.creditPurchase.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

// Billing page's "spend history" — every call this user made as a caller,
// across every API (their own, for testing, or ones they bought), not
// scoped to one API like marketplace.ts's getBuyerCallHistory.
export async function getUserSpendHistory(userId: string, limit = 50) {
  const calls = await db.apiCall.findMany({
    where: { callerId: userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: { api: { select: { name: true } } },
  });
  return calls.map((c) => ({
    id: c.id,
    api_name: c.api.name,
    timestamp: c.timestamp,
    status: c.status,
    cost_bdt: c.costBdt != null ? Number(c.costBdt) : null,
  }));
}
