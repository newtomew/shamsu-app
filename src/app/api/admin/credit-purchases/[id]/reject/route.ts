// POST /api/admin/credit-purchases/:id/reject — the transaction number
// didn't match any real bKash receipt, or was fraudulent.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { rejectCreditPurchase } from '@/lib/admin';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const result = await rejectCreditPurchase(params.id, admin.id);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
