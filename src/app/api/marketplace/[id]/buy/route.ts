// POST /api/marketplace/:id/buy — a buyer purchases access (PRD 2.5/5.2):
// grants ENDPOINT-ONLY access + a fresh API key. The buyer never sees or can
// export the recorded flow — nothing in this response or in any buyer-facing
// route ever includes it.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { purchaseApi } from '@/lib/marketplace';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const result = await purchaseApi(params.id, user.id);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    data: { endpoint: result.endpoint, api_key: result.apiKey },
  });
}
