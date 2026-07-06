// narrator.ts — turns a recorded flow into a plain-language restatement for
// the confirmation screen (PRD section 1.3: "You logged in, searched hotels
// in Bangkok, filtered by price, submitted."). Non-tech users must understand
// what the API does without reading JSON or selectors.
//
// Same safety pattern as classifier.ts: real Claude when a key is set, a
// deterministic rule-based sentence-builder otherwise. Never throws.

import type { RecordedFlow, RecordedStep } from './classifier';

const MODEL = 'claude-sonnet-4-6';

export interface FlowDescription {
  summary: string;
  claude_tokens_used: number;
  _engine: 'claude' | 'rules';
}

export async function describeFlow(flow: RecordedFlow): Promise<FlowDescription> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      return await describeWithClaude(flow, key);
    } catch (e) {
      console.warn('[narrator] Claude call failed, using rule fallback:', (e as Error).message);
    }
  }
  return describeWithRules(flow);
}

async function describeWithClaude(flow: RecordedFlow, key: string): Promise<FlowDescription> {
  const prompt = `You are explaining a recorded browser flow to a non-technical person who is about to
turn it into an API. Restate what happened in one or two plain, friendly sentences —
no jargon, no selectors, no code. Example style: "You logged in, searched hotels in
Bangkok, filtered by price, and submitted."

RECORDED FLOW:
${JSON.stringify(flow, null, 2)}

Return ONLY the plain-language sentence(s), no quotes, no JSON, no prefix.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic API returned ${res.status}`);
  }
  const text = (data.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')
    .trim();
  if (!text) throw new Error('Claude returned an empty description');

  const usage = data.usage || {};
  return {
    summary: text,
    claude_tokens_used: (usage.input_tokens || 0) + (usage.output_tokens || 0),
    _engine: 'claude',
  };
}

function describeWithRules(flow: RecordedFlow): FlowDescription {
  const steps = flow.steps || [];
  const net = flow.network_requests || [];
  const parts: string[] = [];

  for (const step of steps) {
    const part = describeStep(step);
    if (part) parts.push(part);
  }

  const dataReq = net.find((r) => r.response && typeof r.response === 'object') || net[net.length - 1];
  if (dataReq) {
    parts.push(`reads back data from ${dataReq.url}`);
  }

  const summary = parts.length
    ? `This API ${joinEnglish(parts)}.`
    : 'This API replays a recorded browser flow — no steps were captured to describe.';

  return { summary, claude_tokens_used: 0, _engine: 'rules' };
}

function describeStep(step: RecordedStep): string | null {
  switch (step.type) {
    case 'navigate':
      return `opens ${step.url}`;
    case 'fill': {
      const field = guessFieldLabel(step.selector);
      if (/password|passwd|pwd/i.test(step.selector || '')) {
        return `enters your password into the ${field} field`;
      }
      return `enters "${step.value}" into the ${field} field`;
    }
    case 'click':
      return `clicks ${guessFieldLabel(step.selector)}`;
    case 'submit':
      return 'submits the form';
    default:
      return null;
  }
}

function guessFieldLabel(selector = ''): string {
  const m = selector.match(/[#.]?([a-zA-Z_][\w-]*)/);
  const raw = m ? m[1] : 'input';
  return raw.replace(/[-_]/g, ' ').toLowerCase();
}

function joinEnglish(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]}, then ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, then ${parts[parts.length - 1]}`;
}
