#!/usr/bin/env node
// Scratch script (this session, 2026-10-16): re-checks candidate_pages rows stuck at status='checked',
// state in ('unreadable','no pin') -- these were checked WEEKS AGO (Oct 6-14) by the old plain-fetch
// verify_seen.mjs, which never runs page JS, so any OTA that injects its geo client-side looked empty.
// Confirmed by hand in a real browser tonight: Agoda (meta tags), Booking.com-style generic (JSON-LD
// geo.lat/lng), MakeMyTrip (a raw "lat":X,"lng":Y pair embedded in the page HTML, not in JSON-LD) and
// Goibibo (window.__initial_state__.detailsUnif.static.hotelDetails.{lat,lng,name}) ALL load fine and
// carry real geo once rendered -- they were never actually blocked, just checked with the wrong tool.
// Hotels.com checked and confirmed NOT recoverable this way (no JSON-LD, no regex match, needs real
// interaction) -- intentionally excluded here, same conclusion the small-OTA track reached earlier.
// Same safe pattern as the other scratch scripts tonight: headed Chromium, bounded multi-tab concurrency,
// page.waitForFunction polling instead of a fixed wait, crash resilience, guarded UPDATE.
import { chromium } from 'playwright';
import { getDb } from './db.mjs';

const db = getDb();
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const LIMIT = Number(arg('--limit', 150));
const GAP_MS = Number(arg('--gap', 1200));
const CONCURRENCY = Number(arg('--concurrency', 2));
const ONLY_PLATFORM = arg('--platform', '');

const STATE = { OK: 'ok', ELSEWHERE: 'elsewhere', NO_PIN: 'no pin', UNREADABLE: 'unreadable', CLOSED: 'closed' };
const CENTRES = { rishikesh: [30.103, 78.297], haridwar: [29.945, 78.164], dehradun: [30.3244, 78.0419], mussoorie: [30.4598, 78.0643] };
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87);
const townOf = (pin) => {
  const [name, d] = Object.entries(CENTRES).map(([n, c]) => [n, km(pin, c)]).sort((a, b) => a[1] - b[1])[0];
  return d <= 25 ? name : '';
};
const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found|we.?ve removed the page/i;

// NOTE: page.evaluate(fn) serializes only fn's own source and runs it inside the page's isolated
// world -- it does NOT carry Node closures. Every extractor below therefore defines its own copy
// of the dead-listing regex inline instead of referencing the module-level DEAD_RE const; the old
// code referenced DEAD_RE from inside these functions, which threw "DEAD_RE is not defined" in the
// browser on every single call, silently caught by the worker's try/catch as STATE.UNREADABLE --
// this was the actual root cause of the 0-ok bug, unrelated to readiness polling or concurrency.
function extractAgoda() {
  const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found|we.?ve removed the page/i;
  const metaGeo = () => {
    const lat = document.querySelector('meta[property="place:location:latitude"]')?.content;
    const lng = document.querySelector('meta[property="place:location:longitude"]')?.content;
    return lat && lng ? [Number(lat), Number(lng)] : null;
  };
  let name = '';
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const nodes = [].concat(JSON.parse(s.textContent));
      for (const n of nodes) if (!name && n.name) name = n.name;
    } catch {}
  }
  const h1 = document.querySelector('h1')?.innerText || '';
  const bodyText = (document.body?.innerText || '').slice(0, 3000);
  // Agoda sends a removed listing to the city-listing hub instead of a 404: no /hotel/ in the final path
  const redirectedToHub = !/\/hotel\//.test(location.pathname);
  return { name: name || document.querySelector('meta[property="og:title"]')?.content || h1 || document.title, pin: metaGeo(), dead: redirectedToHub || DEAD_RE.test(bodyText) };
}

function extractGeneric() {
  const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found|we.?ve removed the page/i;
  let name = '', pin = null;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const nodes = [].concat(JSON.parse(s.textContent)).flatMap((n) => [n, ...(n['@graph'] || [])]);
      for (const n of nodes) {
        if (!/Hotel|LodgingBusiness|VacationRental|Resort/i.test([].concat(n['@type'] || []).join(' '))) continue;
        if (!name && n.name) name = n.name;
        const g = n.geo || {};
        if (!pin && g.latitude && g.longitude) pin = [Number(g.latitude), Number(g.longitude)];
      }
    } catch {}
  }
  // Booking.com's own global (not JSON-LD): set before any LD/meta renders (verified by the parallel
  // Booking.com track tonight -- its JSON-LD Hotel node carries no geo at all on real pages).
  if (!pin) {
    try {
      const lat = window.booking?.env?.b_map_center_latitude;
      const lng = window.booking?.env?.b_map_center_longitude;
      if (lat && lng) pin = [Number(lat), Number(lng)];
    } catch {}
  }
  const h1 = document.querySelector('h1')?.innerText || '';
  const bodyText = (document.body?.innerText || '').slice(0, 3000);
  return { name: name || document.querySelector('meta[property="og:title"]')?.content || h1 || document.title, pin, dead: DEAD_RE.test(bodyText) };
}

