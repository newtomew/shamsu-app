'use client';

// Single purchase detail (PRD 2.5): endpoint + MY usage only (never another
// buyer's calls), a Test panel, a reissue-key action, and recovery/dispute
// if something's wrong. Source stays hidden — see /api/purchases/:apiId.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, KeyRound, LifeBuoy, PlayCircle, RotateCcw } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Table, TableColumn } from '@/components/ui/Table';
import { CodeBlock } from '@/components/ui/CodeBlock';
import { KeyReveal } from '@/components/ui/KeyReveal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

interface UsageRow {
  id: string;
  timestamp: string;
  status: string;
  latency_ms: number | null;
  cost_bdt: string | null;
}
interface SchemaVariable {
  name: string;
  example?: string;
}
interface PurchaseDetail {
  api_id: string;
  name: string;
  api_status: string;
  endpoint: string;
  purchase_status: string;
  variables: SchemaVariable[];
  usage: UsageRow[];
}
interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export default function PurchaseDetailPage() {
  const params = useParams<{ apiId: string }>();
  const apiId = params.apiId;

  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mintedKey, setMintedKey] = useState<string | null>(null);
  const [reissueBusy, setReissueBusy] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [disputeMessage, setDisputeMessage] = useState<string | null>(null);

  const [simpleValues, setSimpleValues] = useState<Record<string, string>>({});
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/purchases/${apiId}`);
      const json = await res.json();
      if (!json.success) {
        setLoadError(json.error || 'Failed to load this purchase.');
        return;
      }
      setDetail(json.data);
      setSimpleValues(Object.fromEntries((json.data.variables || []).map((v: SchemaVariable) => [v.name, v.example || ''])));
    } catch {
      setLoadError('Could not reach the server. Check your connection and try again.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  async function reissueKey() {
    setReissueBusy(true);
    const res = await fetch(`/api/purchases/${apiId}/reissue-key`, { method: 'POST' });
    const json = await res.json();
    setReissueBusy(false);
    if (json.success) setMintedKey(json.data.api_key);
  }

  async function requestRecovery() {
    setRecoveryBusy(true);
    const res = await fetch(`/api/purchases/${apiId}/request-recovery`, { method: 'POST' });
    const json = await res.json();
    setRecoveryBusy(false);
    setRecoveryMessage(json.success ? 'Recovery successful — the API is active again.' : json.error);
    if (json.success) load();
  }

  async function fileDispute() {
    setDisputeBusy(true);
    const res = await fetch(`/api/purchases/${apiId}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: disputeReason }),
    });
    const json = await res.json();
    setDisputeBusy(false);
    setDisputeMessage(json.success ? 'Dispute filed — an admin will review it.' : json.error);
    if (json.success) {
      setDisputeReason('');
      load();
    }
  }

  async function runTest() {
    if (!mintedKey || !detail) return;
    setTestBusy(true);
    setTestResult(null);
    const res = await fetch(detail.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mintedKey}` },
      body: JSON.stringify(simpleValues),
    });
    const json = await res.json();
    setTestBusy(false);
    setTestResult(json);
    load();
  }

  if (loadError) {
    return (
      <AppShell active="purchases" eyebrow="PURCHASE" title="Something went wrong">
        <Card className="flex items-center gap-3 p-6 text-danger">
          <AlertTriangle className="h-5 w-5 flex-none" aria-hidden />
          {loadError}
        </Card>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell active="purchases" eyebrow="PURCHASE" title="Loading…">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppShell>
    );
  }

  const usageColumns: TableColumn<UsageRow>[] = [
    { key: 'timestamp', label: 'Time', render: (u) => new Date(u.timestamp).toLocaleString() },
    { key: 'status', label: 'Status', render: (u) => <Badge variant={statusToVariant(u.status)}>{u.status}</Badge> },
    { key: 'latency_ms', label: 'Latency', align: 'right', render: (u) => (u.latency_ms != null ? `${u.latency_ms} ms` : '—') },
    { key: 'cost_bdt', label: 'Cost', align: 'right', render: (u) => (u.cost_bdt != null ? `${u.cost_bdt} BDT` : '—') },
  ];

  return (
    <AppShell active="purchases" eyebrow="PURCHASE" title={detail.name}>
      <a href="/purchases" className="mb-4 flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        My purchases
      </a>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={statusToVariant(detail.api_status)}>{detail.api_status}</Badge>
        <Badge variant={statusToVariant(detail.purchase_status)}>{detail.purchase_status}</Badge>
      </div>

      {detail.api_status === 'deleted' && (
        <Card className="mb-6 flex items-start gap-3 border-danger-light bg-danger-light p-4">
          <AlertTriangle className="h-4 w-4 flex-none text-danger" aria-hidden />
          <div>
            <p className="text-sm text-danger">This API was deleted by its creator and is currently unavailable.</p>
            <Button size="sm" variant="secondary" className="mt-2" loading={recoveryBusy} onClick={requestRecovery}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Request recovery
            </Button>
            {recoveryMessage && <p className="mt-2 text-xs text-ink">{recoveryMessage}</p>}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Endpoint</p>
            <div className="mt-2">
              <CodeBlock code={detail.endpoint} />
            </div>
          </section>

          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Access</p>
            <Card className="mt-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-sm text-ink">
                  <KeyRound className="h-3.5 w-3.5 text-muted" aria-hidden />
                  Lost your key?
                </p>
                <Button size="sm" variant="secondary" loading={reissueBusy} onClick={reissueKey}>
                  Get a new one
                </Button>
              </div>
              {mintedKey && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-success">New key — shown once, save it now</p>
                  <KeyReveal value={mintedKey} className="w-full" />
                </div>
              )}
            </Card>
          </section>

          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Support</p>
            <Card className="mt-2 p-4">
              {detail.purchase_status === 'disputed' ? (
                <p className="flex items-center gap-1.5 text-sm text-ink">
                  <LifeBuoy className="h-3.5 w-3.5 text-muted" aria-hidden />
                  Dispute already filed — awaiting admin review.
                </p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-ink">Not working as expected?</p>
                  <Textarea
                    placeholder="What's wrong?"
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    rows={2}
                  />
                  <Button size="sm" variant="secondary" className="mt-2" loading={disputeBusy} onClick={fileDispute} disabled={!disputeReason.trim()}>
                    File a dispute
                  </Button>
                  {disputeMessage && <p className="mt-2 text-xs text-muted">{disputeMessage}</p>}
                </>
              )}
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Test</p>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">Try it</h2>
            <Card className="mt-3 p-4">
              {!mintedKey ? (
                <p className="text-sm text-muted">Get a new key above to test this API directly from here.</p>
              ) : (
                <>
                  {detail.variables.length === 0 ? (
                    <p className="text-sm text-muted">This API takes no variables.</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.variables.map((v) => (
                        <Input
                          key={v.name}
                          label={v.name}
                          value={simpleValues[v.name] ?? ''}
                          onChange={(e) => setSimpleValues((s) => ({ ...s, [v.name]: e.target.value }))}
                        />
                      ))}
                    </div>
                  )}
                  <Button className="mt-4 w-full" loading={testBusy} onClick={runTest}>
                    {!testBusy && <PlayCircle className="h-4 w-4" aria-hidden />}
                    {testBusy ? 'Calling…' : 'Run'}
                  </Button>
                </>
              )}
              {testResult && (
                <div className="mt-3">
                  <p className={`mb-1.5 text-xs font-medium ${testResult.success ? 'text-success' : 'text-danger'}`}>
                    {testResult.success ? 'Success' : `Error: ${testResult.error}`}
                  </p>
                  <CodeBlock code={JSON.stringify(testResult.success ? testResult.data : testResult, null, 2)} />
                </div>
              )}
            </Card>
          </section>

          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">History</p>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">My usage</h2>
            <div className="mt-3">
              {detail.usage.length === 0 ? (
                <EmptyState title="No calls yet" description="Run a test above to see your usage appear here." />
              ) : (
                <Table columns={usageColumns} rows={detail.usage} rowKey={(u) => u.id} />
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
