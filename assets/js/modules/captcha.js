// Client of the self-hosted captcha: proof of work in the ALTCHA protocol (MIT, altcha.org). No third party, no
// cookies, no widget markup. The server side is api/captcha.js and api/captcha-challenge.js.
//
//   GET /api/captcha-challenge  ->  { configured:true, algorithm, challenge, salt, signature, maxnumber }
//                                   or { configured:false } (CAPTCHA_SECRET empty: nothing is enforced)
//   solve: find n in [0, maxnumber] with hex(sha256(salt + n)) === challenge
//   send:  base64(JSON {algorithm, challenge, number, salt, signature, took}) as the "captcha" field of a POST
//
// That payload is exactly what the official ALTCHA widget produces, so the widget could replace this file.
//
// How it works on a page:
//  * The first focus in a form (not the search box) starts fetching and solving in the background
//    (initCaptchaPrefetch, started when this module loads), so the answer is usually ready before "Send".
//  * postEnquiry (enquiry.js) and email-otp.js call withCaptcha(): it takes the solved payload, waits for it when it
//    is still being solved (the submit button then reads "Checking you are not a bot…") and tries once more with a
//    fresh challenge when the server answers captcha_failed.
//  * One solved payload serves one request: the server accepts each challenge once, so every attempt, including a
//    retry after any error, takes a new one.
//  * Graceful skip: when the server says configured:false, the fetch fails, there is no WebCrypto (an insecure
//    http origin), or the solve takes longer than SOLVE_TIMEOUT_MS, the request goes out without a captcha and the
//    server decides (it only rejects when CAPTCHA_SECRET is set). A slow phone is therefore never stuck on a spinner.
//
// Where the hashing runs: a dedicated Worker loaded from a same-origin file (captcha-worker.js, a classic script),
// so the page never freezes and no `blob:` URL is needed under a strict Content-Security-Policy (`worker-src 'self'`
// is enough; vercel.json sets no CSP today). When a Worker cannot start (very old browser, blocked, an error event),
// the same search runs on the main thread in slices of SLICE_MS, yielding to the browser between slices.
import { setButtonLoading } from './button-loading.js';

export const CAPTCHA_FAILED_CODE = 'captcha_failed';
export const CAPTCHA_FAILED_MESSAGE = 'We could not verify that you are not a bot. Please try again.';
export const CHECKING_LABEL = 'Checking you are not a bot…';

export const CHALLENGE_ENDPOINT = '/api/captcha-challenge';
export const SOLVE_TIMEOUT_MS = 20000;
const FETCH_TIMEOUT_MS = 8000;
const SLICE_MS = 12;
// A solved payload that expires sooner than this is not used: the server would see it as expired by the time it arrives.
const MIN_LIFE_MS = 30000;

const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');

const canSolve = () => typeof fetch === 'function' && typeof globalThis.crypto?.subtle?.digest === 'function';

// ALTCHA payload: base64 of the JSON, ASCII only (hex, digits and the salt's query string).
export function encodePayload({ algorithm, challenge, number, salt, signature, took }) {
  return btoa(JSON.stringify({ algorithm, challenge, number, salt, signature, took }));
}

