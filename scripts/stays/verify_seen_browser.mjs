#!/usr/bin/env node
// Browser-rendered follow-up to verify_seen.mjs: for OTAs whose property page puts its pin/address into the
// DOM only after client-side JS runs (so verify_seen.mjs's plain `domcontentloaded` fetch sees an empty shell),
// this script renders the page in a real Playwright browser, waits for it to actually finish loading, and
// extracts name/lat/lng/town/state/ltype/name_src/locality/postal/signals/final_url -- the exact candidate_pages
// columns verify_seen.mjs already fills -- so map_seen_pages.py and import_new_stays.py consume its rows exactly
// the same way, no format change on their end.
//
// Investigated 2026-10-15 against live candidate_pages rows stuck at status='checked' with lat IS NULL, confirmed
// on 25-row batches per platform (node scripts/stays/verify_seen_browser.mjs --platform <p> --limit 25):
//   - Agoda: raw HTML is an almost-empty shell (no <title>, no meta tags); once rendered, the page carries
//     `<meta property="place:location:latitude|longitude">` (and a JSON-LD Hotel block with name/address but no
//     geo) -- the SAME meta-tag read verify_seen.mjs's extract() already does, it just never saw it because the
//     plain fetch never runs the JS that injects those tags. Batch result: 15/25 (60%) got a usable pin.
//   - Airbnb: a `script[type="application/ld+json"]` with `"@type":"VacationRental"` carries `latitude`/
//     `longitude` as TOP-LEVEL numeric fields (not nested under `geo` like Booking.com/Hotel JSON-LD) plus
//     `address.addressLocality` (no postal code seen). Most "unreadable" rows are genuinely gone (the page
//     shows "we've removed the page you're looking for").
//   - Goibibo and MakeMyTrip: every sample URL tried (several browser configs: default headers, added
//     accept-language/viewport, `--disable-http2`) fails at the network layer with `net::ERR_HTTP2_PROTOCOL_ERROR`
//     (or, with HTTP/2 disabled, a flat connection timeout -- the flag does not fall back to HTTP/1.1 cleanly in
//     headless Chromium). A plain `curl --http1.1` reaches Goibibo (200) but MakeMyTrip still times out even over
//     HTTP/1.1. This reads as server-side bot mitigation (a WAF resetting the connection for an automated-browser
//     fingerprint), not anything about our page-loading logic -- not something a `waitUntil`/header tweak fixes.
//     They are wired into PLATFORM_EXTRACTORS below (so a future unblock -- a different TLS/HTTP stack, a vetted
//     proxy -- is a one-line swap) but realistically fail today; see the report in PROGRESS.md / handoff notes
//     for the confirmed batch count.
//
//   node scripts/stays/verify_seen_browser.mjs [--limit 100] [--workers 4] [--platform Agoda] [--shard i/N]
// --shard i/N: take every N-th URL (1-based i), so N runs can go at once without duplicating each other's work
// (same convention as guess_booking_slugs.mjs: sort the job list into a fixed order first, then i%N, so shard
// i/N is deterministic -- the same subset every time -- regardless of process or DB row order).
import { chromium } from 'playwright';
import { platformOf, cleanUrl } from './ota-match.mjs';
import { getDb } from './db.mjs';

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const LIMIT = Number(arg('--limit', 100));
const WORKERS = Number(arg('--workers', 4)); // real browser pages are heavier than verify_seen.mjs's plain fetches
const ONLY_PLATFORM = arg('--platform', '');
const [SHARD, SHARDS] = arg('--shard', '1/1').split('/').map(Number);
const NAV_TIMEOUT_MS = 20000;
const RENDER_WAIT_MS = Number(arg('--wait', 4000)); // map widgets / embedded state can load after domcontentloaded

