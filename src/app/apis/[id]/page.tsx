'use client';

// API detail page (PRD section 2.4): endpoint + copy, API keys (create/
// revoke, multiple per API), JSON format example, a Test panel (simple +
// advanced modes), marketplace listing management, and call history.
// Visual + interaction pass — every fetch/mutation call is unchanged from
// the previous plain version; a pause/resume PATCH endpoint was added
// (store.setApiStatus) since the PRD schema already defines 'paused' and
// this screen is the first thing that needed to write it.

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Pause,
  KeyRound,
  Plus,
  Trash2,
  Store,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs } from '@/components/ui/Tabs';
import { Table, TableColumn } from '@/components/ui/Table';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { KeyReveal } from '@/components/ui/KeyReveal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { credentialTypeLabel, replayModeLabel } from '@/lib/labels';

interface ApiKeyRow {
  id: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
}
interface CallHistoryRow {
  id: string;
  timestamp: string;
  buyer: string;
  status: string;
  latency_ms: number | null;
  error_message: string | null;
  cost_bdt: string | null;
}
interface Variable {
  name: string;
  example?: string;
}
interface ApiDetail {
  id: string;
  name: string;
  status: string;
  replay_mode: string;
  credential_type: string;
  endpoint_url: string;
  variable_schema: { inputs: Variable[] } | null;
  keys: ApiKeyRow[];
  call_history: CallHistoryRow[];
  marketplace: { is_listed: boolean; price?: string; category?: string | null; is_active?: boolean; pricing_model?: string };
  json_format: { example_request: Record<string, string>; example_response: Record<string, string>[] };
}
interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
  meta?: { replay_mode?: string; execution_time_ms?: number; chrome_duration_ms?: number };
}

const CALL_STATUS_FILTERS = ['all', 'success', 'failed', 'timeout', 'rate_limited'];

function notActiveHint(status: string, action: string): string {
  if (status === 'paused') return `Resume this API before ${action}.`;
  if (status === 'draft') return `Confirm this API before ${action}.`;
  return `This API can't be ${action} right now.`;
}

