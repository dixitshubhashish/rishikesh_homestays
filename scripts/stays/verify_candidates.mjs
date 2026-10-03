// Promotes 'doubtful' booking candidates to 'verified' when a real browser
// proves them: the URL must land on a Booking.com property page (not the
// city search it redirects closed/wrong listings to) whose title names the
// same property (most of our name's distinctive words appear in it). Needs
// no web searches, so it's how slug- or reviews-page-derived URLs get
// confirmed. Usage: node scripts/stays/verify_candidates.mjs [extra.tsv]
//   extra.tsv (optional): more candidates, "key<TAB>status<TAB>site<TAB>url<TAB>note".
// Writes the promotions straight into ota-links.tsv; re-run build_pages.py after.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const HERE = new URL('.', import.meta.url).pathname;
const LINKS = `${HERE}ota-links.tsv`;
const STOP = new Set(('hotel hotels resort resorts rishikesh rishīkesh by the a an and of in at near on with stay stays ' +
  'homestay homestays home house guest guesthouse hostel apartment apartments villa inn lodge cottage cottages ' +
  'camp camps tapovan laxman jhula ram ganga ganges view river luxury premium boutique bhk 1bhk 2bhk 3bhk room rooms').split(' '));
const words = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
const distinctive = (name) => words(name).filter((w) => w.length > 2 && !STOP.has(w));

const names = {};
for (const s of JSON.parse(readFileSync(`${HERE}.cache/stays.json`, 'utf8'))) names[s.id] = s.n;
const lines = readFileSync(LINKS, 'utf8').trim().split('\n');
const header = lines[0];
const rows = Object.fromEntries(lines.slice(1).map((l) => [l.split('\t')[0], l.split('\t')]));
const candidates = [];
for (const r of Object.values(rows)) if (r[1] === 'doubtful' && r[2] === 'Booking.com' && r[3]?.startsWith('https://')) candidates.push(r);
if (process.argv[2]) {
  for (const l of readFileSync(process.argv[2], 'utf8').trim().split('\n')) {
    const c = l.split('\t');
    if (c[3]?.startsWith('https://www.booking.com/') && rows[c[0]]?.[1] !== 'verified') candidates.push(c);
  }
}

const browser = await chromium.launch();
const today = new Date().toISOString().slice(0, 10);
let promoted = 0, failed = 0;
async function check(c) {
  const [key, , , url] = c;
  const page = await browser.newPage({ locale: 'en-GB', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const final = page.url();
    const title = await page.title();
    const onProperty = /booking\.com\/hotel\/[a-z]{2}\//.test(final) && !/searchresults|\/city\//.test(final);
    const want = distinctive(names[key] || '');
    const got = new Set(words(title));
    const hits = want.filter((w) => got.has(w)).length;
    const nameOk = want.length ? hits / want.length >= 0.6 : false;
    if (onProperty && nameOk) {
      rows[key] = [key, 'verified', 'Booking.com', url.split('?')[0], `browser-confirmed: page title "${title.split(',')[0].slice(0, 80)}"`, today];
      promoted++;
      console.log(`  ✓ ${key}  →  ${title.slice(0, 70)}`);
    } else {
      failed++;
      if (rows[key]?.[1] !== 'verified' && !rows[key]) rows[key] = [key, 'doubtful', 'Booking.com', url, c[4] || '', today];
      console.log(`  ✗ ${key}  (${onProperty ? `title mismatch: ${title.slice(0, 50)}` : 'redirects to search'})`);
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
writeFileSync(LINKS, `${header}\n${Object.values(rows).sort((a, b) => a[0].localeCompare(b[0])).map((r) => r.join('\t')).join('\n')}\n`);
console.log(`promoted ${promoted} to verified, ${failed} still unconfirmed`);
