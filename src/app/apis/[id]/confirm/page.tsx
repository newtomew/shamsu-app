'use client';

// Confirmation screen — where a draft recording becomes a live API. Plain,
// unstyled controls for now (a real design pass comes later); the important
// part is the interaction: plain-language summary, editable variables/output
// fields, replay_mode + credential_type choice, and a warn-before-confirm
// loop for contradictory choices.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface DraftVariable {
  name: string;
  example?: string;
  source?: string;
}
interface DraftOutputField {
  name: string;
  path: string;
}
interface RecordedStep {
  type: string;
  selector?: string;
  value?: string;
  [key: string]: unknown;
}
interface Classification {
  replay_mode: string;
  needs_login: boolean;
  variables: DraftVariable[];
  output_fields: DraftOutputField[];
  reason: string;
  plain_summary?: string;
  claude_tokens_used: number;
  _engine: string;
}
interface DraftData {
  id: string;
  name: string;
  status: string;
  replay_mode: string;
  credential_type: string;
  recorded_flow: { steps?: RecordedStep[]; network_requests?: unknown[] };
  variable_schema: { inputs: DraftVariable[] } | null;
  output_schema: { fields: DraftOutputField[] } | null;
  classification: Classification | null;
  created_at: string;
}
interface ConfirmResult {
  endpoint: string;
  api_key: string;
  how_to_call: string;
  replay_mode: string;
  credential_type: string;
  warnings: string[];
}

const REPLAY_MODES = ['network_replay', 'hybrid', 'browser_replay'];
const CREDENTIAL_TYPES = ['stored', 'caller-provided', 'prompt-on-call'];