// candidate_pages' state vocabulary (shared with verify_seen.mjs; map_seen_pages.py only branches on OK/ELSEWHERE,
// but every value here must stay one it or import_new_stays.py recognise -- never invent a new one ad hoc).
const STATE = { OK: 'ok', ELSEWHERE: 'elsewhere', NO_PIN: 'no pin', UNREADABLE: 'unreadable', CLOSED: 'closed', REDIRECTED: 'redirected' };
// Network-level bot-block, not a content problem (see Goibibo/MakeMyTrip note above) -- written to the DB as
// UNREADABLE (candidate_pages has no BLOCKED state), kept distinct only in this run's own console report.
const BLOCKED = 'blocked';

const CENTRES = { rishikesh: [30.103, 78.297], haridwar: [29.945, 78.164], dehradun: [30.3244, 78.0419], mussoorie: [30.4598, 78.0643] };
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87);
const townOf = (pin) => {
  const [name, d] = Object.entries(CENTRES).map(([n, c]) => [n, km(pin, c)]).sort((a, b) => a[1] - b[1])[0];
  return d <= 25 ? name : '';
};

const db = getDb();

// ---------------------------------------------------------------------------------------------------------
// Per-platform extraction. page.evaluate() can only serialize a self-contained function -- it cannot close
// over this module's scope -- so the shared JSON-LD/meta/heading readers below are installed on `window.__rh`
// via an init script (ctx.addInitScript, run before every navigation), and each extractor below calls into
// that one copy instead of reimplementing the same parsing loop. An extractor's ONLY job is reading fields off
// the already-rendered page; it never navigates, never writes to the DB, and never decides `state` (that stays
// in the orchestrator below, computed once from the fields every extractor returns in the same shape:
// { name, nameSrc, ltype, locality, postal, rated, bookable, pin: [lat,lng]|null, dead }).
// ---------------------------------------------------------------------------------------------------------
const INIT_SCRIPT = () => {
  const LODGING_TYPES = ['Hostel', 'BedAndBreakfast', 'Campground', 'VacationRental', 'Resort', 'Apartment', 'House', 'Hotel', 'LodgingBusiness', 'Accommodation'];
  const LODGING_RE = new RegExp(LODGING_TYPES.join('|'), 'i');
  const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found|we.?ve removed the page/i;
  window.__rh = {
    // every application/ld+json block on the page, flattened (a node's @graph counts as siblings), regardless of @type
    readLdNodes() {
      const out = [];
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { out.push(...[].concat(JSON.parse(s.textContent)).flatMap((n) => [n, ...(n['@graph'] || [])])); } catch { /* not JSON */ }
      }
      return out;
    },
    // only the lodging-typed nodes (Hotel/LodgingBusiness/...), for platforms whose JSON-LD is the hotel itself
    readLdLodgingNodes() {
      return window.__rh.readLdNodes().filter((n) => LODGING_RE.test([].concat(n['@type'] || []).join(' ')));
    },
    lodgingType(node) {
      const types = [].concat(node['@type'] || []).join(' ');
      return LODGING_TYPES.find((t) => new RegExp(t, 'i').test(types)) || '';
    },
    meta(prop) { return document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)?.content || ''; },
    metaGeo() {
      const lat = window.__rh.meta('place:location:latitude'), lng = window.__rh.meta('place:location:longitude');
      return lat && lng ? [Number(lat), Number(lng)] : null;
    },
    h1s() { return [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()).filter(Boolean); },
    bodyText(limit) { return (document.body?.innerText || '').slice(0, limit); },
    isDead(limit) { return DEAD_RE.test(window.__rh.bodyText(limit ?? 3000)); },
    isBookable(limit) { return /\b(check availability|see availability|show prices|reserve|i'll reserve|book now|select rooms?|choose your room)\b/i.test(window.__rh.bodyText(limit ?? 6000)); },
    nameSrc(ldName, metaTitle, h1s) { return ldName ? 'ld' : metaTitle ? 'meta' : h1s.length === 1 ? 'h1' : 'title'; },
  };
};

