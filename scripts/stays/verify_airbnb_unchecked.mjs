#!/usr/bin/env node
// One-off batch runner for the 1714 `candidate_pages` rows with platform_key='Airbnb', status='unchecked'.
// Same shape as verify_seen.mjs but fixes the one thing that script gets wrong for Airbnb: Airbnb's own
// VacationRental JSON-LD carries latitude/longitude as TOP-LEVEL fields, not nested under `geo` like
// Booking.com/Hotel JSON-LD (confirmed in verify_seen_browser.mjs's investigation notes, 2026-10-15).
// Methodology (owner-approved, matches the prior 50-row clean batch):
//   - own browser tab per worker (chromium, real render, same as verify_seen.mjs)
//   - extract via VacationRental JSON-LD (top-level lat/lng + address.addressLocality)
//   - state='closed' ONLY on literal removed/closed-page text (never inferred)
//   - state='elsewhere' for a valid pin >25 km from every city centre
//   - state='no pin' / 'unreadable' otherwise
//   - status='unchecked' guard: query re-reads status='unchecked' fresh each batch, so a row already
//     claimed/checked by another run is never double-processed
// Each row's UPDATE commits immediately (better-sqlite3 default), so progress is checkpointed every row;
// this script just prints a running count every ~40-50 rows.
//
//   node scripts/stays/verify_airbnb_unchecked.mjs [--limit 150] [--workers 8]
import { chromium } from 'playwright';
import { getDb } from './db.mjs';

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const LIMIT = Number(arg('--limit', 150));
const WORKERS = Number(arg('--workers', 8));

const CENTRES = { rishikesh: [30.103, 78.297], haridwar: [29.945, 78.164], dehradun: [30.3244, 78.0419], mussoorie: [30.4598, 78.0643] };
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87);
const townOf = (pin) => {
  const [name, d] = Object.entries(CENTRES).map(([n, c]) => [n, km(pin, c)]).sort((a, b) => a[1] - b[1])[0];
  return d <= 25 ? name : '';
};

const db = getDb();
const queue = db.prepare(`SELECT url, seen_for FROM candidate_pages WHERE status = 'unchecked' AND platform_key = 'Airbnb' LIMIT ?`).all(LIMIT);
if (!queue.length) { console.log('verify_airbnb_unchecked: nothing queued'); process.exit(0); }

const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found|we.?ve removed the page/i;

const extract = () => {
  let name = '', pin = null, locality = '', ldName = false, ltype = '';
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const nodes = [].concat(JSON.parse(s.textContent)).flatMap((n) => [n, ...(n['@graph'] || [])]);
      for (const n of nodes) {
        const types = [].concat(n['@type'] || []).join(' ');
        if (!/VacationRental|Hotel|LodgingBusiness|Accommodation|Hostel|Resort|BedAndBreakfast|Campground|House|Apartment/i.test(types)) continue;
        if (!name && n.name) { name = n.name; ldName = true; }
        ltype ||= /VacationRental/i.test(types) ? 'VacationRental' : types;
        locality ||= (n.address && n.address.addressLocality) || '';
        // Airbnb: top-level lat/lng on the node itself; other sites nest under geo -- check both
        if (!pin) {
          if (n.latitude && n.longitude) pin = [Number(n.latitude), Number(n.longitude)];
          else if (n.geo && n.geo.latitude && n.geo.longitude) pin = [Number(n.geo.latitude), Number(n.geo.longitude)];
        }
      }
    } catch { /* not JSON */ }
  }
  const h1s = [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()).filter(Boolean);
  const text = (document.body?.innerText || '').slice(0, 3000);
  return {
    name: name || (h1s.length === 1 ? h1s[0] : '') || document.title,
    nameSrc: ldName ? 'ld' : h1s.length === 1 ? 'h1' : 'title',
    ltype, locality, pin,
    dead: /no longer available|is not available on our site|this property is closed|hotel not found|page not found|we.?ve removed the page/i.test(text),
  };
};

const updStmt = db.prepare(`
  UPDATE candidate_pages SET platform_key = 'Airbnb', name = ?, lat = ?, lng = ?, town = ?, state = ?, seen_for = ?, checked = ?,
    ltype = ?, name_src = ?, locality = ?, status = 'checked'
  WHERE url = ? AND status = 'unchecked'
`);

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.route('**/*', (r) => (['image', 'media', 'font', 'stylesheet'].includes(r.request().resourceType()) ? r.abort() : r.continue()));

const tally = { ok: 0, closed: 0, elsewhere: 0, 'no pin': 0, unreadable: 0 };
let n = 0;
const started = Date.now();
const worker = async () => {
  for (let job; (job = queue.shift());) {
    const page = await ctx.newPage();
    let state = 'unreadable', name = '', pin = null, town = '', ev = {};
    try {
      await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await page.waitForFunction(() => document.querySelector('script[type="application/ld+json"]') || /no longer available|removed the page|page not found/i.test((document.body?.innerText || '').slice(0, 2000)), null, { timeout: 10000 }).catch(() => {});
      const r = await page.evaluate(extract);
      ev = r; name = r.name;
      pin = r.pin && r.pin.every(Number.isFinite) ? r.pin : null;
      town = pin ? townOf(pin) : '';
      state = r.dead ? 'closed' : !pin ? 'no pin' : town ? 'ok' : 'elsewhere';
    } catch { /* unreadable */ }
    await page.close().catch(() => {});
    n++; tally[state] = (tally[state] || 0) + 1;
    const clean = (v) => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
    updStmt.run(clean(name), pin?.[0] ?? null, pin?.[1] ?? null, town || null, state, job.seen_for,
      new Date().toISOString().slice(0, 10), clean(ev.ltype), clean(ev.nameSrc), clean(ev.locality), job.url);
    if (n % 45 === 0) console.log(`  checkpoint: ${n}/${queue.length + n} done — ${JSON.stringify(tally)}`);
  }
};
await Promise.all(Array.from({ length: WORKERS }, worker));
await ctx.close();
await browser.close();
console.log(`verify_airbnb_unchecked: ${n} page(s) in ${((Date.now() - started) / 1000).toFixed(0)}s — ${JSON.stringify(tally)}`);
