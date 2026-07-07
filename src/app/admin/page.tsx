'use client';

// Admin panel (PRD section 4) — a calm operational control room, not a
// flashy dashboard. Gated server-side by every /api/admin/* route
// (getAdminUser -> 403 for non-admins); this page mirrors that so a
// non-admin sees a clear message instead of a page full of failed fetches.
// All data contracts and mutation calls are unchanged from the prior plain
// version — this is a visual + interaction pass only.

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Ban,
  CreditCard,
  Flag,
  Gauge,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Tabs } from '@/components/ui/Tabs';
import { Table, TableColumn } from '@/components/ui/Table';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { CodeBlock } from '@/components/ui/CodeBlock';

interface CreditPurchase {
  id: string;
  user_email: string;
  amount_bdt: number;
  credits_added: number;
  payment_reference: string | null;
  status: string;
  created_at: string;
}
interface Dispute {
  id: string;
  buyer_email: string;
  api_id: string;
  api_name: string;
  reason: string;
  status: string;
  resolution: string | null;
  admin_notes: string | null;
  test_result: unknown;
  created_at: string;
}
interface Creator {
  id: string;
  email: string;
  is_admin: boolean;
  moderation_status: string;
  api_count: number;
  created_at: string;
}
interface AdminApi {
  id: string;
  name: string;
  status: string;
  replay_mode: string;
  creator_email: string;
  creator_moderation_status: string;
  is_listed_in_marketplace: boolean;
  has_backup: boolean;
  created_at: string;
}
interface Monitoring {
  active_apis: number;
  calls_last_hour: number;
  failure_rate: number;
  avg_response_time_ms: number;
  chrome_pool_in_use: number;
  chrome_pool_max: number;
  queue_depth: number;
  alerts: { level: 'info' | 'warning'; message: string }[];
}
interface ConfirmAction {
  title: string;
  description: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
}

async function getJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const json = await res.json();
  return { status: res.status, json };
}

