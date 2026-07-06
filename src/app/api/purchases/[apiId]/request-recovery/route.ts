// POST /api/purchases/:apiId/request-recovery — buyer-initiated disaster
// recovery (PRD 4.5): if the creator deleted the API, restore it from the
// encrypted backup so the buyer's integration works again.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { requestRecovery } from '@/lib/marketplace';

export async function POST(req: NextRequest, { params }: { params: { apiId: string } }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const result = await requestRecovery(params.apiId, user.id);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
