// GET /api/purchases — buyer dashboard (PRD 2.5): APIs I bought + my credit
// balance. Scoped to the session user as buyer — never another buyer's rows.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, publicUser } from '@/lib/auth';
import { getBuyerPurchases } from '@/lib/marketplace';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const purchases = await getBuyerPurchases(user.id);
  return NextResponse.json({ success: true, data: { purchases, credit_balance: publicUser(user).api_credits_balance } });
}