// Booking.com-style: geo nested under `n.geo.{latitude,longitude}` on a Hotel/LodgingBusiness node. Kept as
// the fallback for any platform without its own extractor below (Goibibo/MakeMyTrip today -- if their bot
// block ever lifts, this still reads their JSON-LD the same way verify_seen.mjs's plain-fetch extract() does).
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
    nameSrc: R.nameSrc(ldName, metaTitle, h1s), ltype, locality, postal, rated, bookable: R.isBookable(), pin, dead: R.isDead(),
  };
}

// Agoda: the geo pin is NOT in the JSON-LD (its Hotel block has name/address/description only); it arrives as
// plain Open Graph `place:location:latitude/longitude` meta tags once the page's JS has run.
function extractAgoda() {
  const R = window.__rh;
  let name = '', ltype = '', locality = '', postal = '', rated = false, ldName = false;
  for (const n of R.readLdLodgingNodes()) {
    if (!name && n.name) { name = n.name; ldName = true; }
    ltype ||= R.lodgingType(n);
    locality ||= (n.address && n.address.addressLocality) || '';
    postal ||= (n.address && n.address.postalCode) || '';
    if (n.aggregateRating) rated = true;
  }
  const h1s = R.h1s(), metaTitle = R.meta('og:title');
  return {
    name: name || metaTitle || (h1s.length === 1 ? h1s[0] : '') || document.title,
    nameSrc: R.nameSrc(ldName, metaTitle, h1s), ltype, locality, postal, rated, bookable: R.isBookable(), pin: R.metaGeo(), dead: R.isDead(),
  };
}

// Airbnb: a `script[type="application/ld+json"]` with `"@type":"VacationRental"` carries `latitude`/
// `longitude` as TOP-LEVEL numeric fields on the node itself (not nested under `geo`), plus
// `address.addressLocality` (no postal code observed). A room that no longer exists renders the
// "we've removed the page you're looking for" text instead.
function extractAirbnb() {
  const R = window.__rh;
  let name = '', pin = null, locality = '';
  for (const n of R.readLdNodes()) {
    if (!/VacationRental/i.test(n['@type'] || '')) continue;
    name ||= n.name || '';
    locality ||= (n.address && n.address.addressLocality) || '';
    if (!pin && typeof n.latitude === 'number' && typeof n.longitude === 'number') pin = [n.latitude, n.longitude];
  }
  const h1s = R.h1s();
  return {
    name: name || (h1s.length === 1 ? h1s[0] : '') || document.title,
    nameSrc: name ? 'ld' : h1s.length === 1 ? 'h1' : 'title', ltype: 'VacationRental', locality, postal: '', rated: false,
    bookable: R.isBookable(), pin, dead: R.isDead(2000),
  };
}

// Goibibo / MakeMyTrip: no working extractor yet -- every sample URL was blocked before any DOM existed (see
// the file header). Routed to the generic JSON-LD/meta reader so a future unblock needs no code change here.
const PLATFORM_EXTRACTORS = {
  Agoda: extractAgoda,
  Airbnb: extractAirbnb,
  Goibibo: extractGeneric,
  MakeMyTrip: extractGeneric,
};

function sameProperty(url, final) {
  const p = platformOf(url), q = platformOf(final);
  if (!p || !q || p.name !== q.name) return false;
  try { return new URL(cleanUrl(url, p.name)).pathname.toLowerCase() === new URL(cleanUrl(final, q.name)).pathname.toLowerCase(); } catch { return false; }
}

// Orchestration only: decide state from the fields an extractor returned. No platform knowledge here.
function classify(job, finalUrl, r) {
  const pin = r.pin && r.pin.every(Number.isFinite) ? r.pin : null;
  const town = pin ? townOf(pin) : '';
  let state = r.dead ? STATE.CLOSED : !r.name ? STATE.UNREADABLE : !pin ? STATE.NO_PIN : town ? STATE.OK : STATE.ELSEWHERE;
  if (state === STATE.OK && !sameProperty(job.url, finalUrl)) state = STATE.REDIRECTED;
  return { pin, town, state };
}

