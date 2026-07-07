// GET /api/marketplace/:id — single listing detail for the marketplace/[id]
// page. Same public-fields-only rule as browseListings (never recorded_flow,
// creator identity, or revenue) — see lib/marketplace.ts's getListingPublic.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getListingPublic } from '@/lib/marketplace';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const listing = await getListingPublic(params.id, user.id);
  if (!listing) {
    return NextResponse.json({ success: false, error: 'This listing is not available.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: listing });
}
