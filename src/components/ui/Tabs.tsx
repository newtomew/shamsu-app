'use client';

import { cn } from '@/lib/cn';

export interface TabItem {
  key: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ items, active, onChange }: TabsProps) {
  return (
    <div role="tablist" className="inline-flex gap-1 rounded-lg border border-border bg-white p-1">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(item.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              isActive ? 'bg-ink text-white' : 'text-muted hover:text-ink'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
