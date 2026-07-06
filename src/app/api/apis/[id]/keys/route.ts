// GET  /api/apis/:id/keys  — list keys (never the raw key/hash). Owner-only.
// POST /api/apis/:id/keys  — mint a new named key for this API. Owner-only.

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { getSessionUser } from '@/lib/auth';
import { getApiKeys, createApiKey } from '@/lib/creatorData';

async function requireOwnedApi(req: NextRequest, apiId: string) {
  const user = await getSessionUser(req);
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 }) };
  const api = await store.getApi(apiId);
  if (!api) return { error: NextResponse.json({ success: false, error: 'api not found' }, { status: 404 }) };
  if (api.creatorId !== user.id) {
    return { error: NextResponse.json({ success: false, error: 'You do not own this API' }, { status: 403 }) };
  }
  return { user, api };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const check = await requireOwnedApi(req, params.id);
  if (check.error) return check.error;
  const keys = await getApiKeys(params.id);
  return NextResponse.json({ success: true, data: keys });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const check = await requireOwnedApi(req, params.id);
  if (check.error) return check.error;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : 'unnamed';

  const rawKey = await createApiKey(params.id, name, check.user!.id);
  return NextResponse.json({ success: true, data: { name, api_key: rawKey } }, { status: 201 });
}
