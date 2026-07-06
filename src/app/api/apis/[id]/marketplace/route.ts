// GET   /api/apis/:id/marketplace — the creator's own listing (private
//       view — includes price/description/etc for editing). Owner-only.
// POST  /api/apis/:id/marketplace — create or update the listing (PRD 2.8).
//       Required: price, category, description. Optional: pricing_model,
//       documentation, example_request/response, rate_limit_per_sec,
//       max_concurrent. Owner-only; API must be confirmed (status active).
// DELETE /api/apis/:id/marketplace — unlist (stop new purchases; existing
//       buyers keep access).

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { getSessionUser } from '@/lib/auth';
import { getMarketplaceListing } from '@/lib/creatorData';
import { upsertListing, unlistApi, VALID_PRICING_MODELS } from '@/lib/marketplace';

async function requireOwnedActiveApi(req: NextRequest, apiId: string) {
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
  const check = await requireOwnedActiveApi(req, params.id);
  if (check.error) return check.error;
  const listing = await getMarketplaceListing(params.id);
  return NextResponse.json({ success: true, data: listing });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const check = await requireOwnedActiveApi(req, params.id);
  if (check.error) return check.error;
  if (check.api!.status !== 'active') {
    return NextResponse.json({ success: false, error: 'Confirm this API before listing it.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { price, category, description } = body || {};
  if (typeof price !== 'number' || price <= 0) {
    return NextResponse.json({ success: false, error: 'price is required and must be a positive number.' }, { status: 400 });
  }
  if (typeof category !== 'string' || !category.trim()) {
    return NextResponse.json({ success: false, error: 'category is required.' }, { status: 400 });
  }
  if (typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ success: false, error: 'description is required.' }, { status: 400 });
  }
  const pricingModel = body.pricing_model || 'per_call';
  if (!VALID_PRICING_MODELS.includes(pricingModel)) {
    return NextResponse.json(
      { success: false, error: `pricing_model must be one of: ${VALID_PRICING_MODELS.join(', ')}` },
      { status: 400 }
    );
  }

  await upsertListing(params.id, {
    price,
    pricing_model: pricingModel,
    category: category.trim(),
    description: description.trim(),
    documentation: body.documentation,
    example_request: body.example_request,
    example_response: body.example_response,
    rate_limit_per_sec: body.rate_limit_per_sec,
    max_concurrent: body.max_concurrent,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const check = await requireOwnedActiveApi(req, params.id);
  if (check.error) return check.error;
  await unlistApi(params.id);
  return NextResponse.json({ success: true });
}
