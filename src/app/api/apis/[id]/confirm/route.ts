// POST /api/apis/:id/confirm — ported from shamsu-engine server.js `POST /apis/:id/confirm`.
// Activates the API, saves the confirmed variable/output schema, replay_mode
// and credential_type, mints an API key, and returns a ready-to-run curl
// example. Only the API's creator may confirm it.
//
// Warnings (PRD section 1.3: "must ask the user before building anything
// ambiguous") are computed from the submitted choices. If any exist and the
// request doesn't set `force: true`, confirm is refused with 409 and the
// warning list — the confirm page shows these and offers "confirm anyway".

import { NextRequest, NextResponse } from 'next/server';
import * as store from '@/lib/store';
import { getSessionUser } from '@/lib/auth';
import { validateConfirmationChoices } from '@/lib/validation';
import type { Classification } from '@/lib/classifier';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const body = await req.json().catch(() => ({}));
  const replay_mode = body?.replay_mode || api.replayMode;
  const credential_type = body?.credential_type || api.credentialType || 'stored';
  const variables = Array.isArray(body?.variables) ? body.variables : [];
  const output_fields = Array.isArray(body?.output_fields) ? body.output_fields : [];
  const force = body?.force === true;
  const keyName = typeof body?.key_name === 'string' && body.key_name.trim() ? body.key_name.trim() : undefined;

  const priorClassification = api.lastClassification as unknown as Classification | null;
  const needsLogin = priorClassification?.needs_login ?? false;

  const validation = validateConfirmationChoices({
    needs_login: needsLogin,
    replay_mode,
    credential_type,
    variables,
    output_fields,
  });

  if (validation.error) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
  }
  if (validation.warnings.length > 0 && !force) {
    return NextResponse.json(
      {
        success: false,
        error: 'This configuration has warnings. Review them, then resubmit with force:true to confirm anyway.',
        warnings: validation.warnings,
      },
      { status: 409 }
    );
  }

  const key = await store.confirmApi(
    params.id,
    {
      replay_mode,
      variable_schema: { inputs: variables },
      output_schema: { fields: output_fields },
      credential_type,
    },
    user.id,
    keyName
  );

  const base = baseUrl(req);
  const endpoint = `${base}/api/v1/${params.id}/call`;
  const exampleBody = buildExampleBody(variables);

  return NextResponse.json({
    success: true,
    data: {
      api_id: params.id,
      endpoint,
      api_key: key,
      replay_mode,
      credential_type,
      how_to_call: `curl -X POST ${endpoint} -H "Authorization: Bearer ${key}" -H "Content-Type: application/json" -d '${JSON.stringify(exampleBody)}'`,
      warnings: validation.warnings, // present (and overridden) if force:true was used
    },
  });
}

function buildExampleBody(variables: Array<{ name: string; example?: string }>): Record<string, string> {
  const body: Record<string, string> = {};
  for (const v of variables) {
    if (v.name) body[v.name] = v.example ?? 'value';
  }
  return body;
}

function baseUrl(req: NextRequest): string {
  return process.env.PUBLIC_URL || req.nextUrl.origin;
}
