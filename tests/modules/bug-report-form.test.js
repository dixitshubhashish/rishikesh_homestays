import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { setupBugReportForm, describeDevice, initialPageValue } from '../../assets/js/modules/bug-report-form.js';
import { SOURCES } from '../../assets/js/modules/enquiry.js';
import {
  validateBugReport,
  buildBugReportDetails,
  isHttpUrlOrPath,
  isPlausibleEmail,
  bugTypeLabel,
  bugSeverityLabel,
  BUG_TYPES,
  BUG_SEVERITIES,
  BUG_LIMITS
} from '../../assets/js/modules/validators.js';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const PAGE = read('report-a-bug.html');

const GOOD = {
  summary: 'Date picker covers the Send button',
  page: '/contact',
  type: 'form',
  severity: 'serious',
  steps: '1. Open /contact\n2. Tap the check-in date',
  expected: 'I can pick a date',
  actual: 'The Send button is hidden',
  device: 'Chrome 126 on Android',
  email: 'asha@example.com',
  screenshot: 'https://example.com/shot.png'
};

test('validateBugReport: a complete report is valid and comes back trimmed', () => {
  const r = validateBugReport({ ...GOOD, summary: '  Date   picker covers the Send button  ', email: ' asha@example.com ' });
  assert.strictEqual(r.valid, true);
  assert.deepStrictEqual(r.errors, {});
  assert.strictEqual(r.values.summary, 'Date picker covers the Send button');
  assert.strictEqual(r.values.email, 'asha@example.com');
});

test('validateBugReport: only the optional fields may be empty', () => {
  const r = validateBugReport({ ...GOOD, page: '', device: '', email: '', screenshot: '' });
  assert.strictEqual(r.valid, true);
  const empty = validateBugReport({});
  assert.strictEqual(empty.valid, false);
  assert.deepStrictEqual(Object.keys(empty.errors).sort(), ['actual', 'expected', 'severity', 'steps', 'summary', 'type']);
});

test('validateBugReport: the title is 5 to 120 characters', () => {
  assert.strictEqual(validateBugReport({ ...GOOD, summary: 'abcd' }).valid, false);
  assert.strictEqual(validateBugReport({ ...GOOD, summary: 'abcde' }).valid, true);
  // Longer input is cut to the limit, never rejected.
  const long = validateBugReport({ ...GOOD, summary: 'x'.repeat(500) });
  assert.strictEqual(long.valid, true);
  assert.strictEqual(long.values.summary.length, BUG_LIMITS.summary.max);
});

test('validateBugReport: every text field is capped, so an email can never be oversized', () => {
  const r = validateBugReport({ ...GOOD, steps: 's'.repeat(9000), expected: 'e'.repeat(9000), actual: 'a'.repeat(9000), device: 'd'.repeat(9000) });
  assert.strictEqual(r.values.steps.length, BUG_LIMITS.steps.max);
  assert.strictEqual(r.values.expected.length, BUG_LIMITS.expected.max);
  assert.strictEqual(r.values.actual.length, BUG_LIMITS.actual.max);
  assert.strictEqual(r.values.device.length, BUG_LIMITS.device.max);
});

test('validateBugReport: type and severity must be one of the listed values', () => {
  assert.ok(validateBugReport({ ...GOOD, type: 'made-up' }).errors.type);
  assert.ok(validateBugReport({ ...GOOD, severity: 'catastrophic' }).errors.severity);
  assert.ok(validateBugReport({ ...GOOD, type: '' }).errors.type);
  for (const [value] of BUG_TYPES) assert.strictEqual(validateBugReport({ ...GOOD, type: value }).valid, true, value);
  for (const [value] of BUG_SEVERITIES) assert.strictEqual(validateBugReport({ ...GOOD, severity: value }).valid, true, value);
});

test('validateBugReport: steps, expected and actual are required', () => {
  for (const field of ['steps', 'expected', 'actual']) {
    const r = validateBugReport({ ...GOOD, [field]: '   ' });
    assert.ok(r.errors[field], field);
  }
});

