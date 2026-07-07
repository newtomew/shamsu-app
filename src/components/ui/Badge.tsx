import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  danger: 'bg-danger-light text-danger',
  accent: 'bg-accent-light text-accent',
  neutral: 'bg-ink/5 text-muted',
};

// Maps common status strings across the app to a sensible badge color, so
// callers don't have to hand-pick a variant for every status value.
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  active: 'success',
  success: 'success',
  confirmed: 'success',
  draft: 'neutral',
  pending: 'warning',
  warning: 'warning',
  rate_limited: 'warning',
  timeout: 'warning',
  paused: 'warning',
  flagged: 'danger',
  banned: 'danger',
  deleted: 'danger',
  failed: 'danger',
  disputed: 'danger',
  denied: 'danger',
  refunded: 'accent',
};

export function statusToVariant(status: string): BadgeVariant {
  return STATUS_VARIANTS[status] ?? 'neutral';
}

export function Badge({ variant = 'neutral', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide',
        VARIANT_CLASSES[variant]
      )}
    >
      {children}
    </span>
  );
}
