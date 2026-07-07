import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface StepsProps {
  labels: string[];
  current: number; // 0-indexed
}

// Lightweight step/progress indicator for wizards (first-run onboarding,
// confirmation flow). Deliberately simple — dots + connecting bars, no
// internal state — the parent screen owns which step is active.
export function Steps({ labels, current }: StepsProps) {
  return (
    <ol className="flex items-center">
      {labels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-medium transition-colors',
                  done && 'bg-accent text-white',
                  active && !done && 'border-2 border-accent bg-white text-accent',
                  !done && !active && 'border border-border bg-white text-muted'
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-xs font-medium',
                  active || done ? 'text-ink' : 'text-muted'
                )}
              >
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <span
                className={cn('mx-2 mb-5 h-px flex-1 transition-colors', done ? 'bg-accent' : 'bg-border')}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
