# Shamsu Recorder — Chrome extension (Manifest V3)

Records a browser flow (clicks, form fills, navigation, and the underlying
XHR/fetch traffic) and submits it to your Shamsu server as a draft API.

## How it works, briefly

- `popup.html`/`popup.js` — the UI: server URL + token config, the RED Record
  button, a live timer, Stop.
- `background.js` — the only place recording state lives (a service worker;
  popups get destroyed when closed, so it can't hold state). Starts/stops
  recording, enforces the 10/30-minute session limit via `chrome.alarms`
  (survives the popup closing or the service worker being suspended), builds
  the final `recorded_flow` JSON, and POSTs it to `/api/recordings`.
- `content.js` — present on every http(s) page, but checks with
  `background.js` on load whether *this specific tab* is being recorded. If
  not, it does nothing at all — no listeners, no capture. If yes, it captures
  DOM interactions (fill/click/submit + SPA navigation) and relays network
  events.
- `network-inject.js` — runs in the page's own JS context (not the content
  script's isolated world) because that's the only place fetch/XHR response
  *bodies* are visible at all. Stays inert until `content.js` tells it to
  activate.

## Why it asks for broad host permissions

A single recording session must survive navigating to a new page (e.g.
login → search → results — a core requirement). Chrome's `activeTab`
permission does **not** survive a full-page navigation, only per-page, so a
dynamic-injection design built on it would silently stop capturing after the
first navigation in any multi-page flow. The tradeoff made here: request
`http://*/*` and `https://*/*` so content scripts can be declared statically
and always be present, but keep them functionally inert (no listeners
attached, nothing captured) unless `background.js` confirms recording is
active for that exact tab. The permission is broad; the *behavior* is still
strictly explicit-trigger-only.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` folder.
4. You should see "Shamsu Recorder" appear with no errors. Pin it to the
   toolbar (puzzle-piece icon → pin) for easy access.

## Get a token

1. Make sure `shamsu-app` is running (`npm run dev`, or wherever it's
   deployed) and you're logged in to it in your browser.
2. On the root page (`/`), click **Generate extension token**. Copy the
   token shown — it's only ever shown once.
3. Click the Shamsu Recorder toolbar icon. Enter:
   - **Server URL**: `http://localhost:3000` (or your deployed URL)
   - **Token**: the value you just copied
4. Click **Save**.

## Record a real flow

1. Navigate to a public site with a search box, e.g.
   `https://www.wikipedia.org`.
2. Click the Shamsu Recorder icon, pick a session length (10 or 30 min),
   click **● Record**.
3. Switch back to the page and use it normally: type a search term, submit
   the search, click a result. Every fill/click/submit/navigation and every
   XHR/fetch the page makes is being captured in the background — you won't
   see anything different on the page itself.
4. Click the extension icon again and click **■ Stop**.
5. The extension POSTs the recording to `/api/recordings` and opens
   `/apis/<new-id>/confirm` in a new tab automatically (you need to already
   be logged into Shamsu in your browser for that tab to load — the
   confirmation page uses your normal web session, separate from the
   extension's token).

## See it in your dashboard

Open `/dashboard` (or reload it if already open) — the new API appears as a
`draft` card. Open it and confirm it from the confirmation screen (Phase 5)
to get a live endpoint + key, exactly like a recording submitted via curl in
earlier phases.

## Troubleshooting

- **"Open a regular http(s) page..."** — you clicked Record while a
  `chrome://` or extension page was active; switch to a real website tab
  first.
- **Nothing captured / confirm page shows no variables** — some sites load
  their data via server-rendered HTML, not XHR/fetch, so there's nothing for
  network capture to see. Try a site whose search/results load via an API
  call (most modern sites do).
- **"Could not reach `<server>`"** — check the Server URL in the popup
  matches where `shamsu-app` is actually running, and that it's running.
- **Confirmation tab shows a login page instead of the confirm screen** —
  you're not logged into Shamsu in this browser profile; log in, then
  revisit the confirm URL (also shown, as `confirmUrl`, if you inspect the
  extension's state).
