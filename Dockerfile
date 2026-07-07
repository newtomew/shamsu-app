# Dockerfile for Shamsu — a Next.js app that also drives a real headless
# Chrome (Playwright) for the hybrid/browser_replay call paths, so this
# can't just be a plain Node buildpack: Playwright needs its own browser
# binary plus a handful of OS-level libraries to run Chromium at all.
#
# IMPORTANT: uses Debian ("slim"), not Alpine. Playwright's Chromium build
# does not reliably run on Alpine's musl libc — this is a known limitation,
# not a mistake to "optimize" away later.
#
# This intentionally copies the full node_modules into the final image
# rather than hand-picking files out of Next.js's "standalone" trace —
# Prisma 7's migrate CLI needs its own engine binaries at a moment Next.js's
# tracer doesn't see (it's invoked via `npx`, not `require()`d), and
# guessing which files to cherry-pick is exactly the kind of thing that
# "works on my machine" and then silently breaks on a real deploy. A larger
# image that reliably works beats a smaller one that might not.

# ---- deps: install packages once ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- builder: build the Next.js app ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The deps stage already ran `prisma generate` (via npm ci's postinstall), but
# src/generated/prisma is gitignored AND excluded in .dockerignore (so stale
# generated code never leaks into a build from the host machine) — which also
# means it never survives the copy into THIS stage either. Regenerating here,
# now that the full schema + source are present, is what actually makes
# @/generated/prisma/client resolvable for `next build`.
RUN npx prisma generate
# .env is excluded from the build context on purpose (see .dockerignore) so
# real secrets never get baked into an image layer. But src/lib/db.ts creates
# its Prisma client at module load time, and `next build`'s page-data
# collection phase imports that module — so DATABASE_URL alone has to be
# present just for the build to complete, even though nothing actually
# connects to the database yet. Passed in as a one-off build arg, not ENV,
# so it doesn't linger as a runtime default in the final image.
ARG DATABASE_URL
RUN npm run build

# ---- runner: the actual production image ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Playwright's own installer pulls both the Chromium binary AND the correct
# matching set of OS shared libraries (--with-deps) — do this before
# copying app code so Docker can cache this (slow) layer across rebuilds.
RUN npx --yes playwright@1.61.1 install --with-deps chromium

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/src/generated ./src/generated

EXPOSE 3000

# Applies any pending migrations (a no-op if the database is already up to
# date), then starts the server. Safe to run on every boot for a
# single-instance deploy like this one.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
