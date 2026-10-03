// Finds Booking.com pages for stays that have no verified link yet, WITHOUT
// web searches: builds a few likely booking.com/hotel/in/<slug>.html
// candidates from the stay's slug, name and city, opens each in a real browser,
// and accepts the first one that lands on a Booking.com property page that
// names the stay in its own city (the shared rule in booking-match.mjs).
// Covers every city (Rishikesh at .cache/stays.json, others at .cache/<city>/).
//
// Usage: node scripts/stays/guess_booking_slugs.mjs [--shard i/N] [--workers n] [--limit n] [--out file]
//   --shard i/N: take every N-th stay starting at i (1-based), so N runs can go at once.
//   --out: where matches are appended (default .cache/slug-guesses.tsv); stays
//   tried without a match go to <out>.tried, so a re-run skips them.
// Then:  python3 scripts/stays/merge_ota.py <out> [...]
import { chromium } from 'playwright';
import { readFileSync, appendFileSync, existsSync, readdirSync } from 'fs';
import { words, bookingPageMatches } from './booking-match.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const arg = (name, dflt) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : dflt);
const OUT = arg('--out', `${HERE}.cache/slug-guesses.tsv`);
const TRIED = `${OUT}.tried`;
const LIMIT = Number(arg('--limit', 0)) || Infinity;
const WORKERS = Number(arg('--workers', 4));
const [SHARD, SHARDS] = arg('--shard', '1/1').split('/').map(Number);

const slugify = (s) => words(s).join('-');
const PREFIXES = ['hotel-', 'resort-', 'hostel-', 'apt-', 'villa-', 'bnb-', 'house-', 'camp-', 'the-'];
function candidates(slug, name, city) {
  const c = new Set();
  const add = (s) => { s = s.replace(/-+/g, '-').replace(/^-|-$/g, ''); if (s.length > 3) c.add(s); };
  const trimCity = (s) => s.replace(new RegExp(`-${city}(-\\d+)?$`), '');
  add(slug);
  let core = slug;
  for (const p of PREFIXES) if (core.startsWith(p)) core = core.slice(p.length);
  add(core);
  add(trimCity(core));
  add(`${trimCity(core)}-${city}`);
  const n = slugify(name.replace(/[–#|(].*$/, ''));
  add(n); add(n.replace(/^(hotel|the)-/, '')); add(`${trimCity(n)}-${city}`);
  return [...c].slice(0, 7);
}

const stays = [];
// STAYS_FILE=<json> checks another list of stays (e.g. Google Maps places not
// in our directory) instead of the directory's own stays files.
const cityFiles = process.env.STAYS_FILE ? [process.env.STAYS_FILE] : [`${HERE}.cache/stays.json`, ...readdirSync(`${HERE}.cache`, { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => `${HERE}.cache/${e.name}/stays.json`).filter((f) => existsSync(f))];
for (const f of cityFiles) for (const s of JSON.parse(readFileSync(f, 'utf8'))) stays.push({ ...s, cy: s.cy || 'rishikesh' });
const verified = new Set(readFileSync(`${HERE}ota-links.tsv`, 'utf8').trim().split('\n').slice(1)
  .map((l) => l.split('\t')).filter((c) => c[1] === 'verified').map((c) => c[0]));
const seen = (f) => new Set(existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')[0]) : []);
const tried = new Set([...seen(OUT), ...seen(TRIED)]);
const todo = stays.filter((s) => !s.own && !verified.has(s.id))
  .sort((a, b) => a.id.localeCompare(b.id))
  .filter((_, i) => i % SHARDS === SHARD - 1)
  .filter((s) => !tried.has(s.id))
  .slice(0, LIMIT);

const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'en-GB', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' });
await ctx.route(/\.(png|jpe?g|webp|gif|svg|woff2?|mp4)(\?|$)/, (r) => r.abort()); // pages only, no media
let done = 0, found = 0, blocked = 0;
// Booking.com answers 429 when we go too fast. Never record "no match" while
// rate-limited: back off and retry the same candidate instead.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(page, url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    // 429 = rate limited; 202 = Booking's "checking your browser" step, which
    // finishes by itself in a real browser. If it doesn't, wait and retry.
    if (res && res.status() === 429) { blocked++; await sleep(30000 * (attempt + 1)); continue; }
    if (res && res.status() === 202) {
      await page.waitForFunction(() => document.title.trim().length > 0, null, { timeout: 12000 }).catch(() => {});
      if (!(await page.title()).trim()) { blocked++; await sleep(30000 * (attempt + 1)); continue; }
    }
    return res;
  }
  throw new Error('RATE_LIMITED');
}
async function tryStay(s) {
  let page;
  try { page = await ctx.newPage(); } catch { return; } // browser gone: leave the stay for a re-run
  let hit = null, judged = true;
  for (const cand of candidates(s.id, s.n, s.cy)) {
    try {
      await open(page, `https://www.booking.com/hotel/in/${cand}.html`);
      const final = page.url();
      const title = await page.title();
      if (bookingPageMatches(s.n, s.cy, final, title)) {
        hit = { url: `https://www.booking.com/hotel/in/${final.split('/hotel/in/')[1].split(/[.?]/)[0]}.html`, title };
        break;
      }
    } catch (e) {
      judged = false; // rate limit or load failure: don't call it a miss
      if (e.message === 'RATE_LIMITED') break;
    }
  }
  await page.close().catch(() => {});
  if (hit) appendFileSync(OUT, `${s.id}\tverified\tBooking.com\t${hit.url}\tslug guess, browser-confirmed: "${hit.title.split(',')[0].slice(0, 80)}"\n`);
  else if (judged) appendFileSync(TRIED, `${s.id}\tno slug guess landed on a matching Booking.com page\n`);
  done++; if (hit) found++;
  if (hit) console.log(`  ✓ ${s.id}  →  ${hit.title.slice(0, 70)}`);
  if (done % 25 === 0) console.log(`${done}/${todo.length} tried, ${found} found, ${blocked} rate-limit waits`);
}
console.log(`shard ${SHARD}/${SHARDS}: ${todo.length} stays to try`);
const queue = [...todo];
await Promise.all(Array.from({ length: WORKERS }, async () => { while (queue.length) await tryStay(queue.shift()); }));
await browser.close();
console.log(`done: ${done} tried, ${found} found (${done ? Math.round((100 * found) / done) : 0}%), ${blocked} rate-limit waits`);
