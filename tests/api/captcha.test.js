// Captcha (ALTCHA-protocol proof of work, api/captcha.js) on every POST to
// /api/contact and /api/otp-send, plus the bug_report rules of /api/contact.
// BigQuery and Resend are replaced through createContactHandler; nothing here
// touches the network or a real inbox.
import test from 'node:test';
import assert from 'node:assert';
import { createHash } from 'node:crypto';

process.env.RESEND_API_KEY = '';
process.env.OTP_SECRET = '';
process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '';
process.env.CONTACT_EMAIL = 'inbox@example.test';
const SECRET = 'test-secret-not-a-real-one';
process.env.CAPTCHA_SECRET = SECRET;

const { createContactHandler } = await import('../../api/contact.js');
const otpSend = (await import('../../api/otp-send.js')).default;
const challengeHandler = (await import('../../api/captcha-challenge.js')).default;
const { buildChallenge, verifyCaptcha, resetCaptchaState, CAPTCHA_FAILED_MESSAGE, MAX_NUMBER } = await import('../../api/captcha.js');
const { createChallenge, verifySolution } = await import('altcha-lib/v1');
const { schema } = await import('../../scripts/setup-bigquery.js');

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function setup() {
  const inserted = [];
  const sent = [];
  const handler = createContactHandler({
    insertEnquiry: async (row) => { inserted.push(row); },
    sendEmail: async (message) => { sent.push(message); return { data: { id: 'test' } }; }
  });
  return { handler, inserted, sent };
}

const post = async (handler, body, headers = {}) => {
  const res = mockRes();
  await handler({ method: 'POST', body, headers, connection: {} }, res);
  return res;
};

function quietly(fn) {
  return async () => {
    const { log, error, warn } = console;
    console.log = console.error = console.warn = () => {};
    try { await fn(); } finally { Object.assign(console, { log, error, warn }); }
  };
}

const encode = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64');
const decode = (payload) => JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));

// What the browser does: solve the challenge, wrap it as the ALTCHA payload.
async function solve(challenge) {
  const started = Date.now();
  // Synchronous node:crypto keeps the tests fast; the browser solver does the same loop with WebCrypto.
  for (let number = 0; number <= challenge.maxnumber; number += 1) {
    if (createHash('sha256').update(challenge.salt + number).digest('hex') === challenge.challenge) {
      return encode({
        algorithm: challenge.algorithm,
        challenge: challenge.challenge,
        number,
        salt: challenge.salt,
        signature: challenge.signature,
        took: Date.now() - started
      });
    }
  }
  assert.fail('challenge solvable within maxnumber');
}
const freshPayload = async () => solve(await buildChallenge());

const enquiry = (extra = {}) => ({ name: 'Asha', phone: '+919876543210', details: 'Two nights near Tapovan', ...extra });
const bug = (extra = {}) => ({
  source: 'bug_report',
  summary: 'The map does not load',
  steps: '1. Open stays\n2. Tap Map',
  expected: 'A map',
  actual: 'A blank box',
  ...extra
});

test.beforeEach(() => {
  process.env.CAPTCHA_SECRET = SECRET;
  resetCaptchaState();
});

// ---- the challenge endpoint -------------------------------------------------

test('GET /api/captcha-challenge returns a signed, expiring, uncached challenge', async () => {
  const res = mockRes();
  await challengeHandler({ method: 'GET', headers: {} }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.headers['cache-control'], 'no-store');
  assert.deepStrictEqual(Object.keys(res.body).sort(), ['algorithm', 'challenge', 'configured', 'maxnumber', 'salt', 'signature']);
  assert.strictEqual(res.body.configured, true);
  assert.strictEqual(res.body.algorithm, 'SHA-256');
  assert.strictEqual(res.body.maxnumber, MAX_NUMBER);
  assert.match(res.body.challenge, /^[0-9a-f]{64}$/);
  assert.match(res.body.signature, /^[0-9a-f]{64}$/);
  const expires = Number(new URLSearchParams(res.body.salt.split('?')[1]).get('expires'));
  const ahead = expires * 1000 - Date.now();
  assert.ok(ahead > 4 * 60 * 1000 && ahead <= 5 * 60 * 1000, `expires in about 5 minutes, got ${ahead} ms`);
});

