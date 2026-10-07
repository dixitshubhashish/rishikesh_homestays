// Client side of the captcha (assets/js/modules/captcha.js and captcha-worker.js): the solver's output must be
// accepted by altcha-lib (the protocol the ALTCHA widget speaks) and by our own server check (api/captcha.js).
// No network, no real email: fetch is replaced and the challenges come from api/captcha.js in this process.
import test from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';

const SECRET = 'client-test-secret-not-a-real-one';
process.env.CAPTCHA_SECRET = SECRET;
process.env.RESEND_API_KEY = '';

const captcha = await import('../../assets/js/modules/captcha.js');
const { buildChallenge, verifyCaptcha, resetCaptchaState, MAX_NUMBER } = await import('../../api/captcha.js');
const { verifySolution, createChallenge } = await import('altcha-lib/v1');

const {
  solveChallenge, encodePayload, saltExpiry, getCaptcha, prefetchCaptcha, withCaptcha, resetCaptcha, initCaptchaPrefetch,
  CHECKING_LABEL, CAPTCHA_FAILED_MESSAGE, CAPTCHA_FAILED_CODE, SOLVE_TIMEOUT_MS
} = captcha;

const WORKER_SOURCE = readFileSync(join(import.meta.dirname, '..', '..', 'assets', 'js', 'modules', 'captcha-worker.js'), 'utf8');
const decode = (payload) => JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));

// A Worker that really runs captcha-worker.js (in a vm context with a fake `self`), so the shipped file is tested.
function realWorkerFactory(log = []) {
  return () => {
    const worker = {
      onmessage: null,
      onerror: null,
      terminated: false,
      postMessage(data) { log.push('message'); scope.onmessage({ data }); },
      terminate() { this.terminated = true; }
    };
    const scope = { postMessage: (data) => queueMicrotask(() => worker.onmessage?.({ data })) };
    vm.runInNewContext(WORKER_SOURCE, { self: scope, crypto: webcrypto, TextEncoder, Uint8Array, Date, parseInt, String });
    return worker;
  };
}

// fetch stub: the challenge endpoint answers with `answer()`; everything else is recorded.
function stubFetch(t, answer) {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(url);
    const body = await answer(url, init);
    return { ok: body !== null, status: body === null ? 500 : 200, json: async () => body };
  };
  t.after(() => { globalThis.fetch = realFetch; });
  return calls;
}

// What GET /api/captcha-challenge answers, with a small range so most tests stay fast (the first two tests use the
// real difficulty from api/captcha.js).
const liveChallenge = async () => ({
  configured: true,
  ...(await createChallenge({ hmacKey: SECRET, maxnumber: 1500, expires: new Date(Date.now() + 300_000) }))
});

test('the solver output (main thread) is accepted by altcha-lib verifySolution and by our server check', async () => {
  resetCaptchaState();
  const challenge = await createChallenge({ hmacKey: SECRET, maxnumber: MAX_NUMBER, number: 800, expires: new Date(Date.now() + 300_000) });
  assert.strictEqual(challenge.maxnumber, (await buildChallenge()).maxnumber, 'same range as the server hands out');
  const solution = await solveChallenge(challenge, { useWorker: false });
  assert.ok(solution, 'solved');
  assert.deepStrictEqual(Object.keys(solution).sort(), ['algorithm', 'challenge', 'number', 'salt', 'signature', 'took']);
  assert.strictEqual(solution.algorithm, 'SHA-256');
  assert.ok(Number.isInteger(solution.number) && solution.number >= 0 && solution.number <= challenge.maxnumber);
  const payload = encodePayload(solution);
  assert.strictEqual(await verifySolution(payload, SECRET), true);
  assert.strictEqual(await verifySolution(payload, 'another secret'), false);
  assert.strictEqual(await verifyCaptcha(payload), true);
  assert.strictEqual(await verifyCaptcha(payload), false, 'a payload is accepted once');
});

test('the shipped Worker file finds the same kind of answer, accepted by altcha-lib', async () => {
  resetCaptchaState();
  const challenge = await createChallenge({ hmacKey: SECRET, maxnumber: 3000, expires: new Date(Date.now() + 300_000) });
  const log = [];
  const solution = await solveChallenge(challenge, { createWorker: realWorkerFactory(log) });
  assert.deepStrictEqual(log, ['message'], 'the Worker did the work, not the fallback');
  assert.strictEqual(await verifySolution(encodePayload(solution), SECRET), true);
});

