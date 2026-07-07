# SHAMSU — Product Requirements Document (MVP)

**Version:** 1.0 (MVP build spec)
**Owner:** Md. Zahid Hoshen Masud — Founder, Solvetech Solutions LLC
**Team:** Kopa Shamsu (dev + product)
**Status:** Locked for build. Fields marked `[ASSUMED — confirm during build]` carry sensible defaults.
**LLM:** Claude API · **Automation:** Playwright (Node.js) · **DB:** PostgreSQL

---

## 0. Executive Summary

Shamsu is a browser-based **API factory for non-technical users**. A user records their browser activity (form submissions, data extraction, multi-step flows), confirms *what the API should do* through a Claude-assisted visual editor, and instantly receives a callable **REST API endpoint**. APIs are private by default and can be listed in a peer-to-peer **marketplace** (60/40 creator/Shamsu split).

**Core value prop:** Non-technical creators get powerful custom APIs without writing code. Buyers get cheap, custom APIs as an alternative to expensive SaaS subscriptions.

**Analog:** Apify, but the "actor" is recorded by a non-coder in the browser instead of written by a developer.

---

## 1. User Journey & Core Mechanics

### 1.1 Signup & mode selection
- Email signup → verification → land in dashboard.
- User picks (and can switch **per-API** later) a **mode**:
  - **Non-tech** — visual, simplified UI, friendly error messages.
  - **Developer** — detailed logs, JSON views, advanced step editing.
- Free tier: **5 API creation attempts/day** (successful OR failed — the attempt itself is the unit).
- Optional upgrade to paid credits (see §5).

### 1.2 Recording phase
1. User installs the **Chrome extension** (or uses the web-based recorder).
2. Clicks the large **RED Record button** (explicit trigger — no passive/background logging).
3. Capture (all three simultaneously while recording is active):
   - **XHR/Fetch** network requests (URL, method, headers, body, response)
   - **Form submissions** (POST/GET payloads)
   - **Navigation paths** (URL transitions, clicks)
4. Session limits: **10 min standard**, **30 min max (enterprise)**.
5. A single session can capture a **multi-step flow** (e.g., login → search → filter → submit). The user decides during confirmation whether it becomes one multi-step API or is split.

### 1.3 Confirmation phase — the API Definition Engine (core product loop)
The confirmation step is where the API is **actually defined**, not a cosmetic review.

- **UI style:** Figma/Notion-style — **cards + blocks + drag-drop**, hybrid layout (visual summary left, editable detail panel right). Behaves like a document editor.
- **Claude does, in order:**
  1. Parses the recorded flow and restates it in plain language ("You logged in, searched hotels in Bangkok, filtered by price, submitted.").
  2. **Auto-detects variables** and asks per candidate: *"You entered 'Bangkok' in search. Make this a variable input so callers can search any city?"* → user confirms yes/no.
  3. **Auto-detects output fields** and proposes extraction: *"Return hotel name, price, rating?"* → user approves/edits (free-form JSON allowed).
  4. **Validates logic** — flags contradictions and mutually-exclusive steps; **must ask the user before building anything ambiguous**.
- **Multi-step + branching:** flowchart view with **if/else branches** supported. Linear-list fallback acceptable for MVP if branching proves too heavy.
- User can **add/remove steps, edit captured data, mark variables** during confirmation. A warning appears when edits risk breaking the flow. Not locked once submitted.
- On **Confirm**, the API spec is generated.

### 1.4 API generation output
- **Endpoint:** `https://shamsu.com/api/v1/{api-id}/call` (Shamsu-owned; real REST endpoint)
- **Auth:** API key in header — `Authorization: Bearer {api-key}` (also accepted as query param; both supported)
- **Multiple keys per API** (create/revoke individually — e.g. "production", "testing")
- **JSON format** (example request/response) + **instruction file** (how to use)

### 1.5 Versioning
- Each new recording of the same API creates a **new version**. User can **keep a previous version or overwrite**. Versions retained (`api_versions`).

---

## 2. Dashboard Architecture

Two distinct experiences. **Privacy isolation is enforced**, not cosmetic.