test('GET /api/captcha-challenge says configured:false when CAPTCHA_SECRET is empty', async () => {
  process.env.CAPTCHA_SECRET = '';
  const res = mockRes();
  await challengeHandler({ method: 'GET', headers: {} }, res);
  assert.deepStrictEqual(res.body, { configured: false });
  assert.strictEqual(res.headers['cache-control'], 'no-store');
});

test('/api/captcha-challenge refuses POST', async () => {
  const res = mockRes();
  await challengeHandler({ method: 'POST', headers: {} }, res);
  assert.strictEqual(res.statusCode, 405);
});

test('two challenges are never the same', async () => {
  const a = await buildChallenge();
  const b = await buildChallenge();
  assert.notStrictEqual(a.challenge, b.challenge);
  assert.notStrictEqual(a.salt, b.salt);
});

// ---- /api/contact enforcement -----------------------------------------------

test('a valid solved payload is accepted and the enquiry goes through', quietly(async () => {
  const { handler, inserted, sent } = setup();
  const res = await post(handler, enquiry({ captcha: await freshPayload() }));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(inserted.length, 1);
  assert.strictEqual(sent.length, 1);
}));

test('the payload is the ALTCHA shape: algorithm, challenge, number, salt, signature, took', async () => {
  const payload = decode(await freshPayload());
  assert.deepStrictEqual(Object.keys(payload).sort(), ['algorithm', 'challenge', 'number', 'salt', 'signature', 'took']);
  assert.strictEqual(typeof payload.number, 'number');
});

const REJECTED = {
  'missing': () => undefined,
  'empty string': () => '',
  'not base64': () => '!!! not a payload !!!',
  'base64 of non-JSON': () => Buffer.from('hello').toString('base64'),
  'a number, not a string': () => 12345,
  'an object, not a string': () => ({ algorithm: 'SHA-256' }),
  'far too long': () => 'A'.repeat(5000)
};
for (const [name, make] of Object.entries(REJECTED)) {
  test(`captcha ${name} is rejected with captcha_failed`, quietly(async () => {
    const { handler, inserted, sent } = setup();
    const res = await post(handler, enquiry({ captcha: make() }));
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.code, 'captcha_failed');
    assert.strictEqual(res.body.message, CAPTCHA_FAILED_MESSAGE);
    assert.strictEqual(res.body.message, 'We could not verify that you are not a bot. Please try again.');
    assert.strictEqual(inserted.length, 0);
    assert.strictEqual(sent.length, 0);
  }));
}

const TAMPERED = {
  'a different number': (p) => ({ ...p, number: p.number + 1 }),
  'a different signature': (p) => ({ ...p, signature: 'a'.repeat(64) }),
  'a different challenge': (p) => ({ ...p, challenge: 'b'.repeat(64) }),
  'a different salt': (p) => ({ ...p, salt: p.salt.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')) }),
  'a pushed-out expiry': (p) => ({ ...p, salt: p.salt.replace(/expires=\d+/, `expires=${Math.floor(Date.now() / 1000) + 86400}`) }),
  'a weaker algorithm': (p) => ({ ...p, algorithm: 'SHA-1' }),
  'a negative number': (p) => ({ ...p, number: -1 }),
  'a number past maxnumber': (p) => ({ ...p, number: MAX_NUMBER + 1 }),
  'a string number': (p) => ({ ...p, number: String(p.number) })
};
for (const [name, tamper] of Object.entries(TAMPERED)) {
  test(`a payload with ${name} is rejected`, quietly(async () => {
    const { handler, inserted } = setup();
    const res = await post(handler, enquiry({ captcha: encode(tamper(decode(await freshPayload()))) }));
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.code, 'captcha_failed');
    assert.strictEqual(inserted.length, 0);
  }));
}

test('a payload signed with another secret is rejected', quietly(async () => {
  const foreign = await createChallenge({ algorithm: 'SHA-256', hmacKey: 'some-other-secret', maxnumber: 1000, expires: new Date(Date.now() + 60000) });
  const { handler } = setup();
  const res = await post(handler, enquiry({ captcha: await solve(foreign) }));
  assert.strictEqual(res.body.code, 'captcha_failed');
}));

test('an expired challenge is rejected even though it was solved correctly', quietly(async () => {
  const stale = await createChallenge({ algorithm: 'SHA-256', hmacKey: SECRET, maxnumber: 1000, expires: new Date(Date.now() - 10000) });
  const { handler, inserted } = setup();
  const res = await post(handler, enquiry({ captcha: await solve(stale) }));
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.code, 'captcha_failed');
  assert.strictEqual(inserted.length, 0);
}));

