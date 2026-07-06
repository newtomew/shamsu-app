'use client';

// Analytics page (PRD section 2.4): usage over time, top buyers, daily
// earnings by buyer, error logs — across all of the creator's APIs.

import { useEffect, useState } from 'react';

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

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/analytics');
      const json = await res.json();
      if (json.success) setData(json.data);
    })();
  }, []);

  if (!data) return <main style={{ padding: 24 }}>Loading…</main>;

  const maxCalls = Math.max(1, ...data.usage_over_time.map((p) => p.calls));

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <p>
        <a href="/dashboard">← Dashboard</a>
      </p>
      <h1>Analytics</h1>

      <section style={{ marginBottom: 32 }}>
        <h2>Usage over time</h2>
        {data.usage_over_time.length === 0 && <p>No calls yet.</p>}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
          {data.usage_over_time.map((p) => (
            <div key={p.day} title={`${p.day}: ${p.calls} calls`} style={{ textAlign: 'center' }}>
              <div style={{ height: (p.calls / maxCalls) * 100, width: 24, background: '#4a90d9' }} />
              <div style={{ fontSize: 10 }}>{new Date(p.day).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Top buyers</h2>
        {data.top_buyers.length === 0 && <p>No buyers yet — nobody besides you has called your APIs.</p>}
        {data.top_buyers.length > 0 && (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Buyer</th>
                <th style={{ textAlign: 'left' }}>Calls</th>
                <th style={{ textAlign: 'left' }}>Revenue (BDT)</th>
              </tr>
            </thead>
            <tbody>
              {data.top_buyers.map((b) => (
                <tr key={b.buyer_id}>
                  <td>{b.buyer_email}</td>
                  <td>{b.calls}</td>
                  <td>{b.revenue_bdt.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2>Daily earnings by buyer</h2>
        {data.daily_earnings_by_buyer.length === 0 && <p>No earnings yet.</p>}
        {data.daily_earnings_by_buyer.length > 0 && (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Day</th>
                <th style={{ textAlign: 'left' }}>Buyer</th>
                <th style={{ textAlign: 'left' }}>Revenue (BDT)</th>
              </tr>
            </thead>
            <tbody>
              {data.daily_earnings_by_buyer.map((row, i) => (
                <tr key={i}>
                  <td>{new Date(row.day).toLocaleDateString()}</td>
                  <td>{row.email}</td>
                  <td>{Number(row.revenue).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Error logs</h2>
        {data.error_logs.length === 0 && <p>No errors logged.</p>}
        {data.error_logs.length > 0 && (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Timestamp</th>
                <th style={{ textAlign: 'left' }}>API</th>
                <th style={{ textAlign: 'left' }}>Buyer</th>
                <th style={{ textAlign: 'left' }}>Status</th>
                <th style={{ textAlign: 'left' }}>Error</th>
              </tr>
            </thead>
            <tbody>
              {data.error_logs.map((e, i) => (
                <tr key={i}>
                  <td>{new Date(e.timestamp).toLocaleString()}</td>
                  <td>{e.api_name}</td>
                  <td>{e.buyer}</td>
                  <td>{e.status}</td>
                  <td>{e.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
