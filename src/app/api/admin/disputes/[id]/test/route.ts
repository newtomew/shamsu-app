// POST /api/admin/disputes/:id/test — admin runs the disputed API themselves
// (same engine as the creator's own Test button) to see whether the buyer's
// complaint holds up, before deciding a refund.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { testDisputeApi } from '@/lib/admin';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const result = await testDisputeApi(params.id, admin.id);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: result.result });
}
