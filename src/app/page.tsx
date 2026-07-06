// Root page — reached only when logged in (middleware redirects otherwise).
// Deliberately minimal/unstyled per Phase 3 scope; the real dashboard lands
// in a later UI/UX pass.

import { cookies } from 'next/headers';
import { getSessionUserFromCookieStore, publicUser } from '@/lib/auth';
import AccountPanel from '@/components/AccountPanel';

export default async function Home() {
  const user = await getSessionUserFromCookieStore(cookies());

  // Belt-and-suspenders: middleware already redirects unauthenticated
  // visitors to /login, so this should be unreachable without a session.
  if (!user) {
    return <p style={{ padding: 24 }}>Not logged in.</p>;
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 480 }}>
      <h1>Shamsu</h1>
      <p>
        <a href="/dashboard">Dashboard</a> · <a href="/marketplace">Marketplace</a> ·{' '}
        <a href="/purchases">My purchases</a>
      </p>
      <AccountPanel user={publicUser(user)} />
    </main>
  );
}