// Unix seconds from the "?expires=..&" the server puts in the salt; null when there is none.
export function saltExpiry(salt) {
  const query = String(salt).split('?')[1] || '';
  const value = Number(new URLSearchParams(query).get('expires'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Same search as captcha-worker.js, on the calling thread, in slices so the page stays responsive.
async function solveOnMainThread({ salt, challenge, maxnumber }, deadline) {
  const encoder = new TextEncoder();
  let sliceStart = Date.now();
  for (let n = 0; n <= maxnumber; n += 1) {
    if (toHex(await crypto.subtle.digest('SHA-256', encoder.encode(salt + n))) === challenge) return n;
    if (Date.now() - sliceStart >= SLICE_MS) {
      if (Date.now() > deadline) return null;
      await new Promise((resolve) => setTimeout(resolve, 0));
      sliceStart = Date.now();
    }
  }
  return null;
}

// Runs the Worker; resolves with the number, null (no match or timed out) or undefined (the Worker could not run:
// the caller falls back to the main thread). `createWorker` exists for tests.
function solveInWorker(params, timeoutMs, createWorker) {
  return new Promise((resolve) => {
    let worker;
    try {
      worker = createWorker();
    } catch {
      resolve(undefined);
      return;
    }
    if (!worker) {
      resolve(undefined);
      return;
    }
    let timer = null;
    const finish = (value) => {
      clearTimeout(timer);
      try {
        worker.terminate();
      } catch {
        // already gone
      }
      resolve(value);
    };
    timer = setTimeout(() => finish(null), timeoutMs);
    worker.onmessage = (event) => finish(event.data?.error ? undefined : (event.data?.number ?? null));
    worker.onerror = () => finish(undefined);
    try {
      worker.postMessage({ salt: params.salt, challenge: params.challenge, maxnumber: params.maxnumber });
    } catch {
      finish(undefined);
    }
  });
}

const defaultWorker = () => (typeof Worker === 'function' ? new Worker(new URL('./captcha-worker.js', import.meta.url)) : null);

// Solves a challenge object from the server. Resolves with the ALTCHA fields to send (see encodePayload), or null
// when it cannot be solved in time. Never rejects.
export async function solveChallenge(challenge, { timeoutMs = SOLVE_TIMEOUT_MS, createWorker = defaultWorker, useWorker = true } = {}) {
  const started = Date.now();
  try {
    let number;
    if (useWorker) number = await solveInWorker(challenge, timeoutMs, createWorker);
    if (number === undefined) {
      const left = timeoutMs - (Date.now() - started);
      number = left > 0 ? await solveOnMainThread(challenge, started + timeoutMs) : null;
    }
    if (number === null || number === undefined) return null;
    return {
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      number,
      salt: challenge.salt,
      signature: challenge.signature,
      took: Date.now() - started
    };
  } catch {
    return null;
  }
}

// The server said the captcha is off: skip it for the rest of this page view (a reload asks again).
let unconfigured = false;

// null: nothing to solve (not configured, a network error, a malformed answer).
async function fetchChallenge() {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(CHALLENGE_ENDPOINT, { cache: 'no-store', signal: controller?.signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || data.configured !== true) {
      if (data && data.configured === false) unconfigured = true;
      return null;
    }
    const valid = typeof data.algorithm === 'string' && typeof data.challenge === 'string' && typeof data.salt === 'string'
      && typeof data.signature === 'string' && Number.isInteger(data.maxnumber) && data.maxnumber >= 0;
    return valid ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// One slot: the payload being solved or already solved, waiting for a request to take it.
let slot = null;
let solveOptions = {};

// For tests: forget the slot and the "not configured" answer; `testOptions` go to solveChallenge.
export function resetCaptcha(testOptions = {}) {
  slot = null;
  unconfigured = false;
  solveOptions = testOptions;
}

function startSlot() {
  const entry = { settled: false, expiresMs: 0 };
  entry.promise = (async () => {
    try {
      const challenge = await fetchChallenge();
      if (!challenge) return null;
      const expires = saltExpiry(challenge.salt);
      entry.expiresMs = expires ? expires * 1000 : Date.now() + 4 * 60 * 1000;
      const solution = await solveChallenge(challenge, solveOptions);
      return solution ? encodePayload(solution) : null;
    } catch {
      return null;
    } finally {
      entry.settled = true;
    }
  })();
  return entry;
}

// The slot to use now: the one in hand, or a new one when there is none, the last try failed, or its payload is
// about to expire.
function currentSlot() {
  const stale = slot && slot.settled && slot.expiresMs - Date.now() < MIN_LIFE_MS;
  if (!slot || stale) slot = startSlot();
  return slot;
}

// Starts fetching and solving in the background unless that is already done or under way. Resolves with nothing;
// never rejects. Called on focus in a form.
export function prefetchCaptcha() {
  if (unconfigured || !canSolve()) return Promise.resolve();
  return currentSlot().promise.then(() => undefined);
}

// Takes the solved payload for ONE request: the base64 string for the `captcha` field, or null to send without
// one (the server decides). With `button`, the button reads CHECKING_LABEL while the answer is still being worked
// out, then goes back to what it showed.
export async function getCaptcha({ button } = {}) {
  if (unconfigured || !canSolve()) return null;
  const entry = currentSlot();
  slot = null; // single use: the next request takes a new challenge
  let restore = null;
  if (!entry.settled && button) {
    const html = button.innerHTML;
    const hadLabel = button.dataset.originalLabel !== undefined;
    const wasDisabled = button.disabled;
    setButtonLoading(button, CHECKING_LABEL);
    restore = () => {
      button.innerHTML = html;
      button.disabled = wasDisabled;
      if (!hadLabel) delete button.dataset.originalLabel;
    };
  }
  try {
    return await entry.promise;
  } finally {
    restore?.();
  }
}

// Runs `send(captcha)` (any request carrying the payload; it resolves with the server's JSON, so `code` shows)
// with a fresh captcha, once more when the server says captcha_failed, and replaces that answer's message with the
// site's own wording so it is translated like the rest of the page.
export async function withCaptcha(send, { button } = {}) {
  let result = await send(await getCaptcha({ button }));
  if (result && result.code === CAPTCHA_FAILED_CODE) result = await send(await getCaptcha({ button }));
  if (result && result.code === CAPTCHA_FAILED_CODE) result = { ...result, message: CAPTCHA_FAILED_MESSAGE };
  return result;
}

// Focus in a form starts the work, so the answer is ready by the time "Send" is pressed (a no-op while a payload
// is already in hand). The search box (a form marked data-search-form) never posts anything and is left out.
export function initCaptchaPrefetch(doc = typeof document === 'undefined' ? null : document) {
  if (!doc || typeof doc.addEventListener !== 'function') return;
  doc.addEventListener('focusin', (event) => {
    const form = event.target && typeof event.target.closest === 'function' ? event.target.closest('form') : null;
    if (!form || form.hasAttribute('data-search-form') || form.getAttribute('role') === 'search') return;
    prefetchCaptcha();
  }, true);
}

initCaptchaPrefetch();