function extractMakeMyTrip() {
  const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found|we.?ve removed the page/i;
  const html = document.documentElement.innerHTML;
  const m = html.match(/"lat"\s*:\s*(-?\d+\.\d+)[^}]{0,60}"lng"\s*:\s*(-?\d+\.\d+)/i);
  let name = '';
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const nodes = [].concat(JSON.parse(s.textContent));
      for (const n of nodes) if (!name && /Hotel|LodgingBusiness/i.test(n['@type'] || '') && n.name) name = n.name;
    } catch {}
  }
  const h1 = document.querySelector('h1')?.innerText || '';
  const bodyText = (document.body?.innerText || '').slice(0, 3000);
  return { name: name || h1 || document.title, pin: m ? [Number(m[1]), Number(m[2])] : null, dead: DEAD_RE.test(bodyText) };
}

function extractGoibibo() {
  const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found|we.?ve removed the page/i;
  try {
    const hd = window.__initial_state__?.detailsUnif?.static?.hotelDetails;
    if (hd) {
      const bodyText = (document.body?.innerText || '').slice(0, 3000);
      return { name: hd.name || hd.hotelName || document.title, pin: typeof hd.lat === 'number' && typeof hd.lng === 'number' ? [hd.lat, hd.lng] : null, dead: DEAD_RE.test(bodyText) };
    }
  } catch {}
  return extractGeneric();
}

