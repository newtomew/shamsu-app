import { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/cn';

export interface StatCardTrend {
  direction: 'up' | 'down' | 'flat';
  label: string; // e.g. "+12% vs last week"
}

export interface StatCardProps {
  label: string;
  value: ReactNode;
  accent?: boolean;
  loading?: boolean;
  trend?: StatCardTrend;
}

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus };
const TREND_CLASS = { up: 'text-success', down: 'text-danger', flat: 'text-muted' };

export function StatCard({ label, value, accent, loading, trend }: StatCardProps) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  return (
    <Card className="p-5">
      <div className="text-xs font-mono uppercase tracking-wider text-muted">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <span className={cn('font-display text-2xl font-bold tracking-tight', accent ? 'text-accent' : 'text-ink')}>
            {value}
          </span>
          {trend && TrendIcon && (
            <span className={cn('flex items-center gap-0.5 text-xs font-medium', TREND_CLASS[trend.direction])}>
              <TrendIcon className="h-3 w-3" aria-hidden />
              {trend.label}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
