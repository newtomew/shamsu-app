// POST /api/admin/credit-purchases/:id/confirm — admin matches the bKash
// transaction number against the real receipt out-of-band, then confirms;
// this is what actually credits the user's balance.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { confirmCreditPurchase } from '@/lib/admin';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const result = await confirmCreditPurchase(params.id, admin.id);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
