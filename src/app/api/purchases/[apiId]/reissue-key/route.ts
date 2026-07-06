// POST /api/purchases/:apiId/reissue-key — mint a fresh key for a buyer who
// lost theirs (raw keys are only ever shown once, same rule as the creator
// side). Requires an active purchase for this API.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getActivePurchase } from '@/lib/marketplace';
import { createApiKey } from '@/lib/creatorData';

export async function POST(req: NextRequest, { params }: { params: { apiId: string } }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const purchase = await getActivePurchase(params.apiId, user.id);
  if (!purchase) {
    return NextResponse.json({ success: false, error: 'You do not have active access to this API' }, { status: 403 });
  }
  const apiKey = await createApiKey(params.apiId, 'marketplace', user.id);
  return NextResponse.json({ success: true, data: { api_key: apiKey } });
}
