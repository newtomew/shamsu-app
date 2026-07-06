// POST /api/admin/disputes/:id/resolve — body: { resolution: 'refunded_50' |
// 'refunded_100' | 'denied', notes?, flag_creator? }. PRD 4.2/4.3: genuine
// transient failure -> 50% refund (infra was spent); confirmed fake/broken
// listing -> 100% refund + flag creator.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { resolveDispute, type DisputeResolution } from '@/lib/admin';

const VALID_RESOLUTIONS: DisputeResolution[] = ['refunded_50', 'refunded_100', 'denied'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const resolution = body?.resolution;
  if (!VALID_RESOLUTIONS.includes(resolution)) {
    return NextResponse.json(
      { success: false, error: `resolution must be one of: ${VALID_RESOLUTIONS.join(', ')}` },
      { status: 400 }
    );
  }
  const result = await resolveDispute(params.id, admin.id, resolution, body?.notes, !!body?.flag_creator);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: { refund_amount: result.refundAmount } });
}
