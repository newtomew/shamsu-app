'use client';

// Admin panel (PRD section 4). Plain/functional. Gated server-side by every
// /api/admin/* route (getAdminUser -> 403 for non-admins) — this page
// mirrors that at the UI level so a non-admin sees a clear message instead
// of a page full of failed-fetch errors.

import { useEffect, useState } from 'react';

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

async function getJson(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const json = await res.json();
  return { status: res.status, json };
}

export default function AdminPage() {
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  const [monitoring, setMonitoring] = useState<Monitoring | null>(null);
  const [creditPurchases, setCreditPurchases] = useState<CreditPurchase[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [apis, setApis] = useState<AdminApi[]>([]);

  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});
  const [resolveFlag, setResolveFlag] = useState<Record<string, boolean>>({});

  async function loadAll() {
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
    setMonitoring(mon.json.data);
    setCreditPurchases(cp.json.data || []);
    setDisputes(disp.json.data || []);
    setCreators(cre.json.data || []);
    setApis(ap.json.data || []);
    setLoading(false);
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
    loadAll();
  }

  async function moderate(creatorId: string, action: string) {
    await getJson(`/api/admin/creators/${creatorId}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    loadAll();
  }

  async function flagApi(id: string) {
    await getJson(`/api/admin/apis/${id}/flag`, { method: 'POST' });
    loadAll();
  }
  async function unflagApi(id: string) {
    await getJson(`/api/admin/apis/${id}/unflag`, { method: 'POST' });
    loadAll();
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;
  if (forbidden) return <main style={{ padding: 24 }}>Admin access required.</main>;

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 1000 }}>
      <p>
        <a href="/dashboard">Dashboard</a>
      </p>
      <h1>Admin panel</h1>

      {/* ---------------- Monitoring ---------------- */}
      <section style={{ marginBottom: 32 }}>
        <h2>Monitoring</h2>
        {monitoring && (
          <>
            <div style={{ display: 'flex', gap: 24, background: '#f4f4f4', color: '#111', padding: 12, marginBottom: 8 }}>
              <div>
                <strong>{monitoring.active_apis}</strong>
                <div>active APIs</div>
              </div>
              <div>
                <strong>{(monitoring.failure_rate * 100).toFixed(1)}%</strong>
                <div>failure rate (1h)</div>
              </div>
              <div>
                <strong>{monitoring.avg_response_time_ms}ms</strong>
                <div>avg response (5m)</div>
              </div>
              <div>
                <strong>
                  {monitoring.chrome_pool_in_use}/{monitoring.chrome_pool_max}
                </strong>
                <div>chrome pool (this process)</div>
              </div>
              <div>
                <strong>{monitoring.queue_depth}</strong>
                <div>queue depth</div>
              </div>
            </div>
            {monitoring.alerts.length === 0 && <p>No alerts.</p>}
            {monitoring.alerts.map((a, i) => (
              <p key={i} style={a.level === 'warning' ? { color: '#8a6d00' } : undefined}>
                [{a.level}] {a.message}
              </p>
            ))}
          </>
        )}
      </section>

      {/* ---------------- Payment confirmation ---------------- */}
      <section style={{ marginBottom: 32 }}>
        <h2>Pending payments</h2>
        {creditPurchases.length === 0 && <p>No pending payments.</p>}
        {creditPurchases.length > 0 && (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>User</th>
                <th style={{ textAlign: 'left' }}>Amount (BDT)</th>
                <th style={{ textAlign: 'left' }}>bKash reference</th>
                <th style={{ textAlign: 'left' }}>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {creditPurchases.map((p) => (
                <tr key={p.id}>
                  <td>{p.user_email}</td>
                  <td>{p.amount_bdt}</td>
                  <td>{p.payment_reference}</td>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td>
                    <button onClick={() => confirmPayment(p.id)}>Confirm</button>{' '}
                    <button onClick={() => rejectPayment(p.id)}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ---------------- Disputes ---------------- */}
      <section style={{ marginBottom: 32 }}>
        <h2>Open disputes</h2>
        {disputes.length === 0 && <p>No open disputes.</p>}
        {disputes.map((d) => (
          <div key={d.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 8 }}>
            <p>
              <strong>{d.api_name}</strong> · buyer {d.buyer_email}
            </p>
            <p>Reason: {d.reason}</p>
            <button onClick={() => testDispute(d.id)}>Run the API now</button>
            {d.test_result != null && (
              <pre style={{ background: '#f4f4f4', color: '#111', padding: 8, overflowX: 'auto' }}>
                {JSON.stringify(d.test_result, null, 2)}
              </pre>
            )}
            <div style={{ marginTop: 8 }}>
              <input
                placeholder="admin notes"
                value={resolveNotes[d.id] || ''}
                onChange={(e) => setResolveNotes((s) => ({ ...s, [d.id]: e.target.value }))}
                style={{ width: '60%' }}
              />{' '}
              <label>
                <input
                  type="checkbox"
                  checked={!!resolveFlag[d.id]}
                  onChange={(e) => setResolveFlag((s) => ({ ...s, [d.id]: e.target.checked }))}
                />{' '}
                warn creator
              </label>
            </div>
            <div style={{ marginTop: 4 }}>
              <button onClick={() => resolveDispute(d.id, 'refunded_50')}>Refund 50% (genuine failure)</button>{' '}
              <button onClick={() => resolveDispute(d.id, 'refunded_100')}>Refund 100% (fake listing)</button>{' '}
              <button onClick={() => resolveDispute(d.id, 'denied')}>Deny</button>
            </div>
          </div>
        ))}
      </section>

      {/* ---------------- Creators ---------------- */}
      <section style={{ marginBottom: 32 }}>
        <h2>Creators</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Email</th>
              <th style={{ textAlign: 'left' }}>APIs</th>
              <th style={{ textAlign: 'left' }}>Moderation</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {creators.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.email} {c.is_admin && '(admin)'}
                </td>
                <td>{c.api_count}</td>
                <td>{c.moderation_status}</td>
                <td>
                  <button onClick={() => moderate(c.id, 'warning')}>Warn</button>{' '}
                  <button onClick={() => moderate(c.id, 'final_warning')}>Final warning</button>{' '}
                  <button onClick={() => moderate(c.id, 'banned')}>Ban</button>{' '}
                  <button onClick={() => moderate(c.id, 'reinstate')}>Reinstate</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---------------- APIs ---------------- */}
      <section>
        <h2>All APIs</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Creator</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th style={{ textAlign: 'left' }}>Backup</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {apis.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.creator_email}</td>
                <td>{a.status}</td>
                <td>{a.has_backup ? 'yes' : '—'}</td>
                <td>
                  {a.status !== 'flagged' ? (
                    <button onClick={() => flagApi(a.id)}>Flag</button>
                  ) : (
                    <button onClick={() => unflagApi(a.id)}>Unflag</button>
                  )}
                </td>
              </tr>
            ))}
            {apis.length === 0 && (
              <tr>
                <td colSpan={5}>No APIs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
