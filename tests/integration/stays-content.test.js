import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// Content check for the generated stays pages (scripts/stays/build_pages.py):
// category, search-phrase and landmark pages must read as guides, not bare
// lists (owner, 2026-10-05), every page must exist in both cities behind the
// Rishikesh / Haridwar switch, and every page must be in the sitemap.
// Run on its own with: npm run check:stays (also part of npm test).
const root = process.cwd();
const hotels = join(root, 'hotels');
const pages = readdirSync(hotels)
  .filter((f) => f.endsWith('.html') && f !== 'stay.html' && !f.startsWith('advaitam-'))
  .map((f) => ({ file: f, html: readFileSync(join(hotels, f), 'utf-8') }));
const landmark = (p) => p.file.startsWith('best-stays-near-');

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
// Words a reader reads: <main> without the stay rows, navigation, filters and link lists.
function proseWords(html) {
  let m = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  m = m.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<(ul|ol) class="sx-list[^"]*"[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<(nav|aside)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<div class="sx-controls"[\s\S]*?<div id="sx-out">/, '<div id="sx-out">')
    .replace(/<section class="sx-explore"[\s\S]*?<\/section>/g, ' ');
  return (decode(m.replace(/<[^>]+>/g, ' ')).match(/[A-Za-z₹0-9][\w'’,.-]*/g) || []).length;
}
const pick = (html, re) => decode((html.match(re) || [])[1] || '').trim();

test('there are generated stays pages to check', () => {
  assert(pages.length > 100, `expected the generated stays pages in hotels/, found ${pages.length}`);
});

test('every stays page is content rich, not just a list', () => {
  for (const p of pages) {
    const words = proseWords(p.html);
    const min = landmark(p) ? 300 : 450;
    assert(words >= min, `${p.file}: ${words} words of guide text outside the lists (needs ${min}+)`);
    const faqs = (p.html.match(/<details class="sx-faq-item">/g) || []).length;
    assert(faqs >= 2, `${p.file}: ${faqs} FAQs (needs 2+)`);
    assert(/class="sx-guide sx-tips"/.test(p.html) || /^best-hotels-in-/.test(p.file), `${p.file}: no tips section`);
  }
});

test('titles, headlines, ledes and descriptions are unique', () => {
  for (const [label, re] of [['<title>', /<title>([^<]*)<\/title>/], ['<h1>', /<h1[^>]*>([^<]*)<\/h1>/],
    ['lede', /<p class="sx-lede">([^<]*)<\/p>/], ['meta description', /<meta name="description" content="([^"]*)"/]]) {
    const seen = new Map();
    for (const p of pages) {
      const v = pick(p.html, re);
      assert(v, `${p.file}: missing ${label}`);
      assert(!seen.has(v), `${p.file} repeats the ${label} of ${seen.get(v)}: "${v}"`);
      seen.set(v, p.file);
    }
  }
});

test('every stays page has one in-content ad slot, after the lists and before the FAQs', () => {
  for (const p of pages) {
    const slots = p.html.split('class="rh-ad-slot" data-ad="display"').length - 1;
    assert.strictEqual(slots, 1, `${p.file}: ${slots} ad slots`);
    const at = p.html.indexOf('rh-ad-slot');
    assert(at > p.html.indexOf('id="sx-out"'), `${p.file}: the ad slot must come after the stays list`);
    assert(at < p.html.indexOf('class="sx-faq"'), `${p.file}: the ad slot must come before the FAQs`);
    assert(at > p.html.indexOf('<h1'), `${p.file}: no ad above the headline`);
  }
});

test('the Rishikesh / Haridwar switch is on every page and lands on a page that exists', () => {
  for (const p of pages) {
    const nav = (p.html.match(/<nav class="sx-city-switch"[\s\S]*?<\/nav>/) || [])[0];
    assert(nav, `${p.file}: no city switch`);
    const hrefs = [...nav.matchAll(/href="\/hotels\/([^"]+)"/g)].map((m) => m[1]);
    assert.strictEqual(hrefs.length, 2, `${p.file}: the switch should link both cities`);
    for (const h of hrefs) assert(existsSync(join(hotels, `${h}.html`)), `${p.file}: switch links to missing /hotels/${h}`);
    assert(hrefs.includes(p.file.replace(/\.html$/, '')), `${p.file}: the switch should mark this page as the current city`);
  }
});

test('every category and search page of one city has its twin in the other', () => {
  const names = new Set(pages.map((p) => p.file));
  for (const p of pages) {
    if (landmark(p) || !/-(rishikesh|haridwar)\.html$/.test(p.file) || !p.html.includes('data-filter=')) continue;
    // one-city phrases (a landmark in the name) switch to their nearest equivalent instead
    if (/-near-(?!ganga|river|railway-station)|tapovan|aiims|patanjali|shantikunj|gurukul|bhel|sidcul|jolly-grant|neelkanth|isbt/.test(p.file)) continue;
    const twin = p.file.includes('rishikesh') ? p.file.replace(/rishikesh/g, 'haridwar') : p.file.replace(/haridwar/g, 'rishikesh');
    assert(names.has(twin), `${p.file} has no twin page ${twin}`);
  }
});

test('every stays page is in sitemap.xml, and every sitemap stays URL exists', () => {
  const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf-8');
  const listed = new Set([...sitemap.matchAll(/<loc>https:\/\/rishikeshhomestays\.com\/hotels\/([^<]+)<\/loc>/g)].map((m) => m[1]));
  for (const p of pages) {
    assert(listed.has(p.file.replace(/\.html$/, '')), `${p.file} is missing from sitemap.xml`);
  }
  for (const stem of listed) assert(existsSync(join(hotels, `${stem}.html`)), `sitemap.xml lists /hotels/${stem}, which does not exist`);
});

test('every stays page is in llms.txt (index) and llms-full.txt (details with a link to act on)', () => {
  const llms = readFileSync(join(root, 'llms.txt'), 'utf-8');
  const full = readFileSync(join(root, 'llms-full.txt'), 'utf-8');
  assert(llms.includes('https://rishikeshhomestays.com/llms-full.txt'), 'llms.txt should point to llms-full.txt');
  for (const p of pages) {
    const url = `https://rishikeshhomestays.com/hotels/${p.file.replace(/\.html$/, '')}`;
    assert(llms.includes(`(${url})`), `${p.file} is missing from llms.txt`);
    assert(full.includes(`Page: ${url}\n`), `${p.file} is missing from llms-full.txt`);
  }
  assert(!/\): 0 [a-z]/.test(llms), 'llms.txt should describe a page with no stays honestly, not as "0 <stays>"');
  assert(/wa\.me\/918050091290\?text=/.test(full), 'llms-full.txt should carry WhatsApp links travellers can act on');
});
