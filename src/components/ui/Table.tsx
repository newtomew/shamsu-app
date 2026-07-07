'use client';

import { ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { EmptyState } from './EmptyState';

export interface TableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
}

export function Table<T>({ columns, rows, rowKey, sortKey, sortDir, onSort, emptyMessage }: TableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title="Nothing here yet" description={emptyMessage || 'No rows to show.'} />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white shadow-soft">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                className={cn(
                  'px-4 py-3 text-xs font-mono uppercase tracking-wide text-muted',
                  col.align === 'right' ? 'text-right' : 'text-left',
                  col.sortable && onSort && 'cursor-pointer select-none hover:text-ink'
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-border last:border-0 hover:bg-page/60">
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3 text-ink', col.align === 'right' && 'text-right')}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