test('links: only http(s) links and site paths are accepted (the value becomes a link in the email)', () => {
  assert.strictEqual(isHttpUrlOrPath('https://rishikeshhomestays.com/contact'), true);
  assert.strictEqual(isHttpUrlOrPath('http://example.com'), true);
  assert.strictEqual(isHttpUrlOrPath('/hotels/best-hotels-in-rishikesh'), true);
  for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'mailto:a@b.co', '//evil.example', 'not a url', 'ftp://example.com', '']) {
    assert.strictEqual(isHttpUrlOrPath(bad), false, bad);
  }
  assert.ok(validateBugReport({ ...GOOD, page: 'javascript:alert(1)' }).errors.page);
  assert.ok(validateBugReport({ ...GOOD, screenshot: 'javascript:alert(1)' }).errors.screenshot);
});

test('email: a plain address is accepted, garbage is not, and it is optional', () => {
  assert.strictEqual(isPlausibleEmail('asha@example.com'), true);
  for (const bad of ['asha', 'asha@', '@example.com', 'a b@example.com', 'asha@example', 'a@b@c.com']) {
    assert.strictEqual(isPlausibleEmail(bad), false, bad);
  }
  assert.ok(validateBugReport({ ...GOOD, email: 'nope' }).errors.email);
  assert.strictEqual(validateBugReport({ ...GOOD, email: '' }).valid, true);
});

test('buildBugReportDetails: fixed order, labels for type and severity, optional lines only when given', () => {
  const text = buildBugReportDetails(validateBugReport(GOOD).values);
  const order = ['Summary:', 'Type: A form or enquiry', 'Severity: Serious (a feature is broken)', 'Page: /contact', 'Steps to reproduce:', 'Expected:', 'Actual:', 'Device:', 'Screenshot:', 'Reporter email:'];
  let at = -1;
  for (const marker of order) {
    const next = text.indexOf(marker);
    assert(next > at, `${marker} comes after the previous line`);
    at = next;
  }
  const bare = buildBugReportDetails(validateBugReport({ ...GOOD, page: '', device: '', screenshot: '', email: '' }).values);
  assert.match(bare, /Page: Not given/);
  assert.match(bare, /Device: Not given/);
  assert(!/Screenshot:|Reporter email:/.test(bare));
  assert.strictEqual(bugTypeLabel('map'), 'Map');
  assert.strictEqual(bugSeverityLabel('blocker'), 'Blocks booking or enquiry');
});

test('the form on the page offers exactly the types and severities the validator knows', () => {
  const dom = new JSDOM(PAGE);
  const optionValues = (id) => [...dom.window.document.querySelectorAll(`#${id} option`)].map((o) => o.value).filter(Boolean);
  assert.deepStrictEqual(optionValues('bug_type'), BUG_TYPES.map(([v]) => v));
  assert.deepStrictEqual(optionValues('bug_severity'), BUG_SEVERITIES.map(([v]) => v));
  const labels = (id) => [...dom.window.document.querySelectorAll(`#${id} option`)].filter((o) => o.value).map((o) => o.textContent);
  assert.deepStrictEqual(labels('bug_type'), BUG_TYPES.map(([, l]) => l));
  assert.deepStrictEqual(labels('bug_severity'), BUG_SEVERITIES.map(([, l]) => l));
});

test('describeDevice: browser, OS, screen, viewport, language and theme', () => {
  const win = (userAgent, extra = {}) => ({
    navigator: { userAgent, language: 'en-IN' },
    screen: { width: 1920, height: 1080 },
    innerWidth: 1200,
    innerHeight: 800,
    document: { documentElement: { getAttribute: () => 'dark' } },
    ...extra
  });
  const chrome = describeDevice(win('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'));
  assert.match(chrome, /^Chrome 126 on Windows, screen 1920x1080, viewport 1200x800, language en-IN, theme dark$/);
  assert.match(describeDevice(win('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36 Edg/125.0.0.0')), /^Edge 125 on Windows/);
  assert.match(describeDevice(win('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15')), /^Safari 17 on macOS/);
  assert.match(describeDevice(win('Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0')), /^Firefox 127 on Android/);
  assert.match(describeDevice(win('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1')), /^Chrome 126 on iOS/);
  // Missing parts never throw.
  assert.match(describeDevice({ navigator: {} }), /^Unknown browser on unknown OS, theme light$/);
  assert(describeDevice(win('x'.repeat(1000))).length <= BUG_LIMITS.device.max);
});

