import { ReactNode } from 'react';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/cn';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  accent?: boolean;
  loading?: boolean;
}

export function StatCard({ label, value, accent, loading }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="text-xs font-mono uppercase tracking-wider text-muted">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div className={cn('mt-1 font-display text-2xl font-bold tracking-tight', accent ? 'text-accent' : 'text-ink')}>
          {value}
        </div>
      )}
    </Card>
  );
}
