#!/usr/bin/env node
// Scratch script (2026-10-16 session, "small-OTA track"): resolve candidate_pages rows for the smaller
// backlogs -- OYO, EaseMyTrip, Trivago, Cleartrip (Trip.com/Hotels.com/Expedia spot-checked and found
// blocked/unextractable, see below; Goibibo/MakeMyTrip already known network-blocked per
// verify_seen_browser.mjs's header note) -- using the same guarded-UPDATE pattern as
// _scratch_agoda_unchecked_browser.mjs (that file's pattern is copied verbatim below: headed Playwright,
// bounded multi-tab concurrency, waitForFunction polling, crash resilience on "Target closed").
//
// Per-platform spot checks done this session (one sample URL each, headed, 4s render wait):
//   - OYO: JSON-LD Hotel node, geo nested under `geo.{latitude,longitude}` -- same shape as Booking.com.
//     extractGeneric() (copied from verify_seen_browser.mjs) reads it directly.
//   - EaseMyTrip: JSON-LD LodgingBusiness node, geo nested the same way (lat/lng as numeric STRINGS,
//     `Number()` in extractGeneric() already coerces them). Works.
//   - Trivago: JSON-LD Hotel node, geo nested the same way too. One sample loaded clean (no "Access
//     Denied" this run); extractGeneric() reads it. If a batch run starts hitting "Access Denied" bodies,
//     treat remaining Trivago rows as blocked like Goibibo/MakeMyTrip -- don't force it (see isDenied()).
//   - Cleartrip: NO geo in its JSON-LD (Hotel node has name/address/rating only). The pin instead lives in
//     a Google Maps *embed iframe* (`#mapIframe` src="https://maps.google.com/maps?q=<lat>,<lng>&z=...").
//     Needs its own extractor (extractCleartrip() below) reading that iframe's src attribute.
//   - Trip.com (81 rows): every sample redirected straight to a "Sign in to Trip.com" page before any
//     property content rendered -- the property page itself requires auth to view, not a rendering delay.
//     SKIPPED, not wired into PLATFORM_EXTRACTORS/RUNNABLE below.
//   - Hotels.com (8 rows): rendered page (116KB of DOM, waited 5s) has no JSON-LD, no lat/lng anywhere in
//     the HTML (checked both generic numeric-key regexes and a maps-iframe check) -- geo appears to load
//     only after a user interaction (map tab click) this script doesn't drive. SKIPPED.
//   - Expedia (1 row): served a "Bot or Not?" interstitial (Imperva/PerimeterX-style bot check), same
//     family of block as Goibibo/MakeMyTrip's HTTP2-layer block just at the app layer instead. SKIPPED.
//
// Usage: node scripts/stays/_scratch_smallota_unchecked_browser.mjs --platform OYO [--limit 150]
//   [--concurrency 2] [--gap 1200]
// Only writes rows guarded by `AND status = 'unchecked'`, so it can never clobber a row another track
// already touched, same as every other script in this family.
import { chromium } from 'playwright';
import { getDb } from './db.mjs';

const db = getDb();

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const PLATFORM = arg('--platform', '');
const LIMIT = Number(arg('--limit', 150));
const GAP_MS = Number(arg('--gap', 1200)); // owner correction 2026-10-16: pace just under 1.2s/page per tab, not 1.8-3.5s
const CONCURRENCY = Number(arg('--concurrency', 2)); // owner correction 2026-10-16: default to multi-tab, not sequential

const RUNNABLE = new Set(['OYO', 'EaseMyTrip', 'Trivago', 'Cleartrip']);
if (!RUNNABLE.has(PLATFORM)) {
  console.error(`_scratch_smallota_unchecked_browser: --platform must be one of ${[...RUNNABLE].join(', ')} (Trip.com/Hotels.com/Expedia are skipped as blocked, see file header)`);
  process.exit(1);
}

const STATE = { OK: 'ok', ELSEWHERE: 'elsewhere', NO_PIN: 'no pin', UNREADABLE: 'unreadable', CLOSED: 'closed' };
const CENTRES = { rishikesh: [30.103, 78.297], haridwar: [29.945, 78.164], dehradun: [30.3244, 78.0419], mussoorie: [30.4598, 78.0643] };
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87);
const townOf = (pin) => {
  const [name, d] = Object.entries(CENTRES).map(([n, c]) => [n, km(pin, c)]).sort((a, b) => a[1] - b[1])[0];
  return d <= 25 ? name : '';
};

