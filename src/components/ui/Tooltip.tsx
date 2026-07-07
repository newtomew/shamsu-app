'use client';

import { HelpCircle } from 'lucide-react';

export interface TooltipProps {
  text: string;
}

// Pure-CSS tooltip (no JS state) — a focusable/hoverable trigger reveals a
// floating label via group-hover/group-focus-within, so it works with mouse
// and keyboard alike.
export function Tooltip({ text }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="flex text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-full"
        aria-label={text}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-soft transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
