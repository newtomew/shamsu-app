// Account settings — relocated from the old root page ('/') now that '/'
// is the public marketing landing page. Behavior (mode toggle, extension
// token generation, logout) is unchanged from the previous root page.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUserFromCookieStore, publicUser } from '@/lib/auth';
import AccountPanel from '@/components/AccountPanel';
import { AppShell } from '@/components/AppShell';

export default async function SettingsPage() {
  const user = await getSessionUserFromCookieStore(cookies());

  // Belt-and-suspenders: middleware already redirects unauthenticated
  // visitors to /login, so this should be unreachable without a session.
  if (!user) {
    redirect('/login');
  }

  return (
    <AppShell active="settings" eyebrow="ACCOUNT" title="Settings">
      <AccountPanel user={publicUser(user)} />
    </AppShell>
  );
}
