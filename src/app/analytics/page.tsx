'use client';

// Analytics page (PRD section 2.4): usage over time, top buyers, daily
// earnings by buyer, error logs — across all of the creator's APIs.
// Visual pass only — the /api/analytics contract is unchanged.

import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, TrendingUp, Users } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card } from '@/components/ui/Card';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Table, TableColumn } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

interface UsagePoint {
  day: string;
  calls: number;
}
interface TopBuyer {
  buyer_id: string;
  buyer_email: string;
  calls: number;
  revenue_bdt: number;
}
interface DailyEarning {
  day: string;
  caller_id: string;
  email: string;
  revenue: number;
}
interface ErrorLog {
  timestamp: string;
  api_name: string;
  buyer: string;
  status: string;
  error: string | null;
}
interface AnalyticsData {
  usage_over_time: UsagePoint[];
  top_buyers: TopBuyer[];
  daily_earnings_by_buyer: DailyEarning[];
  error_logs: ErrorLog[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/analytics');
        const json = await res.json();
        if (!json.success) {
          setLoadError(json.error || 'Could not load your analytics right now.');
          return;
        }
        setData(json.data);
      } catch {
        setLoadError('Could not reach the server. Check your connection and try again.');
      }
    })();
  }, []);

  if (loadError) {
    return (
      <AppShell active="analytics" eyebrow="INSIGHTS" title="Analytics">
        <Card className="flex items-center gap-3 p-6 text-danger">
          <AlertTriangle className="h-5 w-5 flex-none" aria-hidden />
          {loadError}
        </Card>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell active="analytics" eyebrow="INSIGHTS" title="Analytics">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </AppShell>
    );
  }

  const maxCalls = Math.max(1, ...data.usage_over_time.map((p) => p.calls));

  const buyerColumns: TableColumn<TopBuyer>[] = [
    { key: 'buyer_email', label: 'Buyer', render: (b) => b.buyer_email },
    { key: 'calls', label: 'Calls', align: 'right', render: (b) => b.calls },
    { key: 'revenue_bdt', label: 'Revenue', align: 'right', render: (b) => `${b.revenue_bdt.toFixed(4)} BDT` },
  ];
  const earningsColumns: TableColumn<DailyEarning>[] = [
    { key: 'day', label: 'Day', render: (r) => new Date(r.day).toLocaleDateString() },
    { key: 'email', label: 'Buyer', render: (r) => r.email },
    { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => `${Number(r.revenue).toFixed(4)} BDT` },
  ];
  const errorColumns: TableColumn<ErrorLog>[] = [
    { key: 'timestamp', label: 'Time', render: (e) => new Date(e.timestamp).toLocaleString() },
    { key: 'api_name', label: 'API', render: (e) => <span className="font-medium text-ink">{e.api_name}</span> },
    { key: 'buyer', label: 'Caller', render: (e) => e.buyer },
    { key: 'status', label: 'Status', render: (e) => <Badge variant={statusToVariant(e.status)}>{e.status}</Badge> },
    { key: 'error', label: 'Error', render: (e) => e.error || '—' },
  ];

  return (
    <AppShell active="analytics" eyebrow="INSIGHTS" title="Analytics">
      <div className="space-y-8">
        <section>
          <p className="mb-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
            Usage over time
          </p>
          {data.usage_over_time.length === 0 ? (
            <EmptyState title="No calls yet" description="Once your APIs start getting called, daily usage shows up here." />
          ) : (
            <Card className="p-6">
              <div className="flex h-32 items-end gap-2 overflow-x-auto">
                {data.usage_over_time.map((p) => {
                  // Pixel height, not percentage — a percentage height only
                  // resolves against a parent with a *definite* height, and
                  // this bar's immediate parent (a flex column sized by its
                  // own content) doesn't have one.
                  const barHeightPx = Math.max(4, Math.round((p.calls / maxCalls) * 96));
                  return (
                    <div key={p.day} className="flex flex-1 flex-col items-center gap-2" title={`${p.day}: ${p.calls} calls`}>
                      <div
                        className="w-full min-w-[8px] rounded-t-sm bg-accent transition-all duration-300"
                        style={{ height: `${barHeightPx}px` }}
                      />
                      <span className="font-mono text-[10px] text-muted">
                        {new Date(p.day).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </section>

        <section>
          <p className="mb-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Top buyers
          </p>
          {data.top_buyers.length === 0 ? (
            <EmptyState title="No buyers yet" description="Nobody besides you has called your APIs yet." />
          ) : (
            <Table columns={buyerColumns} rows={data.top_buyers} rowKey={(b) => b.buyer_id} />
          )}
        </section>

        <section>
          <p className="mb-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            Daily earnings by buyer
          </p>
          {data.daily_earnings_by_buyer.length === 0 ? (
            <EmptyState title="No earnings yet" description="Earnings from buyer calls will be broken down by day here." />
          ) : (
            <Table columns={earningsColumns} rows={data.daily_earnings_by_buyer} rowKey={(r) => `${r.day}-${r.caller_id}`} />
          )}
        </section>

        <section>
          <p className="mb-3 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Error logs
          </p>
          {data.error_logs.length === 0 ? (
            <EmptyState title="No errors logged" description="Failed or timed-out calls across your APIs will show up here." />
          ) : (
            <Table columns={errorColumns} rows={data.error_logs} rowKey={(e) => `${e.timestamp}-${e.api_name}-${e.buyer}`} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
