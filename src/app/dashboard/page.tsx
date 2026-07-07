'use client';

// Creator dashboard (PRD section 2.4) — all of my APIs as cards, with a
// toggle to a sortable table, quick stats with week-over-week trends, and a
// portfolio-wide recent activity feed.

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { StatCard, StatCardTrend } from '@/components/ui/StatCard';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Table, TableColumn } from '@/components/ui/Table';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { InstallExtensionSteps } from '@/components/InstallExtensionSteps';
import { Sparkles, Plus, Activity, AlertTriangle } from 'lucide-react';
import { replayModeLabel } from '@/lib/labels';

interface ApiSummary {
  id: string;
  name: string;
  status: string;
  replay_mode: string;
  is_listed_in_marketplace: boolean;
  created_at: string;
  last_called_at: string | null;
  total_calls: number;
  active_buyers: number;
  revenue_bdt: number;
}
interface UsageRow {
  day: string;
  calls: number;
}
interface EarningsRow {
  day: string;
  revenue: number;
}
interface ActivityRow {
  id: string;
  timestamp: string;
  api_name: string;
  buyer: string;
  status: string;
  latency_ms: number | null;
  error: string | null;
}
interface AnalyticsData {
  usage_over_time: UsageRow[];
  daily_earnings_by_buyer: EarningsRow[];
  recent_activity: ActivityRow[];
}

type SortKey = keyof Pick<ApiSummary, 'name' | 'status' | 'total_calls' | 'active_buyers' | 'revenue_bdt' | 'created_at'>;

// Week-over-week trend, computed from real daily rows (no fabricated
// numbers) — days with no activity simply aren't in the rows, which is why
// this buckets by actual elapsed time rather than splitting the row list.
function bucketedSum<T extends { day: string }>(rows: T[], getAmount: (r: T) => number): { recent: number; prior: number } {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86_400_000;
  const fourteenDaysAgo = now - 14 * 86_400_000;
  let recent = 0;
  let prior = 0;
  for (const r of rows) {
    const t = new Date(r.day).getTime();
    const amt = getAmount(r);
    if (t >= sevenDaysAgo) recent += amt;
    else if (t >= fourteenDaysAgo) prior += amt;
  }
  return { recent, prior };
}

