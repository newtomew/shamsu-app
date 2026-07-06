// POST /api/admin/apis/:id/flag — suspend a specific API immediately
// (PRD 4.3: "any API flaggable"), independent of the creator's own ban
// status. Delists it from the marketplace; the /call route already rejects
// any status other than 'active'.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { flagApi } from '@/lib/admin';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  await flagApi(params.id);
  return NextResponse.json({ success: true });
}
