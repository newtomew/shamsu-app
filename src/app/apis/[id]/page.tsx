'use client';

// API detail page (PRD section 2.4): endpoint + copy, API keys (create/
// revoke, multiple per API), JSON format example, a Test button (simple +
// advanced modes), marketplace listing management (Phase 8), and call
// history. Plain/functional.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ApiKeyRow {
  id: string;
  name: string;
  createdAt: string;
  revokedAt: string | null;
}
interface CallHistoryRow {
  id: string;
  timestamp: string;
  buyer: string;
  status: string;
  latency_ms: number | null;
  error_message: string | null;
  cost_bdt: string | null;
}
interface Variable {
  name: string;
  example?: string;
}
interface ApiDetail {
  id: string;
  name: string;
  status: string;
  replay_mode: string;
  credential_type: string;
  endpoint_url: string;
  variable_schema: { inputs: Variable[] } | null;
  keys: ApiKeyRow[];
  call_history: CallHistoryRow[];
  marketplace: { is_listed: boolean; price?: string; category?: string | null; is_active?: boolean };
  json_format: { example_request: Record<string, string>; example_response: Record<string, string>[] };
}
interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export default function ApiDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const apiId = params.id;

  const [api, setApi] = useState<ApiDetail | null>(null);
  const [copyLabel, setCopyLabel] = useState('Copy');

  const [newKeyName, setNewKeyName] = useState('');
  const [mintedKey, setMintedKey] = useState<string | null>(null);

  const [testMode, setTestMode] = useState<'simple' | 'advanced'>('simple');
  const [simpleValues, setSimpleValues] = useState<Record<string, string>>({});
  const [advancedBody, setAdvancedBody] = useState('{}');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  const [listingPrice, setListingPrice] = useState('');
  const [listingCategory, setListingCategory] = useState('');
  const [listingDescription, setListingDescription] = useState('');
  const [listingPricingModel, setListingPricingModel] = useState('per_call');
  const [listingBusy, setListingBusy] = useState(false);
  const [listingMessage, setListingMessage] = useState<string | null>(null);

  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/apis/${apiId}`);
    const json = await res.json();
    if (json.success) {
      setApi(json.data);
      const initial: Record<string, string> = {};
      for (const v of json.data.variable_schema?.inputs || []) initial[v.name] = v.example || '';
      setSimpleValues(initial);
      setAdvancedBody(JSON.stringify(initial, null, 2));
      if (json.data.marketplace.is_listed) {
        setListingPrice(String(json.data.marketplace.price));
        setListingCategory(json.data.marketplace.category || '');
      }
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiId]);

  function copyEndpoint() {
    if (!api) return;
    navigator.clipboard.writeText(window.location.origin + api.endpoint_url).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy'), 1500);
    });
  }

  async function createKey() {
    const res = await fetch(`/api/apis/${apiId}/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName || 'unnamed' }),
    });
    const json = await res.json();
    if (json.success) {
      setMintedKey(json.data.api_key);
      setNewKeyName('');
      load();
    }
  }

  async function revokeKey(keyId: string) {
    await fetch(`/api/apis/${apiId}/keys/${keyId}/revoke`, { method: 'POST' });
    load();
  }

  async function runTest() {
    setTestBusy(true);
    setTestResult(null);
    const body = testMode === 'simple' ? simpleValues : JSON.parse(advancedBody || '{}');
    const res = await fetch(`/api/apis/${apiId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setTestBusy(false);
    setTestResult(json);
    load(); // refresh call history to include this test run
  }

  async function saveListing() {
    setListingBusy(true);
    setListingMessage(null);
    const res = await fetch(`/api/apis/${apiId}/marketplace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: Number(listingPrice),
        category: listingCategory,
        description: listingDescription || api?.name,
        pricing_model: listingPricingModel,
      }),
    });
    const json = await res.json();
    setListingBusy(false);
    setListingMessage(json.success ? 'Listing saved.' : json.error);
    if (json.success) load();
  }

  async function unlist() {
    await fetch(`/api/apis/${apiId}/marketplace`, { method: 'DELETE' });
    load();
  }

  async function deleteApi() {
    if (!confirm('Delete this API? An encrypted backup is kept and buyers will be notified.')) return;
    setDeleteBusy(true);
    const res = await fetch(`/api/apis/${apiId}`, { method: 'DELETE' });
    const json = await res.json();
    setDeleteBusy(false);
    if (json.success) {
      alert(`Deleted. ${json.data.notified_buyer_count} buyer(s) notified.`);
      router.push('/dashboard');
    }
  }

  if (!api) return <main style={{ padding: 24 }}>Loading…</main>;

  const curlPreview = `curl -X POST ${typeof window !== 'undefined' ? window.location.origin : ''}${api.endpoint_url} \\\n  -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" \\\n  -d '${testMode === 'simple' ? JSON.stringify(simpleValues) : advancedBody}'`;

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <p>
        <a href="/dashboard">← Dashboard</a>
      </p>
      <h1>{api.name}</h1>
      <p>
        {api.status} · {api.replay_mode} · credentials: {api.credential_type}
      </p>

      <section style={{ marginBottom: 24 }}>
        <h2>Endpoint</h2>
        <code>{api.endpoint_url}</code> <button onClick={copyEndpoint}>{copyLabel}</button>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Marketplace listing</h2>
        {api.marketplace.is_listed && (
          <p>
            Currently listed · {api.marketplace.price} BDT · {api.marketplace.category} ·{' '}
            {api.marketplace.is_active ? 'active' : 'inactive'} <button onClick={unlist}>Unlist</button>
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input placeholder="price (BDT)" value={listingPrice} onChange={(e) => setListingPrice(e.target.value)} style={{ width: 100 }} />
          <input placeholder="category" value={listingCategory} onChange={(e) => setListingCategory(e.target.value)} />
          <select value={listingPricingModel} onChange={(e) => setListingPricingModel(e.target.value)}>
            <option value="per_call">per_call</option>
            <option value="subscription">subscription</option>
          </select>
        </div>
        <textarea
          placeholder="description"
          value={listingDescription}
          onChange={(e) => setListingDescription(e.target.value)}
          rows={2}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <button onClick={saveListing} disabled={listingBusy}>
          {listingBusy ? 'Saving…' : api.marketplace.is_listed ? 'Update listing' : 'List on marketplace'}
        </button>
        {listingMessage && <p>{listingMessage}</p>}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>JSON format</h2>
        <p>Example request:</p>
        <pre style={{ background: '#f4f4f4', padding: 8, color: '#111' }}>{JSON.stringify(api.json_format.example_request, null, 2)}</pre>
        <p>Example response:</p>
        <pre style={{ background: '#f4f4f4', padding: 8, color: '#111' }}>{JSON.stringify(api.json_format.example_response, null, 2)}</pre>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>API keys</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Name</th>
              <th style={{ textAlign: 'left' }}>Created</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {api.keys.map((k) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td>{new Date(k.createdAt).toLocaleString()}</td>
                <td>{k.revokedAt ? `revoked ${new Date(k.revokedAt).toLocaleDateString()}` : 'active'}</td>
                <td>
                  {!k.revokedAt && <button onClick={() => revokeKey(k.id)}>Revoke</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <input placeholder="key name (e.g. testing)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />{' '}
        <button onClick={createKey}>+ Create key</button>
        {mintedKey && (
          <p style={{ background: '#fff3cd', padding: 8, marginTop: 8, color: '#111' }}>
            New key (shown once — save it now): <code>{mintedKey}</code>
          </p>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Test</h2>
        <div style={{ marginBottom: 8 }}>
          <label>
            <input type="radio" checked={testMode === 'simple'} onChange={() => setTestMode('simple')} /> Simple
          </label>{' '}
          <label>
            <input type="radio" checked={testMode === 'advanced'} onChange={() => setTestMode('advanced')} /> Advanced
          </label>
        </div>

        {testMode === 'simple' ? (
          <div>
            {(api.variable_schema?.inputs || []).map((v) => (
              <div key={v.name} style={{ marginBottom: 4 }}>
                <label>
                  {v.name}:{' '}
                  <input
                    value={simpleValues[v.name] ?? ''}
                    onChange={(e) => setSimpleValues((s) => ({ ...s, [v.name]: e.target.value }))}
                  />
                </label>
              </div>
            ))}
            {(api.variable_schema?.inputs || []).length === 0 && <p>This API takes no variables.</p>}
          </div>
        ) : (
          <textarea
            value={advancedBody}
            onChange={(e) => setAdvancedBody(e.target.value)}
            rows={6}
            style={{ width: '100%', fontFamily: 'monospace' }}
          />
        )}

        <p>
          <strong>Equivalent curl</strong> (replace YOUR_KEY with a real key from above):
        </p>
        <pre style={{ background: '#f4f4f4', padding: 8, overflowX: 'auto', color: '#111' }}>{curlPreview}</pre>

        <button onClick={runTest} disabled={testBusy}>
          {testBusy ? 'Running…' : 'Run'}
        </button>

        {testResult && (
          <div style={{ marginTop: 12 }}>
            {testResult.success ? (
              <pre style={{ background: '#e6ffed', padding: 8, color: '#111' }}>{JSON.stringify(testResult.data, null, 2)}</pre>
            ) : (
              <div style={{ background: '#ffe6e6', padding: 8, color: '#111' }}>
                <p>
                  <strong>Error:</strong> {testResult.error} {testResult.code && `(${testResult.code})`}
                </p>
                {testResult.details && <pre>{JSON.stringify(testResult.details, null, 2)}</pre>}
              </div>
            )}
            <pre style={{ background: '#f4f4f4', padding: 8, color: '#111' }}>meta: {JSON.stringify(testResult.meta, null, 2)}</pre>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Call history</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Timestamp</th>
              <th style={{ textAlign: 'left' }}>Buyer</th>
              <th style={{ textAlign: 'left' }}>Status</th>
              <th style={{ textAlign: 'left' }}>Latency (ms)</th>
              <th style={{ textAlign: 'left' }}>Cost (BDT)</th>
              <th style={{ textAlign: 'left' }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {api.call_history.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.timestamp).toLocaleString()}</td>
                <td>{c.buyer}</td>
                <td>{c.status}</td>
                <td>{c.latency_ms ?? '—'}</td>
                <td>{c.cost_bdt ?? '—'}</td>
                <td>{c.error_message ?? ''}</td>
              </tr>
            ))}
            {api.call_history.length === 0 && (
              <tr>
                <td colSpan={6}>No calls yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Danger zone</h2>
        <button onClick={deleteApi} disabled={deleteBusy || api.status === 'deleted'}>
          {api.status === 'deleted' ? 'Already deleted' : deleteBusy ? 'Deleting…' : 'Delete this API'}
        </button>
      </section>
    </main>
  );
}
