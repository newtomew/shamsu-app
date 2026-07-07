'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Store,
  ShoppingBag,
  CreditCard,
  ShieldCheck,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'analytics', href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: Store },
  { key: 'purchases', href: '/purchases', label: 'My purchases', icon: ShoppingBag },
  { key: 'billing', href: '/billing', label: 'Billing', icon: CreditCard },
  { key: 'admin', href: '/admin', label: 'Admin', icon: ShieldCheck },
];

interface Me {
  email: string;
  mode: string;
}

export interface AppShellProps {
  active: string;
  title: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ active, title, eyebrow, actions, children }: AppShellProps) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/auth/me');
      const json = await res.json();
      if (json.success) setMe(json.data);
    })();
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent font-display text-sm font-bold text-white">
          S
        </span>
        <span className="font-display text-lg font-bold tracking-tight text-ink">Shamsu</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === active;
          return (
            <a
              key={item.key}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-accent-light text-accent' : 'text-muted hover:bg-ink/5 hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-4">
        {me && (
          <a href="/settings" className="mb-2 block rounded-lg px-3 py-1.5 hover:bg-ink/5">
            <p className="truncate text-sm font-medium text-ink">{me.email}</p>
            <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{me.mode}</p>
          </a>
        )}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-white md:block">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-white">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 rounded-md p-1 text-muted hover:bg-ink/5"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-page/90 px-4 py-4 backdrop-blur md:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-ink hover:bg-ink/5 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="font-mono text-xs uppercase tracking-widest text-muted">{eyebrow}</p>}
            <h1 className="truncate font-display text-xl font-bold tracking-tight text-ink">{title}</h1>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>

        <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
