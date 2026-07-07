'use client';

// Confirmation screen — where a draft recording becomes a live API. Per the
// PRD (section 1.3) this is the core product loop: a Figma/Notion-style
// hybrid, plain-language flow on the left, editable decisions on the right.
// All server contracts (GET /api/apis/:id, POST /api/apis/:id/confirm,
// warnings/force-override) are unchanged from the prior plain version —
// this is a visual + interaction pass only.

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  X,
  Globe,
  MousePointerClick,
  Type,
  Send,
  ChevronRight,
  AlertTriangle,
  Lock,
  KeyRound,
  UserCheck,
  ShieldCheck,
  Sparkles,
  Zap,
  Waypoints,
  ArrowRight,
  PlayCircle,
  Plus,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Tooltip } from '@/components/ui/Tooltip';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { KeyReveal } from '@/components/ui/KeyReveal';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { credentialTypeLabel, replayModeLabel } from '@/lib/labels';

// ---------------------------------------------------------------------------
// Types (shapes unchanged from the previous version, just organized)
// ---------------------------------------------------------------------------
interface DraftVariable {
  name: string;
  example?: string;
  source?: string;
}
interface DraftOutputField {
  name: string;
  path: string;
}
interface RecordedStep {
  type: string;
  selector?: string;
  value?: string;
  url?: string;
  [key: string]: unknown;
}
interface RecordedNetworkRequest {
  url: string;
  method?: string;
  response?: unknown;
  _isData?: boolean;
  [key: string]: unknown;
}
interface Classification {
  replay_mode: string;
  needs_login: boolean;
  variables: DraftVariable[];
  output_fields: DraftOutputField[];
  reason: string;
  plain_summary?: string;
  claude_tokens_used: number;
  _engine: string;
}
interface DraftData {
  id: string;
  name: string;
  status: string;
  replay_mode: string;
  credential_type: string;
  recorded_flow: { steps?: RecordedStep[]; network_requests?: RecordedNetworkRequest[] };
  variable_schema: { inputs: DraftVariable[] } | null;
  output_schema: { fields: DraftOutputField[] } | null;
  classification: Classification | null;
  created_at: string;
}
interface ConfirmResult {
  endpoint: string;
  api_key: string;
  how_to_call: string;
  replay_mode: string;
  credential_type: string;
  warnings: string[];
}
interface FieldRow {
  selector: string;
  value: string;
  isVariable: boolean;
  varName: string;
}
interface OutputRow {
  name: string;
  path: string;
  example: unknown;
  included: boolean;
}

const REPLAY_MODES: { key: string; label: string; description: string }[] = [
  { key: 'network_replay', label: 'Fast (network only)', description: 'Re-fires the captured request directly. No browser — fastest and cheapest. Best for pure data lookups.' },
  { key: 'hybrid', label: 'Log in once, then fast', description: 'Logs in with a real browser once, caches the session, then replays data requests quickly.' },
  { key: 'browser_replay', label: 'Full browser', description: 'Drives a real browser through every step, every call. Slower, but works for forms and stateful actions.' },
];

const CREDENTIAL_TYPES: { key: string; label: string; description: string; icon: typeof Lock; recommended?: boolean }[] = [
  {
    key: 'stored',
    label: 'Use my login for everyone',
    description: 'You log in once during setup. Every caller gets the same account’s data. Simplest option.',
    icon: ShieldCheck,
    recommended: true,
  },
  {
    key: 'caller-provided',
    label: 'Each caller uses their own login',
    description: 'Callers pass their own credentials with each request — good for “my own data” APIs like account statements.',
    icon: UserCheck,
  },
  {
    key: 'prompt-on-call',
    label: 'Ask at call time',
    description: 'A browser window opens for a real person to log in when needed. Best for one-off or rarely-used logins.',
    icon: KeyRound,
  },
];

