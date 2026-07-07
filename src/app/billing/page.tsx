'use client';

// Billing (PRD 2.4/4.3): credit balance, the manual bKash buy-credits flow,
// spend history, and — for creators — earnings/payout. Submitting only
// creates a 'pending' request; an admin matches the transaction number
// against the real bKash receipt and confirms it (Phase 10 admin panel),
// which is what actually adds credits.

import { useEffect, useState } from 'react';
import { AlertTriangle, Banknote, Clock, Smartphone, Wallet } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge, statusToVariant } from '@/components/ui/Badge';
import { Table, TableColumn } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

interface CreditPurchase {
  id: string;
  amountBdt: string;
  creditsAdded: number;
  paymentReference: string | null;
  status: string;
  createdAt: string;
}
interface SpendRow {
  id: string;
  api_name: string;
  timestamp: string;
  status: string;
  cost_bdt: number | null;
}
interface CreatorEarnings {
  total_earnings: number;
  pending_payout: number;
  paid_out: number;
  last_payout_date: string | null;
}
interface BillingData {
  credit_balance: string;
  purchases: CreditPurchase[];
  spend_history: SpendRow[];
  creator_earnings: CreatorEarnings | null;
}

const BKASH_NUMBER = process.env.NEXT_PUBLIC_BKASH_NUMBER || 'Ask an admin for the bKash number to send to';

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/billing/credit-purchases');
      const json = await res.json();
      if (!json.success) {
        setLoadError(json.error || 'Could not load your billing info right now.');
        return;
      }
      setLoadError(null);
      setData(json.data);
    } catch {
      setLoadError('Could not reach the server. Check your connection and try again.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await fetch('/api/billing/credit-purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_bdt: Number(amount), payment_reference: reference }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    setMessage('Submitted — confirmed within 30–60 minutes once matched against the bKash receipt.');
    setAmount('');
    setReference('');
    load();
  }

  const loading = data === null;

  const purchaseColumns: TableColumn<CreditPurchase>[] = [
    { key: 'amountBdt', label: 'Amount', align: 'right', render: (p) => `${p.amountBdt} BDT` },
    { key: 'paymentReference', label: 'bKash reference', render: (p) => <span className="font-mono text-xs">{p.paymentReference}</span> },
    { key: 'status', label: 'Status', render: (p) => <Badge variant={statusToVariant(p.status)}>{p.status}</Badge> },
    { key: 'createdAt', label: 'Submitted', render: (p) => new Date(p.createdAt).toLocaleString() },
  ];

  const spendColumns: TableColumn<SpendRow>[] = [
    { key: 'api_name', label: 'API', render: (r) => <span className="font-medium text-ink">{r.api_name}</span> },
    { key: 'timestamp', label: 'Date', render: (r) => new Date(r.timestamp).toLocaleString() },
    { key: 'status', label: 'Status', render: (r) => <Badge variant={statusToVariant(r.status)}>{r.status}</Badge> },
    { key: 'cost_bdt', label: 'Cost', align: 'right', render: (r) => (r.cost_bdt != null ? `${r.cost_bdt.toFixed(4)} BDT` : '—') },
  ];

  if (loadError) {
    return (
      <AppShell active="billing" eyebrow="ACCOUNT" title="Billing & credits">
        <Card className="flex items-center gap-3 p-6 text-danger">
          <AlertTriangle className="h-5 w-5 flex-none" aria-hidden />
          {loadError}
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      active="billing"
      eyebrow="ACCOUNT"
      title={
        <>
          <span className="text-accent">Billing</span> &amp; credits
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <Card className="p-6">
            <p className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              Credit balance
            </p>
            {loading ? (
              <Skeleton className="mt-2 h-10 w-32" />
            ) : (
              <p className="mt-1 font-display text-4xl font-bold tracking-tight text-accent">{data!.credit_balance} BDT</p>
            )}
          </Card>

          <Card className="p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Buy credits</p>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">Pay via bKash</h2>

            <ol className="mt-4 space-y-3">
              <li className="flex items-start gap-3 text-sm text-ink">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent-light font-mono text-[11px] font-semibold text-accent">
                  1
                </span>
                <span className="pt-0.5">
                  Send your desired amount via bKash to{' '}
                  <span className="rounded-md bg-page px-1.5 py-0.5 font-mono text-sm font-semibold text-ink">{BKASH_NUMBER}</span>
                </span>
              </li>
              <li className="flex items-start gap-3 text-sm text-ink">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent-light font-mono text-[11px] font-semibold text-accent">
                  2
                </span>
                <span className="pt-0.5">Copy the transaction number bKash gives you.</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-ink">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent-light font-mono text-[11px] font-semibold text-accent">
                  3
                </span>
                <span className="pt-0.5">Enter the amount and transaction number below and submit.</span>
              </li>
            </ol>

            <div className="mt-5 space-y-3">
              <Input label="Amount sent (BDT)" placeholder="500" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input
                label="bKash transaction number"
                placeholder="e.g. 8N7A6B5C4D"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <Button className="w-full" loading={busy} onClick={submit} disabled={!amount || !reference}>
                <Smartphone className="h-4 w-4" aria-hidden />
                Submit for confirmation
              </Button>
              {error && <p className="text-xs text-danger">{error}</p>}
              {message && (
                <p className="flex items-center gap-1.5 rounded-lg bg-success-light px-3 py-2 text-xs text-success">
                  <Clock className="h-3.5 w-3.5 flex-none" aria-hidden />
                  {message}
                </p>
              )}
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Clock className="h-3.5 w-3.5 flex-none" aria-hidden />
                Confirmed within 30–60 minutes, once matched against the bKash receipt.
              </p>
            </div>
          </Card>

          {!loading && data!.creator_earnings && (
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Earnings</p>
              <h2 className="mt-1 font-display text-lg font-bold text-ink">Your payout</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard label="Total earned" value={`${data!.creator_earnings.total_earnings.toFixed(2)} BDT`} accent />
                <StatCard label="Pending payout" value={`${data!.creator_earnings.pending_payout.toFixed(2)} BDT`} />
                <StatCard label="Paid out" value={`${data!.creator_earnings.paid_out.toFixed(2)} BDT`} />
              </div>
              <Card className="mt-3 flex items-center gap-3 bg-page p-4">
                <Banknote className="h-4 w-4 flex-none text-muted" aria-hidden />
                <p className="text-xs text-muted">
                  You keep 60% of every call buyers make to your listed APIs. Payouts are processed by the Shamsu team.
                </p>
              </Card>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Requests</p>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">Your bKash requests</h2>
            <div className="mt-3">
              {loading ? (
                <Card className="space-y-3 p-5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </Card>
              ) : data!.purchases.length === 0 ? (
                <EmptyState title="No requests yet" description="Submit a bKash payment above to top up your balance." />
              ) : (
                <Table columns={purchaseColumns} rows={data!.purchases} rowKey={(p) => p.id} />
              )}
            </div>
          </section>

          <section>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">History</p>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">Spend history</h2>
            <div className="mt-3">
              {loading ? (
                <Card className="space-y-3 p-5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </Card>
              ) : data!.spend_history.length === 0 ? (
                <EmptyState title="No calls yet" description="Calls you make — to your own APIs or ones you bought — appear here." />
              ) : (
                <Table columns={spendColumns} rows={data!.spend_history} rowKey={(r) => r.id} />
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
