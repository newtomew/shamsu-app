// Prisma client singleton, wired to Neon via the driver adapter (WebSocket
// based). Cached on `globalThis` in dev so Next.js hot-reload doesn't spawn a
// new client (and a new connection pool) on every file change.

import dns from 'node:dns';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// This network resolves some AAAA (IPv6) records for the Neon endpoint that
// time out, while the IPv4 address connects fine — same root cause as the
// ETIMEDOUT seen earlier with plain `pg`. Prefer IPv4 so Node doesn't stall
// on the broken IPv6 route before falling back.
dns.setDefaultResultOrder('ipv4first');

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // At build time (next build), DATABASE_URL is not available since .env is
    // excluded from the Docker build context for security. The app won't
    // actually use the DB during build, so return a no-op client. If DATABASE_URL
    // is truly missing at runtime, the server startup will fail when migrations
    // try to run (see Dockerfile CMD).
    return new PrismaClient();
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
