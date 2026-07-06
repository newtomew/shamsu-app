'use client';

// Buyer billing (PRD 2.4/4.3): submit a manual bKash credit purchase — an
// admin matches the transaction number against the real receipt and
// confirms it (Phase 10 admin panel), which is what actually adds credits.

import { useEffect, useState } from 'react';

interface CreditPurchase {
  id: string;
  amountBdt: string;
  creditsAdded: number;
  paymentReference: string | null;
  status: string;
  createdAt: string;
}

export default function BillingPage() {
  const [purchases, setPurchases] = useState<CreditPurchase[] | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/billing/credit-purchases');
    const json = await res.json();
    if (json.success) setPurchases(json.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/billing/credit-purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_bdt: Number(amount), payment_reference: reference }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.success) {
      setMessage(json.error);
      return;
    }
    setMessage('Submitted — an admin will confirm it within 30-60 minutes once matched against the bKash receipt.');
    setAmount('');
    setReference('');
    load();
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 600 }}>
      <p>
        <a href="/dashboard">Dashboard</a>
      </p>
      <h1>Billing</h1>
      <p>Send payment via bKash, then submit the transaction number below.</p>

      <div style={{ marginBottom: 16 }}>
        <input placeholder="amount (BDT)" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 120 }} />{' '}
        <input placeholder="bKash transaction number" value={reference} onChange={(e) => setReference(e.target.value)} style={{ width: 200 }} />{' '}
        <button onClick={submit} disabled={busy}>
          {busy ? 'Submitting…' : 'Submit'}
        </button>
        {message && <p>{message}</p>}
      </div>

      <h2>My requests</h2>
      {!purchases && <p>Loading…</p>}
      {purchases && purchases.length === 0 && <p>No requests yet.</p>}
      {purchases && purchases.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Amount</th>
              <th style={{ textAlign: 'left' }}>Reference</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th style={{ textAlign: 'left' }}>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td>{p.amountBdt}</td>
                <td>{p.paymentReference}</td>
                <td>{p.status}</td>
                <td>{new Date(p.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
