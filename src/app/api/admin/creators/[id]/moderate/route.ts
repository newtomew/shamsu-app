// POST /api/admin/creators/:id/moderate — 3-stage enforcement (PRD 4.3):
// body { action: 'warning' | 'final_warning' | 'banned' | 'reinstate' }.
// A banned creator's APIs stop accepting calls (enforced in the /call route).

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth';
import { moderateCreator } from '@/lib/admin';

const VALID_ACTIONS = ['warning', 'final_warning', 'banned', 'reinstate'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(req);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (!VALID_ACTIONS.includes(body?.action)) {
    return NextResponse.json({ success: false, error: `action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
  }
  const result = await moderateCreator(params.id, body.action);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: { status: result.status } });
}
