// POST /api/purchases/:apiId/dispute — buyer opens a support ticket over a
// purchase (PRD 4.2/4.3): { reason }. An admin tests the API and resolves it.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { fileDispute } from '@/lib/marketplace';

export async function POST(req: NextRequest, { params }: { params: { apiId: string } }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    return NextResponse.json({ success: false, error: 'reason is required.' }, { status: 400 });
  }
  const result = await fileDispute(params.apiId, user.id, reason);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: { dispute_id: result.disputeId } }, { status: 201 });
}
