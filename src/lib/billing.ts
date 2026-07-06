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
