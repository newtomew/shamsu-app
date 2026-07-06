// GET  /api/billing/credit-purchases — my own bKash requests + their status.
// POST /api/billing/credit-purchases — submit one: { amount_bdt, payment_reference }.
// An admin (Phase 10 panel) matches the transaction number and confirms it —
// this endpoint only creates the 'pending' record.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { submitCreditPurchase, getUserCreditPurchases } from '@/lib/billing';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const purchases = await getUserCreditPurchases(user.id);
  return NextResponse.json({ success: true, data: purchases });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const amount = Number(body?.amount_bdt);
  const reference = typeof body?.payment_reference === 'string' ? body.payment_reference.trim() : '';
  if (!amount || amount <= 0) {
    return NextResponse.json({ success: false, error: 'amount_bdt must be a positive number.' }, { status: 400 });
  }
  if (!reference) {
    return NextResponse.json({ success: false, error: 'payment_reference (bKash transaction number) is required.' }, { status: 400 });
  }
  const purchase = await submitCreditPurchase(user.id, amount, reference);
  return NextResponse.json({ success: true, data: { id: purchase.id, status: purchase.status } }, { status: 201 });
}
