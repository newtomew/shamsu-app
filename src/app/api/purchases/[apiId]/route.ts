// GET /api/purchases/:apiId — one purchase's detail: endpoint + MY usage
// only (timestamp, status, latency, cost) — PRD 2.5. A buyer can never see
// another buyer's calls, even for the same API (privacy isolation, PRD 2.7).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getBuyerCallHistory } from '@/lib/marketplace';

export async function GET(req: NextRequest, { params }: { params: { apiId: string } }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const purchase = await db.marketplacePurchase.findFirst({
    where: { apiId: params.apiId, buyerId: user.id },
  });
  if (!purchase) {
    return NextResponse.json({ success: false, error: 'You have not purchased this API' }, { status: 403 });
  }

  const api = await db.api.findUnique({
    where: { id: params.apiId },
    select: { name: true, status: true, endpointUrl: true },
  });
  const usage = await getBuyerCallHistory(params.apiId, user.id);

  return NextResponse.json({
    success: true,
    data: {
      api_id: params.apiId,
      name: api?.name,
      api_status: api?.status,
      endpoint: api?.endpointUrl,
      purchase_status: purchase.status,
      usage,
    },
  });
}
