#!/usr/bin/env node
// Opens the booking-site pages the search harvested (candidate_pages, status 'unchecked': up to 6 property links per
// search, scripts/stays/db.mjs) FAST: headless browser, 8 pages at once, no images, styles, fonts or media, DOM-ready only,
// 12 s at most per page: a few seconds for the whole batch. Reads the property's name, its pin and its town (the JSON-LD and
// meta tags the booking sites put in the HTML) and UPDATEs the row to status 'checked'. Only pages whose pin is in Rishikesh
// or Haridwar (25 km of either) count (owner, 2026-10-06). map_seen_pages.py maps them to stays.
//
// Besides the pin it stores the evidence import_new_stays.py needs to auto-list a page as a new stay (owner, 2026-10-07):
// the JSON-LD lodging type (ltype), where the name came from (name_src), the address locality and postal code, signals
// (rated = a guest rating in the data, bookable = an availability/reserve button) and the final URL after redirects.
//
//   node scripts/stays/verify_seen.mjs [--limit 400] [--workers 8] [--refresh-days 10]
// --refresh-days N also re-opens `checked`/`held` rows whose state is `ok`, read more than N days ago (or missing the
// evidence columns), that no stay of ours lists yet, so a candidate's evidence stays fresh.
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { platformOf, cleanUrl } from './ota-match.mjs';
import { fileURLToPath } from 'url';
import { getDb } from './db.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BL = `${ROOT}docs/booking-links/`;
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const LIMIT = Number(arg('--limit', 400)), WORKERS = Number(arg('--workers', 8));
const REFRESH_DAYS = Number(arg('--refresh-days', 0));
// the centres of scripts/stays/cities.py (a test keeps them equal); a pin's town is the NEARER centre within 25 km
const CENTRES = { rishikesh: [30.103, 78.297], haridwar: [29.945, 78.164], dehradun: [30.3244, 78.0419], mussoorie: [30.4598, 78.0643] };
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87);
const townOf = (pin) => {
  const [name, d] = Object.entries(CENTRES).map(([n, c]) => [n, km(pin, c)]).sort((a, b) => a[1] - b[1])[0];
  return d <= 25 ? name : '';
};
// kept for coverage-report.test.js, which checks this list against CHECKED_COLS (the DB columns the same evidence fills)
const HEADER = ['url', 'platform', 'name', 'lat', 'lng', 'town', 'state', 'seen_for', 'checked', 'ltype', 'name_src', 'locality', 'postal', 'signals', 'final_url'];
const norm = (u) => u.split('?')[0].replace(/\/+$/, '').toLowerCase();

const db = getDb();

// the latest row per page wins (a re-read appends)
// pages a stay of ours lists (the booking-stays registry, owner 2026-10-07) need no re-read
const registered = new Set();
try {
  for (const l of readFileSync(`${ROOT}scripts/stays/booking-stays.tsv`, 'utf8').split(/\r?\n/).slice(1)) {
    const c = l.split('\t');
    for (const u of [c[8], ...(c[9] || '').split(';').map((x) => x.split('|')[1])]) if (u) registered.add(norm(u));
  }
} catch { /* no registry yet */ }
// pages a stay already has need no look: found.tsv, ota-links.tsv and the places' links
const have = new Set();
for (const f of [`${BL}found.tsv`, `${ROOT}scripts/stays/ota-links.tsv`, `${ROOT}scripts/stays/.cache/places/ota-links.tsv`]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, 'utf8').split(/\r?\n/).slice(1)) { const c = l.split('\t'); const u = c.find((x) => /^https?:\/\//.test(x)); if (u) have.add(norm(u)); }
}

const queue = [];
for (const r of db.prepare(`SELECT url, platform_key as platform, label, seen_for FROM candidate_pages WHERE status = 'unchecked'`).all()) {
  const n = norm(r.url);
  if (have.has(n) || !platformOf(r.url)) continue;
  queue.push({ url: r.url, platform: r.platform, label: r.label, seenFor: r.seen_for });
}
// checked/held pages due for a re-read (a page no stay of ours lists, so `have` does not hold it): state ok, stale or
// missing its evidence columns, not registered. A held page is included too: its evidence may refresh and requalify it.
if (REFRESH_DAYS > 0) {
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 86400e3).toISOString().slice(0, 10);
  const stale = db.prepare(`
    SELECT url, platform_key as platform, seen_for FROM candidate_pages
    WHERE status IN ('checked', 'held') AND state = 'ok'
      AND (checked < ? OR checked IS NULL OR (COALESCE(ltype, '') = '' AND COALESCE(name_src, '') = ''))
  `).all(cutoff);
  for (const r of stale) {
    const n = norm(r.url);
    if (registered.has(n) || !platformOf(r.url)) continue;
    queue.push({ url: r.url, platform: r.platform, label: '', seenFor: r.seen_for });
  }
}
// Booking.com first: its pages carry the pin in plain HTML
queue.sort((a, b) => (b.platform === 'Booking.com') - (a.platform === 'Booking.com'));
const batch = queue.slice(0, LIMIT);