test('initialPageValue: ?page= first, else the page they came from on this site, else empty', () => {
  const at = (href, referrer = '') => {
    const dom = new JSDOM('<!doctype html><body></body>', { url: href, referrer: referrer || undefined });
    return initialPageValue(dom.window);
  };
  assert.strictEqual(at('https://rishikeshhomestays.com/report-a-bug?page=/contact'), '/contact');
  assert.strictEqual(at('https://rishikeshhomestays.com/report-a-bug?page=https%3A%2F%2Frishikeshhomestays.com%2Fhomestays'), 'https://rishikeshhomestays.com/homestays');
  assert.strictEqual(at('https://rishikeshhomestays.com/report-a-bug?page=javascript:alert(1)'), '');
  assert.strictEqual(at('https://rishikeshhomestays.com/report-a-bug?page=//evil.example'), '');
  assert.strictEqual(at('https://rishikeshhomestays.com/report-a-bug', 'https://rishikeshhomestays.com/hotels/best-hotels-in-rishikesh?x=1'), '/hotels/best-hotels-in-rishikesh?x=1');
  assert.strictEqual(at('https://rishikeshhomestays.com/report-a-bug', 'https://www.google.com/search?q=rishikesh'), '');
  assert.strictEqual(at('https://rishikeshhomestays.com/report-a-bug'), '');
});

// Fresh page and stubs per test: fetch answers /api/contact with `apiResult` (any other URL, such as the captcha
// challenge, with "not configured"), and records the /api/contact bodies.
function setup(t, { apiResult = { success: true, enquiryId: 'abcdef12-3456-7890-abcd-ef1234567890' }, throws = false, url = 'http://localhost/report-a-bug' } = {}) {
  const dom = new JSDOM(PAGE.replace(/<script[\s\S]*?<\/script>/g, ''), { url });
  global.window = dom.window;
  global.document = dom.window.document;
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (u, opts = {}) => {
    if (u !== '/api/contact') return { ok: true, json: async () => ({ configured: false }) };
    calls.push(opts.body ? JSON.parse(opts.body) : null);
    if (throws) throw new TypeError('offline');
    return { ok: apiResult.success === true, status: apiResult.success ? 200 : 400, json: async () => apiResult };
  };
  t.after(() => { globalThis.fetch = realFetch; });

  setupBugReportForm();

  const $ = (sel) => document.querySelector(sel);
  const fill = (values) => {
    for (const [name, value] of Object.entries(values)) {
      const el = $(`#bug_${name}`);
      el.value = value;
      el.dispatchEvent(new dom.window.Event('input'));
    }
  };
  const submit = async () => {
    $('#bugForm').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0));
  };
  return { dom, $, fill, submit, calls };
}

test('the form prefills the page and the device and is editable', (t) => {
  const { $ } = setup(t, { url: 'http://localhost/report-a-bug?page=/homestays' });
  assert.strictEqual($('#bug_page').value, '/homestays');
  assert.match($('#bug_device').value, /theme light/);
  assert.strictEqual($('#bug_device').disabled, false);
  assert.strictEqual($('#bug_device').readOnly, false);
});

test('an empty or invalid submit shows messages, focuses the first bad field and sends nothing', async (t) => {
  const { $, submit, fill, calls } = setup(t);
  await submit();
  assert.strictEqual(calls.length, 0);
  for (const f of ['summary', 'type', 'severity', 'steps', 'expected', 'actual']) {
    assert.strictEqual($(`#bug-${f}-error`).hidden, false, f);
    assert.strictEqual($(`#bug_${f}`).getAttribute('aria-invalid'), 'true', f);
  }
  assert.strictEqual($('#bug-email-error').hidden, true);
  assert.strictEqual(document.activeElement, $('#bug_summary'));
  assert.match($('[data-form-status]').textContent, /highlighted/);
  assert(!$('#bugForm').hidden);
  // Typing in a field clears its own message only.
  fill({ summary: 'A real title' });
  assert.strictEqual($('#bug-summary-error').hidden, true);
  assert.strictEqual($('#bug-steps-error').hidden, false);
  // A bad email blocks the send as well.
  fill({ ...GOOD, email: 'nope' });
  await submit();
  assert.strictEqual(calls.length, 0);
  assert.strictEqual($('#bug-email-error').hidden, false);
  assert.strictEqual(document.activeElement, $('#bug_email'));
});