// Per-platform readiness check: poll for this instead of a blind sleep, since a fixed wait under
// multi-tab concurrency was proven tonight to fire before client-side JS has actually injected the
// data (false negatives), especially under CPU contention from several tabs loading heavy pages at once.
const READY = {
  Agoda: () => !!document.querySelector('meta[property="place:location:latitude"]') || !/\/hotel\//.test(location.pathname),
  'Booking.com': () => /"geo"\s*:\s*\{/.test(document.documentElement.innerHTML) || typeof window.booking !== 'undefined',
  MakeMyTrip: () => /"lat"\s*:\s*-?\d+\.\d+/.test(document.documentElement.innerHTML),
  Goibibo: () => !!window.__initial_state__,
};

const EXTRACTORS = { Agoda: extractAgoda, 'Booking.com': extractGeneric, MakeMyTrip: extractMakeMyTrip, Goibibo: extractGoibibo };
// --platform accepts a comma-separated list so one invocation (one browser launch) can cover
// several platforms at once -- avoids popping up multiple headed Chrome windows for separate runs.
const PLATFORMS = ONLY_PLATFORM ? ONLY_PLATFORM.split(',').map((s) => s.trim()) : Object.keys(EXTRACTORS);

const updStmt = db.prepare(`
  UPDATE candidate_pages SET name = ?, lat = ?, lng = ?, town = ?, state = ?, checked = ?, decision_why = ?, status = 'checked'
  WHERE url = ? AND status = 'checked' AND state IN ('unreadable', 'no pin')
`);

let allRows = [];
for (const p of PLATFORMS) {
  const rows = db.prepare(`SELECT url, ? AS platform FROM candidate_pages WHERE status = 'checked' AND state IN ('unreadable','no pin') AND platform_key = ? ORDER BY url LIMIT ?`).all(p, p, LIMIT);
  allRows = allRows.concat(rows);
}
console.log(`recheck_old_unreadable: ${allRows.length} row(s) queued across [${PLATFORMS.join(', ')}] (gap ${GAP_MS}ms, concurrency ${CONCURRENCY}, headed)`);

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
await ctx.route('**/*', (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));

// interleave platforms across the shared queue (Fisher-Yates) so concurrency is spread across all
// of them for the whole run instead of draining one platform before starting the next
const queue = allRows.slice();
for (let i = queue.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [queue[i], queue[j]] = [queue[j], queue[i]];
}
let n = 0, ok = 0, closed = 0, stillBad = 0;
const byPlatform = {};

// MakeMyTrip's Akamai edge throttles by cumulative request volume from this IP: once tripped it
// serves a fake status-200 stub (6-byte JSON body `200-OK` wrapped in a tiny HTML shell, content-type
// application/json, "akamai-cache-status: Error from child") instead of the real page -- confirmed
// by hand tonight (a brand-new browser/context's very FIRST request can already get this stub once
// enough cumulative requests have hit the IP; slowing the per-request gap alone did not clear it).
// This is a bot-mitigation block, not an extractor bug: real page loads for the same URL class
// worked fine earlier in the session before the volume built up. Treat it as retryable, not a
// genuine "unreadable" -- never write it to the DB, and back off hard (platform-wide) when seen.
const isBlockedStub = (html) => html.length < 300 && /200-OK|json-formatter-container/i.test(html);
let mmtBackoffUntil = 0;

async function worker(id) {
  let page = await ctx.newPage();
  for (let job; (job = queue.shift());) {
    const { url, platform } = job;
    if (platform === 'MakeMyTrip' && Date.now() < mmtBackoffUntil) {
      queue.push(job); // put it back for later instead of burning it while blocked
      await page.waitForTimeout(2000);
      continue;
    }
    const extractFn = EXTRACTORS[platform];
    let state = STATE.UNREADABLE, pin = null, town = '', ev = {}, dead = false, blocked = false;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const html = await page.content();
      if (isBlockedStub(html)) {
        blocked = true;
        if (platform === 'MakeMyTrip') mmtBackoffUntil = Date.now() + 60000; // cool off 60s platform-wide
        console.log(`[tab${id}] BLOCKED (bot-mitigation stub) ${platform} ${url}`);
      } else {
        await page.waitForFunction(READY[platform], { timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(800); // small settle after the readiness condition first turns true
        ev = await page.evaluate(extractFn);
        pin = ev.pin && ev.pin.every(Number.isFinite) ? ev.pin : null;
        town = pin ? townOf(pin) : '';
        state = ev.dead ? STATE.CLOSED : !pin ? (ev.name ? STATE.NO_PIN : STATE.UNREADABLE) : town ? STATE.OK : STATE.ELSEWHERE;
      }
    } catch (e) {
      if (/Target page, context or browser has been closed|Target closed/.test(String(e.message))) {
        try { page = await ctx.newPage(); } catch { return; }
        queue.unshift(job);
        continue;
      }
      state = STATE.UNREADABLE;
      console.log(`[tab${id}] ERROR ${platform} ${url}: ${e.message}`);
    }
    if (blocked) {
      job.retries = (job.retries || 0) + 1;
      if (job.retries <= 5) {
        queue.push(job); // retryable, not a real result -- re-queue for after the backoff, don't write or count it
        await page.waitForTimeout(GAP_MS);
        continue;
      }
      console.log(`[tab${id}] gave up after 5 blocked retries: ${platform} ${url} (left unwritten, still 'checked'/'unreadable' or 'no pin' from before)`);
      continue; // never write a blocked-stub result to the DB even after giving up
    }
    n++;
    byPlatform[platform] = byPlatform[platform] || { n: 0, ok: 0 };
    byPlatform[platform].n++;
    if (state === STATE.OK) { ok++; byPlatform[platform].ok++; }
    if (state === STATE.CLOSED) closed++;
    if (state === STATE.UNREADABLE || state === STATE.NO_PIN) stillBad++;
    const clean = (v) => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
    updStmt.run(clean(ev.name), pin?.[0] ?? null, pin?.[1] ?? null, town || null, state,
      new Date().toISOString().slice(0, 10), 'rechecked with a real browser 2026-10-16 (old plain-fetch check never ran page JS)', url);
    console.log(`[tab${id} ${n}/${allRows.length}] ${platform.padEnd(12)} ${state.padEnd(10)} ${url}`);
    try { await page.waitForTimeout(GAP_MS); } catch {}
  }
  await page.close().catch(() => {});
}

browser.on('disconnected', () => console.log('recheck_old_unreadable: browser disconnected unexpectedly'));
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1).catch((e) => console.log(`[tab${i + 1}] worker exited: ${e.message}`))));
await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
console.log(`recheck_old_unreadable: done. ${n} checked, ${ok} ok, ${closed} closed, ${stillBad} still unreadable/no-pin`);
console.log('by platform:', byPlatform);
process.exit(0);
