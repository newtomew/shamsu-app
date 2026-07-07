// background.js — MV3 service worker. Owns all recording state (a popup can
// be closed at any time in MV3, so it must never be the source of truth).
//
// Recording only ever starts from an explicit user click in the popup.
// content.js/network-inject.js are present on every http(s) page (see
// manifest.json's comment for why), but they stay completely inert unless
// this file tells them, via 'shamsu:checkActive', that THIS SPECIFIC TAB is
// currently being recorded — so nothing is ever captured before Record is
// pressed or after Stop is pressed, on this or any other tab.

const STANDARD_MINUTES = 10;
const MAX_MINUTES = 30;
const ALARM_NAME = 'shamsu-auto-stop';

let recording = {
  active: false,
  tabId: null,
  startedAt: null,
  maxDurationMs: STANDARD_MINUTES * 60_000,
  steps: [],
  networkRequests: [],
  lastResult: null, // { ok, error?, apiId?, confirmUrl? } after the last stop
};

async function persistState() {
  // Mirrored into session storage so a popup reopened after the service
  // worker was briefly suspended can still read `startedAt`/`active` — the
  // timer itself is driven by chrome.alarms, which survives suspension.
  await chrome.storage.session.set({ recording });
}

async function loadConfig() {
  const { serverUrl, token } = await chrome.storage.local.get(['serverUrl', 'token']);
  return { serverUrl: serverUrl || '', token: token || '' };
}

// ---------------------------------------------------------------------------
// Recording lifecycle
// ---------------------------------------------------------------------------
async function startRecording(minutes) {
  if (recording.active) return { ok: false, error: 'Already recording.' };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
    return { ok: false, error: 'Open a regular http(s) page in the active tab first.' };
  }

  const cappedMinutes = Math.min(Math.max(minutes || STANDARD_MINUTES, 1), MAX_MINUTES);
  recording = {
    active: true,
    tabId: tab.id,
    startedAt: Date.now(),
    maxDurationMs: cappedMinutes * 60_000,
    steps: [{ type: 'navigate', url: tab.url }],
    networkRequests: [],
    lastResult: null,
  };
  await persistState();
  await chrome.alarms.create(ALARM_NAME, { when: Date.now() + recording.maxDurationMs });

  return { ok: true };
}

async function stopRecording() {
  if (!recording.active) return { ok: false, error: 'Not recording.' };

  recording.active = false;
  await chrome.alarms.clear(ALARM_NAME);
  await persistState();

  const recordedFlow = buildRecordedFlow(recording.steps, recording.networkRequests);
  const { serverUrl, token } = await loadConfig();

  if (!serverUrl || !token) {
    recording.lastResult = { ok: false, error: 'No server URL / token configured — set them in the popup first.' };
    await persistState();
    return recording.lastResult;
  }

  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/recordings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Recorded ${new Date().toLocaleString()}`, recorded_flow: recordedFlow }),
    });
    const json = await res.json();
    if (!json.success) {
      recording.lastResult = { ok: false, error: json.error || `Server returned ${res.status}` };
      await persistState();
      return recording.lastResult;
    }
    const confirmUrl = `${serverUrl.replace(/\/$/, '')}/apis/${json.data.api_id}/confirm?justRecorded=1`;
    await chrome.tabs.create({ url: confirmUrl });
    recording.lastResult = { ok: true, apiId: json.data.api_id, confirmUrl };
  } catch (e) {
    recording.lastResult = { ok: false, error: `Could not reach ${serverUrl}: ${e.message}` };
  }
  await persistState();
  return recording.lastResult;
}

// ---------------------------------------------------------------------------
// recorded_flow assembly — the exact shape lib/classifier.ts and lib/replay.ts
// expect: { steps: [...], network_requests: [...] }.
// ---------------------------------------------------------------------------
function guessName(selector = '') {
  const m = selector.match(/[#.]?([a-zA-Z_][\w-]*)/);
  return (m ? m[1] : 'input').replace(/[-_]/g, '').toLowerCase();
}

function buildRecordedFlow(steps, networkRequests) {
  // Fill values (real ones, not the masked password placeholder) get turned
  // into {varname} template placeholders inside captured URLs/bodies, using
  // the SAME name the classifier will independently derive from the same
  // selector (lib/classifier.ts guessName) — so replay's variable injection
  // (`{varname}` -> caller's new input) actually lines up. Without this, a
  // recorded call could only ever replay the exact value typed during
  // recording, never a new caller-supplied one.
  const substitutions = steps
    .filter((s) => s.type === 'fill' && s.value && s.value !== '{{SHAMSU_LOGIN_PASS}}')
    .map((s) => ({ value: s.value, varName: guessName(s.selector) }));

  function templatize(text) {
    if (typeof text !== 'string') return text;
    let out = text;
    for (const { value, varName } of substitutions) {
      if (!value) continue;
      out = out.split(value).join(`{${varName}}`);
    }
    return out;
  }

  const network_requests = networkRequests.map((r) => ({
    url: templatize(r.url),
    method: r.method || 'GET',
    headers: r.headers || {},
    body: templatize(r.body),
    response: r.response,
    _isData: !!r.isJson,
  }));

  return { steps, network_requests };
}

// ---------------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    // Messages from content scripts carry sender.tab; from the popup they
    // don't. Only content-script messages are tied to a specific recording.
    const senderTabId = sender.tab?.id;

    switch (msg?.type) {
      case 'shamsu:checkActive': {
        sendResponse({ active: recording.active && senderTabId === recording.tabId });
        break;
      }
      case 'shamsu:getState': {
        sendResponse({ ...recording });
        break;
      }
      case 'shamsu:saveConfig': {
        await chrome.storage.local.set({ serverUrl: msg.serverUrl, token: msg.token });
        sendResponse({ ok: true });
        break;
      }
      case 'shamsu:getConfig': {
        sendResponse(await loadConfig());
        break;
      }
      case 'shamsu:startRecording': {
        sendResponse(await startRecording(msg.minutes));
        break;
      }
      case 'shamsu:stopRecording': {
        sendResponse(await stopRecording());
        break;
      }
      case 'shamsu:step': {
        if (recording.active && senderTabId === recording.tabId) {
          recording.steps.push(msg.step);
          await persistState();
        }
        sendResponse({ ok: true });
        break;
      }
      case 'shamsu:network': {
        if (recording.active && senderTabId === recording.tabId) {
          recording.networkRequests.push(msg.payload);
          await persistState();
        }
        sendResponse({ ok: true });
        break;
      }
      case 'shamsu:navigate': {
        if (recording.active && senderTabId === recording.tabId) {
          const last = recording.steps[recording.steps.length - 1];
          if (!last || last.type !== 'navigate' || last.url !== msg.url) {
            recording.steps.push({ type: 'navigate', url: msg.url });
            await persistState();
          }
        }
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'unknown message type' });
    }
  })();
  return true; // keep the message channel open for the async sendResponse above
});

// Auto-stop at the session limit (10 min standard / up to 30 min), even if
// the popup is closed — chrome.alarms (not setTimeout) survives service
// worker suspension.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) stopRecording();
});

// If the tab being recorded is closed, stop and submit whatever was captured
// rather than silently losing it.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (recording.active && tabId === recording.tabId) stopRecording();
});