test('a valid report posts source bug_report with every field, no phone, and shows the thank-you panel', async (t) => {
  const { $, fill, submit, calls } = setup(t);
  fill(GOOD);
  await submit();
  assert.strictEqual(calls.length, 1);
  const body = calls[0];
  assert.strictEqual(body.source, SOURCES.bugReport);
  assert.strictEqual(body.source, 'bug_report');
  assert.strictEqual(body.summary, GOOD.summary);
  assert.strictEqual(body.page_url, '/contact');
  assert.strictEqual(body.bug_type, 'form');
  assert.strictEqual(body.severity, 'serious');
  assert.strictEqual(body.steps, GOOD.steps);
  assert.strictEqual(body.expected, GOOD.expected);
  assert.strictEqual(body.actual, GOOD.actual);
  assert.strictEqual(body.device, GOOD.device);
  assert.strictEqual(body.email, GOOD.email);
  assert.strictEqual(body.screenshot_url, GOOD.screenshot);
  assert.strictEqual(body.name, 'Anonymous');
  assert(!('phone' in body), 'a bug report has no phone');
  assert.match(body.details, /^Summary: Date picker covers the Send button\nType: A form or enquiry\nSeverity: Serious/);
  assert.strictEqual($('#bugForm').hidden, true);
  assert.strictEqual($('[data-bug-thanks]').hidden, false);
  assert.strictEqual($('[data-bug-reference]').textContent, 'abcdef12');
  assert.strictEqual($('[data-bug-reference-line]').hidden, false);
  assert.strictEqual($('#bugForm button[type="submit"]').disabled, false);
  assert.strictEqual($('#bug_summary').value, '');
});

test('"Report another problem" brings the empty form back', async (t) => {
  const { $, fill, submit } = setup(t);
  fill(GOOD);
  await submit();
  $('[data-bug-again]').click();
  assert.strictEqual($('#bugForm').hidden, false);
  assert.strictEqual($('[data-bug-thanks]').hidden, true);
  assert.strictEqual(document.activeElement, $('#bug_summary'));
  assert.match($('#bug_device').value, /theme light/);
});

test('the optional fields can be left empty', async (t) => {
  const { fill, submit, calls } = setup(t);
  fill({ ...GOOD, page: '', email: '', screenshot: '', device: '' });
  await submit();
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].email, '');
  assert.strictEqual(calls[0].page_url, '');
  assert.match(calls[0].details, /Page: Not given/);
});

test('a failed captcha shows the server message, keeps what was typed and re-enables the button', async (t) => {
  const apiResult = { success: false, code: 'captcha_failed', message: 'We could not verify that you are not a bot. Please try again.' };
  const { $, fill, submit, calls } = setup(t, { apiResult });
  fill(GOOD);
  await submit();
  assert.strictEqual(calls.length, 2, 'one automatic retry with a fresh challenge, then the message');
  assert.strictEqual($('[data-form-status]').textContent, apiResult.message);
  assert($('[data-form-status]').classList.contains('is-err'));
  assert.strictEqual($('#bugForm').hidden, false);
  assert.strictEqual($('#bug_summary').value, GOOD.summary);
  assert.strictEqual($('#bugForm button[type="submit"]').disabled, false);
  assert.strictEqual($('#bugForm button[type="submit"]').textContent, 'Send report');
});

test('another server error and a dead network both leave the form usable with a message', async (t) => {
  const server = setup(t, { apiResult: { success: false, message: 'We encountered an error. Please try again or contact us directly.' } });
  server.fill(GOOD);
  await server.submit();
  assert.match(server.$('[data-form-status]').textContent, /encountered an error/);
  assert.strictEqual(server.$('#bugForm').hidden, false);

  const offline = setup(t, { throws: true });
  offline.fill(GOOD);
  await offline.submit();
  assert.match(offline.$('[data-form-status]').textContent, /connection/);
  assert.strictEqual(offline.$('#bugForm button[type="submit"]').disabled, false);
  assert.strictEqual(offline.$('#bug_summary').value, GOOD.summary);
});

