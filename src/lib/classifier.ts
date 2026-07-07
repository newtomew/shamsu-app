// classifier.ts — ported from shamsu-engine/src/classifier.js, logic unchanged.
//
// Reads a recorded flow, decides:
//   replay_mode (network_replay | hybrid | browser_replay)
//   variables[] (inputs a caller can change)
//   output_fields[] (what the API returns)
//   needs_login
//
// Uses real Claude when ANTHROPIC_API_KEY is set. Falls back to a deterministic
// rule engine otherwise — so the API maker WORKS even with no key. Never throws.

const MODEL = 'claude-sonnet-4-6';

export interface RecordedStep {
  type: string;
  selector?: string;
  value?: string;
  url?: string;
  submitSelector?: string;
  _var?: string;
  [key: string]: unknown;
}

export interface RecordedNetworkRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  response?: unknown;
  _isData?: boolean;
  [key: string]: unknown;
}

export interface RecordedFlow {
  steps?: RecordedStep[];
  network_requests?: RecordedNetworkRequest[];
}

export interface ClassificationVariable {
  name: string;
  example?: string;
  source?: string;
}

export interface ClassificationOutputField {
  name: string;
  path: string;
}

export interface Classification {
  replay_mode: 'network_replay' | 'hybrid' | 'browser_replay';
  needs_login: boolean;
  variables: ClassificationVariable[];
  output_fields: ClassificationOutputField[];
  reason: string;
  claude_tokens_used: number; // 0 when the rule-based fallback ran
  _engine: 'claude' | 'rules';
  _dataUrl?: string | null;
}

export async function classifyFlow(recordedFlow: RecordedFlow): Promise<Classification> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      return await classifyWithClaude(recordedFlow, key);
    } catch (e) {
      // never let the brain crash the maker — fall back to rules
      console.warn('[classifier] Claude call failed, using rule fallback:', (e as Error).message);
    }
  }
  return classifyWithRules(recordedFlow);
}

// ---------- Real Claude ----------
async function classifyWithClaude(flow: RecordedFlow, key: string): Promise<Classification> {
  const prompt = `You are the classifier for Shamsu, a tool that turns recorded browser activity into an API.
Given this recorded flow JSON, decide how to replay it.

RECORDED FLOW:
${JSON.stringify(flow, null, 2)}

Return ONLY valid JSON, no prose, in this exact shape:
{
  "replay_mode": "network_replay" | "hybrid" | "browser_replay",
  "needs_login": true | false,
  "variables": [ { "name": "string", "example": "string", "source": "which recorded field this maps to" } ],
  "output_fields": [ { "name": "string", "path": "json path or selector" } ],
  "reason": "one sentence"
}

Rules:
- network_replay: pure data fetch, the useful data is already in an XHR/fetch JSON response, no login.
- hybrid: needs login once, but data comes from an XHR/fetch response (fast after login).
- browser_replay: form submission / stateful action that must drive a real browser every time.
- A field the user typed (search term, city, query) should become a variable.
- output_fields = the data the caller wants back.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    // surfaces things like an invalid/expired key or a rate limit — caught by
    // classifyFlow's try/catch, which falls back to rules
    throw new Error(data?.error?.message || `Anthropic API returned ${res.status}`);
  }
  const text = (data.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  parsed._engine = 'claude';
  const usage = data.usage || {};
  parsed.claude_tokens_used = (usage.input_tokens || 0) + (usage.output_tokens || 0);
  return parsed;
}

// ---------- Deterministic rule fallback ----------
function classifyWithRules(flow: RecordedFlow): Classification {
  const steps = flow.steps || [];
  const net = flow.network_requests || [];

  const hasLogin =
    steps.some((s) => /login|signin|password|auth/i.test(JSON.stringify(s))) ||
    net.some((r) => /login|signin|auth|token/i.test(r.url || ''));

  const hasSubmit = steps.some(
    (s) => s.type === 'submit' || /submit|checkout|book|buy/i.test(JSON.stringify(s))
  );

  // Find the JSON-returning GET/XHR = the data source. Prefer _isData first —
  // that's the recorder's own explicit signal that this was a detected JSON
  // response — mirroring replay.ts's pickDataRequest, which already checks
  // _isData before falling back to the typeof-object heuristic. Without this,
  // a request flagged _isData:true whose response was captured as a raw JSON
  // string (not yet parsed into an object) was invisible to this search,
  // incorrectly falling through to browser_replay despite real data having
  // been captured.
  let dataReq = net.find((r) => r._isData);
  if (!dataReq) {
    dataReq = net.find(
      (r) => (r.method === 'GET' || r.method === 'POST') && r.response && typeof r.response === 'object'
    );
  }
  // Normalize a stringified JSON response into a real object/array so
  // output_fields extraction below (which needs to read its keys) still works.
  if (dataReq && typeof dataReq.response === 'string') {
    try {
      dataReq = { ...dataReq, response: JSON.parse(dataReq.response) };
    } catch {
      // not actually JSON — leave as-is, output_fields extraction just won't find keys
    }
  }

  let replay_mode: Classification['replay_mode'];
  if (hasSubmit && !dataReq) replay_mode = 'browser_replay';
  else if (hasLogin && dataReq) replay_mode = 'hybrid';
  else if (dataReq) replay_mode = 'network_replay';
  else replay_mode = 'browser_replay';

  // variables = fields the user filled
  const variables = steps
    .filter((s) => s.type === 'fill' && s.value && !/password/i.test(s.selector || ''))
    .map((s) => ({
      name: guessName(s.selector),
      example: s.value,
      source: s.selector,
    }));

  // output fields = top-level keys of the data response
  let output_fields: ClassificationOutputField[] = [];
  if (dataReq && dataReq.response) {
    const sample = Array.isArray(dataReq.response) ? dataReq.response[0] : dataReq.response;
    if (sample && typeof sample === 'object') {
      output_fields = Object.keys(sample)
        .slice(0, 8)
        .map((k) => ({ name: k, path: '.' + k }));
    }
  }

  return {
    replay_mode,
    needs_login: hasLogin,
    variables,
    output_fields,
    reason: `rule-based: ${replay_mode} (${hasLogin ? 'login detected' : 'no login'}, ${
      dataReq ? 'data response found' : 'no data response'
    })`,
    claude_tokens_used: 0,
    _engine: 'rules',
    _dataUrl: dataReq ? dataReq.url : null,
  };
}

export function guessName(selector = ''): string {
  const m = selector.match(/[#.]?([a-zA-Z_][\w-]*)/);
  return (m ? m[1] : 'input').replace(/[-_]/g, '').toLowerCase();
}
