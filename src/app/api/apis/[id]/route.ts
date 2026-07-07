// GET /api/apis/:id — fetch a single API's full detail, owner-only:
// draft classification (used by the confirmation screen, Phase 5), plus
// (Phase 7) API keys, recent call history, marketplace status, and a JSON
// format example — used by the API detail page.
//
// DELETE /api/apis/:id — soft-delete with an encrypted backup (PRD 4.5).

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { getSessionUser } from '@/lib/auth';
import { getApiKeys, getCallHistory, getMarketplaceListing } from '@/lib/creatorData';
import { deleteApiWithBackup } from '@/lib/marketplace';

interface SchemaVariable {
  name: string;
  example?: string;
}
interface SchemaOutputField {
  name: string;
}

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

  const [keys, callHistory, marketplaceListing] = await Promise.all([
    getApiKeys(api.id),
    getCallHistory(api.id),
    getMarketplaceListing(api.id),
  ]);

  const variables = ((api.variableSchema as { inputs?: SchemaVariable[] } | null)?.inputs || []) as SchemaVariable[];
  const outputFields = ((api.outputSchema as { fields?: SchemaOutputField[] } | null)?.fields || []) as SchemaOutputField[];
  const exampleRequest = Object.fromEntries(variables.map((v) => [v.name, v.example || 'value']));
  const exampleResponse = [Object.fromEntries(outputFields.map((f) => [f.name, 'example_value']))];

  return NextResponse.json({
    success: true,
    data: {
      id: api.id,
      name: api.name,
      status: api.status,
      replay_mode: api.replayMode,
      credential_type: api.credentialType,
      endpoint_url: api.endpointUrl,
      recorded_flow: api.recordedFlow,
      variable_schema: api.variableSchema,
      output_schema: api.outputSchema,
      classification: api.lastClassification,
      created_at: api.createdAt,
      keys,
      call_history: callHistory,
      marketplace: marketplaceListing
        ? {
            is_listed: true,
            price: marketplaceListing.price,
            pricing_model: marketplaceListing.pricingModel,
            category: marketplaceListing.category,
            is_active: marketplaceListing.isActive,
          }
        : { is_listed: false },
      json_format: { example_request: exampleRequest, example_response: exampleResponse },
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
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

  const { notifiedBuyerCount } = await deleteApiWithBackup(params.id);
  return NextResponse.json({ success: true, data: { notified_buyer_count: notifiedBuyerCount } });
}

// PATCH /api/apis/:id — creator pause/resume toggle. Deliberately narrow:
// only 'active' and 'paused' are accepted here (never 'deleted', which stays
// exclusive to DELETE's soft-delete-with-backup flow above).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  if (api.status !== 'active' && api.status !== 'paused') {
    return NextResponse.json({ success: false, error: `Cannot change status of a ${api.status} API.` }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  if (body?.status !== 'active' && body?.status !== 'paused') {
    return NextResponse.json({ success: false, error: "status must be 'active' or 'paused'." }, { status: 400 });
  }

  await store.setApiStatus(params.id, body.status);
  return NextResponse.json({ success: true, data: { status: body.status } });
}