test('the payload is base64 JSON with the fields the ALTCHA widget sends', async () => {
  const challenge = await createChallenge({ hmacKey: SECRET, maxnumber: 500, number: 321, expires: new Date(Date.now() + 60000) });
  const solution = await solveChallenge(challenge, { useWorker: false });
  assert.strictEqual(solution.number, 321);
  const parsed = decode(encodePayload(solution));
  assert.strictEqual(parsed.number, 321);
  assert.strictEqual(parsed.challenge, challenge.challenge);
  assert.strictEqual(parsed.signature, challenge.signature);
  assert.strictEqual(parsed.salt, challenge.salt);
  assert.ok(typeof parsed.took === 'number' && parsed.took >= 0);
  assert.ok(saltExpiry(challenge.salt) > Date.now() / 1000);
  assert.strictEqual(saltExpiry('abc'), null);
});

test('a Worker that cannot start or errors falls back to the main thread', async () => {
  const challenge = await createChallenge({ hmacKey: SECRET, maxnumber: 300, number: 42 });
  const throwing = await solveChallenge(challenge, { createWorker: () => { throw new Error('blocked by CSP'); } });
  assert.strictEqual(throwing.number, 42);
  const none = await solveChallenge(challenge, { createWorker: () => null });
  assert.strictEqual(none.number, 42);
  const errorEvent = await solveChallenge(challenge, {
    createWorker: () => ({ postMessage() { queueMicrotask(() => this.onerror?.(new Error('boom'))); }, terminate() {} })
  });
  assert.strictEqual(errorEvent.number, 42);
  const errorMessage = await solveChallenge(challenge, {
    createWorker: () => ({ postMessage() { queueMicrotask(() => this.onmessage?.({ data: { number: null, error: true } })); }, terminate() {} })
  });
  assert.strictEqual(errorMessage.number, 42);
});

test('a solve that takes too long is cancelled and gives null (a slow device), and the Worker is stopped', async () => {
  const challenge = await createChallenge({ hmacKey: SECRET, maxnumber: 50000, number: 49999 });
  let terminated = false;
  const hung = await solveChallenge(challenge, {
    timeoutMs: 40,
    createWorker: () => ({ postMessage() {}, terminate() { terminated = true; } })
  });
  assert.strictEqual(hung, null);
  assert.strictEqual(terminated, true);
  // Main thread: stops at the deadline with the answer still far away.
  const started = Date.now();
  const slow = await solveChallenge({ ...challenge, maxnumber: 5_000_000, challenge: '0'.repeat(64) }, { useWorker: false, timeoutMs: 60 });
  assert.strictEqual(slow, null);
  assert.ok(Date.now() - started < 3000, 'gave up near the deadline');
  assert.ok(SOLVE_TIMEOUT_MS <= 30000, 'never leaves a guest waiting long');
});

test('not configured: no solving, no payload, and the endpoint is asked only once', async (t) => {
  resetCaptcha({ useWorker: false });
  const calls = stubFetch(t, () => ({ configured: false }));
  assert.strictEqual(await getCaptcha(), null);
  assert.strictEqual(await getCaptcha(), null);
  await prefetchCaptcha();
  assert.deepStrictEqual(calls, ['/api/captcha-challenge']);
});

test('a failing challenge request or a malformed answer sends no captcha and does not throw', async (t) => {
  resetCaptcha({ useWorker: false });
  stubFetch(t, () => null);
  assert.strictEqual(await getCaptcha(), null);
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  assert.strictEqual(await getCaptcha(), null);
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ configured: true, challenge: 5 }) });
  assert.strictEqual(await getCaptcha(), null);
  globalThis.fetch = async () => ({ ok: true, json: async () => { throw new Error('not json'); } });
  assert.strictEqual(await getCaptcha(), null);
});

