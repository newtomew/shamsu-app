# Shamsu — Deployment Guide (Closed Beta)

Written for a non-technical operator. Follow it top to bottom — every step says what to click and why it matters.

---

## 1. Host recommendation: Railway

Shamsu isn't a normal Next.js app — some API calls (`hybrid` and `browser_replay` modes) launch a **real headless Chrome browser** via Playwright to replay a recorded flow. That rules out plain serverless hosting:

- **Vercel** (the obvious first choice for Next.js) runs your code in short-lived, size-limited serverless functions. Getting a full Chromium browser to run reliably there needs special compressed browser builds and workarounds, and even then it's fragile and easy to break on a routine update. Not recommended for this app.
- What you actually need is a host that runs your app as a **persistent container/server** — like a small permanently-running computer — so Playwright can install and keep a real Chromium binary around.

**Recommendation: Railway.** It's the simplest option that reliably supports this:
- You connect your GitHub repo, it builds automatically on every push.
- It reads the `Dockerfile` in this repo (already added) and builds exactly the environment Playwright needs — you don't need to configure anything for that part.
- Environment variables are set through a simple form in their dashboard, no command line needed.
- HTTPS (the padlock/`https://` in the browser) is automatic, including on your own custom domain later.
- Typical cost for an app this size: **$5–20/month**.

**If Railway ever gives you trouble:** Render is a very close alternative with the same container-based model and a similar dashboard. Everything below applies the same way there, just on a different dashboard.

---

## 2. Step-by-step deploy guide

### Step 2.1 — Push your code to GitHub (if it isn't already)

Railway deploys by connecting to a GitHub repository, so your code needs to live there first.

1. Create a new repository on [github.com](https://github.com) (private is fine).
2. In your terminal, from the `shamsu-app` folder:
   ```
   git remote add origin <the URL GitHub gives you>
   git push -u origin main
   ```

### Step 2.2 — Decide on your production database

You already have a Neon Postgres database from development. You have two honest options:

- **Reuse it.** Your existing test accounts/APIs stay in there. Fine for a genuine closed beta where a bit of test data isn't a problem.
- **Create a fresh Neon project** for a clean slate. Go to [neon.tech](https://neon.tech) → New Project → copy the new connection string it gives you.

Either way, you'll end up with one **connection string** that looks like:
```
postgresql://user:password@host/dbname?sslmode=require
```
Keep this handy — it's your `DATABASE_URL`.

**You do not need to manually run database migrations.** The container automatically applies any pending ones every time it starts (safe — it does nothing if the database is already up to date).

### Step 2.3 — Create the Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project → Deploy from GitHub repo** → pick your Shamsu repository.
3. Railway will detect the `Dockerfile` and start a build automatically. **Let this first build fail or sit — you need to add environment variables before it can actually run.** That's expected, not a problem.

### Step 2.4 — Set environment variables

In your Railway project, open the service → **Variables** tab, and add these one at a time:

| Variable | Value | Where it comes from |
|---|---|---|
| `DATABASE_URL` | your Neon connection string | Step 2.2 |
| `JWT_SECRET` | the same value from your local `.env` | Copy it from your local `shamsu-app/.env` file — **keep it identical**, don't generate a new one, or it won't matter yet since no one's logged in in production, but keep this rule for later: never change it once real users exist, it logs everyone out. |
| `ENCRYPTION_KEY` | the same value from your local `.env` | Same file. **Never rotate this once real encrypted data exists** — it can't be recovered if you lose the original key. |
| `ANTHROPIC_API_KEY` | your real Claude API key | From your Anthropic console. If you skip this, the app still works — it silently falls back to simpler rule-based logic instead of Claude's reasoning. |
| `NEXT_PUBLIC_BKASH_NUMBER` | your real bKash number | **Don't skip this.** Without it, the billing page tells buyers "ask an admin for the number" instead of showing a real number — nobody can actually pay you. |
| `PUBLIC_URL` | your Railway domain, see Step 2.5 | Comes next |

To find your local values: open `shamsu-app/.env` on your computer (not `.env.example`) in any text editor — the real secrets are there.

### Step 2.5 — Get your domain, then set `PUBLIC_URL`

1. In Railway, open your service → **Settings → Networking → Generate Domain**. Railway gives you a free `https://something.up.railway.app` address immediately, HTTPS already on.
2. Copy that URL.
3. Go back to **Variables** and set:
   ```
   PUBLIC_URL=https://something.up.railway.app
   ```
   This matters because whenever an API is confirmed and activated, Shamsu builds its public callable address (e.g. `.../api/v1/{id}/call`) using this value. If it's missing, endpoints get built from whatever internal address the request happened to arrive on, which is unreliable in production.
4. (Optional, later) If you buy a custom domain, add it in **Settings → Networking → Custom Domain**, then update `PUBLIC_URL` to match it.

### Step 2.6 — Deploy

Once all the variables above are set, trigger a new deploy (Railway usually does this automatically the moment you save a variable — if not, there's a **Deploy** button). Watch the build logs:

- You'll see it install Chromium (`playwright install --with-deps chromium`) — this step is slow (a few minutes) the first time. That's expected.
- Then it builds the Next.js app.
- Then on startup, it runs `npx prisma migrate deploy` (applies your database schema) followed by starting the server.

If the build fails, the log will tell you which of those three steps it was on — that's the fastest way to know what to check.

---

## 3. Pre-launch checklist

Go through this in order, on your **real production URL**, not localhost.

- [ ] **All six environment variables from Step 2.4 are set** (check Railway's Variables tab — nothing blank).
- [ ] **HTTPS is on.** Just visit your Railway URL — if the browser shows a padlock and no warning, you're done; Railway handles this automatically, nothing to configure.
- [ ] **Create your admin account.** Sign up for a real account on your production site first (through the normal signup page), then run this once in Neon's SQL editor (neon.tech → your project → SQL Editor), replacing the email with yours:
  ```sql
  UPDATE users SET is_admin = true WHERE email = 'your-real-email@example.com';
  ```
  Then visit `/admin` on production — you should see the dashboard, not "Admin access required."
- [ ] **Run the end-to-end smoke test** (next section) — this is the one that actually proves the app works, not just that it loaded.

### The production smoke test

Do this for real, on the live URL:

1. **Sign up** on your production site with a real (or test) email.
2. **Install the Chrome extension** pointed at production: open the extension popup → set **Server URL** to your Railway `PUBLIC_URL`, not `localhost:3000` → paste an extension token (generate one from your account settings page on production).
3. **Record** a short flow on any public site that returns clean JSON data (e.g. search a site, or hit a page that clearly loads data via an API call).
4. **Confirm** the recording on production — you should land on the confirmation screen, review the plain-language summary, and hit **Activate**.
5. **Call** the resulting live endpoint — either use the confirmation screen's "Test it now" button, or copy the generated `curl` command from the success screen and run it. **You should get real JSON data back**, not an error.
6. **(Optional but recommended)** Add a small amount of test credit to your own account via a bKash request + admin confirmation, then buy your own API from a second test account on the marketplace, and confirm the buyer's own test call also works.

If step 5 returns real data, your core product works in production. That's the bar — everything else (billing, admin, marketplace) is supporting infrastructure around that one proof point.

---

## 4. After launch

Don't fix anything from `BUILD_STATE.md`'s "still rough" list before this first launch — none of it blocks a closed beta. Once real users are in and the smoke test above is green, come back to that list and pick up the one deferred priority (WCAG audit is the standing recommendation) as your first Phase 2 task.
