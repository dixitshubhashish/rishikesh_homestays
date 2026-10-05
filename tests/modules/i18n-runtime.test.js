import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { segId as extractId, extractPage, PAGES as EXTRACT_PAGES } from '../../scripts/i18n/extract.mjs';
import {
  segId, sha1Hex, pageKey, compilePatterns, makeLookup, createTranslator, flatpickrLocale, PAGES,
} from '../../assets/js/i18n-runtime.js';
import { langUrl, LANGUAGES } from '../../assets/js/modules/lang-picker.js';

const root = process.cwd();
const dom = (html) => new JSDOM(html, { virtualConsole: new VirtualConsole() }).window.document;

test('sha1 matches node:crypto', () => {
  assert.strictEqual(sha1Hex(''), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
  assert.strictEqual(sha1Hex('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  const long = 'x'.repeat(1000) + ' ₹2,000 हर हर गंगे 🙏';
  assert.strictEqual(segId(long), extractId(long));
});

test('runtime ids are extract.mjs ids for every catalogued English string', () => {
  for (const page of EXTRACT_PAGES) {
    const strings = Object.entries(extractPage(readFileSync(join(root, `${page}.html`), 'utf8')));
    assert(strings.length > 0, page);
    for (const [id, english] of strings) assert.strictEqual(segId(english), id, `${page}: ${english.slice(0, 60)}`);
  }
});

test('runtime page list is extract.mjs PAGES', () => {
  assert.deepStrictEqual(PAGES, EXTRACT_PAGES);
});

test('page key from the address', () => {
  assert.strictEqual(pageKey('/'), 'index');
  assert.strictEqual(pageKey('/index.html'), 'index');
  assert.strictEqual(pageKey('/contact'), 'contact');
  assert.strictEqual(pageKey('/contact.html'), 'contact');
  assert.strictEqual(pageKey('/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh'), 'hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh');
  assert.strictEqual(pageKey('/hotels/best-hotels-in-rishikesh'), null); // shared strings only, for now
  assert.strictEqual(pageKey('/no-such-page', '404'), '404');
});

// The browser walk must look up exactly what extract.mjs catalogues from the
// body (head text and JSON-LD aside), or translations silently never apply.
test('the in-browser walk finds every catalogued body string on every page', () => {
  for (const page of EXTRACT_PAGES) {
    const html = readFileSync(join(root, `${page}.html`), 'utf8')
      .replace(/<head>[\s\S]*<\/head>/, '<head></head>')
      .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
      .replace(/<!--\s*footer-stays\s*-->[\s\S]*?<!--\s*\/footer-stays\s*-->/g, '');
    const expected = new Set(Object.keys(extractPage(html)));
    const seen = new Set();
    const doc = dom(html);
    const tr = createTranslator(doc, (english) => { seen.add(segId(english)); return null; });
    tr.walk(doc.body);
    tr.attrs(doc.body);
    const missed = [...expected].filter((id) => !seen.has(id));
    assert.deepStrictEqual(missed, [], `${page}: ${missed.length} catalogued strings not reached by the runtime walk`);
  }
});

test('translating a run keeps links, listeners and untranslated text', () => {
  const doc = dom(`<body><p id="p">Book <a href="/contact" class="x">direct</a> today <img src="i.png" alt=""></p>
    <p translate="no">Book <a href="/contact">direct</a> today</p>
    <input type="text" placeholder="Your name" value="Ravi">
    <h1 data-headlines='["Ride the Ganges"]'>Ride the Ganges</h1>
    <span class="price">Starting ₹2,000 onwards</span>
    <p>Stay name that is not catalogued</p></body>`);
  const a = doc.querySelector('#p a');
  let clicked = 0;
  a.addEventListener('click', () => clicked++);
  const strings = {
    [segId('Book <0>direct</0> today')]: 'आज <0>सीधे</0> बुक करें',
    [segId('Your name')]: 'आपका नाम',
    [segId('Ride the Ganges')]: 'गंगा की सवारी',
  };
  const lookup = makeLookup(strings, compilePatterns({ 'Starting ₹{p} onwards': '₹{p} से शुरू' }));
  const tr = createTranslator(doc, lookup);
  tr.walk(doc.body);
  tr.attrs(doc.body);
  const p = doc.querySelector('#p');
  assert.strictEqual(p.textContent.trim(), 'आज सीधे बुक करें');
  assert.strictEqual(p.querySelector('a'), a, 'the same <a> element is reused');
  assert.strictEqual(a.getAttribute('href'), '/contact');
  assert(p.querySelector('img'), 'the trailing image stays');
  a.click();
  assert.strictEqual(clicked, 1);
  assert.match(doc.querySelector('[translate="no"]').textContent, /Book direct today/);
  assert.strictEqual(doc.querySelector('input').placeholder, 'आपका नाम');
  assert.strictEqual(doc.querySelector('input').value, 'Ravi');
  assert.strictEqual(doc.querySelector('h1').textContent, 'गंगा की सवारी');
  assert.deepStrictEqual(JSON.parse(doc.querySelector('h1').getAttribute('data-headlines')), ['गंगा की सवारी']);
  assert.strictEqual(doc.querySelector('.price').textContent, '₹2,000 से शुरू');
  assert.strictEqual(doc.querySelectorAll('p')[2].textContent, 'Stay name that is not catalogued');
});

test('a translation with the wrong placeholders is ignored', () => {
  const lookup = makeLookup({ [segId('Book <0>direct</0>')]: 'सीधे बुक करें' });
  assert.strictEqual(lookup('Book <0>direct</0>'), null);
});

test('calendar names fall back to the browser language data', () => {
  const loc = flatpickrLocale('de', () => null);
  assert.strictEqual(loc.months.longhand[0], 'Januar');
  assert.strictEqual(loc.weekdays.longhand[0], 'Sonntag');
  const own = flatpickrLocale('hi', (en) => (en === 'January' ? 'जनवरी!' : null));
  assert.strictEqual(own.months.longhand[0], 'जनवरी!');
});

test('language picker: own names, clean English URLs', () => {
  assert.strictEqual(LANGUAGES.length, 23);
  assert.deepStrictEqual(LANGUAGES[0], ['en', 'English']);
  assert.strictEqual(langUrl('https://x.test/contact?s=1#f', 'hi', true), '/contact?s=1&lang=hi#f');
  assert.strictEqual(langUrl('https://x.test/contact?lang=hi', 'en', true), '/contact');
  assert.strictEqual(langUrl('https://x.test/contact?lang=hi', 'en', false), '/contact?lang=en');
});
