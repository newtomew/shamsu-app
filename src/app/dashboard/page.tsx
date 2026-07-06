'use client';

// Creator dashboard (PRD section 2.4) — all of my APIs as cards, with a
// toggle to a sortable table, plus quick stats. Plain/functional for now.

import { useEffect, useMemo, useState } from 'react';

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

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (!apis) return <main style={{ padding: 24 }}>Loading…</main>;

  const totals = apis.reduce(
    (acc, a) => ({
      calls: acc.calls + a.total_calls,
      revenue: acc.revenue + a.revenue_bdt,
      buyers: acc.buyers + a.active_buyers,
    }),
    { calls: 0, revenue: 0, buyers: 0 }
  );

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 960 }}>
      <h1>Dashboard</h1>
      <p>
        <a href="/analytics">Analytics</a> · <a href="/marketplace">Marketplace</a> ·{' '}
        <a href="/purchases">My purchases</a> · <a href="/billing">Billing</a> · <a href="/admin">Admin</a>
      </p>

      <section style={{ display: 'flex', gap: 24, margin: '16px 0', padding: 12, background: '#f4f4f4', color: '#111' }}>
        <div>
          <strong>{totals.calls}</strong>
          <div>total calls</div>
        </div>
        <div>
          <strong>{totals.revenue.toFixed(4)} BDT</strong>
          <div>revenue</div>
        </div>
        <div>
          <strong>{totals.buyers}</strong>
          <div>active buyers</div>
        </div>
      </section>

      {apis.length === 0 && <p>No APIs yet.</p>}

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setView('cards')} disabled={view === 'cards'}>
          Cards
        </button>{' '}
        <button onClick={() => setView('table')} disabled={view === 'table'}>
          Table
        </button>
      </div>

      {view === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {sorted.map((api) => (
            <a
              key={api.id}
              href={`/apis/${api.id}`}
              style={{ border: '1px solid #ccc', padding: 12, display: 'block', color: 'inherit', textDecoration: 'none' }}
            >
              <h3 style={{ margin: '0 0 8px' }}>{api.name}</h3>
              <p style={{ margin: 0 }}>
                {api.status} · {api.replay_mode}
              </p>
              <p style={{ margin: 0 }}>{api.total_calls} calls</p>
              <p style={{ margin: 0 }}>{api.revenue_bdt.toFixed(4)} BDT revenue</p>
              <p style={{ margin: 0 }}>{api.active_buyers} active buyers</p>
              {api.is_listed_in_marketplace && <p style={{ margin: 0, color: 'green' }}>Listed in marketplace</p>}
            </a>
          ))}
        </div>
      )}

      {view === 'table' && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {(
                [
                  ['name', 'Name'],
                  ['status', 'Status'],
                  ['total_calls', 'Calls'],
                  ['active_buyers', 'Buyers'],
                  ['revenue_bdt', 'Revenue'],
                  ['created_at', 'Created'],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  style={{ cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}
                >
                  {label}
                  {sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((api) => (
              <tr key={api.id}>
                <td style={{ padding: 6 }}>
                  <a href={`/apis/${api.id}`}>{api.name}</a>
                </td>
                <td style={{ padding: 6 }}>{api.status}</td>
                <td style={{ padding: 6 }}>{api.total_calls}</td>
                <td style={{ padding: 6 }}>{api.active_buyers}</td>
                <td style={{ padding: 6 }}>{api.revenue_bdt.toFixed(4)}</td>
                <td style={{ padding: 6 }}>{new Date(api.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
