'use client';

import { cn } from '@/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onChange, label, disabled, id }: SwitchProps) {
  return (
    <label htmlFor={id} className={cn('inline-flex items-center gap-2.5', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-10 flex-none rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-page',
          checked ? 'bg-accent' : 'bg-border'
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform',
            checked && 'translate-x-4'
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
    </label>
  );
}
