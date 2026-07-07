'use client';

// Buyer dashboard (PRD 2.5): APIs I bought, my usage only, my credit
// balance. Mirrors the creator dashboard's cards/table pattern.

import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, ShoppingBag, Store } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Table, TableColumn } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

interface Purchase {
  api_id: string;
  name: string;
  api_status: string;
  endpoint: string;
  purchase_date: string;
  price_paid: number;
  status: string;
  total_calls: number;
  total_cost_bdt: number;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [creditBalance, setCreditBalance] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/purchases');
        const json = await res.json();
        if (!json.success) {
          setLoadError(json.error || 'Could not load your purchases right now.');
          return;
        }
        setPurchases(json.data.purchases);
        setCreditBalance(json.data.credit_balance);
      } catch {
        setLoadError('Could not reach the server. Check your connection and try again.');
      }
    })();
  }, []);

  const loading = purchases === null;
  const totalCalls = (purchases || []).reduce((s, p) => s + p.total_calls, 0);
  const totalSpent = (purchases || []).reduce((s, p) => s + p.total_cost_bdt + p.price_paid, 0);

  const columns: TableColumn<Purchase>[] = [
    {
      key: 'name',
      label: 'API',
      render: (p) => (
        <a href={`/purchases/${p.api_id}`} className="font-medium text-ink hover:text-accent">
          {p.name}
        </a>
      ),
    },
    { key: 'api_status', label: 'Status', render: (p) => <Badge variant={statusToVariant(p.api_status)}>{p.api_status}</Badge> },
    { key: 'total_calls', label: 'My calls', align: 'right', render: (p) => p.total_calls },
    { key: 'total_cost_bdt', label: 'My spend', align: 'right', render: (p) => `${(p.total_cost_bdt + p.price_paid).toFixed(4)} BDT` },
    { key: 'purchase_date', label: 'Purchased', render: (p) => new Date(p.purchase_date).toLocaleDateString() },
  ];

  if (loadError) {
    return (
      <AppShell active="purchases" eyebrow="BUYER" title="My purchases">
        <Card className="flex items-center gap-3 p-6 text-danger">
          <AlertTriangle className="h-5 w-5 flex-none" aria-hidden />
          {loadError}
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      active="purchases"
      eyebrow="BUYER"
      title={
        <>
          My <span className="text-accent">purchases</span>
        </>
      }
      actions={
        <a href="/marketplace">
          <Button variant="secondary">
            <Store className="h-4 w-4" aria-hidden />
            Browse marketplace
          </Button>
        </a>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Credit balance" value={creditBalance ? `${creditBalance} BDT` : '—'} accent loading={loading} />
        <StatCard label="APIs purchased" value={(purchases || []).length} loading={loading} />
        <StatCard label="My total calls" value={totalCalls} loading={loading} />
      </div>

      <Card className="mt-4 flex items-center gap-3 bg-page p-4">
        <ShieldCheck className="h-4 w-4 flex-none text-muted" aria-hidden />
        <p className="text-xs text-muted">
          You only ever see your own usage here — other buyers&apos; calls and the creator&apos;s revenue are never visible to you.
        </p>
      </Card>

      {!loading && purchases!.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <Tabs
            items={[
              { key: 'cards', label: 'Cards' },
              { key: 'table', label: 'Table' },
            ]}
            active={view}
            onChange={(k) => setView(k as 'cards' | 'table')}
          />
          <p className="font-mono text-xs text-muted">{totalSpent.toFixed(4)} BDT spent total</p>
        </div>
      )}

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

        {!loading && purchases!.length === 0 && (
          <EmptyState
            size="lg"
            icon={<ShoppingBag className="h-6 w-6" aria-hidden />}
            title="You haven't bought anything yet"
            description="Browse the marketplace to find ready-made APIs you can start calling in minutes."
            action={
              <a href="/marketplace">
                <Button>Browse marketplace</Button>
              </a>
            }
          />
        )}

        {!loading && purchases!.length > 0 && view === 'cards' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {purchases!.map((p) => (
              <a key={p.api_id} href={`/purchases/${p.api_id}`} className="block">
                <Card clickable className="h-full p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-semibold text-ink">{p.name}</h3>
                    <Badge variant={statusToVariant(p.api_status)}>{p.api_status}</Badge>
                  </div>
                  <div className="mt-4 space-y-1 text-sm text-ink">
                    <p>{p.total_calls} calls made</p>
                    <p>{(p.total_cost_bdt + p.price_paid).toFixed(4)} BDT spent</p>
                    <p className="text-muted">Purchased {new Date(p.purchase_date).toLocaleDateString()}</p>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}

        {!loading && purchases!.length > 0 && view === 'table' && (
          <Table columns={columns} rows={purchases!} rowKey={(p) => p.api_id} />
        )}
      </div>
    </AppShell>
  );
}
