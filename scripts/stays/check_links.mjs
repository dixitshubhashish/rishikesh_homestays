// Re-checks every 'verified' booking link in ota-links.tsv in a real browser
// (Playwright). A Booking.com link passes only if it lands on a property page
// (/hotel/<cc>/...), not a search/city page, which is what Booking.com shows
// for a property that is closed or whose URL changed. Failures are printed;
// move them to 'doubtful' in ota-links.tsv and re-run build_pages.py.
// MakeMyTrip blocks automated browsers, so its failures are inconclusive.
// Usage: node scripts/stays/check_links.mjs
import { chromium } from 'playwright';
import { BROWSER_UA } from './booking-match.mjs';
import { readFileSync } from 'fs';

const rows = readFileSync(new URL('./ota-links.tsv', import.meta.url), 'utf8').trim().split(/\r?\n/).slice(1)
  .map((l) => l.split('\t')).filter((c) => c[1] === 'verified');
const browser = await chromium.launch();
const results = [];
async function check([key, , ota, url]) {
  const page = await browser.newPage({ locale: 'en-GB', userAgent: BROWSER_UA });
  const r = { key, ota, url, ok: false, why: '' };
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const final = page.url();
    if (ota === 'Booking.com') {
      r.ok = /booking\.com\/hotel\/[a-z]{2}\//.test(final) && !/searchresults|\/city\//.test(final);
      r.why = r.ok ? 'property page' : 'redirects to search/city page';
    } else {
      r.ok = Boolean(res && res.status() < 400);
      r.why = r.ok ? 'loads' : `HTTP ${res?.status()}`;
    }
  } catch (e) {
    r.why = `load failed (${e.message.split('\n')[0].slice(0, 60)})`;
  }
  await page.close();
  return r;
}
for (let i = 0; i < rows.length; i += 2) {
  results.push(...await Promise.all(rows.slice(i, i + 2).map(check)));
  await new Promise((done) => setTimeout(done, 800));
}
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`checked ${results.length}: ${results.length - bad.length} ok, ${bad.length} failing`);
bad.forEach((r) => console.log(`  ✗ ${r.key}\t${r.ota}\t${r.why}`));
