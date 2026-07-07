// GET /api/purchases/:apiId — one purchase's detail: endpoint + MY usage
// only (timestamp, status, latency, cost) — PRD 2.5. A buyer can never see
// another buyer's calls, even for the same API (privacy isolation, PRD 2.7).
//
// `variables` (name + example only, never `source` — a CSS selector, which
// stays on the creator side) is included because the buyer's Test panel
// can't build an input form without knowing what params to send. This is
// the public contract of the API, not the recorded flow.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getBuyerCallHistory } from '@/lib/marketplace';

interface SchemaVariable {
  name: string;
  example?: string;
}

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
    select: { name: true, status: true, endpointUrl: true, variableSchema: true },
  });
  const usage = await getBuyerCallHistory(params.apiId, user.id);
  const variables = ((api?.variableSchema as { inputs?: SchemaVariable[] } | null)?.inputs || []).map((v) => ({
    name: v.name,
    example: v.example,
  }));

  return NextResponse.json({
    success: true,
    data: {
      api_id: params.apiId,
      name: api?.name,
      api_status: api?.status,
      endpoint: api?.endpointUrl,
      purchase_status: purchase.status,
      variables,
      usage,
    },
  });
}
