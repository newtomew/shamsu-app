// GET /api/admin/disputes — list disputes (PRD 4.2/4.3), optionally filtered
// by status (?status=open).

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { listDisputes } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const status = req.nextUrl.searchParams.get('status') || undefined;
  const disputes = await listDisputes(status);
  return NextResponse.json({ success: true, data: disputes });
}
