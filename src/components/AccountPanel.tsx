'use client';

// Minimal, unstyled account panel — logout + mode toggle. A real dashboard
// UI lands in a later pass; this just makes login state and the mode toggle
// visible/testable in the browser for Phase 3.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PublicUser } from '@/lib/auth';

export default function AccountPanel({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [mode, setMode] = useState(user.mode);
  const [busy, setBusy] = useState(false);
  const [extensionToken, setExtensionToken] = useState<string | null>(null);

  async function generateExtensionToken() {
    setBusy(true);
    const res = await fetch('/api/auth/extension-token', { method: 'POST' });
    const json = await res.json();
    setBusy(false);
    if (json.success) setExtensionToken(json.data.token);
  }

  async function logout() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function switchMode(next: string) {
    setBusy(true);
    const res = await fetch('/api/auth/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: next }),
    });
    const json = await res.json();
    if (json.success) setMode(json.data.mode);
    setBusy(false);
  }

  return (
    <div>
      <p>
        Logged in as <strong>{user.email}</strong>
        {user.name ? ` (${user.name})` : ''}
      </p>
      <p>Credits balance: {user.api_credits_balance}</p>
      <p>
        Mode: <strong>{mode}</strong>{' '}
        <button disabled={busy || mode === 'non-tech'} onClick={() => switchMode('non-tech')}>
          non-tech
        </button>{' '}
        <button disabled={busy || mode === 'developer'} onClick={() => switchMode('developer')}>
          developer
        </button>
      </p>
      <button disabled={busy} onClick={logout}>
        Log out
      </button>

      <div style={{ marginTop: 16 }}>
        <p>Chrome extension token (paste into the extension popup — shown once):</p>
        <button disabled={busy} onClick={generateExtensionToken}>
          Generate extension token
        </button>
        {extensionToken && (
          <p style={{ background: '#fff3cd', color: '#111', padding: 8, marginTop: 8, wordBreak: 'break-all' }}>
            <code>{extensionToken}</code>
          </p>
        )}
      </div>
    </div>
  );
}
