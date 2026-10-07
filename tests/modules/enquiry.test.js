// The one place the site posts an enquiry (assets/js/modules/enquiry.js).
import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resetCaptcha, CAPTCHA_FAILED_MESSAGE } from '../../assets/js/modules/captcha.js';
import { postEnquiry, ENQUIRY_ENDPOINT, SOURCES, otaRedirectSource, stayRedirectSource } from '../../assets/js/modules/enquiry.js';

const ROOT = join(import.meta.dirname, '..', '..');

// The captcha asks /api/captcha-challenge first; these tests stub it as "not configured" (nothing attached).
const notConfigured = { ok: true, status: 200, json: async () => ({ configured: false }) };

test('postEnquiry sends JSON to /api/contact and returns the server answer with ok and status', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  resetCaptcha();
  globalThis.fetch = async (url, init) => {
    if (url !== ENQUIRY_ENDPOINT) return notConfigured;
    calls.push([url, init]);
    return { ok: true, status: 200, json: async () => ({ success: true, message: 'Thanks' }) };
  };
  try {
    const result = await postEnquiry({ name: 'Asha', source: SOURCES.contact });
    assert.strictEqual(calls[0][0], ENQUIRY_ENDPOINT);
    assert.strictEqual(calls[0][1].method, 'POST');
    assert.strictEqual(calls[0][1].headers['Content-Type'], 'application/json');
    assert.deepStrictEqual(JSON.parse(calls[0][1].body), { name: 'Asha', source: 'website_form' });
    assert.deepStrictEqual(result, { success: true, message: 'Thanks', ok: true, status: 200 });
  } finally { globalThis.fetch = realFetch; }
});

test('a failed or unreadable answer is ok:false; a network error rejects like fetch', async () => {
  const realFetch = globalThis.fetch;
  resetCaptcha();
  try {
    globalThis.fetch = async (url) => (url === ENQUIRY_ENDPOINT ? { ok: false, status: 400, json: async () => ({ success: false, message: 'Bad phone' }) } : notConfigured);
    assert.deepStrictEqual(await postEnquiry({}), { success: false, message: 'Bad phone', ok: false, status: 400 });
    globalThis.fetch = async (url) => (url === ENQUIRY_ENDPOINT ? { ok: true, status: 200, json: async () => { throw new Error('not json'); } } : notConfigured);
    assert.strictEqual((await postEnquiry({})).ok, false);
    globalThis.fetch = async (url) => { if (url === ENQUIRY_ENDPOINT) throw new TypeError('offline'); return notConfigured; };
    await assert.rejects(postEnquiry({}), /offline/);
  } finally { globalThis.fetch = realFetch; }
});

test('a configured captcha is attached as "captcha", once per request, with one retry on captcha_failed', async () => {
  const { createChallenge, verifySolution } = await import('altcha-lib/v1');
  const secret = 'enquiry-test-secret';
  const realFetch = globalThis.fetch;
  const bodies = [];
  let challenges = 0;
  resetCaptcha({ useWorker: false });
  globalThis.fetch = async (url, init) => {
    if (url !== ENQUIRY_ENDPOINT) {
      challenges += 1;
      const c = await createChallenge({ hmacKey: secret, maxnumber: 300, expires: new Date(Date.now() + 300_000) });
      return { ok: true, status: 200, json: async () => ({ configured: true, ...c }) };
    }
    bodies.push(JSON.parse(init.body));
    const failed = bodies.length === 1;
    return {
      ok: !failed,
      status: failed ? 400 : 200,
      json: async () => (failed ? { success: false, code: 'captcha_failed', message: 'x' } : { success: true })
    };
  };
  try {
    const result = await postEnquiry({ name: 'Asha', source: SOURCES.contact });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(bodies.length, 2, 'the failed first try was repeated once');
    assert.strictEqual(challenges, 2, 'each try solved its own challenge');
    assert.notStrictEqual(bodies[0].captcha, bodies[1].captcha);
    for (const body of bodies) {
      assert.strictEqual(body.name, 'Asha');
      assert.strictEqual(await verifySolution(body.captcha, secret), true);
    }
    // Still failing after the retry: the caller gets the friendly message and the code.
    bodies.length = 0;
    globalThis.fetch = async (url) => (url !== ENQUIRY_ENDPOINT
      ? { ok: true, status: 200, json: async () => ({ configured: false }) }
      : { ok: false, status: 400, json: async () => ({ success: false, code: 'captcha_failed', message: 'x' }) });
    resetCaptcha();
    const failed = await postEnquiry({});
    assert.deepStrictEqual([failed.ok, failed.code, failed.message], [false, 'captcha_failed', CAPTCHA_FAILED_MESSAGE]);
  } finally { globalThis.fetch = realFetch; resetCaptcha(); }
});

test('source names for the booking-site click-throughs', () => {
  assert.strictEqual(otaRedirectSource('Booking.com'), 'ota_redirect_booking_com');
  assert.strictEqual(stayRedirectSource('MakeMyTrip'), 'stay_redirect_makemytrip');
  assert.deepStrictEqual(Object.values(SOURCES).sort(), ['bug_report', 'host_application', 'rental_enquiry', 'stay_enquiry', 'website_form', 'whatsapp_widget']);
});

test('no other module posts to /api/contact: every form goes through enquiry.js', () => {
  const dir = join(ROOT, 'assets', 'js', 'modules');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'enquiry.js')) {
    const src = readFileSync(join(dir, f), 'utf8');
    assert(!/fetch\(\s*['"`]\/api\/contact/.test(src), `${f} posts to /api/contact itself: use postEnquiry`);
  }
});
