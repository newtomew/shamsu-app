// GET /api/admin/credit-purchases — pending (or filtered) bKash requests
// (PRD 4.3): user + transaction number + amount, for manual matching.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { listCreditPurchases } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const status = req.nextUrl.searchParams.get('status') || undefined;
  const purchases = await listCreditPurchases(status);
  return NextResponse.json({ success: true, data: purchases });
}
