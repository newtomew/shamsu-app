// GET /api/creator/apis — dashboard summary: all of the logged-in user's
// APIs with quick stats (total calls, revenue, active buyers). Scoped to
// the session user at the query level, not just checked after the fact.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getCreatorApisSummary } from '@/lib/creatorData';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  const apis = await getCreatorApisSummary(user.id);
  return NextResponse.json({ success: true, data: apis });
}
