import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  // 'lg' is for the one big coaching moment per screen (e.g. a first-run
  // dashboard with zero APIs) — same component, more prominent treatment.
  size?: 'sm' | 'lg';
}

export function EmptyState({ title, description, action, icon, size = 'sm' }: EmptyStateProps) {
  const lg = size === 'lg';
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl text-center',
        lg ? 'border border-border bg-white px-6 py-14 shadow-soft' : 'border border-dashed border-border bg-white/60 px-6 py-12'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          lg ? 'h-14 w-14 bg-accent-light text-accent' : 'h-10 w-10 bg-ink/5 text-muted'
        )}
      >
        {icon ?? <Inbox className={lg ? 'h-6 w-6' : 'h-5 w-5'} aria-hidden />}
      </div>
      <div>
        <p className={cn('font-display font-semibold text-ink', lg ? 'text-xl' : 'text-base')}>{title}</p>
        {description && <p className={cn('mt-2 text-sm text-muted', lg && 'mx-auto max-w-sm')}>{description}</p>}
      </div>
      {action}
    </div>
  );
}