test('a challenge without an expiry is rejected', quietly(async () => {
  const forever = await createChallenge({ algorithm: 'SHA-256', hmacKey: SECRET, maxnumber: 1000 });
  const { handler } = setup();
  const res = await post(handler, enquiry({ captcha: await solve(forever) }));
  assert.strictEqual(res.body.code, 'captcha_failed');
}));

test('a payload works once: the replay is rejected', quietly(async () => {
  const { handler, inserted } = setup();
  const captcha = await freshPayload();
  assert.strictEqual((await post(handler, enquiry({ captcha }))).statusCode, 200);
  const replay = await post(handler, enquiry({ captcha }));
  assert.strictEqual(replay.statusCode, 400);
  assert.strictEqual(replay.body.code, 'captcha_failed');
  assert.strictEqual(inserted.length, 1);
}));

test('the same payload sent three times at once passes only once', quietly(async () => {
  const captcha = await freshPayload();
  const results = await Promise.all([verifyCaptcha(captcha), verifyCaptcha(captcha), verifyCaptcha(captcha)]);
  assert.strictEqual(results.filter(Boolean).length, 1);
}));

test('every source needs the captcha', quietly(async () => {
  const sources = ['website_form', 'whatsapp_widget', 'host_application', 'rental_enquiry', 'stay_enquiry', 'stay_redirect_booking', 'ota_redirect_booking', 'bug_report'];
  for (const source of sources) {
    const { handler, inserted, sent } = setup();
    const res = await post(handler, enquiry({ source }));
    assert.strictEqual(res.statusCode, 400, `${source} without a captcha`);
    assert.strictEqual(res.body.code, 'captcha_failed', source);
    assert.strictEqual(inserted.length + sent.length, 0, source);
  }
}));

test('the captcha field never reaches the stored row or the email', quietly(async () => {
  const { handler, inserted, sent } = setup();
  const captcha = await freshPayload();
  await post(handler, enquiry({ captcha }));
  assert.ok(!JSON.stringify(inserted).includes(captcha));
  assert.ok(!JSON.stringify(sent).includes(captcha));
}));

test('with CAPTCHA_SECRET empty nothing is enforced (and a payload is not needed)', quietly(async () => {
  process.env.CAPTCHA_SECRET = '';
  const { handler, inserted } = setup();
  assert.strictEqual((await post(handler, enquiry())).statusCode, 200);
  assert.strictEqual((await post(handler, enquiry({ captcha: 'garbage' }))).statusCode, 200);
  assert.strictEqual((await post(handler, bug())).statusCode, 200);
  assert.strictEqual(inserted.length, 3);
}));

test('an old-secret payload stops working when the secret changes', quietly(async () => {
  const captcha = await freshPayload();
  process.env.CAPTCHA_SECRET = 'rotated-secret';
  const { handler } = setup();
  assert.strictEqual((await post(handler, enquiry({ captcha }))).body.code, 'captcha_failed');
}));

// ---- the client solver and altcha-lib agree ----------------------------------

test('a payload built the way the browser solver builds it passes altcha-lib verifySolution', async () => {
  const payload = await freshPayload();
  assert.strictEqual(await verifySolution(payload, SECRET), true);
  assert.strictEqual(await verifySolution(payload, 'wrong'), false);
});

