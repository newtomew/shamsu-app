'use client';

// Single purchase detail (PRD 2.5): endpoint + MY usage only (never another
// buyer's calls), plus a reissue-key action and recovery request if the
// creator deleted the underlying API (PRD 4.5).

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface UsageRow {
  id: string;
  timestamp: string;
  status: string;
  latency_ms: number | null;
  cost_bdt: string | null;
}
interface PurchaseDetail {
  api_id: string;
  name: string;
  api_status: string;
  endpoint: string;
  purchase_status: string;
  usage: UsageRow[];
}

export default function PurchaseDetailPage() {
  const params = useParams<{ apiId: string }>();
  const apiId = params.apiId;

  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [mintedKey, setMintedKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeMessage, setDisputeMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/purchases/${apiId}`);
    const json = await res.json();
    if (json.success) setDetail(json.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  async function reissueKey() {
    const res = await fetch(`/api/purchases/${apiId}/reissue-key`, { method: 'POST' });
    const json = await res.json();
    if (json.success) setMintedKey(json.data.api_key);
  }

  async function requestRecovery() {
    const res = await fetch(`/api/purchases/${apiId}/request-recovery`, { method: 'POST' });
    const json = await res.json();
    setMessage(json.success ? 'Recovery successful — the API is active again.' : json.error);
    if (json.success) load();
  }

  async function fileDispute() {
    const res = await fetch(`/api/purchases/${apiId}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: disputeReason }),
    });
    const json = await res.json();
    setDisputeMessage(json.success ? 'Dispute filed — an admin will review it.' : json.error);
    if (json.success) {
      setDisputeReason('');
      load();
    }
  }

  if (!detail) return <main style={{ padding: 24 }}>Loading…</main>;

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <p>
        <a href="/purchases">← My purchases</a>
      </p>
      <h1>{detail.name}</h1>
      <p>Endpoint: <code>{detail.endpoint}</code></p>
      <p>Purchase status: {detail.purchase_status}</p>

      {detail.api_status === 'deleted' && (
        <div style={{ background: '#ffe6e6', color: '#111', padding: 12, marginBottom: 16 }}>
          <p>This API was deleted by its creator and is currently unavailable.</p>
          <button onClick={requestRecovery}>Request recovery</button>
          {message && <p>{message}</p>}
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <button onClick={reissueKey}>Lost your key? Get a new one</button>
        {mintedKey && (
          <p style={{ background: '#fff3cd', color: '#111', padding: 8, marginTop: 8 }}>
            New key (shown once — save it now): <code>{mintedKey}</code>
          </p>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Not working as expected?</h2>
        {detail.purchase_status === 'disputed' ? (
          <p>Dispute already filed — awaiting admin review.</p>
        ) : (
          <div>
            <input
              placeholder="what's wrong?"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              style={{ width: '60%' }}
            />{' '}
            <button onClick={fileDispute}>File a dispute</button>
            {disputeMessage && <p>{disputeMessage}</p>}
          </div>
        )}
      </section>

      <section>
        <h2>My usage</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Timestamp</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th style={{ textAlign: 'left' }}>Latency (ms)</th>
              <th style={{ textAlign: 'left' }}>Cost (BDT)</th>
            </tr>
          </thead>
          <tbody>
            {detail.usage.map((u) => (
              <tr key={u.id}>
                <td>{new Date(u.timestamp).toLocaleString()}</td>
                <td>{u.status}</td>
                <td>{u.latency_ms ?? '—'}</td>
                <td>{u.cost_bdt ?? '—'}</td>
              </tr>
            ))}
            {detail.usage.length === 0 && (
              <tr>
                <td colSpan={4}>No calls yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
