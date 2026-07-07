import { TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={cn(
          'rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus:border-accent',
          error && 'border-danger focus:border-danger focus-visible:ring-danger/30',
          className
        )}
        aria-invalid={!!error}
        {...rest}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});
