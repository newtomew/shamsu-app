// GET /api/admin/apis — every API across every creator (admin-wide view,
// unlike the creator dashboard's self-scoped list), including whether an
// encrypted backup exists (Phase 8/PRD 4.5) and the creator's moderation status.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { listAllApis } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const apis = await listAllApis();
  return NextResponse.json({ success: true, data: apis });
}
