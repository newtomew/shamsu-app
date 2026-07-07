// cn.ts — tiny classname joiner. No conflict-resolution logic (unlike
// tailwind-merge) since this design system's components don't need callers
// to override conflicting utilities — a plain join is enough and keeps the
// dependency footprint at zero.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
