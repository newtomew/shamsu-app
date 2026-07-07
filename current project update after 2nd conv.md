# Shamsu — Current Project Update (after 2nd conversation)

_Written 2026-07-07. Plain-language status report — read this before deciding what to do next._

---

## 1. What's done

- **The full MVP loop works, end to end, verified live**: record a browser flow with the Chrome extension → Claude-assisted confirmation screen → activate → get a real callable API endpoint + key → call it and get real data back. Tested repeatedly this session against real endpoints, not mocks.
- **Every screen in the app has been redesigned with a real, consistent design system** — not raw HTML anymore. This covers: landing page, first-run onboarding, the confirmation editor (`/apis/[id]/confirm` — "the heart of the product"), creator dashboard (`/dashboard`) and API detail (`/apis/[id]`), marketplace browse + listing detail + buyer dashboard (`/marketplace`, `/marketplace/[id]`, `/purchases`, `/purchases/[apiId]`), billing (`/billing`), admin panel (`/admin`), and analytics (`/analytics`).
- **A full polish pass was done across the whole app**: consistent components everywhere, loading/empty/error states on every data screen (no more infinite spinners on a failed request), hover/press micro-interactions, plain-language copy (no raw enum values like `network_replay` shown to users), and a fixed real bug in the marketplace's popularity sorting.
- **The Chrome extension** (lives in a separate folder, `../extension/`, outside this project's git history) works: record → auto-opens the confirmation tab → activate → call, with a redesigned popup UI matching the app's look.
- **Marketplace and buyer flows are verified live**: browsing, filtering, search, buying, and a buyer's own usage/test panel were all tested with two real listings. Buyers never see the recorded flow or other buyers' data — that privacy rule is enforced in the code, not just the UI.
- **Deployment is prepared and ready to use**: a `Dockerfile` was written (handles installing headless Chrome automatically), the app is configured to build in "standalone" mode for a lean deploy, and a missing step that would have broken any fresh install (`prisma generate` not running automatically) was found and fixed.
- **Two reference documents exist for you and any future conversation to pick up from**:
  - [`BUILD_STATE.md`](BUILD_STATE.md) — full technical state, commit history, what's rough, architecture snapshot
  - [`DEPLOY.md`](DEPLOY.md) — plain-language, step-by-step deployment guide for Railway
- **All of the above is committed to git.** Current commit history:
  ```
  bc971ba  Deploy prep: Dockerfile (Playwright + Prisma), standalone output, postinstall
  7ee7144  BUILD_STATE: ready for deploy, 5 known rough items deferred to Phase 2
  34f709f  UI: confirmation editor, dashboard/API detail, marketplace, billing/admin, onboarding, and final polish pass
  c45c9a0  UI: design system + landing + initial screens styled
  10b1f8d  Fix classifier: check _isData first, normalize stringified JSON → network_replay
  b7d01d0  Shamsu MVP: core loop working (record → confirm → call)
  f8027c6  Initial commit from Create Next App
  ```

---

## 2. What's not done

- **The app is not live on the internet yet.** Everything above has only ever been tested on your own computer (localhost). No real user besides you has ever touched it.
- **There is no GitHub repository connected to this project**, and **no hosting account (Railway or otherwise) has been set up.** Both are required before a real deploy can happen, and both need to be done by you personally (they require your own accounts/credentials).
- **The admin panel's actual content has never been viewed in a browser.** It's fully built and passes type-checking, but no admin test account exists yet to log in and see the real dashboard, tables, and dispute cards — creating one required a privilege-escalation step that was correctly held back until you explicitly ask for it (see §4).
- **There is no reviews system.** Buyers can't leave star ratings on APIs — the UI honestly shows "No reviews yet" everywhere, but there's no way for anyone to actually submit a review. This is a real feature gap, not just unfinished polish.
- **No accessibility (WCAG/contrast) audit has been run** with an actual tool — color contrast was checked by calculation, not verified with something like axe or Lighthouse.
- **Admin's "creators" and "APIs" lists only support a safety cap** (200 rows max) plus a manual "show more" button — not real pagination. Fine at today's scale, but not built for growth yet.
- **The Chrome extension's popup wasn't included in the final polish pass** — it was styled earlier and works, but didn't get the same later consistency/copy sweep the rest of the app got.
- **A single, unbroken smoke test of the entire flow has not been run since all the UI work finished** — every piece has been tested individually, but not back-to-back in one sitting (record → confirm → call → buy as a second account → admin actions).

---

## 3. What's left (to reach a real closed-beta launch)

In order:

1. Create a GitHub repository and push this code to it.
2. Decide: reuse your existing (test-data-filled) Neon database for production, or create a fresh one.
3. Sign up for Railway, connect the GitHub repo, let it build.
4. Set 6 environment variables in Railway's dashboard (`DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_BKASH_NUMBER`, `PUBLIC_URL`).
5. Generate your Railway domain, set `PUBLIC_URL` to it, redeploy.
6. Create your own admin account on the live site and run the one-line SQL command to make it an admin (see `DEPLOY.md` §3).
7. Run the production smoke test: sign up → record with the extension pointed at production → confirm → activate → call the endpoint → confirm real data comes back.

Full detail for every one of these steps is already written out in [`DEPLOY.md`](DEPLOY.md).

---

## 4. What needs to be done ASAP (before or immediately after launch)

- **Get a real domain / hosting account set up.** Nothing else can happen until Shamsu is reachable on a real URL — this is the single blocking item.
- **Set a real `NEXT_PUBLIC_BKASH_NUMBER`.** Right now this is only a labeled placeholder in your local `.env`. Without your real bKash number, buyers have no way to actually pay you — this quietly breaks the entire monetization loop if forgotten.
- **Create a real admin account and actually view the admin panel once**, so a human confirms the dashboard, dispute tools, and payment-confirmation tools work — not just that the code compiles.
- **Run one full, unbroken smoke test on production** (per §3, step 7) before inviting any real beta users.
- **Decide what to do with the existing test data in your Neon database** (fake accounts, fake APIs like "Bangkok Hotel Search," fake purchases) — either accept it in production or start with a fresh database.

---

## 5. What can be done later (Phase 2 — not launch-blocking)

- **An accessibility (WCAG/contrast) audit** — recommended to do first among the Phase 2 items, since it's the cheapest to run and the kind of gap that's awkward to fix retroactively once real users depend on the app.
- **Real pagination** for admin's creator/API lists — only matters once those lists actually grow past a couple hundred rows.
- **A reviews system** — biggest lift of the three, since it needs a new database write path and new UI, not just hardening existing code. Worth doing once there's real usage to review.
- **A consistency/copy pass on the Chrome extension's popup UI** to match the rest of the polish pass.

(This priority order — accessibility first, then pagination/reviews as usage demands — was the standing recommendation from `BUILD_STATE.md`; it's a recommendation, not a decision that's been locked in.)

---

## 6. Any integrations needed

- **GitHub** — required now, to connect your code to a hosting provider. You need to create this yourself.
- **Railway** (or Render as a backup) — required now, this is where the app will actually run. You need to sign up yourself.
- **Neon** (Postgres database) — already in use for development; a decision is needed on whether to keep using the same one or create a fresh one for production. You already have an account.
- **Anthropic API** (Claude) — already integrated and working (`ANTHROPIC_API_KEY`) for the confirmation-screen classifier. If this key is ever missing, the app doesn't break — it just falls back to simpler rule-based logic instead of Claude's reasoning.
- **bKash** — not a technical/API integration (Shamsu does manual bKash confirmation, not an automated payment gateway), but your real bKash number needs to be added as an environment variable before buyers can pay — see §4.
- **No other third-party integrations exist or are planned** — no Stripe, no OAuth login providers, no email service. Signup/login is self-contained (email + password, JWT sessions).

---

## Bottom line

The product itself — the hard part — is built, styled, and working. What's left is entirely deployment logistics (accounts, environment variables, one smoke test) that only you can do, since they require your own GitHub/Railway/Neon/bKash credentials. Once those are done, Shamsu is genuinely ready for a closed beta.