const INIT_SCRIPT = () => {
  const LODGING_TYPES = ['Hostel', 'BedAndBreakfast', 'Campground', 'VacationRental', 'Resort', 'Apartment', 'House', 'Hotel', 'LodgingBusiness', 'Accommodation'];
  const LODGING_RE = new RegExp(LODGING_TYPES.join('|'), 'i');
  const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found|we.?ve removed the page/i;
  const DENIED_RE = /access denied|you don.?t have permission to access/i;
  window.__rh = {
    readLdNodes() {
      const out = [];
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { out.push(...[].concat(JSON.parse(s.textContent)).flatMap((n) => [n, ...(n['@graph'] || [])])); } catch {}
      }
      return out;
    },
    readLdLodgingNodes() { return window.__rh.readLdNodes().filter((n) => LODGING_RE.test([].concat(n['@type'] || []).join(' '))); },
    lodgingType(node) {
      const types = [].concat(node['@type'] || []).join(' ');
      return LODGING_TYPES.find((t) => new RegExp(t, 'i').test(types)) || '';
    },
    meta(prop) { return document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)?.content || ''; },
    metaGeo() {
      const lat = window.__rh.meta('place:location:latitude'), lng = window.__rh.meta('place:location:longitude');
      return lat && lng ? [Number(lat), Number(lng)] : null;
    },
    mapIframeGeo() {
      const src = document.querySelector('#mapIframe, iframe[src*="maps.google"]')?.src || '';
      const m = src.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      return m ? [Number(m[1]), Number(m[2])] : null;
    },
    h1s() { return [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()).filter(Boolean); },
    bodyText(limit) { return (document.body?.innerText || '').slice(0, limit); },
    isDead(limit) { return DEAD_RE.test(window.__rh.bodyText(limit ?? 3000)); },
    isDenied(limit) { return DENIED_RE.test(window.__rh.bodyText(limit ?? 2000)); },
    isBookable(limit) { return /\b(check availability|see availability|show prices|reserve|i'll reserve|book now|select rooms?|choose your room)\b/i.test(window.__rh.bodyText(limit ?? 6000)); },
    nameSrc(ldName, metaTitle, h1s) { return ldName ? 'ld' : metaTitle ? 'meta' : h1s.length === 1 ? 'h1' : 'title'; },
  };
};

// Booking.com-style JSON-LD reader (copied from verify_seen_browser.mjs's extractGeneric): geo nested
// under `n.geo.{latitude,longitude}` on a Hotel/LodgingBusiness node. Covers OYO, EaseMyTrip, Trivago.
function extractGeneric() {
  const R = window.__rh;
  let name = '', pin = null, ltype = '', locality = '', postal = '', rated = false, ldName = false;
  for (const n of R.readLdLodgingNodes()) {
    if (!name && n.name) { name = n.name; ldName = true; }
    ltype ||= R.lodgingType(n);
    locality ||= (n.address && n.address.addressLocality) || '';
    postal ||= (n.address && n.address.postalCode) || '';
    if (n.aggregateRating) rated = true;
    const g = n.geo || {};
    if (!pin && g.latitude && g.longitude) pin = [Number(g.latitude), Number(g.longitude)];
  }
  if (!pin) pin = R.metaGeo();
  const h1s = R.h1s(), metaTitle = R.meta('og:title');
  return {
    name: name || metaTitle || (h1s.length === 1 ? h1s[0] : '') || document.title,
    nameSrc: R.nameSrc(ldName, metaTitle, h1s), ltype, locality, postal, rated, bookable: R.isBookable(), pin,
    dead: R.isDead(), denied: R.isDenied(),
  };
}

// Cleartrip: no geo in its JSON-LD Hotel node (name/address/rating only) -- the pin lives in a Google
// Maps embed iframe's `q=<lat>,<lng>` query param instead.
function extractCleartrip() {
  const R = window.__rh;
  let name = '', ltype = '', locality = '', rated = false, ldName = false;
  for (const n of R.readLdLodgingNodes()) {
    if (!name && n.name) { name = n.name; ldName = true; }
    ltype ||= R.lodgingType(n);
    locality ||= (n.address && n.address.addressLocality) || '';
    if (n.aggregateRating) rated = true;
  }
  const h1s = R.h1s(), metaTitle = R.meta('og:title');
  return {
    name: name || metaTitle || (h1s.length === 1 ? h1s[0] : '') || document.title,
    nameSrc: R.nameSrc(ldName, metaTitle, h1s), ltype, locality, postal: '', rated, bookable: R.isBookable(),
    pin: R.mapIframeGeo(), dead: R.isDead(), denied: R.isDenied(),
  };
}

