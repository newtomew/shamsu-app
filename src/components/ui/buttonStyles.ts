// Plain (non-"use client") module so Server Components can call
// buttonClasses() directly — exports from a "use client" file become opaque
// client references when imported into a Server Component, and can only be
// rendered as JSX, not called as functions. Button.tsx imports its variant
// maps from here too, so styling never drifts between the two.

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover focus-visible:ring-accent/40',
  secondary: 'bg-white text-ink border border-border hover:border-ink/30 focus-visible:ring-ink/20',
  ghost: 'bg-transparent text-ink hover:bg-ink/5 focus-visible:ring-ink/20',
  danger: 'bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/40',
};

export const BUTTON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export const BUTTON_BASE_CLASSES =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-page';

// Shares Button's exact variant/size styling with plain <a> tags — for
// cases (page navigation, marketing CTAs) that need button styling but must
// stay a real link rather than a <button>.
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(BUTTON_BASE_CLASSES, BUTTON_VARIANT_CLASSES[variant], BUTTON_SIZE_CLASSES[size], className);
}
