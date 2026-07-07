# Shamsu — Deployment Status (Railway)

_A focused summary of just the deployment work, written so a new chat can pick up exactly here without re-reading the whole project history. Paste this into a fresh conversation to continue._

---

## 1. Where things stand right now

- **Code:** fully on GitHub at **https://github.com/newtomew/shamsu-app** (public repo, 10 commits, includes the app, the Chrome extension under `extension/`, the PRD under `docs/`, and this deployment history). Local machine and GitHub are confirmed byte-for-byte identical.
- **Host:** Railway, Hobby plan ($5/mo), billing already set up.
- **Railway project:** `resourceful-ambition` (there's also a leftover empty project called `trustworthy-trust` with no services in it — harmless, safe to ignore or delete anytime, not urgent).
- **Railway service:** `shamsu-app`, connected to the GitHub repo, created but **not yet successfully deployed**.

## 2. What's already been fixed (don't redo these)

- **Dockerfile bug (fixed & pushed):** the build was failing with `Module not found: Can't resolve '@/generated/prisma/client'`. Root cause: the Docker build's "builder" stage never received the auto-generated Prisma client code. Fixed by adding `RUN npx prisma generate` in the builder stage, right before `npm run build`. This is already committed and pushed — no action needed.
- **Playwright/Chromium download step:** this occasionally fails or is slow mid-build (was a transient network hiccup once). If it happens again, the fix is just to retry the deploy — it's not a code problem.
- **Two duplicate Railway projects:** happened once during setup confusion. Cleaned up by removing the services from both; only `resourceful-ambition` has an active service now.

## 3. ⚠️ Unfinished — secret rotation (do this before deploying)

The user accidentally shared a screenshot of their local `.env` file in chat, which exposed the real values of:
- `DATABASE_URL` (Neon Postgres password)
- `JWT_SECRET`
- `ENCRYPTION_KEY`

(`ANTHROPIC_API_KEY` was NOT exposed this time — it's still showing an old placeholder from a *previous* similar incident and still needs a fresh value.)

**These 3-4 values must be rotated before going live**, and the exposed screenshot/old values should never be reused:

| Variable | How to get a new value |
|---|---|
| `DATABASE_URL` | Neon dashboard (console.neon.tech) → reset the database password → copy the new full connection string |
| `JWT_SECRET` | Run locally: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `ENCRYPTION_KEY` | Run locally: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys → create a new key |

For each: update the value in **both** the local `.env` file and the matching box in Railway's Variables screen. No real users exist in production yet, so rotating is free — nothing breaks, nobody gets logged out of anything real.

**Rule going forward: never paste real secret values into chat or a screenshot — only into the actual Railway/`.env` fields.**

## 4. Immediate next steps, in order

1. Rotate the 4 values above (§3).
2. Update local `.env` with the new values.
3. In Railway → `resourceful-ambition` → `shamsu-app` service → **Variables** tab: paste in the new (rotated) values for `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`.
4. Fill in `NEXT_PUBLIC_BKASH_NUMBER` with the real bKash number (this one is not a secret, just a phone number — safe to type directly).
5. **Leave `PUBLIC_URL` untouched for now** — its real value depends on the domain Railway generates, which happens *after* a successful deploy.
6. Click **Add** to save the variables.
7. Go to the **Deployments** tab → click **Deploy**.
8. Watch the build. If it fails, get the exact error text/screenshot (from the bottom of the log — that's where the real reason usually is) and diagnose from there.
9. Once it succeeds: go to **Settings → Networking → Generate Domain** to get the live `https://...up.railway.app` address, then set `PUBLIC_URL` to that value and redeploy once more.
10. Then: pre-launch checklist — create a real admin account (sign up normally, then run one SQL command in Neon's SQL editor to set `is_admin = true` for that email), and run one full production smoke test (sign up → record via the extension pointed at the live URL → confirm → activate → call the endpoint → confirm real data comes back).

## 5. Known limitations worth knowing

- Claude (the assistant) **cannot reliably drive Railway directly** from its own environment — its network connection to Railway's backend API is flaky (confirmed after several attempts, one partial success that still failed at the final step). So all Railway dashboard actions need to be done by the human, with Claude guiding step-by-step and reading screenshots/logs.
- Full reference docs already exist in the repo for anything not covered here: `BUILD_STATE.md` (overall product state), `DEPLOY.md` (original full deploy guide), `current project update after 2nd conv.md` (broader project status).