export default function ApiDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const apiId = params.id;

  const [api, setApi] = useState<ApiDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const [newKeyName, setNewKeyName] = useState('');
  const [mintedKey, setMintedKey] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [testMode, setTestMode] = useState<'simple' | 'advanced'>('simple');
  const [simpleValues, setSimpleValues] = useState<Record<string, string>>({});
  const [advancedBody, setAdvancedBody] = useState('{}');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  const [listingPrice, setListingPrice] = useState('');
  const [listingCategory, setListingCategory] = useState('');
  const [listingDescription, setListingDescription] = useState('');
  const [listingPricingModel, setListingPricingModel] = useState('per_call');
  const [listingBusy, setListingBusy] = useState(false);
  const [listingMessage, setListingMessage] = useState<string | null>(null);

  const [historyFilter, setHistoryFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/apis/${apiId}`);
      const json = await res.json();
      if (!json.success) {
        setLoadError(json.error || 'Failed to load this API.');
        return;
      }
      setApi(json.data);
      const initial: Record<string, string> = {};
      for (const v of json.data.variable_schema?.inputs || []) initial[v.name] = v.example || '';
      setSimpleValues(initial);
      setAdvancedBody(JSON.stringify(initial, null, 2));
      if (json.data.marketplace.is_listed) {
        setListingPrice(String(json.data.marketplace.price));
        setListingCategory(json.data.marketplace.category || '');
        setListingPricingModel(json.data.marketplace.pricing_model || 'per_call');
      }
    } catch {
      setLoadError('Could not reach the server. Check your connection and try again.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  async function toggleStatus() {
    if (!api) return;
    const next = api.status === 'active' ? 'paused' : 'active';
    setStatusBusy(true);
    const res = await fetch(`/api/apis/${apiId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    const json = await res.json();
    setStatusBusy(false);
    if (json.success) setApi((a) => (a ? { ...a, status: next } : a));
  }

  async function createKey() {
    setKeyBusy(true);
    const res = await fetch(`/api/apis/${apiId}/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName || 'unnamed' }),
    });
    const json = await res.json();
    setKeyBusy(false);
    if (json.success) {
      setMintedKey(json.data.api_key);
      setNewKeyName('');
      load();
    }
  }

  async function revokeKey(keyId: string) {
    setRevokingId(null);
    await fetch(`/api/apis/${apiId}/keys/${keyId}/revoke`, { method: 'POST' });
    load();
  }

  async function runTest() {
    setTestBusy(true);
    setTestResult(null);
    let body: unknown;
    try {
      body = testMode === 'simple' ? simpleValues : JSON.parse(advancedBody || '{}');
    } catch {
      setTestBusy(false);
      setTestResult({ success: false, error: 'Advanced body is not valid JSON.' });
      return;
    }
    const res = await fetch(`/api/apis/${apiId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setTestBusy(false);
    setTestResult(json);
    load();
  }

  async function saveListing() {
    setListingBusy(true);
    setListingMessage(null);
    const res = await fetch(`/api/apis/${apiId}/marketplace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: Number(listingPrice),
        category: listingCategory,
        description: listingDescription || api?.name,
        pricing_model: listingPricingModel,
      }),
    });
    const json = await res.json();
    setListingBusy(false);
    setListingMessage(json.success ? 'Listing saved.' : json.error);
    if (json.success) load();
  }

  async function unlist() {
    await fetch(`/api/apis/${apiId}/marketplace`, { method: 'DELETE' });
    load();
  }

  async function deleteApi() {
    setDeleteBusy(true);
    const res = await fetch(`/api/apis/${apiId}`, { method: 'DELETE' });
    const json = await res.json();
    setDeleteBusy(false);
    setConfirmDelete(false);
    if (json.success) {
      router.push('/dashboard');
    }
  }

  if (loadError) {
    return (
      <AppShell active="dashboard" eyebrow="API" title="Something went wrong">
        <Card className="flex items-center gap-3 p-6 text-danger">
          <AlertTriangle className="h-5 w-5 flex-none" aria-hidden />
          {loadError}
        </Card>
      </AppShell>
    );
  }

  if (!api) {
    return (
      <AppShell active="dashboard" eyebrow="API" title="Loading…">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  const curlKey = mintedKey || 'YOUR_KEY';
  const curlBody = testMode === 'simple' ? JSON.stringify(simpleValues) : advancedBody;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const curlPreview = `curl -X POST ${origin}${api.endpoint_url} \\\n  -H "Authorization: Bearer ${curlKey}" -H "Content-Type: application/json" \\\n  -d '${curlBody}'`;

  const filteredHistory =
    historyFilter === 'all' ? api.call_history : api.call_history.filter((c) => c.status === historyFilter);

  const historyColumns: TableColumn<CallHistoryRow>[] = [
    { key: 'timestamp', label: 'Time', render: (c) => new Date(c.timestamp).toLocaleString() },
    { key: 'buyer', label: 'Caller', render: (c) => c.buyer },
    { key: 'status', label: 'Status', render: (c) => <Badge variant={statusToVariant(c.status)}>{c.status}</Badge> },
    { key: 'latency_ms', label: 'Latency', align: 'right', render: (c) => (c.latency_ms != null ? `${c.latency_ms} ms` : '—') },
    { key: 'cost_bdt', label: 'Cost', align: 'right', render: (c) => (c.cost_bdt != null ? `${c.cost_bdt} BDT` : '—') },
    { key: 'error_message', label: 'Error', render: (c) => c.error_message || '—' },
  ];

  return (
    <AppShell
      active="dashboard"
      eyebrow="API"
      title={api.name}
      actions={
        (api.status === 'active' || api.status === 'paused') && (
          <Button variant={api.status === 'active' ? 'secondary' : 'primary'} loading={statusBusy} onClick={toggleStatus}>
            {!statusBusy && (api.status === 'active' ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />)}
            {api.status === 'active' ? 'Pause' : 'Resume'}
          </Button>
        )
      }
    >
      <a href="/dashboard" className="mb-4 flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Dashboard
      </a>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={statusToVariant(api.status)}>{api.status}</Badge>
        <Badge variant="neutral">{replayModeLabel(api.replay_mode)}</Badge>
        <Badge variant="neutral">{credentialTypeLabel(api.credential_type)}</Badge>
        {api.marketplace.is_listed && <Badge variant="accent">Listed in marketplace</Badge>}
      </div>

      {api.status === 'draft' && (
        <Card className="mb-6 flex items-center gap-3 border-warning-light bg-warning-light p-4">
          <AlertTriangle className="h-4 w-4 flex-none text-warning" aria-hidden />
          <p className="text-sm text-warning">
            This API is still a draft.{' '}
            <a href={`/apis/${api.id}/confirm`} className="font-semibold underline">
              Confirm it
            </a>{' '}
            to get a live endpoint and key.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          {/* Endpoint */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Endpoint</p>
            <div className="mt-2">
              <CodeBlock code={`${origin}${api.endpoint_url}`} />
            </div>
          </section>

          {/* API keys */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">API keys</p>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">Manage access</h2>

            {api.keys.length === 0 ? (
              <Card className="mt-3 p-4 text-sm text-muted">No keys yet — create one below.</Card>
            ) : (
              <Card className="mt-3 divide-y divide-border p-0">
                {api.keys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 flex-none text-muted" aria-hidden />
                        <p className="truncate text-sm font-medium text-ink">{k.name}</p>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted">Created {new Date(k.createdAt).toLocaleDateString()}</p>
                    </div>
                    {k.revokedAt ? (
                      <Badge variant="danger">Revoked</Badge>
                    ) : revokingId === k.id ? (
                      <div className="flex flex-none items-center gap-2">
                        <span className="text-xs text-muted">Revoke?</span>
                        <Button size="sm" variant="danger" onClick={() => revokeKey(k.id)}>
                          Yes
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRevokingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setRevokingId(k.id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </Card>
            )}

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Input label="New key name" placeholder="e.g. production" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
              <Button loading={keyBusy} onClick={createKey}>
                <Plus className="h-4 w-4" aria-hidden />
                Create key
              </Button>
            </div>

            {mintedKey && (
              <div className="mt-3 rounded-xl border border-success-light bg-success-light p-4">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  New key created — shown once, save it now
                </p>
                <KeyReveal value={mintedKey} className="w-full" />
              </div>
            )}
          </section>

          {/* JSON format */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">JSON format</p>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">Request &amp; response shape</h2>
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Example request</p>
                <CodeBlock code={JSON.stringify(api.json_format.example_request, null, 2)} />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">Example response</p>
                <CodeBlock code={JSON.stringify(api.json_format.example_response, null, 2)} />
              </div>
            </div>
          </section>

          {/* Marketplace */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Marketplace</p>
            <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-bold text-ink">
              <Store className="h-4 w-4 text-muted" aria-hidden />
              Sell this API
            </h2>

            {api.marketplace.is_listed && (
              <Card className="mt-3 flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm text-ink">
                    Listed at <span className="font-semibold">{api.marketplace.price} BDT</span> · {api.marketplace.category}
                  </p>
                  <Badge variant={api.marketplace.is_active ? 'success' : 'neutral'}>
                    {api.marketplace.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <Button size="sm" variant="secondary" onClick={unlist}>
                  Unlist
                </Button>
              </Card>
            )}

            <Card className="mt-3 space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Price (BDT)" placeholder="150" value={listingPrice} onChange={(e) => setListingPrice(e.target.value)} />
                <Select label="Pricing model" value={listingPricingModel} onChange={(e) => setListingPricingModel(e.target.value)}>
                  <option value="per_call">Per call</option>
                  <option value="subscription">Subscription</option>
                </Select>
              </div>
              <Input label="Category" placeholder="e.g. Travel" value={listingCategory} onChange={(e) => setListingCategory(e.target.value)} />
              <Textarea
                label="Description"
                placeholder="What does this API do, and why would someone buy it?"
                value={listingDescription}
                onChange={(e) => setListingDescription(e.target.value)}
                rows={3}
              />
              <Button onClick={saveListing} loading={listingBusy} disabled={api.status !== 'active'}>
                {api.marketplace.is_listed ? 'Update listing' : 'List on marketplace'}
              </Button>
              {api.status !== 'active' && <p className="text-xs text-muted">{notActiveHint(api.status, 'listing it')}</p>}
              {listingMessage && <p className="text-sm text-ink">{listingMessage}</p>}
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          {/* Test panel */}
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Test</p>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">Try it</h2>

            <div className="mt-3">
              <Tabs
                items={[
                  { key: 'simple', label: 'Simple' },
                  { key: 'advanced', label: 'Advanced' },
                ]}
                active={testMode}
                onChange={(k) => setTestMode(k as 'simple' | 'advanced')}
              />
            </div>

            <Card className="mt-3 p-4">
              {testMode === 'simple' ? (
                (api.variable_schema?.inputs || []).length === 0 ? (
                  <p className="text-sm text-muted">This API takes no variables.</p>
                ) : (
                  <div className="space-y-3">
                    {(api.variable_schema?.inputs || []).map((v) => (
                      <Input
                        key={v.name}
                        label={v.name}
                        value={simpleValues[v.name] ?? ''}
                        onChange={(e) => setSimpleValues((s) => ({ ...s, [v.name]: e.target.value }))}
                      />
                    ))}
                  </div>
                )
              ) : (
                <Textarea
                  label="Request body (JSON)"
                  value={advancedBody}
                  onChange={(e) => setAdvancedBody(e.target.value)}
                  rows={6}
                  className="font-mono"
                />
              )}

              <p className="mb-1.5 mt-4 text-xs font-medium text-muted">Equivalent curl</p>
              <CodeBlock code={curlPreview} />

              <Button className="mt-4 w-full" loading={testBusy} disabled={api.status !== 'active'} onClick={runTest}>
                {!testBusy && <PlayCircle className="h-4 w-4" aria-hidden />}
                {testBusy ? 'Running…' : 'Run'}
              </Button>
              {api.status !== 'active' && <p className="mt-2 text-xs text-muted">{notActiveHint(api.status, 'testing it')}</p>}
            </Card>

            {testResult && (
              <div className="mt-3 space-y-3">
                {testResult.success ? (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Success
                    </p>
                    <CodeBlock code={JSON.stringify(testResult.data, null, 2)} />
                  </div>
                ) : (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-danger">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                      {testResult.error} {testResult.code && `(${testResult.code})`}
                    </p>
                    {testResult.details && <CodeBlock code={JSON.stringify(testResult.details, null, 2)} />}
                  </div>
                )}
                {testResult.meta && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted">Latency</p>
                    <CodeBlock
                      code={`replay_mode: ${testResult.meta.replay_mode}\nexecution_time_ms: ${testResult.meta.execution_time_ms}\nchrome_duration_ms: ${testResult.meta.chrome_duration_ms}`}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Call history */}
          <section>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-muted">History</p>
                <h2 className="mt-1 font-display text-lg font-bold text-ink">Call history</h2>
              </div>
              <Select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)} className="h-8 w-auto text-xs">
                {CALL_STATUS_FILTERS.map((f) => (
                  <option key={f} value={f}>
                    {f === 'all' ? 'All statuses' : f}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-3">
              {filteredHistory.length === 0 ? (
                <EmptyState title="No calls yet" description="Run a test above or share your API key to see calls appear here." />
              ) : (
                <Table columns={historyColumns} rows={filteredHistory} rowKey={(c) => c.id} />
              )}
            </div>
          </section>

          {/* Danger zone */}
          {api.status !== 'deleted' && (
            <section>
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Danger zone</p>
              <Card className="mt-3 flex items-center justify-between gap-3 border-danger-light p-4">
                <p className="text-sm text-ink">Deleting keeps an encrypted backup and notifies existing buyers.</p>
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </Button>
              </Card>
            </section>
          )}
        </div>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this API?">
        <p className="text-sm text-muted">
          An encrypted backup is kept and any buyers will be notified. This immediately takes the endpoint offline.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteBusy} onClick={deleteApi}>
            Delete
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
