// labels.ts — plain-language labels for internal enum values (replay_mode,
// credential_type, pricing_model) that would otherwise leak raw jargon
// ("network_replay", "caller-provided") straight into the UI. Shared so
// every screen that shows one of these values reads the same way.

const REPLAY_MODE_LABELS: Record<string, string> = {
  network_replay: 'Fast (network only)',
  hybrid: 'Log in once, then fast',
  browser_replay: 'Full browser',
};

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  stored: 'Your login',
  'caller-provided': "Caller's own login",
  'prompt-on-call': 'Ask at call time',
};

const PRICING_MODEL_LABELS: Record<string, string> = {
  per_call: 'Per call',
  subscription: 'Subscription',
};

export function replayModeLabel(mode: string): string {
  return REPLAY_MODE_LABELS[mode] || mode;
}
export function credentialTypeLabel(type: string): string {
  return CREDENTIAL_TYPE_LABELS[type] || type;
}
export function pricingModelLabel(model: string): string {
  return PRICING_MODEL_LABELS[model] || model;
}
