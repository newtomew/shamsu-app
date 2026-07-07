import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  // For cards that are themselves a link/button target (dashboard, browse
  // grids) — one shared hover treatment instead of every page re-typing the
  // same hover:shadow-none hover:border-ink/20 combo.
  clickable?: boolean;
}

export function Card({ className, clickable, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-white shadow-soft transition-all duration-150',
        clickable && 'hover:shadow-none hover:border-ink/20',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
