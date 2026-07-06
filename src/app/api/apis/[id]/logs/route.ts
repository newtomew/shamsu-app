// GET /api/apis/:id/logs — ported from shamsu-engine server.js `GET /apis/:id/logs`.
// Recent call logs (dashboard preview). Logs contain request/response bodies,
// so only the API's creator may view them.

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const api = await store.getApi(params.id);
  if (!api) {
    return NextResponse.json({ success: false, error: 'api not found' }, { status: 404 });
  }
  if (api.creatorId !== user.id) {
    return NextResponse.json({ success: false, error: 'You do not own this API' }, { status: 403 });
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;
  const logs = await store.recentLogs(params.id, limit);
  return NextResponse.json({ success: true, data: logs });
}
