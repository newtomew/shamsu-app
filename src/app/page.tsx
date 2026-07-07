// Root page — public marketing landing page for logged-out visitors.
// Logged-in visitors are sent straight to the dashboard. The old root
// content (account panel: mode toggle, extension token, logout) now lives
// at /settings, linked from the AppShell sidebar.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUserFromCookieStore } from '@/lib/auth';
import { LandingPage } from '@/components/LandingPage';

export default async function Home() {
  const user = await getSessionUserFromCookieStore(cookies());
  if (user) {
    redirect('/dashboard');
  }

  return <LandingPage />;
}