const EXTRACTORS = { OYO: extractGeneric, EaseMyTrip: extractGeneric, Trivago: extractGeneric, Cleartrip: extractCleartrip };
const extractFn = EXTRACTORS[PLATFORM];

function classify(r) {
  if (r.denied) return { pin: null, town: '', state: 'blocked' };
  const pin = r.pin && r.pin.every(Number.isFinite) ? r.pin : null;
  const town = pin ? townOf(pin) : '';
  const state = r.dead ? STATE.CLOSED : !r.name ? STATE.UNREADABLE : !pin ? STATE.NO_PIN : town ? STATE.OK : STATE.ELSEWHERE;
  return { pin, town, state };
}

const updStmt = db.prepare(`
  UPDATE candidate_pages SET name = ?, lat = ?, lng = ?, town = ?, state = ?, checked = ?,
    ltype = ?, name_src = ?, locality = ?, postal = ?, signals = ?, final_url = ?, status = 'checked'
  WHERE url = ? AND status = 'unchecked'
`);

const rows = db.prepare(`SELECT url FROM candidate_pages WHERE platform_key = ? AND status = 'unchecked' ORDER BY url LIMIT ?`).all(PLATFORM, LIMIT);
console.log(`smallota_unchecked_browser[${PLATFORM}]: ${rows.length} row(s) queued (gap ${GAP_MS}ms, concurrency ${CONCURRENCY}, headed)`);

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
await ctx.addInitScript(INIT_SCRIPT);
await ctx.route('**/*', (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));

let n = 0, ok = 0, closed = 0, blocked = 0, crashed = 0;
const queue = rows.slice();

async function worker(id) {
  let page = await ctx.newPage();
  for (let job; (job = queue.shift());) {
    const { url } = job;
    let state = STATE.UNREADABLE, pin = null, town = '', ev = {}, finalUrl = '';
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // poll for either a JSON-LD lodging node or a map iframe instead of a fixed wait -- same reasoning
      // as the Agoda script's comment: under concurrency, a fixed wait produced false "unreadable" results
      try {
        await page.waitForFunction(
          () => (window.__rh && (window.__rh.readLdLodgingNodes().length > 0 || window.__rh.mapIframeGeo())),
          { timeout: 10000 },
        );
      } catch { /* nothing showed up in time -- extract from whatever's there and classify it */ }
      finalUrl = page.url();
      ev = await page.evaluate(extractFn);
      ({ pin, town, state } = classify(ev));
    } catch (e) {
      state = STATE.UNREADABLE;
      blocked++;
      if (/Target page, context or browser has been closed|Target closed/.test(String(e.message))) {
        crashed++;
        console.log(`[tab${id}] page died (${e.message.split('\n')[0]}), reopening`);
        try { page = await ctx.newPage(); } catch (e2) { console.log(`[tab${id}] could not reopen a page, stopping this worker: ${e2.message}`); return; }
        queue.unshift(job);
        continue;
      }
    }
    if (state === 'blocked') {
      // bot-block mid-run (e.g. Trivago "Access Denied") -- record as unreadable in the DB (candidate_pages
      // has no BLOCKED state) but keep it distinct in this run's own console tally
      state = STATE.UNREADABLE;
      blocked++;
    }
    n++; if (state === STATE.OK) ok++; if (state === STATE.CLOSED) closed++;
    const clean = (v) => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
    const signals = [ev.rated ? 'rated' : '', ev.bookable ? 'bookable' : ''].filter(Boolean).join(',');
    updStmt.run(clean(ev.name), pin?.[0] ?? null, pin?.[1] ?? null, town || null, state,
      new Date().toISOString().slice(0, 10), clean(ev.ltype), clean(ev.nameSrc), clean(ev.locality), clean(ev.postal),
      signals, clean(finalUrl), url);
    console.log(`[tab${id} ${n}/${rows.length}] ${state.padEnd(10)} ${url}`);
    try { await page.waitForTimeout(GAP_MS); } catch { /* page died between extraction and the gap wait */ }
  }
  await page.close().catch(() => {});
}

browser.on('disconnected', () => console.log(`smallota_unchecked_browser[${PLATFORM}]: browser disconnected unexpectedly`));
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1).catch((e) => console.log(`[tab${i + 1}] worker exited: ${e.message}`))));
await browser.close().catch(() => {});
console.log(`smallota_unchecked_browser[${PLATFORM}]: done. ${n} checked, ${ok} ok, ${closed} closed, ${blocked} blocked/unreadable (${crashed} tab crashes recovered)`);
