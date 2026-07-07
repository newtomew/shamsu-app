'use client';

// First-run welcome — shown once, right after signup (see signup/page.tsx's
// redirect). Purely a friendly nudge, not a gate: every step can be skipped,
// and nothing here blocks or persists to the backend — a returning user just
// never lands here again because login redirects straight to /dashboard.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MousePointerClick, CheckCircle2, Zap, Square, Globe } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Steps } from '@/components/ui/Steps';
import { KeyReveal } from '@/components/ui/KeyReveal';
import { InstallExtensionSteps } from '@/components/InstallExtensionSteps';

const STEP_LABELS = ['Install', 'Record', 'Confirm'];

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [showInstall, setShowInstall] = useState(false);

  function skip() {
    router.push('/dashboard');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-display text-base font-bold text-white">
          S
        </span>
        <span className="font-display text-xl font-bold tracking-tight text-ink">Shamsu</span>
      </div>

      <Card className="w-full max-w-lg p-8">
        <div className="flex items-start justify-between gap-4">
          <Steps labels={STEP_LABELS} current={step} />
          <button
            type="button"
            onClick={skip}
            className="mt-0.5 flex-none text-sm font-medium text-muted hover:text-ink"
          >
            Skip for now
          </button>
        </div>

        <div className="mt-8">
          {step === 0 && (
            <StepInstall
              onContinue={() => setStep(1)}
              onShowInstall={() => setShowInstall(true)}
            />
          )}
          {step === 1 && <StepRecord onContinue={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && <StepConfirm onFinish={() => router.push('/dashboard')} onBack={() => setStep(1)} />}
        </div>
      </Card>

      <Modal open={showInstall} onClose={() => setShowInstall(false)} title="Install the Chrome extension">
        <InstallExtensionSteps />
        <Button className="mt-6 w-full" onClick={() => setShowInstall(false)}>
          Got it
        </Button>
      </Modal>
    </main>
  );
}

function StepInstall({ onContinue, onShowInstall }: { onContinue: () => void; onShowInstall: () => void }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Step 1 of 3</p>
      <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
        Install the Chrome <span className="text-accent">extension</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        Shamsu records your browser flow through a small Chrome extension. Takes about 15 seconds to set up.
      </p>

      <RecordFlowPreview />

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onContinue}>Continue</Button>
        <Button variant="secondary" onClick={onShowInstall}>
          How to install
        </Button>
      </div>
    </div>
  );
}

function StepRecord({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Step 2 of 3</p>
      <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
        Record your <span className="text-accent">first flow</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        Click the Shamsu icon in your toolbar, hit the red Record button, then use any website normally — search,
        click, fill a form, submit. When you're done, hit Stop.
      </p>

      <div className="mt-6 flex items-center gap-4 rounded-xl border border-border bg-page p-5">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-accent text-white shadow-soft">
          <span className="h-3 w-3 rounded-full bg-white" />
        </span>
        <div>
          <p className="font-display text-sm font-bold text-ink">Record</p>
          <p className="font-mono text-xs text-muted">00:14 elapsed</p>
        </div>
        <span className="ml-auto rounded-full bg-ink/5 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-muted">
          Recording…
        </span>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onContinue}>Got it — I&apos;ll record now</Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

function StepConfirm({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Step 3 of 3</p>
      <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
        Get your <span className="text-accent">API</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        The moment you hit Stop, Shamsu opens a confirmation tab automatically. Review what it captured, hit
        Confirm, and you'll have a live endpoint and an API key.
      </p>

      <div className="mt-6 space-y-3 rounded-xl border border-border bg-page p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          We captured your flow
        </div>
        <KeyReveal value="sk_demo0000000000000000EXAMPLE" />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onFinish}>Go to dashboard</Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}

// A tiny illustrative "Record → browse → Stop" storyboard — not a real
// video (none exists yet), just a lightweight animated preview so a
// first-time user knows what to expect before installing anything.
function RecordFlowPreview() {
  const frames = [
    { icon: MousePointerClick, label: 'Click Record' },
    { icon: Globe, label: 'Browse normally' },
    { icon: Square, label: 'Click Stop' },
  ];
  return (
    <div className="mt-6 rounded-xl border border-border bg-page p-5">
      <div className="flex items-center justify-between">
        {frames.map((f, i) => (
          <div key={f.label} className="flex flex-1 flex-col items-center gap-2 text-center">
            <span
              className="flex h-11 w-11 animate-pulse items-center justify-center rounded-full bg-white text-ink shadow-soft"
              style={{ animationDelay: `${i * 0.8}s`, animationDuration: '2.4s' }}
            >
              <f.icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-xs font-medium text-muted">{f.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-widest text-muted">~15 seconds</p>
    </div>
  );
}
