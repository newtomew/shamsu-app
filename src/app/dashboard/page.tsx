'use client';

// Creator dashboard (PRD section 2.4) — all of my APIs as cards, with a
// toggle to a sortable table, plus quick stats.
//
// Visual pass only: data-fetching, sorting, and all existing behavior are
// unchanged from the previous version — only the markup/components changed.

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Table, TableColumn } from '@/components/ui/Table';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sparkles } from 'lucide-react';

interface ApiSummary {
  id: string;
  name: string;
  status: string;
  replay_mode: string;
  is_listed_in_marketplace: boolean;
  created_at: string;
  total_calls: number;
  active_buyers: number;
  revenue_bdt: number;
}

type SortKey = keyof Pick<ApiSummary, 'name' | 'status' | 'total_calls' | 'active_buyers' | 'revenue_bdt' | 'created_at'>;

export default function DashboardPage() {
  const [apis, setApis] = useState<ApiSummary[] | null>(null);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/creator/apis');
      const json = await res.json();
      if (json.success) setApis(json.data);
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
    }),
    { calls: 0, revenue: 0, buyers: 0 }
  );

  const columns: TableColumn<ApiSummary>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (a) => <a href={`/apis/${a.id}`} className="font-medium text-ink hover:text-accent">{a.name}</a> },
    { key: 'status', label: 'Status', sortable: true, render: (a) => <Badge variant={statusToVariant(a.status)}>{a.status}</Badge> },
    { key: 'total_calls', label: 'Calls', sortable: true, align: 'right', render: (a) => a.total_calls },
    { key: 'active_buyers', label: 'Buyers', sortable: true, align: 'right', render: (a) => a.active_buyers },
    { key: 'revenue_bdt', label: 'Revenue', sortable: true, align: 'right', render: (a) => `${a.revenue_bdt.toFixed(4)} BDT` },
    { key: 'created_at', label: 'Created', sortable: true, render: (a) => new Date(a.created_at).toLocaleDateString() },
  ];

  return (
    <AppShell active="dashboard" eyebrow="OVERVIEW" title={<>Your <span className="text-accent">APIs</span></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total calls" value={totals.calls} loading={loading} />
        <StatCard label="Revenue" value={`${totals.revenue.toFixed(4)} BDT`} accent loading={loading} />
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
            icon={<Sparkles className="h-5 w-5" aria-hidden />}
            title="No APIs yet"
            description="Record a browser flow with the Shamsu extension or submit one via /api/recordings to see it here."
          />
        )}

        {!loading && apis!.length > 0 && view === 'cards' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((api) => (
              <a key={api.id} href={`/apis/${api.id}`} className="block">
                <Card className="h-full p-5 transition-shadow hover:shadow-none hover:border-ink/20">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-ink">{api.name}</h3>
                    <Badge variant={statusToVariant(api.status)}>{api.status}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted">{api.replay_mode}</p>
                  <div className="mt-4 space-y-1 text-sm text-ink">
                    <p>{api.total_calls} calls</p>
                    <p>{api.revenue_bdt.toFixed(4)} BDT revenue</p>
                    <p>{api.active_buyers} active buyers</p>
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
          <Table
            columns={columns}
            rows={sorted}
            rowKey={(a) => a.id}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
          />
        )}
      </div>
    </AppShell>
  );
}
