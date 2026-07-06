// GET /api/admin/monitoring — real-time-ish dashboard (PRD 4.1): active
// APIs, failure rate, avg response time, Chrome-pool usage, queue depth,
// plus computed Info/Warning alerts (no Critical level exists here).

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { getMonitoring } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const data = await getMonitoring();
  return NextResponse.json({ success: true, data });
}
