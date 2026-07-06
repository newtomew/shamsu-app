// POST /api/apis/:id/keys/:keyId/revoke — revoke one key individually.
// Owner-only; also verifies the key actually belongs to this api id (not
// just that the caller owns *some* API).

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { getSessionUser } from '@/lib/auth';
import { getApiIdForKey, revokeApiKey } from '@/lib/creatorData';

export async function POST(req: NextRequest, { params }: { params: { id: string; keyId: string } }) {
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

  const keyApiId = await getApiIdForKey(params.keyId);
  if (keyApiId !== params.id) {
    return NextResponse.json({ success: false, error: 'Key not found on this API' }, { status: 404 });
  }

  await revokeApiKey(params.keyId);
  return NextResponse.json({ success: true });
}
