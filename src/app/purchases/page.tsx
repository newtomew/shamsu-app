'use client';

// Buyer dashboard (PRD 2.5): APIs I bought, my credit balance. Cards for now
// (matches the creator dashboard's pattern from Phase 7).

import { useEffect, useState } from 'react';

interface Purchase {
  api_id: string;
  name: string;
  api_status: string;
  endpoint: string;
  purchase_date: string;
  price_paid: number;
  status: string;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [creditBalance, setCreditBalance] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/purchases');
      const json = await res.json();
      if (json.success) {
        setPurchases(json.data.purchases);
        setCreditBalance(json.data.credit_balance);
      }
    })();
  }, []);

  if (!purchases) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <p>
        <a href="/dashboard">Dashboard</a> · <a href="/marketplace">Marketplace</a>
      </p>
      <h1>My purchases</h1>
      <p>Credit balance: {creditBalance} BDT</p>

      {purchases.length === 0 && <p>You haven&apos;t bought anything yet — visit the marketplace.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {purchases.map((p) => (
          <a
            key={p.api_id}
            href={`/purchases/${p.api_id}`}
            style={{ border: '1px solid #ccc', padding: 12, display: 'block', color: 'inherit', textDecoration: 'none' }}
          >
            <h3 style={{ margin: '0 0 8px' }}>{p.name}</h3>
            <p style={{ margin: 0 }}>
              {p.api_status === 'deleted' ? '⚠️ unavailable (deleted by creator)' : p.api_status}
            </p>
            <p style={{ margin: 0 }}>Purchased {new Date(p.purchase_date).toLocaleDateString()}</p>
            <p style={{ margin: 0 }}>{p.price_paid} BDT paid</p>
          </a>
        ))}
      </div>
    </main>
  );
}