const extract = () => {
  let name = '', pin = null, ltype = '', locality = '', postal = '', rated = false, ldName = false;
  const LODGING = ['Hostel', 'BedAndBreakfast', 'Campground', 'VacationRental', 'Resort', 'Apartment', 'House', 'Hotel', 'LodgingBusiness', 'Accommodation'];
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const nodes = [].concat(JSON.parse(s.textContent)).flatMap((n) => [n, ...(n['@graph'] || [])]);
      for (const n of nodes) {
        if (!/Hotel|LodgingBusiness|Accommodation|Hostel|Resort|BedAndBreakfast|Campground|VacationRental|House|Apartment/i.test([].concat(n['@type'] || []).join(' '))) continue;
        if (!name && n.name) { name = n.name; ldName = true; }
        const types = [].concat(n['@type'] || []).join(' ');
        ltype ||= LODGING.find((t) => new RegExp(t, 'i').test(types)) || '';
        locality ||= (n.address && n.address.addressLocality) || '';
        postal ||= (n.address && n.address.postalCode) || '';
        if (n.aggregateRating) rated = true;
        const g = n.geo || {};
        if (!pin && g.latitude && g.longitude) pin = [Number(g.latitude), Number(g.longitude)];
      }
    } catch { /* not JSON */ }
  }
  const meta = (p) => document.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.content || '';
  if (!pin && meta('place:location:latitude')) pin = [Number(meta('place:location:latitude')), Number(meta('place:location:longitude'))];
  const atlas = (document.querySelector('[data-atlas-latlng]')?.getAttribute('data-atlas-latlng') || '').split(',').map(Number);
  if (atlas.length === 2 && atlas[0]) pin = atlas;
  const h1s = [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()).filter(Boolean);
  const text = document.body?.innerText || '';
  const nameSrc = ldName ? 'ld' : meta('og:title') ? 'meta' : h1s.length === 1 ? 'h1' : 'title';
  const bookable = /\b(check availability|see availability|show prices|reserve|i'll reserve|book now|select rooms?|choose your room)\b/i.test(text.slice(0, 6000));
  return { name: name || meta('og:title') || (h1s.length === 1 ? h1s[0] : '') || document.title, nameSrc, ltype, locality, postal, rated, bookable, pin, dead: /no longer available|is not available on our site|this property is closed|hotel not found|page not found/i.test((document.body?.innerText || '').slice(0, 3000)) };
};

// the page we landed on is the same property page (language and country variants aside)
function sameProperty(url, final) {
  const p = platformOf(url), q = platformOf(final);
  if (!p || !q || p.name !== q.name) return false;
  try { return new URL(cleanUrl(url, p.name)).pathname.toLowerCase() === new URL(cleanUrl(final, q.name)).pathname.toLowerCase(); } catch { return false; }
}

const updStmt = db.prepare(`
  UPDATE candidate_pages SET platform_key = ?, name = ?, lat = ?, lng = ?, town = ?, state = ?, seen_for = ?, checked = ?,
    ltype = ?, name_src = ?, locality = ?, postal = ?, signals = ?, final_url = ?, status = 'checked'
  WHERE url = ?
`);

const browser = await chromium.launch();
const started = Date.now();
let n = 0, ok = 0;
// one shared browser context: Booking.com's bot check is solved once and its cookie serves every later page
const ctx = await browser.newContext();
await ctx.route('**/*', (r) => (['image', 'media', 'font', 'stylesheet'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
const worker = async () => {
  for (let job; (job = batch.shift());) {
    const page = await ctx.newPage();
    let state = 'unreadable', name = '', pin = null, town = '', ev = {}, finalUrl = '';
    try {
      await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
      // the first answer can be the bot-check page: the real page (with its JSON-LD) follows within a few seconds
      await page.waitForFunction(() => document.querySelector('script[type="application/ld+json"]') || /no longer available|not available on our site|page not found/i.test((document.body?.innerText || '').slice(0, 2000)), null, { timeout: 10000 }).catch(() => {});
      finalUrl = page.url();
      if (/[?&](?:closed_msg|hlrd)=/.test(finalUrl)) state = 'closed';
      else {
        const r = await page.evaluate(extract);
        name = r.name; pin = r.pin && r.pin.every(Number.isFinite) ? r.pin : null;
        town = pin ? townOf(pin) : '';
        ev = r;
        state = r.dead ? 'closed' : !name ? 'unreadable' : !pin ? 'no pin' : town ? 'ok' : 'elsewhere';
        // a redirect to another page (a list, a city, another property) is not the page we meant
        if (state === 'ok' && !sameProperty(job.url, finalUrl)) state = 'redirected';
      }
    } catch { /* blocked or crashed page */ }
    await page.close().catch(() => {});
    n++; if (state === 'ok') ok++;
    const clean = (v) => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
    const signals = [ev.rated ? 'rated' : '', ev.bookable ? 'bookable' : ''].filter(Boolean).join(',');
    updStmt.run(job.platform, clean(name), pin?.[0] ?? null, pin?.[1] ?? null, town || null, state, job.seenFor,
      new Date().toISOString().slice(0, 10), clean(ev.ltype), clean(ev.nameSrc), clean(ev.locality), clean(ev.postal),
      signals, clean(finalUrl), job.url);
  }
};
await Promise.all(Array.from({ length: WORKERS }, worker));
await ctx.close();
await browser.close();
console.log(`verify_seen: ${n} page(s) in ${((Date.now() - started) / 1000).toFixed(0)} s, ${ok} in Rishikesh or Haridwar with a pin (${queue.length - n} still queued)`);