// ---- /api/otp-send ---------------------------------------------------------

test('otp-send needs the captcha too', quietly(async () => {
  const res = mockRes();
  await otpSend({ method: 'POST', body: { email: 'victim@example.test' }, headers: {} }, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.code, 'captcha_failed');
  assert.strictEqual(res.body.message, CAPTCHA_FAILED_MESSAGE);
}));

test('otp-send with a valid payload gets past the captcha (OTP itself is off here)', quietly(async () => {
  const res = mockRes();
  await otpSend({ method: 'POST', body: { email: 'a@example.test', captcha: await freshPayload() }, headers: {} }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, { success: true, configured: false });
}));

test('otp-send rejects a replayed payload', quietly(async () => {
  const captcha = await freshPayload();
  const first = mockRes();
  await otpSend({ method: 'POST', body: { email: 'a@example.test', captcha }, headers: {} }, first);
  const again = mockRes();
  await otpSend({ method: 'POST', body: { email: 'a@example.test', captcha }, headers: {} }, again);
  assert.strictEqual(first.statusCode, 200);
  assert.strictEqual(again.body.code, 'captcha_failed');
}));

test('otp-send is not enforced while CAPTCHA_SECRET is empty', quietly(async () => {
  process.env.CAPTCHA_SECRET = '';
  const res = mockRes();
  await otpSend({ method: 'POST', body: { email: 'a@example.test' }, headers: {} }, res);
  assert.strictEqual(res.statusCode, 200);
}));

// ---- bug_report ------------------------------------------------------------

test('a bug report needs no name or phone, emails only CONTACT_EMAIL and never the reporter', quietly(async () => {
  const { handler, inserted, sent } = setup();
  const res = await post(handler, bug({
    captcha: await freshPayload(),
    email: 'reporter@example.test',
    bug_type: 'map',
    severity: 'serious',
    page_url: 'https://rishikeshhomestays.com/hotels/best-hotels-in-rishikesh',
    device: 'Firefox 130 on Windows, 390x844, hi, dark',
    screenshot_url: 'https://example.test/shot.png',
    lang: 'hi'
  }));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.enquiryId);

  assert.strictEqual(sent.length, 1);
  const mail = sent[0];
  assert.strictEqual(mail.to, 'inbox@example.test');
  assert.strictEqual(mail.cc, undefined);
  assert.strictEqual(mail.bcc, undefined);
  assert.strictEqual(mail.subject, 'Bug report [serious]: The map does not load');
  assert.strictEqual(mail.reply_to, 'reporter@example.test');
  assert.ok(mail.text.includes('A blank box') && mail.text.includes('Firefox 130'));

  assert.strictEqual(inserted.length, 1);
  const row = inserted[0];
  assert.strictEqual(row.source, 'bug_report');
  assert.strictEqual(row.name, 'Anonymous');
  assert.strictEqual(row.phone, '');
  assert.strictEqual(row.email, 'reporter@example.test');
  assert.strictEqual(row.page_lang, 'hi');
  assert.ok(row.message.includes('Steps to reproduce'));
}));

test('a bug report row only uses columns of the BigQuery schema, with no NULL in a REQUIRED one', quietly(async () => {
  const { handler, inserted } = setup();
  await post(handler, bug({ captcha: await freshPayload() }));
  const row = inserted[0];
  const columns = new Map(schema.map((f) => [f.name, f]));
  for (const key of Object.keys(row)) assert.ok(columns.has(key), `column ${key} exists`);
  for (const f of schema.filter((c) => c.mode === 'REQUIRED')) {
    assert.ok(row[f.name] !== null && row[f.name] !== undefined, `${f.name} is REQUIRED and set`);
  }
}));

test('a bug report still emails when the database insert fails', quietly(async () => {
  const sent = [];
  const handler = createContactHandler({
    insertEnquiry: async () => { throw new Error('bigquery down'); },
    sendEmail: async (m) => { sent.push(m); return {}; }
  });
  const res = await post(handler, bug({ captcha: await freshPayload() }));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(sent.length, 1);
  assert.ok(sent[0].html.includes('could NOT be saved') || sent[0].html.includes('Could NOT be saved'));
}));

