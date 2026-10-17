#!/usr/bin/env node
// Scratch script (this session, Booking.com track): resolve candidate_pages rows where
// platform_key='Booking.com' AND status='unchecked'. Mirrors scripts/stays/_scratch_agoda_unchecked_browser.mjs
// (headed, single worker, paced) but uses Booking.com's own extraction shape: geo lives nested under the
// JSON-LD Hotel/LodgingBusiness node's `geo.latitude`/`geo.longitude` (verify_seen_browser.mjs's
// extractGeneric()), not Agoda's Open Graph meta tags.
//
// Dead-page check (manually probed 2026-10-16 against two live unchecked rows): a removed/closed Booking.com
// property does NOT render a "not available" message on its own URL -- it 301s to
// booking.com/searchresults...&closed_msg=<id>..., i.e. redirected off any /hotel/ path to a search-results
// page. A live property stays on .../hotel/<cc>/<slug>(.en-gb).html. So "redirected away from /hotel/" is the
// closed signal here, same shape as Agoda's redirectedToHub() but adapted to Booking.com's URL pattern.
//
// Geo correction (found while sanity-checking the first --limit 5 batch): on the live pages actually probed,
// the JSON-LD Hotel node here carries NO `geo` field at all (just name/address/description/image) -- the task
// brief's "nested under geo.latitude/longitude" did not hold for this sample. The real pin is a global JS
// variable set before any JSON-LD/meta: `booking.env.b_map_center_latitude` / `b_map_center_longitude`
// (also mirrored inside an embedded JSON blob as `location.latitude`/`longitude`, but the booking.env globals
// are simpler to read reliably). extractGeneric() below tries ld geo first (in case some pages do carry it),
// then these globals, then the OG meta tags, in that order.
// Only writes rows guarded by `AND status = 'unchecked'`, so it can't clobber a row another track already touched.
import { chromium } from 'playwright';
import { getDb } from './db.mjs';

const db = getDb();

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const LIMIT = Number(arg('--limit', 150));
const GAP_MS = Number(arg('--gap', 2000));
// Default 2 (not 4): several headed Chromium instances across tracks (this run, the Agoda run, manual
// browser-extension tabs) share this machine's memory; the Agoda track saw free memory drop to ~72MB at
// concurrency 4 and its browser died outright. Raise again once other tracks finish and memory frees up.
const CONCURRENCY = Number(arg('--concurrency', 2));

const STATE = { OK: 'ok', ELSEWHERE: 'elsewhere', NO_PIN: 'no pin', UNREADABLE: 'unreadable', CLOSED: 'closed', REDIRECTED: 'redirected' };
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
  window.__rh = {
    readLdNodes() {
      const out = [];
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { out.push(...[].concat(JSON.parse(s.textContent)).flatMap((n) => [n, ...(n['@graph'] || [])])); } catch {}
      }
      return out;
    },
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
    bookingEnvGeo() {
      try {
        const lat = window.booking && window.booking.env && window.booking.env.b_map_center_latitude;
        const lng = window.booking && window.booking.env && window.booking.env.b_map_center_longitude;
        return Number.isFinite(lat) && Number.isFinite(lng) ? [Number(lat), Number(lng)] : null;
      } catch { return null; }
    },
    ldGeo() {
      for (const n of window.__rh.readLdLodgingNodes()) {
        const g = n.geo || {};
        if (g.latitude && g.longitude) return [Number(g.latitude), Number(g.longitude)];
      }
      return null;
    },
    hasGeo() { return !!(window.__rh.ldGeo() || window.__rh.bookingEnvGeo() || window.__rh.metaGeo()); },
  };
};

// Booking.com-style: geo nested under n.geo.{latitude,longitude} on the Hotel/LodgingBusiness JSON-LD node.
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
  if (!pin) pin = R.bookingEnvGeo();
  if (!pin) pin = R.metaGeo();
  const h1s = R.h1s(), metaTitle = R.meta('og:title');
  return {
    name: name || metaTitle || (h1s.length === 1 ? h1s[0] : '') || document.title,
    nameSrc: R.nameSrc(ldName, metaTitle, h1s), ltype, locality, postal, rated, bookable: R.isBookable(), pin, dead: R.isDead(),
  };
}

