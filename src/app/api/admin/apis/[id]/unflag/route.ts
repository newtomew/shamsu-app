// POST /api/admin/apis/:id/unflag — lift a flag, restoring the API to active.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { unflagApi } from '@/lib/admin';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  await unflagApi(params.id);
  return NextResponse.json({ success: true });
}
