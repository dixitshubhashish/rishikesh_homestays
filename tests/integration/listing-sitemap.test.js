// A stay with a verified booking link ("finalised") gets its <url> in the main sitemap.xml (inside
// scripts/stays/listing_sitemap.py's own <!-- finalised-stays:start/end --> marker block); a stay
// with no verified link yet stays in sitemap-stays.xml. Both are kept in step with the built data
// modules by every stays build (owner decision 2026-10-17: "as long as URL is finalised it should
// move in main sitemap"). The stay page itself is indexable and names its own URL either way.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseSitemap, SITEMAPS } from '../../scripts/indexnow.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const MODULES = join(ROOT, 'assets', 'js', 'modules');
const SITE = 'https://rishikeshhomestays.com';
const thinSitemap = parseSitemap(readFileSync(join(ROOT, 'sitemap-stays.xml'), 'utf8'));
const mainSitemap = parseSitemap(readFileSync(join(ROOT, 'sitemap.xml'), 'utf8'));

const cities = readdirSync(MODULES)
  .map((f) => /^stays-index-data(?:-([a-z]+))?\.js$/.exec(f))
  .filter(Boolean)
  .map((m) => [m[1] || 'rishikesh', m[0]]);
const urlFor = (city, id) => `${SITE}/hotels/stay?s=${encodeURIComponent(id)}${city === 'rishikesh' ? '' : `&c=${city}`}`;

test('every stay of every city is in exactly one of the two sitemaps, by its link status, with a date', async () => {
  const wantFinal = new Set(), wantThin = new Set();
  for (const [city, file] of cities) {
    const { STAYS_INDEX } = await import(`../../assets/js/modules/${file}`);
    for (const s of STAYS_INDEX) (s.o ? wantFinal : wantThin).add(urlFor(city, s.id));
  }
  assert(wantFinal.size + wantThin.size > 1000, 'the data modules hold the stays');
  const haveThin = new Set([...thinSitemap.keys()].map((u) => u.replace(/&amp;/g, '&')));
  const haveFinalAll = new Set([...mainSitemap.keys()].map((u) => u.replace(/&amp;/g, '&')));
  const haveFinal = new Set([...haveFinalAll].filter((u) => u.includes('/hotels/stay?s=')));
  assert.deepStrictEqual([...wantThin].filter((u) => !haveThin.has(u)).slice(0, 5), [], 'thin stays missing from sitemap-stays.xml: run npm run build:stays');
  assert.deepStrictEqual([...haveThin].filter((u) => !wantThin.has(u)).slice(0, 5), [], 'sitemap-stays.xml lists a stay that is gone, or now has a link: run npm run build:stays');
  assert.deepStrictEqual([...wantFinal].filter((u) => !haveFinal.has(u)).slice(0, 5), [], 'finalised stays missing from sitemap.xml: run npm run build:stays');
  assert.deepStrictEqual([...haveFinal].filter((u) => !wantFinal.has(u)).slice(0, 5), [], 'sitemap.xml lists a finalised stay that is gone, or lost its link: run npm run build:stays');
  assert.strictEqual(thinSitemap.size, wantThin.size, 'no thin stay twice');
  assert.strictEqual(haveFinal.size, wantFinal.size, 'no finalised stay twice');
  assert(thinSitemap.size <= 50000 && mainSitemap.size <= 50000, 'one sitemap file holds at most 50,000 URLs');
  for (const [u, d] of thinSitemap) assert(/^\d{4}-\d{2}-\d{2}$/.test(d), `${u} has a <lastmod>`);
  for (const u of haveFinal) assert(/^\d{4}-\d{2}-\d{2}$/.test(mainSitemap.get([...mainSitemap.keys()].find((k) => k.replace(/&amp;/g, '&') === u))), `${u} has a <lastmod>`);
});

test('our own stays are not listed by listing_sitemap.py (they have their own hand-made sitemap.xml entries)', async () => {
  const { STAYS_OWN } = await import('../../assets/js/modules/stays-index-data.js');
  for (const o of STAYS_OWN) {
    assert(![...thinSitemap.keys()].some((u) => u.includes(`s=${encodeURIComponent(o.id)}`)), o.id);
    assert(![...mainSitemap.keys()].some((u) => u.includes(`/hotels/stay?s=${encodeURIComponent(o.id)}`)), o.id);
  }
});

test('listing_sitemap.py --check: both sitemaps and listing-dates.tsv are what the data modules say', () => {
  execFileSync('node', [join(ROOT, 'scripts', 'py.mjs'), join(ROOT, 'scripts', 'stays', 'listing_sitemap.py'), '--check'], { cwd: ROOT, stdio: 'pipe' });
});

test('robots.txt, IndexNow and the workflows know both sitemaps', () => {
  const robots = readFileSync(join(ROOT, 'robots.txt'), 'utf8');
  for (const f of SITEMAPS) assert(robots.includes(`Sitemap: ${SITE}/${f}`), `robots.txt names ${f}`);
  for (const w of ['indexnow.yml', 'stays-refresh.yml']) {
    assert(readFileSync(join(ROOT, '.github', 'workflows', w), 'utf8').includes('sitemap-stays.xml'), `${w} watches sitemap-stays.xml`);
  }
});

test('the stay page is indexable and has no static canonical (stay-page.js sets each stay\'s own)', () => {
  const html = readFileSync(join(ROOT, 'hotels', 'stay.html'), 'utf8');
  assert(/<meta name="robots" content="index, follow/.test(html), 'robots: index');
  assert(!/rel="canonical"/.test(html), 'no static canonical: every ?s= URL would fold into /hotels/stay');
  const js = readFileSync(join(MODULES, 'stay-page.js'), 'utf8');
  assert(js.includes('setIndexing(false)') && js.includes('setIndexing(!isOwn, d)'), 'a missing stay and our own stays are noindex');
});
