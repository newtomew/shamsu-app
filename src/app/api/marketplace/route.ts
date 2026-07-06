// GET /api/marketplace — browse listings with filters (PRD 2.8): category,
// price range, rating, popularity. Requires a session (this app has no
// public/unauthenticated pages), but returns only public listing fields —
// never recorded_flow, creator identity, or revenue.

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { browseListings } from '@/lib/marketplace';

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const category = params.get('category') || undefined;
  const minPrice = params.get('min_price') ? Number(params.get('min_price')) : undefined;
  const maxPrice = params.get('max_price') ? Number(params.get('max_price')) : undefined;
  const minRating = params.get('min_rating') ? Number(params.get('min_rating')) : undefined;
  const sort = (params.get('sort') as 'rating' | 'popularity' | 'price_asc' | 'price_desc' | null) || undefined;

  const listings = await browseListings({ category, minPrice, maxPrice, minRating, sort });
  return NextResponse.json({ success: true, data: listings });
}