export default function AdminPage() {
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('payments');

  const [monitoring, setMonitoring] = useState<Monitoring | null>(null);
  const [creditPurchases, setCreditPurchases] = useState<CreditPurchase[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [apis, setApis] = useState<AdminApi[]>([]);

  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [resolveFlag, setResolveFlag] = useState<Record<string, boolean>>({});
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const [creatorSearch, setCreatorSearch] = useState('');
  const [apiSearch, setApiSearch] = useState('');
  const [creatorPage, setCreatorPage] = useState(1);
  const [apiPage, setApiPage] = useState(1);
  const PAGE_SIZE = 10;

  async function loadAll() {
    try {
      const [mon, cp, disp, cre, ap] = await Promise.all([
        getJson('/api/admin/monitoring'),
        getJson('/api/admin/credit-purchases?status=pending'),
        getJson('/api/admin/disputes?status=open'),
        getJson('/api/admin/creators'),
        getJson('/api/admin/apis'),
      ]);
      if (mon.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      if (!mon.json.success) {
        setLoadError(mon.json.error || 'Could not load the admin panel right now.');
        setLoading(false);
        return;
      }
      setMonitoring(mon.json.data);
      setCreditPurchases(cp.json.data || []);
      setDisputes(disp.json.data || []);
      setCreators(cre.json.data || []);
      setApis(ap.json.data || []);
      setLoading(false);
    } catch {
      setLoadError('Could not reach the server. Check your connection and try again.');
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function confirmPayment(id: string) {
    await getJson(`/api/admin/credit-purchases/${id}/confirm`, { method: 'POST' });
    loadAll();
  }
  async function rejectPayment(id: string) {
    await getJson(`/api/admin/credit-purchases/${id}/reject`, { method: 'POST' });
    loadAll();
  }

  async function testDispute(id: string) {
    const { json } = await getJson(`/api/admin/disputes/${id}/test`, { method: 'POST' });
    setDisputes((ds) => ds.map((d) => (d.id === id ? { ...d, test_result: json.data } : d)));
  }
  async function resolveDispute(id: string, resolution: string) {
    await getJson(`/api/admin/disputes/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, notes: resolveNotes[id], flag_creator: !!resolveFlag[id] }),
    });
    setConfirmAction(null);
    loadAll();
  }

  async function moderate(creatorId: string, action: string) {
    await getJson(`/api/admin/creators/${creatorId}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setConfirmAction(null);
    loadAll();
  }

  async function flagApi(id: string) {
    await getJson(`/api/admin/apis/${id}/flag`, { method: 'POST' });
    setConfirmAction(null);
    loadAll();
  }
  async function unflagApi(id: string) {
    await getJson(`/api/admin/apis/${id}/unflag`, { method: 'POST' });
    loadAll();
  }

  const filteredCreators = useMemo(
    () => creators.filter((c) => c.email.toLowerCase().includes(creatorSearch.toLowerCase())),
    [creators, creatorSearch]
  );
  const filteredApis = useMemo(
    () =>
      apis.filter(
        (a) => a.name.toLowerCase().includes(apiSearch.toLowerCase()) || a.creator_email.toLowerCase().includes(apiSearch.toLowerCase())
      ),
    [apis, apiSearch]
  );
  const visibleCreators = filteredCreators.slice(0, creatorPage * PAGE_SIZE);
  const visibleApis = filteredApis.slice(0, apiPage * PAGE_SIZE);

  if (loading) {
    return (
      <AppShell active="admin" eyebrow="OPERATIONS" title="Admin panel">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (forbidden) {
    return (
      <AppShell active="admin" eyebrow="OPERATIONS" title="Admin panel">
        <Card className="flex items-center gap-3 p-6">
          <ShieldAlert className="h-5 w-5 flex-none text-muted" aria-hidden />
          <p className="text-sm text-ink">Admin access required.</p>
        </Card>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell active="admin" eyebrow="OPERATIONS" title="Admin panel">
        <Card className="flex items-center gap-3 p-6 text-danger">
          <AlertTriangle className="h-5 w-5 flex-none" aria-hidden />
          {loadError}
        </Card>
      </AppShell>
    );
  }

  const paymentColumns: TableColumn<CreditPurchase>[] = [
    { key: 'user_email', label: 'User', render: (p) => p.user_email },
    { key: 'amount_bdt', label: 'Amount', align: 'right', render: (p) => `${p.amount_bdt} BDT` },
    { key: 'payment_reference', label: 'bKash reference', render: (p) => <span className="font-mono text-xs">{p.payment_reference}</span> },
    { key: 'created_at', label: 'Submitted', render: (p) => new Date(p.created_at).toLocaleString() },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => confirmPayment(p.id)}>
            Confirm
          </Button>
          <Button size="sm" variant="ghost" onClick={() => rejectPayment(p.id)}>
            Reject
          </Button>
        </div>
      ),
    },
  ];

  const creatorColumns: TableColumn<Creator>[] = [
    {
      key: 'email',
      label: 'Email',
      render: (c) => (
        <span className="flex items-center gap-2">
          {c.email}
          {c.is_admin && <Badge variant="accent">Admin</Badge>}
        </span>
      ),
    },
    { key: 'api_count', label: 'APIs', align: 'right', render: (c) => c.api_count },
    { key: 'moderation_status', label: 'Moderation', render: (c) => <Badge variant={statusToVariant(c.moderation_status)}>{c.moderation_status}</Badge> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (c) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setConfirmAction({
                title: `Warn ${c.email}?`,
                description: 'This records a first-stage moderation warning against this creator.',
                onConfirm: () => moderate(c.id, 'warning'),
              })
            }
          >
            Warn
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setConfirmAction({
                title: `Final warning for ${c.email}?`,
                description: 'This is the last stage before a ban.',
                onConfirm: () => moderate(c.id, 'final_warning'),
              })
            }
          >
            Final warning
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              setConfirmAction({
                title: `Ban ${c.email}?`,
                description: 'This creator will lose access immediately. This can be reversed with Reinstate.',
                variant: 'danger',
                onConfirm: () => moderate(c.id, 'banned'),
              })
            }
          >
            <Ban className="h-3.5 w-3.5" aria-hidden />
            Ban
          </Button>
          {c.moderation_status !== 'active' && (
            <Button size="sm" variant="ghost" onClick={() => moderate(c.id, 'reinstate')}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reinstate
            </Button>
          )}
        </div>
      ),
    },
  ];

  const apiColumns: TableColumn<AdminApi>[] = [
    { key: 'name', label: 'Name', render: (a) => <span className="font-medium text-ink">{a.name}</span> },
    { key: 'creator_email', label: 'Creator', render: (a) => a.creator_email },
    { key: 'status', label: 'Status', render: (a) => <Badge variant={statusToVariant(a.status)}>{a.status}</Badge> },
    { key: 'has_backup', label: 'Backup', render: (a) => (a.has_backup ? <Badge variant="success">Yes</Badge> : '—') },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (a) =>
        a.status !== 'flagged' ? (
          <Button
            size="sm"
            variant="danger"
            onClick={() =>
              setConfirmAction({
                title: `Flag "${a.name}"?`,
                description: 'This removes it from the marketplace and marks it for review.',
                variant: 'danger',
                onConfirm: () => flagApi(a.id),
              })
            }
          >
            <Flag className="h-3.5 w-3.5" aria-hidden />
            Flag
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => unflagApi(a.id)}>
            Unflag
          </Button>
        ),
    },
  ];

  return (
    <AppShell active="admin" eyebrow="OPERATIONS" title="Admin panel">
      <Tabs
        items={[
          { key: 'payments', label: `Payments${creditPurchases.length ? ` (${creditPurchases.length})` : ''}` },
          { key: 'disputes', label: `Disputes${disputes.length ? ` (${disputes.length})` : ''}` },
          { key: 'directory', label: 'Creators & APIs' },
          { key: 'monitoring', label: 'Monitoring' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-6">
        {tab === 'payments' && (
          <section>
            <p className="mb-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted">
              <CreditCard className="h-3.5 w-3.5" aria-hidden />
              Pending bKash tickets
            </p>
            {creditPurchases.length === 0 ? (
              <EmptyState title="No pending payments" description="New bKash submissions will appear here." />
            ) : (
              <Table columns={paymentColumns} rows={creditPurchases} rowKey={(p) => p.id} />
            )}
          </section>
        )}

        {tab === 'disputes' && (
          <section>
            <p className="mb-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Open disputes
            </p>
            {disputes.length === 0 ? (
              <EmptyState title="No open disputes" description="Buyer-filed disputes will appear here." />
            ) : (
              <div className="space-y-4">
                {disputes.map((d) => (
                  <Card key={d.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-base font-semibold text-ink">{d.api_name}</p>
                        <p className="text-xs text-muted">Buyer: {d.buyer_email}</p>
                      </div>
                      <Badge variant={statusToVariant(d.status)}>{d.status}</Badge>
                    </div>
                    <p className="mt-3 rounded-lg bg-page px-3 py-2 text-sm text-ink">{d.reason}</p>

                    <Button size="sm" variant="secondary" className="mt-3" onClick={() => testDispute(d.id)}>
                      <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                      Auto-test API
                    </Button>
                    {d.test_result != null && (
                      <div className="mt-3">
                        <CodeBlock code={JSON.stringify(d.test_result, null, 2)} />
                      </div>
                    )}

                    <div className="mt-4 space-y-2">
                      <Textarea
                        placeholder="Admin notes"
                        value={resolveNotes[d.id] || ''}
                        onChange={(e) => setResolveNotes((s) => ({ ...s, [d.id]: e.target.value }))}
                        rows={2}
                      />
                      <label className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={!!resolveFlag[d.id]}
                          onChange={(e) => setResolveFlag((s) => ({ ...s, [d.id]: e.target.checked }))}
                          className="h-4 w-4 rounded border-border text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        />
                        Warn creator when resolving
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setConfirmAction({
                            title: 'Refund 50%?',
                            description: 'Use this for a genuine infra failure — half the cost is refunded to the buyer.',
                            onConfirm: () => resolveDispute(d.id, 'refunded_50'),
                          })
                        }
                      >
                        Refund 50%
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setConfirmAction({
                            title: 'Full refund?',
                            description: 'Use this for a fake or broken listing — the buyer is refunded in full.',
                            variant: 'danger',
                            onConfirm: () => resolveDispute(d.id, 'refunded_100'),
                          })
                        }
                      >
                        Full refund
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resolveDispute(d.id, 'denied')}>
                        Deny
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'directory' && (
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  Creators
                </p>
                <Input
                  placeholder="Search by email…"
                  value={creatorSearch}
                  onChange={(e) => {
                    setCreatorSearch(e.target.value);
                    setCreatorPage(1);
                  }}
                  className="h-8 w-56 text-xs"
                />
              </div>
              {filteredCreators.length === 0 ? (
                <EmptyState title="No creators found" description="Try a different search." />
              ) : (
                <>
                  <Table columns={creatorColumns} rows={visibleCreators} rowKey={(c) => c.id} />
                  {visibleCreators.length < filteredCreators.length && (
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-muted">
                        Showing {visibleCreators.length} of {filteredCreators.length}
                      </p>
                      <Button size="sm" variant="secondary" onClick={() => setCreatorPage((p) => p + 1)}>
                        Show more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">All APIs</p>
                <Input
                  placeholder="Search by name or creator…"
                  value={apiSearch}
                  onChange={(e) => {
                    setApiSearch(e.target.value);
                    setApiPage(1);
                  }}
                  className="h-8 w-56 text-xs"
                />
              </div>
              {filteredApis.length === 0 ? (
                <EmptyState title="No APIs found" description="Try a different search." />
              ) : (
                <>
                  <Table columns={apiColumns} rows={visibleApis} rowKey={(a) => a.id} />
                  {visibleApis.length < filteredApis.length && (
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs text-muted">
                        Showing {visibleApis.length} of {filteredApis.length}
                      </p>
                      <Button size="sm" variant="secondary" onClick={() => setApiPage((p) => p + 1)}>
                        Show more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {tab === 'monitoring' && monitoring && (
          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Active APIs" value={monitoring.active_apis} />
              <StatCard label="Failure rate (1h)" value={`${(monitoring.failure_rate * 100).toFixed(1)}%`} />
              <StatCard label="Avg response (5m)" value={`${monitoring.avg_response_time_ms} ms`} />
              <StatCard label="Chrome pool" value={`${monitoring.chrome_pool_in_use}/${monitoring.chrome_pool_max}`} />
              <StatCard label="Queue depth" value={monitoring.queue_depth} />
            </div>

            <div className="mt-6">
              <p className="mb-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted">
                <Gauge className="h-3.5 w-3.5" aria-hidden />
                Alerts
              </p>
              {monitoring.alerts.length === 0 ? (
                <EmptyState icon={<Activity className="h-5 w-5" aria-hidden />} title="No alerts" description="Everything looks healthy." />
              ) : (
                <div className="space-y-2">
                  {monitoring.alerts.map((a, i) => (
                    <Card key={i} className="flex items-center gap-3 p-4">
                      <Badge variant={a.level === 'warning' ? 'warning' : 'neutral'}>{a.level}</Badge>
                      <p className="text-sm text-ink">{a.message}</p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <Modal open={!!confirmAction} onClose={() => setConfirmAction(null)} title={confirmAction?.title}>
        <p className="text-sm text-muted">{confirmAction?.description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmAction(null)}>
            Cancel
          </Button>
          <Button variant={confirmAction?.variant === 'danger' ? 'danger' : 'primary'} onClick={() => confirmAction?.onConfirm()}>
            Confirm
          </Button>
        </div>
      </Modal>
    </AppShell>
  );
}