### 2.1 Roles
- **Creator** — owns the recorded flow.
- **Buyer/Caller** — rented/bought a creator's API; cannot alter the endpoint or the flow.

### 2.2 Landing after first API creation
Three CTAs, **equal prominence**: **Test your API** · **Copy endpoint** · **View instructions**.

### 2.3 API display
**Hybrid**: cards for overview + toggle to sortable table for detail.

### 2.4 Creator dashboard
```
├─ Dashboard        : all my APIs (cards/table), quick stats (calls, revenue, active buyers), recent activity
├─ Analytics        : usage over time, top buyers (buyer/calls/revenue), daily earnings breakdown by buyer, error logs (timestamp/buyer/error/status)
├─ My APIs (detail) : endpoint+copy, API keys (multi, revoke), JSON format, test (simple/advanced), marketplace status, call history (timestamp/buyer/status/latency)
├─ Marketplace      : list/manage APIs, edit price/description/SLA
├─ Billing          : buy credits (bKash), balance, cost history
└─ Account          : profile, developer mode (per-API toggle), credential vault
```

### 2.5 Buyer dashboard
```
├─ Dashboard   : APIs I bought (cards/table), quick stats (calls used, credit balance)
├─ My Usage    : MY call history only (timestamp/endpoint/status/latency/cost) + filters
├─ Marketplace : browse & buy (filters: category, price range, rating, popularity)
├─ Billing     : buy credits, spend history
└─ Account     : profile, credential vault
```

### 2.6 Testing interface
- **Simple mode:** input form for variables → Run → JSON response.
- **Advanced mode:** cURL/JS editor, modifiable request.
- **Results:** Buyer sees status + JSON; Creator sees full logs (headers, latency, error stack).

### 2.7 Privacy rules (ENFORCE)
1. Creator sees: all buyers + each buyer's call count + timestamps.
2. Buyer sees: **only their own** call history.
3. Buyer CANNOT see: creator revenue, other buyers' identities, other buyers' call counts.
4. Credentials: user-held (encrypted client-side or third-party vault). Shamsu never stores plaintext.

### 2.8 Marketplace
- **Required listing fields:** name, description, price, category.
- **Optional:** documentation, example request/response, version notes, rate limits, concurrent limits, SLA.
- **Filters:** category, price range, rating, popularity (most-used).
- Buyer gets **endpoint-only** access — **source/recorded flow is never exposed**.
- **Commission:** 60% creator / 40% Shamsu.
- **Ownership & recovery:** if creator deletes an API, Shamsu retains an encrypted backup; buyer can request recovery → new endpoint issued, buyers notified to update integrations.

---

## 3. Technical Architecture

### 3.1 Recording & storage
Store **both** raw network calls **and** interpreted DOM steps.

```json
{
  "api_id": "uuid",
  "recorded_flow": {
    "network_requests": [
      { "url": "...", "method": "POST", "headers": {}, "body": {}, "response": {} }
    ],
    "steps": [
      { "type": "navigate", "url": "..." },
      { "type": "fill", "selector": "...", "value": "..." },
      { "type": "click", "selector": "..." },
      { "type": "submit", "submitSelector": "..." }
    ]
  },
  "variable_schema": { "inputs": [ { "name": "city", "type": "string", "required": true, "default": null } ] },
  "output_schema":   { "fields": [ { "name": "hotel_name", "type": "string", "path": ".hotel_name" } ] },
  "replay_mode": "network_replay | browser_replay | hybrid",
  "credential_type": "stored | caller-provided | prompt-on-call",
  "credentials_encrypted": "aes256(...)"
}
```
- **Retention:** until API deleted.

### 3.2 Replay strategy — routed by `replay_mode` (DECISION LOCKED: classify at record-time, route at call-time)

The single most important architectural decision in the product. It drives infra cost, margins, and pricing tiers simultaneously. **Do NOT default to "always spin up Chrome"** — that destroys unit economics at scale.

Claude tags each API with a `replay_mode` **during confirmation**, based on what the flow does:

