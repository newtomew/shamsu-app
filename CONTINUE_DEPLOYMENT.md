# Shamsu — Continue Deployment (start a new chat with this file)

_A complete, self-contained deployment guide. Written so a brand-new Claude Code chat — with no memory of anything before this file — can read it and pick up exactly where things stand, with zero missing context._

---

## 0. How to use this in a new chat

1. Open a new Claude Code session (new terminal tab/window and run `claude`, or "New Chat" if you're using the desktop/web app), in this same project folder (`shamsu-app`).
2. Just say: **"Read CONTINUE_DEPLOYMENT.md and continue the Railway deployment from where it left off."**
3. That's it — no need to paste anything, the new chat can open the file itself.

---

## 1. What this project is

**Shamsu** — a Next.js 14 app that turns a recorded browser flow into a callable API. It also runs a real headless Chrome browser (Playwright) for some of its API-call modes, which is why it needs a container-based host rather than plain serverless hosting.

- **Code:** fully on GitHub, public repo: **https://github.com/newtomew/shamsu-app**
- **Host:** Railway (chosen specifically because it reliably supports Playwright's Chromium — serverless hosts like Vercel do not).

---

## 2. What's already done — don't redo any of this

- ✅ GitHub repo created and fully pushed (local machine and GitHub are byte-for-byte identical). Includes the app, the Chrome extension (`extension/`), the PRD (`docs/`), and all deployment docs.
- ✅ Railway account created, on the **Hobby plan** ($5/mo billing already set up — required because this app needs a persistent container, not the free trial tier).
- ✅ Railway project **`resourceful-ambition`** exists, with a service named **`shamsu-app`** connected to the GitHub repo.
- ✅ **Dockerfile bug fixed and pushed:** the build was failing with `Module not found: Can't resolve '@/generated/prisma/client'`. Root cause: the Docker build's "builder" stage never received the auto-generated Prisma database client. Fixed by adding `RUN npx prisma generate` in the builder stage, right before `npm run build`. This fix is already committed — if you ever see this exact error again, something regressed; otherwise, don't touch the Dockerfile for this reason again.
- ✅ Duplicate/leftover empty Railway project cleanup: there may be a second, empty, harmless project called `trustworthy-trust` sitting in the account with no services in it. It's inert — safe to ignore forever, or delete it anytime via its project Settings → Danger Zone → Delete Project. Not urgent.

---

## 3. ⚠️ Not yet done — secret rotation (do this first, before anything else)

At one point, a screenshot of the local `.env` file was shared in chat, which exposed the real values of `DATABASE_URL` (Neon database password), `JWT_SECRET`, and `ENCRYPTION_KEY` in plain text. `ANTHROPIC_API_KEY` was NOT exposed that time (it was still a placeholder from an *earlier, separate* exposure incident and still needs a first real value).

**All 4 of these need fresh values before deploying for real** — exposed secrets should never be reused, even in a low-stakes pre-launch app:

| Variable | How to get a new value |
|---|---|
| `DATABASE_URL` | Go to console.neon.tech → your project → reset the database password → copy the new full connection string (starts with `postgresql://`) |
| `JWT_SECRET` | Run in Terminal: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `ENCRYPTION_KEY` | Run in Terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | Go to console.anthropic.com/settings/keys → create a new key (starts with `sk-ant-`) |

For each: update the value in **both**
1. the local file `shamsu-app/.env` (open with `open -e "/Users/mdzahidhoshenmasud/Desktop/cse226/shamsu-app/.env"`), replacing the old line, **and**
2. the matching box in Railway's **Variables** tab (inside the `shamsu-app` service, under project `resourceful-ambition`).

Nothing is lost by doing this — there are no real users in production yet.

**Rule going forward: paste real secret values only into the actual `.env` file or Railway's Variables boxes — never into a chat message or a screenshot.** If a secret ever gets shown in chat by accident again, treat it as compromised and rotate it the same way, immediately.

---

## 4. Environment variables — full list

Railway auto-detected these variable *names* from the source code and shows them under "Suggested Variables" with placeholder values. Replace each placeholder with the real value:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | rotated Neon connection string (§3) | |
| `JWT_SECRET` | rotated value (§3) | Signs login sessions |
| `ENCRYPTION_KEY` | rotated value (§3) | Encrypts stored credentials — never rotate again once real users exist |
| `ANTHROPIC_API_KEY` | new key (§3) | If ever unset, the app still works via a simpler rule-based fallback, just without Claude's reasoning |
| `NEXT_PUBLIC_BKASH_NUMBER` | your real bKash number | Not a secret — just a phone number. Without a real value here, buyers can't see how to pay you |
| `PUBLIC_URL` | **leave untouched for now** | Depends on the live domain, which only exists after the first successful deploy (see §6) |

---

## 5. Steps to actually deploy — in order

1. Complete the secret rotation (§3) and update the local `.env` file.
2. In Railway → `resourceful-ambition` project → `shamsu-app` service → **Variables** tab: fill in the real values for `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, and `NEXT_PUBLIC_BKASH_NUMBER`. Leave `PUBLIC_URL` as its placeholder.
3. Click **Add** to save the variables.
4. Go to the **Deployments** tab → click the purple **Deploy** button.
5. Watch the build. It should progress through: installing Chrome (slow, a few minutes, normal) → building the Next.js app → running database migrations automatically on startup.
6. **If it fails:** scroll to the bottom of the build log (that's where the real error usually is), copy or screenshot that section, and share it in the new chat — don't guess at fixes without the exact error text.
7. **If it succeeds:** move to §6.

---

## 6. After a successful deploy — get a live URL

1. In Railway, open the `shamsu-app` service → **Settings** → **Networking** → click **"Generate Domain"**. This gives a free `https://something.up.railway.app` address immediately, with HTTPS already on automatically.
2. Copy that URL.
3. Go back to **Variables** and set:
   ```
   PUBLIC_URL=https://something.up.railway.app
   ```
   This matters because confirmed APIs build their public callable endpoint using this value. Without it, generated endpoint URLs are unreliable in production.
4. Save — this triggers one more redeploy. Let it finish.

---

## 7. Pre-launch checklist

- [ ] All 6 environment variables are set with real (rotated, non-exposed) values.
- [ ] HTTPS is on — just visit the Railway URL; the padlock confirms it. Nothing to configure, Railway does this automatically.
- [ ] **Create a real admin account:**
  1. Sign up for a normal account on the live production URL.
  2. In Neon's SQL editor (console.neon.tech → your project → SQL Editor), run once (replacing the email):
     ```sql
     UPDATE users SET is_admin = true WHERE email = 'your-real-email@example.com';
     ```
  3. Visit `/admin` on production — you should see the dashboard, not "Admin access required."
- [ ] **Run one full production smoke test:**
  1. Sign up on the live site.
  2. Install the Chrome extension, point its **Server URL** at the live `PUBLIC_URL` (not localhost), paste an extension token generated from the account settings page on production.
  3. Record a short flow on any site that clearly returns JSON data.
  4. Confirm the recording on production, review the summary, hit **Activate**.
  5. Call the resulting live endpoint (via "Test it now" or the generated `curl` command). **You should get real data back**, not an error.
  6. If that works, the core product is proven live — everything else (billing, admin, marketplace) is supporting infrastructure around that one proof point.

---

## 8. Known limitations for whoever picks this up (human or Claude)

- **Claude cannot reliably drive the Railway CLI directly** — its sandboxed environment has an unreliable network path to Railway's backend API (confirmed across several attempts; one login even succeeded on the user's end but then timed out on Claude's end during the token exchange). All Railway dashboard actions need to be done by the human, with Claude guiding step-by-step and reading back screenshots/logs.
- There is no branching/PR workflow on this repo — it has always had a single `main` branch, matching how the whole project has been built (direct commits, direct pushes). Railway deploys directly from `main`. Don't introduce feature branches unless explicitly asked.
- Other reference docs already in this repo, if broader context is ever needed beyond deployment: `BUILD_STATE.md` (full product/feature state), `DEPLOY.md` (the original, pre-account full guide — now partly superseded by this file), `current project update after 2nd conv.md` (broader project status write-up).