function guessName(selector = ''): string {
  const m = selector.match(/[#.]?([a-zA-Z_][\w-]*)/);
  return (m ? m[1] : 'input').replace(/[-_]/g, '').toLowerCase();
}

function parseResponse(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw ?? null;
}

function findDataRequest(requests: RecordedNetworkRequest[]): RecordedNetworkRequest | null {
  return requests.find((r) => r._isData) || requests.find((r) => r.response && typeof r.response === 'object') || null;
}

function describeStep(step: RecordedStep): { icon: typeof Globe; text: string } {
  switch (step.type) {
    case 'navigate':
      return { icon: Globe, text: `Opened ${step.url}` };
    case 'fill': {
      const isSecret = /password|passwd|pwd/i.test(step.selector || '');
      return { icon: Type, text: isSecret ? 'Typed a password into a field' : `Typed “${step.value}” into a field` };
    }
    case 'click':
      return { icon: MousePointerClick, text: 'Clicked an element on the page' };
    case 'submit':
      return { icon: Send, text: 'Submitted the form' };
    default:
      return { icon: ChevronRight, text: `Did a “${step.type}” action` };
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmPageInner />
    </Suspense>
  );
}

function ConfirmPageInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const apiId = params.id;
  const [showCapturedBanner, setShowCapturedBanner] = useState(searchParams.get('justRecorded') === '1');

  const [draft, setDraft] = useState<DraftData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [fieldRows, setFieldRows] = useState<FieldRow[]>([]);
  const [outputRows, setOutputRows] = useState<OutputRow[]>([]);
  const [dataSourceUrl, setDataSourceUrl] = useState<string | null>(null);
  const [replayMode, setReplayMode] = useState('browser_replay');
  const [credentialType, setCredentialType] = useState('stored');

  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ConfirmResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
      const res = await fetch(`/api/apis/${apiId}`);
      const json = await res.json();
      if (cancelled) return;
      if (!json.success) {
        setLoadError(json.error || 'Failed to load this API.');
        setLoading(false);
        return;
      }
      const d: DraftData = json.data;
      setDraft(d);

      // --- variable candidates: every non-password field the user typed ---
      const classifierVars = d.classification?.variables || d.variable_schema?.inputs || [];
      const usedSelectors = new Set(classifierVars.map((v) => v.source).filter(Boolean));
      const fillSteps = (d.recorded_flow.steps || []).filter(
        (s) => s.type === 'fill' && !/password|passwd|pwd/i.test(s.selector || '')
      );
      const rows: FieldRow[] = [
        ...classifierVars.map((v) => ({ selector: v.source || '', value: v.example || '', isVariable: true, varName: v.name })),
        ...fillSteps
          .filter((s) => !usedSelectors.has(s.selector))
          .map((s) => ({ selector: s.selector || '', value: s.value || '', isVariable: false, varName: guessName(s.selector) })),
      ];
      setFieldRows(rows);

      // --- output candidates: real keys from the captured data response ---
      const netReqs = d.recorded_flow.network_requests || [];
      const dataReq = findDataRequest(netReqs);
      const parsed = dataReq ? parseResponse(dataReq.response) : null;
      const sample = Array.isArray(parsed) ? parsed[0] : parsed;
      const detectedKeys = sample && typeof sample === 'object' ? Object.keys(sample as object) : [];
      const priorFields = d.classification?.output_fields || d.output_schema?.fields || [];
      const priorNames = new Set(priorFields.map((f) => f.name));
      const outRows: OutputRow[] = detectedKeys.map((key) => ({
        name: key,
        path: '.' + key,
        example: (sample as Record<string, unknown>)[key],
        included: priorNames.size === 0 ? true : priorNames.has(key),
      }));
      for (const f of priorFields) {
        if (!detectedKeys.includes(f.name)) outRows.push({ name: f.name, path: f.path, example: undefined, included: true });
      }
      setOutputRows(outRows);
      setDataSourceUrl(dataReq?.url || null);

      setReplayMode(d.replay_mode);
      setCredentialType(d.credential_type || 'stored');
      setLoading(false);
      } catch {
        if (!cancelled) {
          setLoadError('Could not reach the server. Check your connection and try again.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiId]);

  function toggleVariable(index: number, isVariable: boolean) {
    setFieldRows((rows) => rows.map((r, i) => (i === index ? { ...r, isVariable } : r)));
  }
  function renameVariable(index: number, varName: string) {
    setFieldRows((rows) => rows.map((r, i) => (i === index ? { ...r, varName } : r)));
  }

  function toggleOutput(index: number, included: boolean) {
    setOutputRows((rows) => rows.map((r, i) => (i === index ? { ...r, included } : r)));
  }
  function addCustomOutput() {
    setOutputRows((rows) => [...rows, { name: '', path: '', example: undefined, included: true }]);
  }
  function updateCustomOutput(index: number, patch: Partial<OutputRow>) {
    setOutputRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeOutput(index: number) {
    setOutputRows((rows) => rows.filter((_, i) => i !== index));
  }

  const jsonPreview = useMemo(() => {
    const obj = Object.fromEntries(outputRows.filter((r) => r.included && r.name).map((r) => [r.name, r.example ?? null]));
    return JSON.stringify([obj], null, 2);
  }, [outputRows]);

  async function submit(force: boolean) {
    setBusy(true);
    setConfirmError(null);
    const variables = fieldRows.filter((r) => r.isVariable).map((r) => ({ name: r.varName, example: r.value, source: r.selector }));
    const output_fields = outputRows.filter((r) => r.included && r.name).map((r) => ({ name: r.name, path: r.path }));
    const res = await fetch(`/api/apis/${apiId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replay_mode: replayMode, credential_type: credentialType, variables, output_fields, force }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.success) {
      setConfirmError(json.error);
      setWarnings(json.warnings || []);
      return;
    }
    setWarnings([]);
    setResult(json.data);
  }

  if (loading) {
    return (
      <AppShell active="dashboard" eyebrow="CONFIRM API" title="Loading…">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell active="dashboard" eyebrow="CONFIRM API" title="Something went wrong">
        <Card className="flex items-center gap-3 p-6 text-danger">
          <AlertTriangle className="h-5 w-5 flex-none" aria-hidden />
          {loadError}
        </Card>
      </AppShell>
    );
  }

  if (!draft) return null;

  if (result) {
    return (
      <AppShell active="dashboard" eyebrow="CONFIRM API" title={draft.name}>
        <SuccessScreen draft={draft} result={result} fieldRows={fieldRows} />
      </AppShell>
    );
  }

  if (draft.status !== 'draft') {
    return (
      <AppShell active="dashboard" eyebrow="CONFIRM API" title={draft.name}>
        <Card className="flex items-center gap-3 p-6">
          <CheckCircle2 className="h-5 w-5 flex-none text-success" aria-hidden />
          <p className="text-sm text-ink">This API is already active. Its key was shown once at confirmation time.</p>
        </Card>
      </AppShell>
    );
  }

  const needsLogin = draft.classification?.needs_login ?? false;
  const steps = draft.recorded_flow.steps || [];

  return (
    <AppShell
      active="dashboard"
      eyebrow="CONFIRM API"
      title={
        <>
          Confirm <span className="text-accent">{draft.name}</span>
        </>
      }
    >
      {showCapturedBanner && (
        <div
          role="status"
          className="mb-6 flex animate-pop-in items-center justify-between gap-3 rounded-xl border border-success-light bg-success-light px-4 py-3"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="h-5 w-5 flex-none" aria-hidden />
            We captured your flow — review it below and confirm to make it live.
          </div>
          <button
            type="button"
            onClick={() => setShowCapturedBanner(false)}
            aria-label="Dismiss"
            className="flex-none text-success/70 hover:text-success"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        {/* ------------------------------ LEFT: the flow, in plain language ------------------------------ */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <Card className="p-5">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">What this API does</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-ink">
              {draft.classification?.plain_summary || 'No plain-language summary available.'}
            </p>
          </Card>

          {steps.length === 0 ? (
            <Card className="flex items-center gap-3 p-5 text-sm text-muted">
              <Waypoints className="h-4 w-4 flex-none" aria-hidden />
              No browser steps were recorded — this API was created directly from captured data.
            </Card>
          ) : (
            <ol className="space-y-3">
              {steps.map((step, i) => {
                const { icon: Icon, text } = describeStep(step);
                return (
                  <li key={i}>
                    <Card className="flex items-start gap-3 p-4">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-page text-ink">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <p className="min-w-0 break-words pt-1.5 text-sm text-ink">{text}</p>
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}

          {dataSourceUrl && (
            <Card className="flex items-start gap-3 p-4">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-light text-accent">
                <Zap className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-sm text-ink">Found real data at this address:</p>
                <p className="mt-1 truncate font-mono text-xs text-muted">{dataSourceUrl}</p>
              </div>
            </Card>
          )}
        </div>

        {/* ------------------------------ RIGHT: decisions ------------------------------ */}
        <div className="space-y-6">
          {/* Variables */}
          <section>
            <div className="flex items-center gap-1.5">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Variables</p>
              <Tooltip text="A variable is a value the caller can change with each request — like a search term. Anything left off stays fixed to what you recorded." />
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">What can callers change?</h2>

            {fieldRows.length === 0 ? (
              <Card className="mt-3 p-4 text-sm text-muted">Nothing was typed during recording — this API takes no inputs.</Card>
            ) : (
              <div className="mt-3 space-y-2">
                {fieldRows.map((row, i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-ink">
                        Should “<span className="font-medium">{row.value}</span>” be changeable by whoever calls this API?
                      </p>
                      <Switch checked={row.isVariable} onChange={(v) => toggleVariable(i, v)} />
                    </div>
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-200 ease-out',
                        row.isVariable ? 'grid-rows-[1fr] mt-3' : 'grid-rows-[0fr]'
                      )}
                    >
                      <div className="overflow-hidden">
                        <Input
                          label="Friendly name callers will use"
                          value={row.varName}
                          onChange={(e) => renameVariable(i, e.target.value)}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Outputs */}
          <section>
            <div className="flex items-center gap-1.5">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Outputs</p>
              <Tooltip text="Tick the fields you want returned to callers. Everything else found in the response stays hidden." />
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">What should it return?</h2>

            {outputRows.length === 0 ? (
              <Card className="mt-3 p-4 text-sm text-muted">No data fields were detected in the recording.</Card>
            ) : (
              <Card className="mt-3 divide-y divide-border p-0">
                {outputRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <input
                      type="checkbox"
                      checked={row.included}
                      onChange={(e) => toggleOutput(i, e.target.checked)}
                      className="h-4 w-4 flex-none rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    />
                    {row.path.startsWith('.') && outputRows[i].example !== undefined ? (
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{row.name}</p>
                        <p className="truncate font-mono text-xs text-muted">{JSON.stringify(row.example)}</p>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          placeholder="name"
                          value={row.name}
                          onChange={(e) => updateCustomOutput(i, { name: e.target.value })}
                          className="w-32"
                        />
                        <Input
                          placeholder="path (e.g. .name)"
                          value={row.path}
                          onChange={(e) => updateCustomOutput(i, { path: e.target.value })}
                          className="w-40"
                        />
                        <button type="button" onClick={() => removeOutput(i)} className="text-xs text-muted hover:text-danger">
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </Card>
            )}
            <button
              type="button"
              onClick={addCustomOutput}
              className="mt-2 flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add a custom field
            </button>

            <div className="mt-4">
              <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-muted">Live preview</p>
              <CodeBlock code={jsonPreview} />
            </div>
          </section>

          {/* Login / credentials */}
          {needsLogin && (
            <section className="animate-pop-in">
              <div className="flex items-center gap-1.5">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">Login</p>
                <Tooltip text="Your credentials are always encrypted (AES-256) and never shown to buyers — they only ever get endpoint access." />
              </div>
              <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-bold text-ink">
                <Lock className="h-4 w-4 text-muted" aria-hidden />
                This flow needs a login — whose?
              </h2>
              <div className="mt-3 space-y-2">
                {CREDENTIAL_TYPES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCredentialType(c.key)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                      credentialType === c.key ? 'border-accent bg-accent-light/40' : 'border-border bg-white hover:border-ink/20'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 flex-none items-center justify-center rounded-full',
                        credentialType === c.key ? 'bg-accent text-white' : 'bg-page text-muted'
                      )}
                    >
                      <c.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{c.label}</p>
                        {c.recommended && <Badge variant="accent">Recommended</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted">{c.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Replay mode */}
          <section>
            <div className="flex items-center gap-1.5">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Replay mode</p>
              <Tooltip text="How Shamsu re-runs this flow on every call. We pick a sensible default — change it only if you know why." />
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">How should calls run?</h2>
            <div className="mt-3 space-y-2">
              {REPLAY_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setReplayMode(m.key)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors',
                    replayMode === m.key ? 'border-accent bg-accent-light/40' : 'border-border bg-white hover:border-ink/20'
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">{m.label}</p>
                    <p className="mt-1 text-xs text-muted">{m.description}</p>
                  </div>
                  {draft.classification?.replay_mode === m.key && <Badge variant="neutral">Detected</Badge>}
                </button>
              ))}
            </div>
          </section>

          {/* Warnings + activate */}
          {warnings.length > 0 && (
            <Card className="border-warning-light bg-warning-light p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-none text-warning" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-warning">{confirmError || 'This might not work as expected'}</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-warning">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <Button variant="secondary" size="sm" className="mt-3" disabled={busy} onClick={() => submit(true)}>
                Confirm anyway
              </Button>
            </Card>
          )}
          {confirmError && warnings.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 flex-none" aria-hidden />
              {confirmError}
            </p>
          )}

          <Button size="lg" loading={busy} onClick={() => submit(false)} className="w-full sm:w-auto">
            <Sparkles className="h-4 w-4" aria-hidden />
            {busy ? 'Activating…' : 'Activate API'}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Success screen
// ---------------------------------------------------------------------------
function SuccessScreen({ draft, result, fieldRows }: { draft: DraftData; result: ConfirmResult; fieldRows: FieldRow[] }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function testNow() {
    setTesting(true);
    setTestResult(null);
    const body = Object.fromEntries(fieldRows.filter((r) => r.isVariable).map((r) => [r.varName, r.value]));
    try {
      const res = await fetch(result.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${result.api_key}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setTestResult(JSON.stringify(json, null, 2));
    } catch (e) {
      setTestResult(JSON.stringify({ success: false, error: (e as Error).message }, null, 2));
    }
    setTesting(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="animate-pop-in p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-ink">
          <span className="text-accent">{draft.name}</span> is live
        </h1>
        <p className="mt-2 text-sm text-muted">Your endpoint is ready to call — save the key below, it&apos;s shown only once.</p>

        {result.warnings.length > 0 && (
          <div className="mt-6 rounded-xl border border-warning-light bg-warning-light p-4 text-left">
            <p className="text-sm font-semibold text-warning">Confirmed with overridden warnings:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-warning">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 space-y-4 text-left">
          <div>
            <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-muted">Endpoint</p>
            <p className="truncate rounded-lg border border-border bg-page px-3 py-2 font-mono text-xs text-ink">{result.endpoint}</p>
          </div>
          <div>
            <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-muted">API key (shown once)</p>
            <KeyReveal value={result.api_key} className="w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral">{replayModeLabel(result.replay_mode)}</Badge>
            <Badge variant="neutral">{credentialTypeLabel(result.credential_type)}</Badge>
          </div>
          <div>
            <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-muted">Try it from the command line</p>
            <CodeBlock code={result.how_to_call} />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button size="lg" onClick={testNow} loading={testing} className="w-full sm:w-auto">
            {!testing && <PlayCircle className="h-4 w-4" aria-hidden />}
            {testing ? 'Calling your API…' : 'Test it now'}
          </Button>
          <a href="/dashboard" className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
            Back to dashboard
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>

        {testResult && (
          <div className="mt-6 text-left">
            <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-muted">Response</p>
            <CodeBlock code={testResult} />
          </div>
        )}
      </Card>
    </div>
  );
}