| `replay_mode` | When | How replay runs | Cost/Pricing tier |
|---|---|---|---|
| **`network_replay`** | Pure data-extraction; useful payload already lives in a captured XHR/JSON response | Replay the captured HTTP request directly, parse response for output fields. **No browser.** 10–50× cheaper/faster. Survives HTML redesigns. | Light |
| **`browser_replay`** | Form submission, login, any stateful/JS-dependent action (CSRF, cookies, JS validation, anti-bot) | Full Playwright DOM replay with credential injection | Medium/Heavy |
| **`hybrid`** | Authenticated extraction (e.g., "my booking history") | Playwright establishes logged-in session; data pulled from intercepted network response mid-flight | Heavy |

**Phase 2 — `self_heal`:** a `network_replay` API whose stored response signature changes (site broke it) auto-falls-back to `browser_replay` + notifies creator to re-record. Ties into the Part 4 breaking-change auto-detection. **Deferred; do not build for MVP** — but keep the `replay_mode` field extensible.

### 3.3 API call execution flow
```
POST https://shamsu.com/api/v1/{api-id}/call
Authorization: Bearer {api-key}
Content-Type: application/json
{ "city": "Bangkok", "hotel_type": "luxury" }
```
1. Validate API key exists + not revoked.
2. Validate caller credits ≥ cost; enforce rate limit (§3.7) + concurrency.
3. **Deduct cost immediately.**
4. Retrieve recorded flow + variable schema + credentials; branch on `replay_mode`.
5. Execute: navigate → fill (inject variables) → submit → wait for results.
6. Extract output fields (from `output_schema`).
7. Log call; return standard-wrapped JSON; tear down any browser instance.

**Success response (standard wrapper):**
```json
{
  "success": true,
  "data": { "hotels": [ { "name": "Hotel A", "price": 100, "rating": 4.5 } ] },
  "meta": { "execution_time_ms": 3400, "calls_remaining": 950 }
}
```
**Error — non-tech mode:**
```json
{ "success": false, "error": "The website may be temporarily unavailable. Please try again in a minute." }
```
**Error — developer mode:**
```json
{ "success": false, "error": "Login timeout after 30 seconds", "code": "LOGIN_TIMEOUT",
  "details": { "step": 1, "action": "fill_login_form", "suggestion": "Check credentials or site availability" } }
```

### 3.4 Authentication & credentials (3 modes, per API)
1. **`stored`** — creator logs in during confirmation; creds encrypted (AES-256) in Shamsu; all callers get the same data. Configured during confirmation (creator's stored).
2. **`caller-provided`** — caller passes auth at call time; each caller gets their own data ("your booking history").
3. **`prompt-on-call`** — system opens a Chrome window; user logs in manually; session captured; ask "Remember this login?".

**Core rule:** users always authenticate with **their own** credentials. On login failure during replay → **prompt the creator in real time to re-authenticate** (open browser, capture new session).

### 3.5 Output
- Structured JSON only. Claude **auto-detects** likely output fields during confirmation; creator can adjust. Free-form JSON allowed (no forced schema across API types).

### 3.6 Database schema (PostgreSQL — core tables)
> Metering columns on `api_calls` (`step_count`, `execution_time_ms`, `chrome_duration_ms`, `claude_tokens_used`) are **the entire cost** of keeping Phase-2 weighted pricing open. Log them from call #1.

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  mode VARCHAR(16) DEFAULT 'non-tech',           -- 'non-tech' | 'developer'
  api_credits_balance DECIMAL(12,2) DEFAULT 0,
  credential_vault_type VARCHAR(16) DEFAULT 'shamsu', -- 'shamsu' | 'vault-io' | '1password'
  created_at TIMESTAMP DEFAULT NOW()
);