test('the page: friendly copy, a "good report" list, the form, a thank-you state and no phone field', () => {
  const dom = new JSDOM(PAGE);
  const doc = dom.window.document;
  assert.strictEqual(doc.title, 'Report a Bug | Rishikesh Homestays');
  assert.strictEqual(doc.querySelector('link[rel="canonical"]').href, 'https://rishikeshhomestays.com/report-a-bug');
  assert(doc.querySelector('.check-list li'), 'what makes a good report');
  assert(doc.querySelector('#bugForm'));
  assert(doc.querySelector('[data-bug-thanks][hidden]'));
  assert(!doc.querySelector('#bugForm input[type="tel"], #bugForm input[name="phone"], #bugForm select[name="country"]'), 'no phone field');
  for (const name of ['summary', 'page', 'type', 'severity', 'steps', 'expected', 'actual', 'device', 'screenshot', 'email']) {
    const el = doc.querySelector(`#bug_${name}`);
    assert(el, `field ${name}`);
    assert(doc.querySelector(`label[for="bug_${name}"]`), `label for ${name}`);
    assert(doc.getElementById(`bug-${name}-error`), `error span for ${name}`);
  }
  for (const name of ['summary', 'type', 'severity', 'steps', 'expected', 'actual']) {
    assert(doc.querySelector(`#bug_${name}`).required, `${name} is required`);
  }
  for (const name of ['page', 'device', 'screenshot', 'email']) {
    assert(!doc.querySelector(`#bug_${name}`).required, `${name} is optional`);
  }
  assert.strictEqual(doc.querySelector('#bug_summary').maxLength, BUG_LIMITS.summary.max);
  assert(!/—/.test(PAGE.replace(/<script[\s\S]*?<\/script>/g, '')), 'no em dashes in the copy');
});

test('the page loads the module as a module, adds no other POST to /api/contact and carries no ads', () => {
  assert.match(PAGE, /<script type="module" src="\/assets\/js\/modules\/bug-report-form\.js"><\/script>/);
  assert(!PAGE.includes('/api/contact'), 'the form goes through enquiry.js');
  assert(!PAGE.includes('rh-ad-slot'), 'a lead-type page: no ad slots');
  const ads = read('assets/js/ads.js');
  const lead = ads.match(/const LEAD = \{[\s\S]*?\};/)[0];
  const guides = ads.match(/const GUIDES = \[[\s\S]*?\];/)[0];
  assert(!lead.includes('report-a-bug') && !guides.includes('report-a-bug'), 'ads.js decides ads only for listed pages');
  const source = read('assets/js/modules/bug-report-form.js');
  assert(!/fetch\(/.test(source), 'module posts only through postEnquiry');
});

test('the site links to the page: footer of every hand-made page, thanks, contact, sitemap, llms.txt', () => {
  const link = '<a href="/report-a-bug">Report a bug</a>';
  const pages = [
    ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')),
    'hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh.html'
  ];
  for (const page of pages) assert(read(page).includes(link), `${page} footer links to the bug page`);
  assert(read('contact.html').includes('href="/report-a-bug"'));
  assert.match(read('sitemap.xml'), /<loc>https:\/\/rishikeshhomestays\.com\/report-a-bug<\/loc>/);
  assert(read('llms.txt').includes('https://rishikeshhomestays.com/report-a-bug'));
  assert(read('assets/search/index.json').includes('/report-a-bug'), 'run npm run build:search');
  assert(read('scripts/stays/page-dates.tsv').split('\n').some((l) => l.startsWith('/report-a-bug\t')));
});

test('the bug-report styles use tokens only and never use a bare 1fr', () => {
  const css = read('assets/css/styles.css');
  const block = css.slice(css.lastIndexOf('Report a bug (/report-a-bug'));
  assert(block.length > 100, 'the block exists');
  assert(!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(block), 'no colour literals');
  assert(!/\b1fr\b/.test(block.replace(/minmax\(0, 1fr\)/g, '')), 'no bare 1fr');
});