function toTrend({ recent, prior }: { recent: number; prior: number }): StatCardTrend | undefined {
  if (prior === 0 && recent === 0) return undefined;
  if (prior === 0) return { direction: 'up', label: 'New this week' };
  const pct = ((recent - prior) / prior) * 100;
  if (Math.abs(pct) < 1) return { direction: 'flat', label: 'Flat vs last week' };
  return { direction: pct > 0 ? 'up' : 'down', label: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}% vs last week` };
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never called';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DashboardPage() {
  const [apis, setApis] = useState<ApiSummary[] | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [apisRes, analyticsRes] = await Promise.all([fetch('/api/creator/apis'), fetch('/api/analytics')]);
        const apisJson = await apisRes.json();
        const analyticsJson = await analyticsRes.json();
        if (!apisJson.success) {
          setLoadError(apisJson.error || 'Could not load your dashboard right now.');
          return;
        }
        setApis(apisJson.data);
        if (analyticsJson.success) setAnalytics(analyticsJson.data);
      } catch {
        setLoadError('Could not reach the server. Check your connection and try again.');
      }
    })();
  }, []);

  const sorted = useMemo(() => {
    if (!apis) return [];
    const copy = [...apis];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [apis, sortKey, sortDir]);

  function toggleSort(key: string) {
    const k = key as SortKey;
    if (k === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('desc');
    }
  }

  const loading = apis === null;
  const totals = (apis || []).reduce(
    (acc, a) => ({
      calls: acc.calls + a.total_calls,
      revenue: acc.revenue + a.revenue_bdt,
      buyers: acc.buyers + a.active_buyers,
      activeApis: acc.activeApis + (a.status === 'active' ? 1 : 0),
    }),
    { calls: 0, revenue: 0, buyers: 0, activeApis: 0 }
  );

  const callsTrend = analytics ? toTrend(bucketedSum(analytics.usage_over_time, (r) => r.calls)) : undefined;
  const revenueTrend = analytics ? toTrend(bucketedSum(analytics.daily_earnings_by_buyer, (r) => r.revenue)) : undefined;

  const columns: TableColumn<ApiSummary>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (a) => (
        <a href={`/apis/${a.id}`} className="font-medium text-ink hover:text-accent">
          {a.name}
        </a>
      ),
    },
    { key: 'status', label: 'Status', sortable: true, render: (a) => <Badge variant={statusToVariant(a.status)}>{a.status}</Badge> },
    { key: 'total_calls', label: 'Calls', sortable: true, align: 'right', render: (a) => a.total_calls },
    { key: 'active_buyers', label: 'Buyers', sortable: true, align: 'right', render: (a) => a.active_buyers },
    { key: 'revenue_bdt', label: 'Revenue', sortable: true, align: 'right', render: (a) => `${a.revenue_bdt.toFixed(4)} BDT` },
    { key: 'created_at', label: 'Last called', render: (a) => relativeTime(a.last_called_at) },
  ];

  const activityColumns: TableColumn<ActivityRow>[] = [
    { key: 'timestamp', label: 'Time', render: (r) => relativeTime(r.timestamp) },
    { key: 'api_name', label: 'API', render: (r) => <span className="font-medium text-ink">{r.api_name}</span> },
    { key: 'buyer', label: 'Caller', render: (r) => r.buyer },
    { key: 'status', label: 'Status', render: (r) => <Badge variant={statusToVariant(r.status)}>{r.status}</Badge> },
    { key: 'latency_ms', label: 'Latency', align: 'right', render: (r) => (r.latency_ms != null ? `${r.latency_ms} ms` : '—') },
  ];

  if (loadError) {
    return (
      <AppShell active="dashboard" eyebrow="OVERVIEW" title="Your APIs">
        <Card className="flex items-center gap-3 p-6 text-danger">
          <AlertTriangle className="h-5 w-5 flex-none" aria-hidden />
          {loadError}
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      active="dashboard"
      eyebrow="OVERVIEW"
      title={
        <>
          Your <span className="text-accent">APIs</span>
        </>
      }
      actions={
        <Button onClick={() => setShowInstall(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Create API
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total calls" value={totals.calls} loading={loading} trend={callsTrend} />
        <StatCard label="Revenue" value={`${totals.revenue.toFixed(4)} BDT`} accent loading={loading} trend={revenueTrend} />
        <StatCard label="Active APIs" value={totals.activeApis} loading={loading} />
        <StatCard label="Active buyers" value={totals.buyers} loading={loading} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Tabs
          items={[
            { key: 'cards', label: 'Cards' },
            { key: 'table', label: 'Table' },
          ]}
          active={view}
          onChange={(k) => setView(k as 'cards' | 'table')}
        />
      </div>

      <div className="mt-4">
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="space-y-3 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))}
          </div>
        )}

        {!loading && apis!.length === 0 && (
          <EmptyState
            size="lg"
            icon={<Sparkles className="h-6 w-6" aria-hidden />}
            title="Create your first API"
            description="Record a browser flow with the Shamsu extension — confirm it, and it becomes a live endpoint in minutes."
            action={
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Button onClick={() => setShowInstall(true)}>Open the recorder</Button>
                <a href="/welcome">
                  <Button variant="secondary">Take the guided tour</Button>
                </a>
              </div>
            }
          />
        )}

        {!loading && apis!.length > 0 && view === 'cards' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((api) => (
              <a key={api.id} href={`/apis/${api.id}`} className="block">
                <Card clickable className="h-full p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-ink">{api.name}</h3>
                    <Badge variant={statusToVariant(api.status)}>{api.status}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">{replayModeLabel(api.replay_mode)}</p>
                  <div className="mt-4 space-y-1 text-sm text-ink">
                    <p>{api.total_calls} calls</p>
                    <p>{api.revenue_bdt.toFixed(4)} BDT revenue</p>
                    <p className="text-muted">{relativeTime(api.last_called_at)}</p>
                  </div>
                  {api.is_listed_in_marketplace && (
                    <div className="mt-3">
                      <Badge variant="accent">Listed in marketplace</Badge>
                    </div>
                  )}
                </Card>
              </a>
            ))}
          </div>
        )}

        {!loading && apis!.length > 0 && view === 'table' && (
          <Table columns={columns} rows={sorted} rowKey={(a) => a.id} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
        )}
      </div>

      <div className="mt-8">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Activity</p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">Recent activity</h2>

        <div className="mt-3">
          {loading && (
            <Card className="space-y-3 p-5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </Card>
          )}
          {!loading && (!analytics || analytics.recent_activity.length === 0) && (
            <EmptyState
              icon={<Activity className="h-5 w-5" aria-hidden />}
              title="No calls yet"
              description="Calls to any of your APIs — successes and errors alike — will show up here."
            />
          )}
          {!loading && analytics && analytics.recent_activity.length > 0 && (
            <Table columns={activityColumns} rows={analytics.recent_activity} rowKey={(r) => r.id} />
          )}
        </div>
      </div>

      <Modal open={showInstall} onClose={() => setShowInstall(false)} title="Create an API">
        <p className="mb-4 text-sm text-muted">
          APIs are created by recording a browser flow with the Shamsu extension, then confirming it. If you haven&apos;t
          installed the extension yet, do that first:
        </p>
        <InstallExtensionSteps />
        <p className="mt-4 text-sm text-muted">Already installed? Click the Shamsu icon in your toolbar and hit Record.</p>
        <Button className="mt-6 w-full" onClick={() => setShowInstall(false)}>
          Got it
        </Button>
      </Modal>
    </AppShell>
  );
}
