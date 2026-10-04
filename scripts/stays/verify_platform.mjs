// Browser-checks candidate property pages on platforms other than Booking.com
// (made by sitemap_candidates.py): a candidate becomes 'verified' only if the
// page is still that platform's property page and its title names the stay in
// its own city (titleMatches in booking-match.mjs). Never touches ota-links.tsv.
//
// Usage: node scripts/stays/verify_platform.mjs <candidates.tsv> --out <results.tsv> [--shard i/N] [--slow]
//   --slow: one page at a time with a 4 s gap (for sites that push back on bursts).
// If the site keeps refusing (5xx/429 on 8 pages in a row) the run stops by
// itself instead of pressing on; re-run later, matched stays are kept.
// Then:  python3 scripts/stays/merge_ota.py <results.tsv> [...]
import { chromium } from 'playwright';
import { readFileSync, appendFileSync, existsSync, readdirSync } from 'fs';
import { titleMatches } from './booking-match.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const arg = (name, dflt) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : dflt);
const OUT = arg('--out');
const [SHARD, SHARDS] = arg('--shard', '1/1').split('/').map(Number);
const SLOW = process.argv.includes('--slow');
if (!OUT) throw new Error('--out <results.tsv> is required');
// Where each platform's property pages live, and where the name ends in its titles.
const PLATFORMS = {
  'Booking.com': { page: /booking\.com\/hotel\/[a-z]{2}\/[^/?]+\.html/, nameEnd: ',' },
  EaseMyTrip: { page: /easemytrip\.com\/hotels\/[^/]+-\d+\/?$/, nameEnd: ':' },
  // "Best Price on <name> in <town> + Reviews!" → "<name>, <town>"
  Agoda: { page: /agoda\.com\/(?:[a-z]{2}-[a-z]{2}\/)?[^/]+\/hotel\/[^/]+\.html/, nameEnd: ',',
    clean: (t) => t.replace(/^Best Price on /i, '').replace(/ in ([^+]+?)\s*\+ Reviews!?\s*$/i, ', $1') },
  // "<name> (<town>) - 2026 Prices, Reviews…" → "<name>, <town>"; strict host, makemytrip/easemytrip end in trip.com too
  'Trip.com': { page: /^https?:\/\/(?:[a-z]{2}\.|www\.)?trip\.com\/hotels\/[^/?#]*hotel-detail-\d+/, nameEnd: ',',
    clean: (t) => t.replace(/\s*\(([^)]+)\)\s*-\s*.*$/, ', $1') },
};
const decode = (t) => t.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');

const names = {}, cityOf = {};
// STAYS_FILE=<json> checks another list of stays (e.g. Google Maps places not
// in our directory) instead of the directory's own stays files.
const cityFiles = process.env.STAYS_FILE ? [process.env.STAYS_FILE] : [`${HERE}.cache/stays.json`, ...readdirSync(`${HERE}.cache`, { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => `${HERE}.cache/${e.name}/stays.json`).filter((f) => existsSync(f))];
for (const f of cityFiles) for (const s of JSON.parse(readFileSync(f, 'utf8'))) { names[s.id] = s.n; cityOf[s.id] = s.cy || 'rishikesh'; }
const candidates = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => l.split('\t'))
  .filter((c) => PLATFORMS[c[2]] && c[3]?.startsWith('https://'));
// shard by stay, so all of one stay's candidates are checked in the same run
const keys = [...new Set(candidates.map((c) => c[0]))];
const mine = new Set(keys.filter((_, i) => i % SHARDS === SHARD - 1));
candidates.splice(0, candidates.length, ...candidates.filter((c) => mine.has(c[0])));

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'en-GB', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' });
await ctx.route(/\.(png|jpe?g|webp|gif|svg|woff2?|mp4)(\?|$)/, (r) => r.abort()); // pages only, no media
const confirmed = new Set();
let found = 0, missed = 0, skipped = 0, refusedInARow = 0;
async function check([key, , site, url]) {
  if (confirmed.has(key)) return; // an earlier candidate already matched
  const { page: pagePattern, nameEnd, clean = (t) => t } = PLATFORMS[site];
  let page;
  try {
    page = await ctx.newPage();
    let res;
    // 429 = slow down: back off and try again (twice) instead of judging.
    for (let attempt = 1; ; attempt++) {
      res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!res || res.status() !== 429 || attempt === 3) break;
      await page.waitForTimeout(30000 * attempt);
    }
    if (res && (res.status() === 429 || res.status() >= 500)) {
      skipped++; refusedInARow++; console.log(`  … ${key}  (site refused: ${res.status()}, not judged)`); return;
    }
    refusedInARow = 0;
    await page.waitForTimeout(2000);
    // 202 = a "checking your browser" step (Booking.com) that finishes by itself
    if (res && res.status() === 202) await page.waitForFunction(() => document.title.trim().length > 0, null, { timeout: 12000 }).catch(() => {});
    const title = clean(decode(await page.title()));
    if (!title.trim() || (res && res.status() >= 400)) { skipped++; console.log(`  … ${key}  (no page: ${res?.status()})`); return; }
    if (pagePattern.test(page.url()) && titleMatches(names[key] || '', cityOf[key], title, nameEnd)) {
      confirmed.add(key); found++;
      appendFileSync(OUT, `${key}\tverified\t${site}\t${url}\tbrowser-confirmed: page title "${title.split(nameEnd)[0].slice(0, 80)}"\n`);
      console.log(`  ✓ ${key}  →  ${title.slice(0, 70)}`);
    } else { missed++; console.log(`  ✗ ${key}  (${title.slice(0, 60)})`); }
  } catch {
    skipped++; console.log(`  … ${key}  (load failed: not judged)`);
  } finally {
    await page?.close().catch(() => {});
  }
}
console.log(`shard ${SHARD}/${SHARDS}: checking ${candidates.length} candidates`);
const step = SLOW ? 1 : 2;
for (let i = 0; i < candidates.length; i += step) {
  if (refusedInARow >= 8) { console.log('site keeps refusing: stopping here, re-run later'); break; }
  await Promise.all(candidates.slice(i, i + step).map(check));
  await new Promise((done) => setTimeout(done, SLOW ? 4000 : 800));
}
await browser.close();
console.log(`done: ${found} verified, ${missed} not the same stay, ${skipped} not judged`);
