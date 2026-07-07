// content.js — isolated-world content script, present on every http(s) page
// (see manifest.json / network-inject.js for why). The FIRST thing it does
// is ask background.js whether this specific tab is actually being
// recorded right now; if not, it exits immediately and attaches nothing —
// no listeners, no capture, no data collected. Explicit trigger only.

(() => {
  if (window.__shamsuContentActive) return;

  chrome.runtime
    .sendMessage({ type: 'shamsu:checkActive' })
    .then((res) => {
      if (res && res.active) activate();
    })
    .catch(() => {});

  function activate() {
    window.__shamsuContentActive = true;

    // Tell the MAIN-world script (network-inject.js) it's OK to start
    // actually reporting captured requests.
    window.postMessage({ __shamsuRecorderControl: 'activate' }, '*');

    function send(step) {
      chrome.runtime.sendMessage({ type: 'shamsu:step', step }).catch(() => {});
    }
    function sendNetwork(payload) {
      chrome.runtime.sendMessage({ type: 'shamsu:network', payload }).catch(() => {});
    }

    // ---------- selector generation (best-effort, good enough for replay) ----------
    function cssPath(el) {
      if (!el || el.nodeType !== 1) return '';
      if (el.id) return '#' + CSS.escape(el.id);
      if (el.getAttribute && el.getAttribute('name')) {
        return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.getAttribute('name'))}"]`;
      }
      const parts = [];
      let node = el;
      for (let i = 0; i < 4 && node && node.nodeType === 1 && node !== document.body; i++) {
        let part = node.tagName.toLowerCase();
        const cls = (node.className && typeof node.className === 'string' ? node.className : '').trim().split(/\s+/)[0];
        if (cls) part += '.' + CSS.escape(cls);
        const parent = node.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
        parts.unshift(part);
        node = parent;
      }
      return parts.join(' > ');
    }

    function isPasswordField(el) {
      return el && el.tagName === 'INPUT' && el.type === 'password';
    }

    // ---------- DOM interaction capture ----------
    // 'change' (fires on blur / after typing settles) rather than every
    // keystroke — one 'fill' step per field, holding its final value.
    document.addEventListener(
      'change',
      (e) => {
        const el = e.target;
        if (!el || !('value' in el)) return;
        if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return;
        const selector = cssPath(el);
        if (!selector) return;
        const value = isPasswordField(el) ? '{{SHAMSU_LOGIN_PASS}}' : el.value;
        send({ type: 'fill', selector, value });
      },
      true
    );

    document.addEventListener(
      'click',
      (e) => {
        const el = e.target.closest('button, a, input[type=submit], input[type=button], [role=button]');
        if (!el) return;
        const selector = cssPath(el);
        if (!selector) return;
        send({ type: 'click', selector });
      },
      true
    );

    document.addEventListener(
      'submit',
      (e) => {
        const form = e.target;
        const submitter = e.submitter;
        const submitSelector = submitter ? cssPath(submitter) : cssPath(form);
        send({ type: 'submit', submitSelector });
      },
      true
    );

    // ---------- relay network events from the MAIN-world script ----------
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || !data.__shamsuRecorder || data.kind !== 'network') return;
      sendNetwork(data.payload);
    });

    // ---------- navigation ----------
    // Full page loads: background.js already knows (this script re-running
    // via document_start on every navigation IS the signal); this message
    // catches it even if background's own bookkeeping lags.
    chrome.runtime.sendMessage({ type: 'shamsu:navigate', url: location.href }).catch(() => {});

    // SPA client-side routing (pushState/replaceState) never reloads the
    // page, so this content script never re-runs for it — patch history
    // directly to still capture those as 'navigate' steps.
    for (const fn of ['pushState', 'replaceState']) {
      const original = history[fn];
      history[fn] = function (...args) {
        const result = original.apply(this, args);
        chrome.runtime.sendMessage({ type: 'shamsu:navigate', url: location.href }).catch(() => {});
        return result;
      };
    }
    window.addEventListener('popstate', () => {
      chrome.runtime.sendMessage({ type: 'shamsu:navigate', url: location.href }).catch(() => {});
    });
  }
})();