test('configured: the payload is verified by the server, used once, and a new challenge is fetched each time', async (t) => {
  resetCaptcha({ useWorker: false });
  resetCaptchaState();
  const calls = stubFetch(t, liveChallenge);
  const first = await getCaptcha();
  assert.strictEqual(await verifyCaptcha(first), true);
  const second = await getCaptcha();
  assert.notStrictEqual(second, first);
  assert.strictEqual(await verifyCaptcha(second), true);
  assert.strictEqual(calls.length, 2);
  assert.ok(calls.every((url) => url === '/api/captcha-challenge'));
});

test('prefetch solves ahead: the next request takes that payload without another fetch or a waiting state', async (t) => {
  resetCaptcha({ useWorker: false });
  resetCaptchaState();
  const calls = stubFetch(t, liveChallenge);
  await prefetchCaptcha();
  await prefetchCaptcha();
  assert.strictEqual(calls.length, 1, 'prefetch is idempotent');
  const dom = new JSDOM('<button id="b">Send enquiry</button>');
  const button = dom.window.document.getElementById('b');
  const states = [];
  const observer = new dom.window.MutationObserver(() => states.push(button.textContent));
  observer.observe(button, { childList: true, characterData: true, subtree: true });
  const payload = await getCaptcha({ button });
  await new Promise((r) => setTimeout(r, 0));
  assert.strictEqual(await verifyCaptcha(payload), true);
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(states, [], 'already solved: the button was never touched');
});

test('while the solve is under way the button reads "Checking you are not a bot…" and then goes back', async (t) => {
  resetCaptcha({ useWorker: false });
  resetCaptchaState();
  const dom = new JSDOM('<button id="b">Send enquiry</button>');
  const button = dom.window.document.getElementById('b');
  stubFetch(t, liveChallenge);
  // The form already put its own busy state on the button.
  button.dataset.originalLabel = 'Send enquiry';
  button.disabled = true;
  button.innerHTML = '<span class="btn-spinner"></span>Sending...';
  const pending = getCaptcha({ button });
  assert.match(button.textContent, /Checking you are not a bot…/);
  assert.strictEqual(button.disabled, true);
  const payload = await pending;
  assert.ok(payload);
  assert.strictEqual(CHECKING_LABEL, 'Checking you are not a bot…');
  assert.strictEqual(button.textContent, 'Sending...');
  assert.strictEqual(button.dataset.originalLabel, 'Send enquiry');
  assert.strictEqual(button.disabled, true, 'the form clears its own busy state');
});

test('a button the form did not touch comes back exactly as it was', async (t) => {
  resetCaptcha({ useWorker: false });
  const dom = new JSDOM('<button id="b">Send enquiry</button>');
  const button = dom.window.document.getElementById('b');
  stubFetch(t, liveChallenge);
  await getCaptcha({ button });
  assert.strictEqual(button.textContent, 'Send enquiry');
  assert.strictEqual(button.disabled, false);
  assert.strictEqual(button.dataset.originalLabel, undefined);
});

test('a solved payload that is about to expire is not used', async (t) => {
  resetCaptcha({ useWorker: false });
  resetCaptchaState();
  let n = 0;
  stubFetch(t, async () => {
    n += 1;
    // First answer expires in 10 seconds (under the safety margin), the second in 5 minutes.
    return { configured: true, ...(await createChallenge({ hmacKey: SECRET, maxnumber: 200, expires: new Date(Date.now() + (n === 1 ? 10_000 : 300_000)) })) };
  });
  await prefetchCaptcha();
  const payload = await getCaptcha();
  assert.strictEqual(n, 2, 'the nearly expired one was thrown away and a fresh challenge fetched');
  assert.ok(payload);
});

test('withCaptcha: sends the payload, retries once with a fresh one on captcha_failed, then shows the site wording', async (t) => {
  resetCaptcha({ useWorker: false });
  resetCaptchaState();
  stubFetch(t, liveChallenge);
  const seen = [];
  const accepted = await withCaptcha(async (payload) => {
    seen.push(payload);
    return seen.length === 1 ? { success: false, code: CAPTCHA_FAILED_CODE, message: 'server words' } : { success: true };
  });
  assert.strictEqual(accepted.success, true);
  assert.strictEqual(seen.length, 2);
  assert.notStrictEqual(seen[0], seen[1], 'the retry used a new challenge');

  const failing = await withCaptcha(async () => ({ success: false, code: CAPTCHA_FAILED_CODE, message: 'server words' }));
  assert.strictEqual(failing.message, CAPTCHA_FAILED_MESSAGE);
  assert.strictEqual(failing.code, 'captcha_failed');

  let calls = 0;
  const other = await withCaptcha(async () => { calls += 1; return { success: false, code: 'invalid_phone', message: 'Bad phone' }; });
  assert.strictEqual(calls, 1, 'only captcha_failed is retried');
  assert.strictEqual(other.message, 'Bad phone');
});