// A removed/closed Booking.com property redirects away from its /hotel/ page to a search-results page
// (observed with a `closed_msg=` query param, but we treat any non-/hotel/ redirect as closed to be safe).
function redirectedToHub(finalUrl) {
  try {
    const u = new URL(finalUrl);
    return u.hostname.includes('booking.com') && !/\/hotel\//.test(u.pathname);
  } catch { return false; }
}

function classify(finalUrl, r) {
  if (redirectedToHub(finalUrl)) return { pin: null, town: '', state: STATE.CLOSED };
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

const rows = db.prepare(`SELECT url FROM candidate_pages WHERE platform_key = 'Booking.com' AND status = 'unchecked' ORDER BY url LIMIT ?`).all(LIMIT);
console.log(`booking_unchecked_browser: ${rows.length} row(s) queued (gap ${GAP_MS}ms, concurrency ${CONCURRENCY}, headed)`);

const browser = await chromium.launch({ headless: false });
browser.on('disconnected', () => console.log('booking_unchecked_browser: browser DISCONNECTED (crashed or killed externally) -- any in-flight worker will re-queue its row, not record a false negative'));
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
await ctx.addInitScript(INIT_SCRIPT);
await ctx.route('**/*', (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));

let n = 0, ok = 0, closed = 0, blocked = 0;
const queue = rows.slice();

// "Target closed"-style errors (browser/context/page died mid-navigation, e.g. the OS killed Chromium under
// memory pressure from other concurrent tracks) are NOT a real "unreadable" result for that URL -- re-queue it
// and open a fresh page instead of recording a false negative.
const isTargetClosed = (e) => /Target (page, context or browser )?has been closed|has been closed/i.test(String(e && e.message));

// Each tab is its own independent, slow, sequential worker (same gap/pacing as the single-tab version);
// CONCURRENCY just controls how many such tabs run side by side, mirroring the Agoda track's own script --
// the per-tab pacing that avoids bot-detection is unchanged.
async function worker(id) {
  let page = await ctx.newPage();
  for (let job; (job = queue.shift());) {
    const { url } = job;
    let state = STATE.UNREADABLE, pin = null, town = '', ev = {}, finalUrl = '';
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // poll for geo instead of a fixed wait -- under concurrency several tabs loading at once means some
      // pages take longer than a fixed 4s to render their JSON-LD/booking.env geo, which was producing false
      // "unreadable"/"no pin" results (seen first-hand: a --concurrency 4 batch had 4/8 unreadable, 3 of
      // them with an empty final_url i.e. the navigation/extraction never even settled in time).
      try {
        await page.waitForFunction(() => window.__rh && window.__rh.hasGeo(), { timeout: 10000 });
      } catch { /* no geo ever showed up -- let extraction run anyway and classify from what's there */ }
      finalUrl = page.url();
      ev = await page.evaluate(extractGeneric);
      ({ pin, town, state } = classify(finalUrl, ev));
    } catch (e) {
      if (isTargetClosed(e)) {
        console.log(`[tab${id}] target closed mid-row, re-queuing ${url}`);
        queue.push(job);
        try { page = await ctx.newPage(); } catch { /* context/browser itself is gone -- bail out of this worker */ break; }
        continue; // don't record anything for this attempt
      }
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
    // guarded: the browser/context may have died since the row write above (e.g. killed under memory
    // pressure) -- a bare waitForTimeout on a dead page throws "Target closed" OUTSIDE the per-row try/catch
    // above, which would otherwise crash the whole worker/script and lose every other in-flight worker too.
    try { await page.waitForTimeout(GAP_MS); } catch { break; }
  }
  await page.close().catch(() => {});
}

// Guard each worker individually (allSettled, not all): one dead worker/browser must not crash the others
// or the whole script -- it just stops contributing rows, and whatever it never got to stays 'unchecked'
// for a future run.
const results = await Promise.allSettled(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));
results.forEach((r, i) => { if (r.status === 'rejected') console.log(`booking_unchecked_browser: tab${i + 1} worker crashed: ${r.reason}`); });
await browser.close().catch(() => {});
console.log(`booking_unchecked_browser: done. ${n} checked, ${ok} ok, ${closed} closed, ${blocked} network-blocked`);
