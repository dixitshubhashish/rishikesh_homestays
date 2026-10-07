// Promotes 'doubtful' booking candidates to 'verified' when a real browser
// proves them: the URL must land on a Booking.com property page (not the
// city search it redirects closed/wrong listings to) whose title names the
// same property (most of our name's distinctive words appear in it). Needs
// no web searches, so it's how slug- or reviews-page-derived URLs get
// confirmed. Usage: node scripts/stays/verify_candidates.mjs [extra.tsv] [--out results.tsv]
//   extra.tsv (optional): more candidates, "key<TAB>status<TAB>site<TAB>url<TAB>note".
// Writes the promotions straight into ota-links.tsv; re-run build_pages.py after.
//   --out: parallel-safe mode for sharded runs. Checks only extra.tsv, appends
//   each match to results.tsv (merge with merge_ota.py) and never rewrites
//   ota-links.tsv, so several runs can go at once.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync } from 'fs';
import { bookingPageMatches, BROWSER_UA } from './booking-match.mjs';
import { fileURLToPath } from 'url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const LINKS = `${HERE}ota-links.tsv`;
const names = {};
// names from every city (Rishikesh at .cache/stays.json, others at .cache/<city>/)
// STAYS_FILE=<json> checks another list of stays (e.g. Google Maps places not
// in our directory) instead of the directory's own stays files.
const cityFiles = process.env.STAYS_FILE ? [process.env.STAYS_FILE] : [`${HERE}.cache/stays.json`, ...readdirSync(`${HERE}.cache`, { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => `${HERE}.cache/${e.name}/stays.json`).filter((f) => existsSync(f))];
const cityOf = {};
for (const f of cityFiles) for (const s of JSON.parse(readFileSync(f, 'utf8'))) { names[s.id] = s.n; cityOf[s.id] = s.cy || 'rishikesh'; }
const lines = readFileSync(LINKS, 'utf8').trim().split(/\r?\n/);
const header = lines[0];
const rows = Object.fromEntries(lines.slice(1).map((l) => [l.split('\t')[0], l.split('\t')]));
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const candidates = [];
if (!OUT) for (const r of Object.values(rows)) if (r[1] === 'doubtful' && r[2] === 'Booking.com' && r[3]?.startsWith('https://')) candidates.push(r);
if (process.argv[2] && process.argv[2] !== '--out') {
  for (const l of readFileSync(process.argv[2], 'utf8').trim().split(/\r?\n/)) {
    const c = l.split('\t');
    if (c[3]?.startsWith('https://www.booking.com/') && rows[c[0]]?.[1] !== 'verified') candidates.push(c);
  }
}

const browser = await chromium.launch();
const today = new Date().toISOString().slice(0, 10);
let promoted = 0, failed = 0;
const confirmedNow = new Set();
async function check(c) {
  const [key, , , url] = c;
  if (confirmedNow.has(key)) return; // an earlier candidate already matched
  const page = await browser.newPage({ locale: 'en-GB', userAgent: BROWSER_UA });
  try {
    // 429 = Booking asks us to slow down: back off and try again (twice)
    // rather than skip the stay; parallel sharded runs can hit it.
    let res;
    for (let attempt = 1; ; attempt++) {
      res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!res || res.status() !== 429 || attempt === 3) break;
      await page.waitForTimeout(30000 * attempt);
    }
    // 202 = Booking's "checking your browser" step: a normal browser finishes
    // it by itself and the real page loads, so wait for it. Only judge the
    // page once it has a real title; 429 (rate limited) is never judged.
    if (res && res.status() === 429) { console.log(`  … ${key}  (rate limited: not judged)`); await page.close(); return; }
    await page.waitForTimeout(2500);
    if (res && res.status() === 202) {
      await page.waitForFunction(() => document.title.trim().length > 0, null, { timeout: 12000 }).catch(() => {});
      if (!(await page.title()).trim()) { console.log(`  … ${key}  (browser check didn't finish: not judged)`); await page.close(); return; }
    }
    const final = page.url();
    const title = await page.title();
    const onProperty = /booking\.com\/hotel\/[a-z]{2}\//.test(final) && !/searchresults|\/city\//.test(final);
    const nameOk = onProperty && bookingPageMatches(names[key] || '', cityOf[key], final, title);
    if (nameOk) {
      rows[key] = [key, 'verified', 'Booking.com', url.split('?')[0], `browser-confirmed: page title "${title.split(',')[0].slice(0, 80)}"`, today];
      promoted++;
      confirmedNow.add(key);
      if (OUT) appendFileSync(OUT, `${rows[key].slice(0, 5).join('\t')}\n`);
      console.log(`  ✓ ${key}  →  ${title.slice(0, 70)}`);
    } else {
      failed++;
      // a failed extra candidate leaves the stay as it was (unsearched stays stay unsearched)
      console.log(`  ✗ ${key}  (${!onProperty ? 'redirects to search' : `title mismatch or other town: ${title.slice(0, 50)}`})`);
    }
  } catch (e) {
    failed++;
    console.log(`  ✗ ${key}  (load failed)`);
  }
  await page.close();
}
console.log(`checking ${candidates.length} Booking.com candidates`);
for (let i = 0; i < candidates.length; i += 2) {
  await Promise.all(candidates.slice(i, i + 2).map(check));
  await new Promise((done) => setTimeout(done, 800));
}
await browser.close();
if (!OUT) writeFileSync(LINKS, `${header}\n${Object.values(rows).sort((a, b) => a[0].localeCompare(b[0], 'en')).map((r) => r.join('\t')).join('\n')}\n`);
console.log(`promoted ${promoted} to verified, ${failed} still unconfirmed`);
