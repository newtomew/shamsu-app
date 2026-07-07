// popup.js — thin UI over background.js's state. The popup can be closed at
// any moment (MV3 tears it down), so it never holds state itself — it just
// asks background for the current state each time it opens and re-renders.

const configView = document.getElementById('configView');
const idleView = document.getElementById('idleView');
const recordingView = document.getElementById('recordingView');

const serverUrlInput = document.getElementById('serverUrl');
const tokenInput = document.getElementById('token');
const configError = document.getElementById('configError');
const lastResultEl = document.getElementById('lastResult');
const timerEl = document.getElementById('timer');

let tickInterval = null;

function fmt(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function showView(name) {
  configView.style.display = name === 'config' ? 'block' : 'none';
  idleView.style.display = name === 'idle' ? 'block' : 'none';
  recordingView.style.display = name === 'recording' ? 'block' : 'none';
}

function renderLastResult(lastResult) {
  if (!lastResult) {
    lastResultEl.innerHTML = '';
    return;
  }
  if (lastResult.ok) {
    lastResultEl.innerHTML = `<div class="success">&#10003; Captured — confirmation tab opened.</div>`;
  } else {
    lastResultEl.innerHTML = `<div class="error">${lastResult.error}</div>`;
  }
}

async function refresh() {
  const config = await chrome.runtime.sendMessage({ type: 'shamsu:getConfig' });
  const state = await chrome.runtime.sendMessage({ type: 'shamsu:getState' });

  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }

  if (state.active) {
    showView('recording');
    const tick = () => {
      const elapsed = Date.now() - state.startedAt;
      const remaining = state.maxDurationMs - elapsed;
      timerEl.textContent = fmt(elapsed) + ' / ' + fmt(state.maxDurationMs);
      if (remaining <= 0) clearInterval(tickInterval);
    };
    tick();
    tickInterval = setInterval(tick, 1000);
    return;
  }

  if (!config.serverUrl || !config.token) {
    showView('config');
    return;
  }

  showView('idle');
  renderLastResult(state.lastResult);
}

document.getElementById('saveConfigBtn').addEventListener('click', async () => {
  const serverUrl = serverUrlInput.value.trim();
  const token = tokenInput.value.trim();
  if (!serverUrl || !token) {
    configError.textContent = 'Both fields are required.';
    configError.style.display = 'block';
    return;
  }
  await chrome.runtime.sendMessage({ type: 'shamsu:saveConfig', serverUrl, token });
  configError.textContent = '';
  configError.style.display = 'none';
  refresh();
});

document.getElementById('editConfigLink').addEventListener('click', async () => {
  const config = await chrome.runtime.sendMessage({ type: 'shamsu:getConfig' });
  serverUrlInput.value = config.serverUrl;
  tokenInput.value = config.token;
  showView('config');
});

document.getElementById('recordBtn').addEventListener('click', async () => {
  const minutes = Number(document.getElementById('sessionLength').value);
  const result = await chrome.runtime.sendMessage({ type: 'shamsu:startRecording', minutes });
  if (!result.ok) {
    lastResultEl.innerHTML = `<div class="error">${result.error}</div>`;
    return;
  }
  refresh();
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  timerEl.textContent = 'Submitting…';
  await chrome.runtime.sendMessage({ type: 'shamsu:stopRecording' });
  refresh();
});

refresh();