const updStmt = db.prepare(`
  UPDATE candidate_pages SET name = ?, lat = ?, lng = ?, town = ?, state = ?, checked = ?,
    ltype = ?, name_src = ?, locality = ?, postal = ?, signals = ?, final_url = ?, status = 'checked'
  WHERE url = ?
`);

const platforms = Object.keys(PLATFORM_EXTRACTORS);
const queue = [];
for (const p of ONLY_PLATFORM ? [ONLY_PLATFORM] : platforms) {
  for (const r of db.prepare(`SELECT url, platform_key as platform FROM candidate_pages WHERE status = 'checked' AND lat IS NULL AND platform_key = ?`).all(p)) {
    queue.push({ url: r.url, platform: r.platform });
  }
}
// sort into a fixed order BEFORE sharding, so --shard i/N always yields the same disjoint subset no matter
// what order the SQL SELECT (no ORDER BY) happened to return rows in on a given run
queue.sort((a, b) => a.url.localeCompare(b.url, 'en'));
const sharded = SHARDS > 1 ? queue.filter((_, i) => i % SHARDS === SHARD - 1) : queue;
const batch = sharded.slice(0, LIMIT);
console.log(`verify_seen_browser: shard ${SHARD}/${SHARDS}: ${batch.length} page(s) queued (of ${sharded.length} in this shard, ${queue.length} stuck without a pin)`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
await ctx.addInitScript(INIT_SCRIPT);
await ctx.route('**/*', (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));

const started = Date.now();
let n = 0, ok = 0;
const counts = {};
// Orchestration only: launch/navigate/wait, dispatch to the matching extractor, classify, write the row.
const worker = async () => {
  for (let job; (job = batch.shift());) {
    const extractFn = PLATFORM_EXTRACTORS[job.platform] || extractGeneric;
    const page = await ctx.newPage();
    let state = STATE.UNREADABLE, pin = null, town = '', ev = {}, finalUrl = '';
    try {
      await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      // let late-loading map widgets / embedded state settle -- domcontentloaded alone is too early on these sites
      await page.waitForTimeout(RENDER_WAIT_MS);
      finalUrl = page.url();
      ev = await page.evaluate(extractFn);
      ({ pin, town, state } = classify(job, finalUrl, ev));
    } catch (e) {
      state = /net::ERR_HTTP2_PROTOCOL_ERROR|net::ERR_CONNECTION/.test(String(e.message)) ? BLOCKED : STATE.UNREADABLE;
    }
    await page.close().catch(() => {});
    n++; if (state === STATE.OK) ok++;
    counts[job.platform] = counts[job.platform] || { n: 0, ok: 0 };
    counts[job.platform].n++; if (state === STATE.OK) counts[job.platform].ok++;
    const clean = (v) => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
    const signals = [ev.rated ? 'rated' : '', ev.bookable ? 'bookable' : ''].filter(Boolean).join(',');
    updStmt.run(clean(ev.name), pin?.[0] ?? null, pin?.[1] ?? null, town || null, state === BLOCKED ? STATE.UNREADABLE : state,
      new Date().toISOString().slice(0, 10), clean(ev.ltype), clean(ev.nameSrc), clean(ev.locality), clean(ev.postal),
      signals, clean(finalUrl), job.url);
  }
};
await Promise.all(Array.from({ length: WORKERS }, worker));
await ctx.close();
await browser.close();
console.log(`verify_seen_browser: ${n} page(s) in ${((Date.now() - started) / 1000).toFixed(0)} s, ${ok} with a usable pin in Rishikesh/Haridwar/Dehradun/Mussoorie`);
for (const [p, c] of Object.entries(counts)) console.log(`  ${p}: ${c.ok}/${c.n} ok`);