function guessName(selector = ''): string {
  const m = selector.match(/[#.]?([a-zA-Z_][\w-]*)/);
  return (m ? m[1] : 'input').replace(/[-_]/g, '').toLowerCase();
}

export default function ConfirmPage() {
  const params = useParams<{ id: string }>();
  const apiId = params.id;

  const [draft, setDraft] = useState<DraftData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [variables, setVariables] = useState<DraftVariable[]>([]);
  const [candidates, setCandidates] = useState<{ selector: string; value: string }[]>([]);
  const [outputFields, setOutputFields] = useState<DraftOutputField[]>([]);
  const [replayMode, setReplayMode] = useState('browser_replay');
  const [credentialType, setCredentialType] = useState('stored');

  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ConfirmResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/apis/${apiId}`);
      const json = await res.json();
      if (cancelled) return;
      if (!json.success) {
        setLoadError(json.error || 'Failed to load this API.');
        setLoading(false);
        return;
      }
      const d: DraftData = json.data;
      setDraft(d);
      const vars = d.classification?.variables || d.variable_schema?.inputs || [];
      setVariables(vars.map((v) => ({ name: v.name, example: v.example || '', source: v.source })));

      const fillSteps = (d.recorded_flow.steps || []).filter((s) => s.type === 'fill');
      const usedSelectors = new Set(vars.map((v) => v.source).filter(Boolean));
      setCandidates(
        fillSteps
          .filter((s) => !usedSelectors.has(s.selector))
          .map((s) => ({ selector: s.selector || '', value: s.value || '' }))
      );

      const fields = d.classification?.output_fields || d.output_schema?.fields || [];
      setOutputFields(fields.map((f) => ({ name: f.name, path: f.path })));

      setReplayMode(d.replay_mode);
      setCredentialType(d.credential_type || 'stored');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiId]);

  function promoteCandidate(index: number) {
    const c = candidates[index];
    setVariables((v) => [...v, { name: guessName(c.selector), example: c.value, source: c.selector }]);
    setCandidates((cs) => cs.filter((_, i) => i !== index));
  }

  function updateVariable(index: number, patch: Partial<DraftVariable>) {
    setVariables((v) => v.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function removeVariable(index: number) {
    setVariables((v) => v.filter((_, i) => i !== index));
  }
  function addVariable() {
    setVariables((v) => [...v, { name: '', example: '' }]);
  }

  function updateOutputField(index: number, patch: Partial<DraftOutputField>) {
    setOutputFields((f) => f.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function removeOutputField(index: number) {
    setOutputFields((f) => f.filter((_, i) => i !== index));
  }
  function addOutputField() {
    setOutputFields((f) => [...f, { name: '', path: '' }]);
  }

  async function submit(force: boolean) {
    setBusy(true);
    setConfirmError(null);
    const res = await fetch(`/api/apis/${apiId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replay_mode: replayMode, credential_type: credentialType, variables, output_fields: outputFields, force }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.success) {
      setConfirmError(json.error);
      setWarnings(json.warnings || []);
      return;
    }
    setWarnings([]);
    setResult(json.data);
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;
  if (loadError) return <main style={{ padding: 24, color: 'red' }}>{loadError}</main>;
  if (!draft) return null;

  if (result) {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 640 }}>
        <h1>{draft.name} is live</h1>
        {result.warnings.length > 0 && (
          <div style={{ background: '#fff3cd', padding: 12, marginBottom: 12, color: '#111' }}>
            <strong>Confirmed with overridden warnings:</strong>
            <ul>
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <p>
          <strong>Endpoint:</strong> <code>{result.endpoint}</code>
        </p>
        <p>
          <strong>API key</strong> (shown once — save it now): <code>{result.api_key}</code>
        </p>
        <p>
          <strong>Replay mode:</strong> {result.replay_mode} · <strong>Credentials:</strong> {result.credential_type}
        </p>
        <p>
          <strong>Try it:</strong>
        </p>
        <pre style={{ background: '#f4f4f4', padding: 12, overflowX: 'auto', color: '#111' }}>{result.how_to_call}</pre>
      </main>
    );
  }

  if (draft.status !== 'draft') {
    return (
      <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>{draft.name}</h1>
        <p>This API is already active. Its key was shown once at confirmation time.</p>
      </main>
    );
  }

  const needsLogin = draft.classification?.needs_login ?? false;

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720 }}>
      <h1>Confirm: {draft.name}</h1>

      <section style={{ marginBottom: 24 }}>
        <h2>What this API does</h2>
        <p>{draft.classification?.plain_summary || 'No plain-language summary available.'}</p>
        {needsLogin && <p style={{ color: '#8a6d00' }}>This recording appears to require logging in.</p>}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Variables (callers can change these)</h2>
        {variables.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
            <input
              placeholder="name"
              value={v.name}
              onChange={(e) => updateVariable(i, { name: e.target.value })}
              style={{ width: 140 }}
            />
            <input
              placeholder="example value"
              value={v.example || ''}
              onChange={(e) => updateVariable(i, { example: e.target.value })}
              style={{ width: 160 }}
            />
            <span style={{ color: '#888', fontSize: 12 }}>{v.source}</span>
            <button type="button" onClick={() => removeVariable(i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addVariable}>
          + Add variable
        </button>

        {candidates.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p>Other fields filled during recording (not currently variables):</p>
            {candidates.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
                <span>
                  {c.selector} = &quot;{c.value}&quot;
                </span>
                <button type="button" onClick={() => promoteCandidate(i)}>
                  Add as variable
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Output fields (what the API returns)</h2>
        {outputFields.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
            <input
              placeholder="name"
              value={f.name}
              onChange={(e) => updateOutputField(i, { name: e.target.value })}
              style={{ width: 140 }}
            />
            <input
              placeholder="path (e.g. .name)"
              value={f.path}
              onChange={(e) => updateOutputField(i, { path: e.target.value })}
              style={{ width: 160 }}
            />
            <button type="button" onClick={() => removeOutputField(i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addOutputField}>
          + Add output field
        </button>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Replay mode</h2>
        {REPLAY_MODES.map((m) => (
          <label key={m} style={{ display: 'block' }}>
            <input type="radio" name="replay_mode" checked={replayMode === m} onChange={() => setReplayMode(m)} /> {m}
          </label>
        ))}
      </section>

      {needsLogin && (
        <section style={{ marginBottom: 24 }}>
          <h2>Whose credentials should calls use?</h2>
          {CREDENTIAL_TYPES.map((c) => (
            <label key={c} style={{ display: 'block' }}>
              <input
                type="radio"
                name="credential_type"
                checked={credentialType === c}
                onChange={() => setCredentialType(c)}
              />{' '}
              {c}
            </label>
          ))}
        </section>
      )}

      {warnings.length > 0 && (
        <div style={{ background: '#fff3cd', padding: 12, marginBottom: 12, color: '#111' }}>
          <strong>{confirmError}</strong>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <button type="button" disabled={busy} onClick={() => submit(true)}>
            Confirm anyway
          </button>
        </div>
      )}
      {confirmError && warnings.length === 0 && <p style={{ color: 'red' }}>{confirmError}</p>}

      <button type="button" disabled={busy} onClick={() => submit(false)}>
        {busy ? 'Confirming…' : 'Confirm and activate'}
      </button>
    </main>
  );
}
