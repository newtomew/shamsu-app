'use client';

// Signup — visual pass only; the submit/redirect logic is unchanged from the
// previous version.

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: name || undefined }),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.success) {
      setError(json.error);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-4">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-display text-base font-bold text-white">
          S
        </span>
        <span className="font-display text-xl font-bold tracking-tight text-ink">Shamsu</span>
      </div>

      <Card className="w-full max-w-sm p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Get started</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
          Create your <span className="text-accent">account</span>
        </h1>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <Input label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            label="Password (min 8 characters)"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {error && (
            <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy} className="w-full">
            {busy ? 'Signing up…' : 'Sign up'}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <a href="/login" className="font-medium text-accent hover:text-accent-hover">
          Log in
        </a>
      </p>
    </main>
  );
}
