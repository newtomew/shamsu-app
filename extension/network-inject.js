// network-inject.js — runs in the PAGE's own JS context ("MAIN" world), not
// the content script's isolated world. This is the only place that can see
// fetch/XHR request bodies AND response bodies directly (chrome.webRequest
// exposes headers but never bodies). It never touches the DOM or page
// behavior beyond wrapping these two functions transparently, and always
// calls through to the real implementation — recording must never change
// how the page behaves.
//
// Present on every http(s) page (a content script "world":"MAIN" entry has
// to be, to be available at all — Chrome content scripts can't be injected
// on demand into arbitrary future navigations without broad host
// permissions we don't want to lean on more than this). But it stays
// INERT — the wrapping below never posts anything anywhere — until
// content.js (which DOES check with background.js whether this tab is
// actually being recorded) sends an explicit 'activate' signal. No data
// ever leaves an unrecorded page.

(() => {
  if (window.__shamsuRecorderInjected) return;
  window.__shamsuRecorderInjected = true;

  let active = false;
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.__shamsuRecorderControl === 'activate') active = true;
  });

  function post(payload) {
    if (!active) return;
    window.postMessage({ __shamsuRecorder: true, kind: 'network', payload }, '*');
  }

  function looksLikeJson(contentType, text) {
    if (contentType && contentType.includes('json')) return true;
    if (!text) return false;
    const t = text.trim();
    if (!(t.startsWith('{') || t.startsWith('['))) return false;
    try {
      JSON.parse(t);
      return true;
    } catch {
      return false;
    }
  }

  // ---------- fetch ----------
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : input?.url || String(input);
    const method = (init?.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    let headers = {};
    try {
      const h = init?.headers || (typeof input === 'object' && input.headers);
      if (h) headers = Object.fromEntries(new Headers(h).entries());
    } catch {
      /* best effort */
    }
    const body = init?.body && typeof init.body === 'string' ? init.body : undefined;

    const response = await originalFetch.apply(this, args);

    if (active) {
      // Clone so the page's own code can still read the original response body.
      response
        .clone()
        .text()
        .then((text) => {
          const contentType = response.headers.get('content-type') || '';
          const isJson = looksLikeJson(contentType, text);
          let parsed;
          if (isJson) {
            try {
              parsed = JSON.parse(text);
            } catch {
              /* fall through to raw text */
            }
          }
          post({
            url,
            method,
            headers,
            body,
            status: response.status,
            response: parsed !== undefined ? parsed : text,
            isJson,
          });
        })
        .catch(() => {});
    }

    return response;
  };

  // ---------- XMLHttpRequest ----------
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__shamsuMethod = (method || 'GET').toUpperCase();
    this.__shamsuUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (active) {
      this.addEventListener('load', () => {
        try {
          const contentType = this.getResponseHeader('content-type') || '';
          const text = this.responseText;
          const isJson = looksLikeJson(contentType, text);
          let parsed;
          if (isJson) {
            try {
              parsed = JSON.parse(text);
            } catch {
              /* fall through */
            }
          }
          post({
            url: this.__shamsuUrl,
            method: this.__shamsuMethod,
            headers: {},
            body: typeof body === 'string' ? body : undefined,
            status: this.status,
            response: parsed !== undefined ? parsed : text,
            isJson,
          });
        } catch {
          /* never let capture break the page's own XHR handling */
        }
      });
    }
    return originalSend.call(this, body);
  };
})();