test('a bug report with a missing required field is refused', quietly(async () => {
  for (const field of ['summary', 'steps', 'expected', 'actual']) {
    const { handler, sent } = setup();
    const res = await post(handler, bug({ captcha: await freshPayload(), [field]: '   ' }));
    assert.strictEqual(res.statusCode, 400, field);
    assert.strictEqual(res.body.code, 'missing_fields', field);
    assert.strictEqual(sent.length, 0);
  }
}));

test('the summary must be 5 to 120 characters', quietly(async () => {
  const cases = [['abcd', 400], ['abcde', 200], ['x'.repeat(120), 200], ['x'.repeat(121), 400]];
  for (const [summary, status] of cases) {
    const { handler } = setup();
    const res = await post(handler, bug({ captcha: await freshPayload(), summary }));
    assert.strictEqual(res.statusCode, status, `${summary.length} characters`);
    if (status === 400) assert.strictEqual(res.body.code, 'invalid_summary');
  }
}));

test('long free text is cut to its cap, not rejected', quietly(async () => {
  const { handler, inserted } = setup();
  const res = await post(handler, bug({
    captcha: await freshPayload(),
    steps: 's'.repeat(50000),
    expected: 'e'.repeat(50000),
    actual: 'a'.repeat(50000),
    device: 'd'.repeat(50000),
    page_url: 'p'.repeat(50000)
  }));
  assert.strictEqual(res.statusCode, 200);
  const message = inserted[0].message;
  assert.ok(message.length < 6500, `stored message is bounded (${message.length})`);
  assert.ok(!message.includes('s'.repeat(2001)));
  assert.ok(!message.includes('e'.repeat(1001)));
  assert.ok(!message.includes('d'.repeat(301)));
  assert.ok(!message.includes('p'.repeat(301)));
}));

test('bad severity, type, email and screenshot link are refused with their own code', quietly(async () => {
  const cases = [
    [{ severity: 'apocalyptic' }, 'invalid_severity'],
    [{ bug_type: 'weather' }, 'invalid_bug_type'],
    [{ email: 'not-an-email' }, 'invalid_email'],
    [{ screenshot_url: 'javascript:alert(1)' }, 'invalid_url'],
    [{ screenshot_url: 'not a url' }, 'invalid_url'],
    [{ screenshot_url: 'https://example.test/' + 'x'.repeat(600) }, 'invalid_url']
  ];
  for (const [extra, code] of cases) {
    const { handler, sent } = setup();
    const res = await post(handler, bug({ captcha: await freshPayload(), ...extra }));
    assert.strictEqual(res.statusCode, 400, code);
    assert.strictEqual(res.body.code, code);
    assert.strictEqual(sent.length, 0);
  }
}));

test('subject and HTML cannot be used for header or markup injection', quietly(async () => {
  const { handler, sent } = setup();
  const res = await post(handler, bug({
    captcha: await freshPayload(),
    summary: 'Broken\r\nBcc: victim@example.test <script>alert(1)</script>',
    actual: '<img src=x onerror=alert(1)>',
    page_url: '"><script>alert(2)</script>'
  }));
  assert.strictEqual(res.statusCode, 200);
  const mail = sent[0];
  assert.ok(!/[\r\n]/.test(mail.subject), 'subject is one line');
  assert.ok(!mail.html.includes('<script>') && !mail.html.includes('<img src=x'), 'user text is escaped in the HTML');
  assert.ok(mail.html.includes('&lt;img src=x'));
}));

test('a name or phone is not required for a bug report and a phone is not validated', quietly(async () => {
  const { handler, inserted } = setup();
  const res = await post(handler, bug({ captcha: await freshPayload(), phone: 'garbage', name: '' }));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(inserted[0].name, 'Anonymous');
  assert.strictEqual(inserted[0].phone, '');
}));
