// sitemap-stays.xml (scripts/stays/listing_sitemap.py): one entry per listed stay, kept in step with the
// built data modules by every stays build; the stay page is indexable and names its own URL.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { parseSitemap, SITEMAPS } from '../../scripts/indexnow.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const MODULES = join(ROOT, 'assets', 'js', 'modules');
const SITE = 'https://rishikeshhomestays.com';
const sitemap = parseSitemap(readFileSync(join(ROOT, 'sitemap-stays.xml'), 'utf8'));

const cities = readdirSync(MODULES)
  .map((f) => /^stays-index-data(?:-([a-z]+))?\.js$/.exec(f))
  .filter(Boolean)
  .map((m) => [m[1] || 'rishikesh', m[0]]);
const urlFor = (city, id) => `${SITE}/hotels/stay?s=${encodeURIComponent(id)}${city === 'rishikesh' ? '' : `&c=${city}`}`;

test('every stay of every city is in sitemap-stays.xml, once, with a date', async () => {
  const want = new Set();
  for (const [city, file] of cities) {
    const { STAYS_INDEX } = await import(`../../assets/js/modules/${file}`);
    for (const s of STAYS_INDEX) want.add(urlFor(city, s.id));
  }
  assert(want.size > 1000, 'the data modules hold the stays');
  const have = new Set([...sitemap.keys()].map((u) => u.replace(/&amp;/g, '&')));
  assert.deepStrictEqual([...want].filter((u) => !have.has(u)).slice(0, 5), [], 'stays missing from sitemap-stays.xml: run npm run build:stays');
  assert.deepStrictEqual([...have].filter((u) => !want.has(u)).slice(0, 5), [], 'sitemap-stays.xml lists stays that are gone: run npm run build:stays');
  assert.strictEqual(sitemap.size, want.size, 'no stay twice');
  assert(sitemap.size <= 50000, 'one sitemap file holds at most 50,000 URLs');
  for (const [u, d] of sitemap) assert(/^\d{4}-\d{2}-\d{2}$/.test(d), `${u} has a <lastmod>`);
});

test('our own stays are not listed here (they have their own pages in sitemap.xml)', async () => {
  const { STAYS_OWN } = await import('../../assets/js/modules/stays-index-data.js');
  for (const o of STAYS_OWN) assert(![...sitemap.keys()].some((u) => u.includes(`s=${encodeURIComponent(o.id)}`)), o.id);
});

test('listing_sitemap.py --check: the file and listing-dates.tsv are what the data modules say', () => {
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
