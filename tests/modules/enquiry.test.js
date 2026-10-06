// The one place the site posts an enquiry (assets/js/modules/enquiry.js).
import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { postEnquiry, ENQUIRY_ENDPOINT, SOURCES, otaRedirectSource, stayRedirectSource } from '../../assets/js/modules/enquiry.js';

const ROOT = join(import.meta.dirname, '..', '..');

test('postEnquiry sends JSON to /api/contact and returns the server answer with ok and status', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push([url, init]); return { ok: true, status: 200, json: async () => ({ success: true, message: 'Thanks' }) }; };
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
  try {
    globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ success: false, message: 'Bad phone' }) });
    assert.deepStrictEqual(await postEnquiry({}), { success: false, message: 'Bad phone', ok: false, status: 400 });
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); } });
    assert.strictEqual((await postEnquiry({})).ok, false);
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    await assert.rejects(postEnquiry({}), /offline/);
  } finally { globalThis.fetch = realFetch; }
});

test('source names for the booking-site click-throughs', () => {
  assert.strictEqual(otaRedirectSource('Booking.com'), 'ota_redirect_booking_com');
  assert.strictEqual(stayRedirectSource('MakeMyTrip'), 'stay_redirect_makemytrip');
  assert.deepStrictEqual(Object.values(SOURCES).sort(), ['host_application', 'rental_enquiry', 'stay_enquiry', 'website_form', 'whatsapp_widget']);
});

test('no other module posts to /api/contact: every form goes through enquiry.js', () => {
  const dir = join(ROOT, 'assets', 'js', 'modules');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'enquiry.js')) {
    const src = readFileSync(join(dir, f), 'utf8');
    assert(!/fetch\(\s*['"`]\/api\/contact/.test(src), `${f} posts to /api/contact itself: use postEnquiry`);
  }
});
