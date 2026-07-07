'use client';

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface KeyRevealProps {
  value: string;
  className?: string;
}

function mask(value: string): string {
  if (value.length <= 8) return '•'.repeat(value.length);
  return value.slice(0, 4) + '•'.repeat(Math.min(value.length - 8, 24)) + value.slice(-4);
}

export function KeyReveal({ value, className }: KeyRevealProps) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-border bg-page px-3 py-2 font-mono text-sm text-ink',
        className
      )}
    >
      <span className="select-all">{shown ? value : mask(value)}</span>
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide key' : 'Show key'}
        className="text-muted hover:text-ink"
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button type="button" onClick={copy} aria-label="Copy key" className="text-muted hover:text-ink">
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
