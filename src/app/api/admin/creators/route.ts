// GET /api/admin/creators — all users (PRD 4.3: "Admin sees lists of: all
// APIs, all creators, buyers-per-creator") with their API count and
// moderation status.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { listCreators } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const creators = await listCreators();
  return NextResponse.json({ success: true, data: creators });
}
