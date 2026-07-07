import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface RatingProps {
  value: number;
  count?: number;
  className?: string;
}

// Simple 5-star display (round to nearest whole star — no half-star
// rendering, kept deliberately plain since there's no review-writing UI
// yet, only the aggregate rating/review_count columns).
export function Rating({ value, count, className }: RatingProps) {
  const full = Math.round(value);
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="flex items-center gap-0.5 text-warning">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn('h-3.5 w-3.5', i <= full ? 'fill-current' : 'fill-none text-border')} aria-hidden />
        ))}
      </span>
      {count !== undefined && (
        <span className="font-mono text-xs text-muted">{count > 0 ? `(${count})` : 'No reviews yet'}</span>
      )}
    </span>
  );
}