-- APIs (recorded flows)
CREATE TABLE apis (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  endpoint_url VARCHAR(255) NOT NULL,
  status VARCHAR(16) DEFAULT 'active',            -- 'active' | 'paused' | 'deleted'
  recorded_flow JSONB NOT NULL,
  variable_schema JSONB,
  output_schema JSONB,
  replay_mode VARCHAR(24) DEFAULT 'browser_replay', -- 'network_replay' | 'browser_replay' | 'hybrid' | (P2:'self_heal')
  credentials_encrypted TEXT,
  credential_type VARCHAR(24) DEFAULT 'stored',   -- 'stored' | 'caller-provided' | 'prompt-on-call'
  max_execution_time INT DEFAULT 600,             -- seconds (10 min)
  cache_enabled BOOLEAN DEFAULT FALSE,
  cache_duration INT DEFAULT 300,
  rate_limit_per_sec INT DEFAULT 50,
  max_concurrent INT DEFAULT 50,
  current_version INT DEFAULT 1,
  is_latest BOOLEAN DEFAULT TRUE,
  is_listed_in_marketplace BOOLEAN DEFAULT FALSE,
  marketplace_price DECIMAL(12,2),
  marketplace_category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- API versions
CREATE TABLE api_versions (
  id UUID PRIMARY KEY,
  api_id UUID NOT NULL REFERENCES apis(id),
  version_number INT NOT NULL,
  recorded_flow JSONB NOT NULL,
  variable_schema JSONB,
  output_schema JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (api_id, version_number)
);

-- API calls (logs + metering)
CREATE TABLE api_calls (
  id UUID PRIMARY KEY,
  api_id UUID NOT NULL REFERENCES apis(id),
  caller_id UUID NOT NULL REFERENCES users(id),
  request_body JSONB,
  response_data JSONB,
  status VARCHAR(16) DEFAULT 'success',           -- 'success'|'failed'|'timeout'|'rate_limited'
  error_message TEXT,
  latency_ms INT,
  cost_bdt DECIMAL(12,4),
  -- metering (Phase-2 weighted pricing enabler; log from call #1)
  step_count INT,
  execution_time_ms INT,
  chrome_duration_ms INT,
  claude_tokens_used INT,
  timestamp TIMESTAMP DEFAULT NOW()
  -- NOTE: never log credentials or full sensitive request/response bodies in production
);

-- API keys (multiple per API)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  api_id UUID NOT NULL REFERENCES apis(id),
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),                              -- 'production' | 'testing'
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Credentials vault
CREATE TABLE credentials_vault (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  api_id UUID REFERENCES apis(id),
  encrypted_username TEXT,
  encrypted_password TEXT,
  encrypted_auth_token TEXT,
  vault_type VARCHAR(16) DEFAULT 'basic',         -- 'basic'|'oauth'|'bearer-token'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace listings
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY,
  api_id UUID NOT NULL REFERENCES apis(id),
  price DECIMAL(12,2) NOT NULL,
  pricing_model VARCHAR(16) DEFAULT 'per_call',   -- 'per_call' | 'subscription'
  description TEXT,
  category VARCHAR(100),
  documentation TEXT,
  example_request JSONB,
  example_response JSONB,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Marketplace purchases (buyer access)
CREATE TABLE marketplace_purchases (
  id UUID PRIMARY KEY,
  api_id UUID NOT NULL REFERENCES apis(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  purchase_date TIMESTAMP DEFAULT NOW(),
  price_paid DECIMAL(12,2),
  status VARCHAR(16) DEFAULT 'active'             -- 'active'|'refunded'|'disputed'
);

-- Replay queue (async job processing)
CREATE TABLE replay_queue (
  id UUID PRIMARY KEY,
  api_id UUID NOT NULL REFERENCES apis(id),
  caller_id UUID NOT NULL REFERENCES users(id),
  request_body JSONB,
  status VARCHAR(16) DEFAULT 'queued',            -- 'queued'|'processing'|'completed'|'failed'
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 5,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Credit purchases (manual bKash confirmation)
CREATE TABLE credit_purchases (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  amount_bdt DECIMAL(12,2) NOT NULL,
  credits_added INT NOT NULL,
  payment_method VARCHAR(16) DEFAULT 'bkash',     -- 'bkash'|'manual'
  payment_reference VARCHAR(255),                 -- bKash transaction number
  status VARCHAR(16) DEFAULT 'pending',           -- 'pending'|'confirmed'|'failed'
  confirmed_by_admin_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP
);

-- Creator earnings
CREATE TABLE creator_earnings (
  id UUID PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id),
  total_earnings DECIMAL(12,2) DEFAULT 0,
  pending_payout DECIMAL(12,2) DEFAULT 0,
  paid_out DECIMAL(12,2) DEFAULT 0,
  last_payout_date TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3.7 REST API contract (creation + calling)
```
POST /api/v1/recordings              → { api_id, next_step:"confirm_flow" }
POST /api/v1/apis/{api-id}/confirm   → { api_id, endpoint, api_key, status:"active" }
POST /api/v1/{api-id}/call           → { success, data, meta }
```

### 3.8 Infrastructure & limits
- **Automation:** Playwright (Node.js).
- **LLM:** Claude API; latency <3s ideal, graceful fallback >5s.
- **Chrome pool:** autoscale by queue depth; **max 50 concurrent instances per API** (queue beyond).
- **Rate limit:** **50 calls/sec per API** `[ASSUMED — max safe/sec without instability; confirm during load test]`.
- **Execution timeout:** **10 min** per call (configurable per API).
- **Queue depth:** **10,000** pending max → beyond returns HTTP 429.
- **Caching:** creator-controlled per API (on/off, duration; default off for MVP).

---

## 4. Operations & Security

### 4.1 Monitoring & alerts — admin dashboard (Kopa Shamsu team)
Real-time (refresh ~10s): active APIs, APIs >5% failure, avg response time, Chrome pool X/50, queue depth X/10k, uptime.
Logs: failed replays (24h), Chrome crashes, network timeouts, credential-access anomalies.
- **Creator side:** sees own API failure count + timestamps in dashboard.
- **Shamsu side:** detailed logs — which API failed for which buyer, when, why.
- **Alert levels:** Info + Warning only (no Critical).

**Alert rules (Info/Warning):**
| Alert | Condition | Level | Action |
|---|---|---|---|
| API failure rate | >5% in 1h | Warning | monitor; escalate >10% |
| Chrome crash | instance crash | Info | auto-restart + log |
| Response time | >10s avg over 5m | Warning | check queue; scale pool |
| Queue depth | >5,000 pending | Warning | scale pool; reject new at 10k |
| Uptime drop | <99.99% in 1h | Warning | investigate infra |
| Credential anomaly | 1 credential used >100×/min | Warning | check brute-force |

### 4.2 Abuse prevention
- **Rate/quota:** free = 5 creations/day; paid = unlimited creations, per-call pricing; 50 calls/sec/API.
- **Malicious API detection — HYBRID:** automated heuristics (phishing-URL blocklist, password/card extraction, credential-exfil patterns, copy-paste spam, thin listings) **+** community reporting (buyer "Report API") **+** Shamsu team review of flagged APIs. Auto-flagged APIs are held for human review before marketplace publish.
- **Fake listings — buyer-initiated:** buyer disputes non-working API → Shamsu tests endpoint → if fake/broken: refund buyer + flag creator.

### 4.3 Admin panel & operations
- **Payment confirmation (manual bKash):** support sees ticket = user email + **transaction number** + proof; match against bKash receipt; **Confirm** auto-adds credits. Target confirmation window **30–60 min**.
- **Dispute resolution:** buyer opens support ticket → Shamsu **tests API** → if failed, **refund 50%** (acknowledges creator infra cost); handled via customer team, not instant auto-refund. `[Full-refund path for fake listings per §4.2]`
- **Flagging & banning (3-stage):** Warning → Final Warning → Ban. Admin sees lists of: all APIs, all creators, buyers-per-creator. Any creator bannable / any API flaggable.

### 4.4 Credential security
- **Encryption:** AES-256 at rest; bcrypt for auth tokens. Keys held by Shamsu `[acceptable for college-project MVP; revisit for prod]`.
- **Access logs:** every credential use tracked (who/what/when/success-fail).
- **Rotation:** **90-day auto-invalidate** + **60-day reminder email** → creator must re-record with new password; at 90d calls fail until re-recorded. **Notify API creator.**
- **Leak response — optional reset:** email creators that creds may be exposed; recommend password update + re-record; creator's choice (creds were encrypted).

### 4.5 Disaster recovery
- **Recorded-flow backup:** creator can **export flow as JSON** anytime **AND Shamsu keeps an encrypted copy in a library** so access is never lost. On accidental delete → support restores from library → new endpoint issued → buyers notified.
- **Failed mid-execution call:** **charge 50%** of cost (infra was spent); notify creator; caller may retry.
- **Shamsu downtime:** buyers' integrations break (expected dependency); team restores ASAP.

### 4.6 SLAs & performance
- **Uptime target:** 99.99% (~52 min/yr).
- **Response time:** <5s ideal, <10s acceptable, >10s alerts.
- **Queue:** 10k max → HTTP 429 beyond.
- **Graceful degradation:** when degraded → marketplace read-only, API calls queue at higher latency, pause new creations/purchases.

---

## 5. Business Model

### 5.1 Pricing (DECISION LOCKED: Universal-now, Weighted-Tier-at-launch)
- **Free tier:** 5 API creation attempts/day (lead-gen; convert to paid on scale).
- **MVP / closed beta:** **universal flat — 150 BDT / 10,000 calls** (pre-pay credit pool; balance decreases per call). Simple, unblocks the build.
- **Instrument from call #1:** log `step_count`, `execution_time_ms`, `chrome_duration_ms`, `claude_tokens_used` on every `api_calls` row (schema §3.6).
- **Pre-public-launch (Phase 2):** flip to **3-tier weighted pricing**, thresholds set from real beta data:
  - **Light** (`network_replay`, 1–2 steps, <5s): ~150 BDT/10k
  - **Medium** (`browser_replay`, 3–5 steps, 5–30s): ~400 BDT/10k
  - **Heavy** (`browser_replay`/`hybrid`, 6+ steps, login, >30s): ~1,000 BDT/10k
  - Creator sees the computed price **after confirmation** (UI already designed). Tier maps directly to `replay_mode`.
- **Why:** flat-forever loses money on heavy APIs (Chrome + Claude cost). Weighted tiers protect margin per call and scale to high volume without re-architecting billing.

### 5.2 Marketplace economics
- Creators set their own price, choose **per-call** or **monthly subscription** (with call limits).
- **Split:** 60% creator / 40% Shamsu.
- Endpoint-only access; source never exposed; recovery-backed (§2.8, §4.5).

### 5.3 Target user & value prop
- **First segment:** solo online coaches priced out of premium SaaS who need custom APIs.
- **Creator incentive:** no coding/expertise required; Claude-assisted creation; 60% revenue share; flexible pricing.
- **Acquisition** (out of PRD scope → Marketing Plan): email outreach + paid + organic.

---

## 6. MVP Scope Boundary

**IN (MVP):** Chrome extension/web recorder · Claude confirmation (variables + outputs) · multi-step + branching · `replay_mode` routing (network/browser/hybrid) · REST endpoint generation · creator+buyer dashboards · marketplace (list/buy/sell + disputes) · encrypted credential vault · admin panel (payment confirmation, disputes, flagging) · monitoring/alerts · manual bKash + credits · 99.99% uptime target · metering columns logged.

**OUT (Phase 2):** weighted per-API pricing (data collected in MVP) · `self_heal` replay fallback · advanced caching · full compliance/security audit · full KPI/metrics dashboard · roadmap beyond 3 months.

---

## 7. Build Sequence (suggested)
1. Project scaffold — Node.js backend, Next.js frontend, PostgreSQL, Playwright.
2. Chrome extension — record XHR + DOM steps behind explicit RED-button trigger.
3. Recording ingest + storage (`recorded_flow` JSONB, both formats).
4. Claude confirmation flow — variable/output detection, `replay_mode` classification, validation.
5. Replay engine — router (network/browser/hybrid) + credential injection + output extraction.
6. Endpoint generation + key management + credit deduction + rate/concurrency limits.
7. Dashboards — creator + buyer (privacy isolation enforced).
8. Marketplace — listing, purchase, endpoint-only access, dispute + 50% refund.
9. Admin panel — monitoring, payment-confirmation tickets, flagging (3-stage), backup library.
10. Metering + logging → QA → closed beta.

---

## 8. Open Items to Confirm During Build
- `[ASSUMED]` 50 calls/sec/API ceiling — validate via load test.
- `[ASSUMED]` AES-256/Shamsu-held keys acceptable for MVP — revisit before handling real user creds at scale.
- Branching (if/else) in confirmation — ship if feasible; linear-list fallback acceptable for MVP.
- Weighted-tier thresholds — set from beta metering data before public launch.