test('withCaptcha sends null when the captcha is off, so the request carries no captcha field', async (t) => {
  resetCaptcha({ useWorker: false });
  stubFetch(t, () => ({ configured: false }));
  const seen = [];
  await withCaptcha(async (payload) => { seen.push(payload); return { success: true }; });
  assert.deepStrictEqual(seen, [null]);
});

test('focus in a form starts the work; the search box and other pages elements do not', async (t) => {
  resetCaptcha({ useWorker: false });
  resetCaptchaState();
  const calls = stubFetch(t, liveChallenge);
  const dom = new JSDOM(`<form data-search-form><input id="s"></form>
    <form id="f"><input id="i"></form><p id="p">text</p>`);
  const { document } = dom.window;
  initCaptchaPrefetch(document);
  const focus = (el) => el.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
  focus(document.getElementById('s'));
  focus(document.getElementById('p'));
  assert.strictEqual(calls.length, 0);
  focus(document.getElementById('i'));
  assert.strictEqual(calls.length, 1);
  focus(document.getElementById('i'));
  assert.strictEqual(calls.length, 1, 'one challenge at a time');
});

test('no WebCrypto (an insecure page): nothing is attempted and the server decides', async (t) => {
  resetCaptcha({ useWorker: false });
  const calls = stubFetch(t, liveChallenge);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
  t.after(() => Object.defineProperty(globalThis, 'crypto', descriptor));
  assert.strictEqual(await getCaptcha(), null);
  assert.strictEqual(calls.length, 0);
});

// waits for the proof of work to be solved (seconds on a loaded machine) instead of a fixed pause
const until = async (cond, ms = 60000) => { for (const end = Date.now() + ms; Date.now() < end && !cond(); ) await new Promise((r) => setTimeout(r, 50)); };

test('email-otp sends the captcha with /api/otp-send and shows the friendly message when it is refused', async (t) => {
  resetCaptcha({ useWorker: false });
  resetCaptchaState();
  const dom = new JSDOM('<input id="email" type="email" value="asha@example.com">');
  global.window = dom.window;
  global.document = dom.window.document;
  t.after(() => { delete global.window; delete global.document; });
  const sends = [];
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });
  globalThis.fetch = async (url, init) => {
    const reply = (body) => ({ ok: true, status: 200, json: async () => body });
    if (url === '/api/otp-status') return reply({ configured: true });
    if (url === '/api/captcha-challenge') return reply(await liveChallenge());
    sends.push(JSON.parse(init.body));
    // Refused the first two times (first try and its retry), accepted afterwards.
    return sends.length <= 2 ? reply({ success: false, code: 'captcha_failed', message: 'server words' }) : reply({ success: true, token: 'tok' });
  };
  const { setupEmailVerification } = await import('../../assets/js/modules/email-otp.js');
  await setupEmailVerification(document.getElementById('email'));
  const verify = document.querySelector('.email-otp-btn');
  const status = document.querySelector('.email-otp-status');
  verify.click();
  await until(() => sends.length >= 2);
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(sends.length, 2);
  assert.strictEqual(sends[0].email, 'asha@example.com');
  assert.strictEqual(await verifySolution(sends[0].captcha, SECRET), true);
  assert.notStrictEqual(sends[0].captcha, sends[1].captcha);
  assert.strictEqual(status.textContent, CAPTCHA_FAILED_MESSAGE);
  assert.strictEqual(verify.disabled, false);
  verify.click();
  await until(() => sends.length >= 3);
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(sends.length, 3);
  assert.strictEqual(await verifySolution(sends[2].captcha, SECRET), true);
  assert.match(status.textContent, /Code sent/);
});
