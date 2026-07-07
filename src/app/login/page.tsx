'use client';

// Login — visual pass only; the submit/redirect logic is unchanged from the
// previous version.

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error);
        return;
      }
      router.push(searchParams.get('next') || '/');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
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
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Welcome back</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Log in</h1>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && (
            <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy} className="w-full">
            {busy ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-sm text-muted">
        No account?{' '}
        <a href="/signup" className="font-medium text-accent hover:text-accent-hover">
          Sign up
        </a>
      </p>
    </main>
  );
}
