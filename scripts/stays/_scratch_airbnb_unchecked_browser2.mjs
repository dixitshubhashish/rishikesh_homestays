#!/usr/bin/env node
// Scratch script (this session, Airbnb track #2): resolve candidate_pages rows where platform_key='Airbnb'
// AND status='unchecked', using the same per-page extraction logic as scripts/stays/verify_seen_browser.mjs's
// extractAirbnb()/classify() (duplicated here rather than imported since those are unexported inner functions).
// Copied from _scratch_agoda_unchecked_browser.mjs (the proven headed+bounded-concurrency+waitForFunction+
// crash-resilience pattern from this session) with Airbnb's extraction swapped in: the VacationRental
// JSON-LD node carries latitude/longitude as TOP-LEVEL numeric fields (not nested under `geo` like
// Agoda/Booking Hotel-type JSON-LD). No "redirected to hub" closed-detection here (that's an Agoda-specific
// signal) -- a removed Airbnb listing is caught by the shared isDead() text-match regex instead.
// Only writes rows guarded by `AND status = 'unchecked'`, so it can't clobber a row another track already touched.
import { chromium } from 'playwright';
import { getDb } from './db.mjs';

const db = getDb();

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const LIMIT = Number(arg('--limit', 150));
const GAP_MS = Number(arg('--gap', 1800));
const CONCURRENCY = Number(arg('--concurrency', 2));

const STATE = { OK: 'ok', ELSEWHERE: 'elsewhere', NO_PIN: 'no pin', UNREADABLE: 'unreadable', CLOSED: 'closed', REDIRECTED: 'redirected' };
const CENTRES = { rishikesh: [30.103, 78.297], haridwar: [29.945, 78.164], dehradun: [30.3244, 78.0419], mussoorie: [30.4598, 78.0643] };
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87);
const townOf = (pin) => {
  const [name, d] = Object.entries(CENTRES).map(([n, c]) => [n, km(pin, c)]).sort((a, b) => a[1] - b[1])[0];
  return d <= 25 ? name : '';
};

const INIT_SCRIPT = () => {
  const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found|we.?ve removed the page/i;
  window.__rh = {
    readLdNodes() {
      const out = [];
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try { out.push(...[].concat(JSON.parse(s.textContent)).flatMap((n) => [n, ...(n['@graph'] || [])])); } catch {}
      }
      return out;
    },
    h1s() { return [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()).filter(Boolean); },
    bodyText(limit) { return (document.body?.innerText || '').slice(0, limit); },
    isDead(limit) { return DEAD_RE.test(window.__rh.bodyText(limit ?? 3000)); },
    isBookable(limit) { return /\b(check availability|see availability|show prices|reserve|i'll reserve|book now|select rooms?|choose your room)\b/i.test(window.__rh.bodyText(limit ?? 6000)); },
    vacationRentalPin() {
      for (const n of window.__rh.readLdNodes()) {
        if (!/VacationRental/i.test(n['@type'] || '')) continue;
        if (typeof n.latitude === 'number' && typeof n.longitude === 'number') return [n.latitude, n.longitude];
      }
      return null;
    },
  };
};

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

function classify(finalUrl, r) {
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

const rows = db.prepare(`SELECT url FROM candidate_pages WHERE platform_key = 'Airbnb' AND status = 'unchecked' ORDER BY url LIMIT ?`).all(LIMIT);
console.log(`airbnb_unchecked_browser2: ${rows.length} row(s) queued (gap ${GAP_MS}ms, concurrency ${CONCURRENCY}, headed)`);

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
await ctx.addInitScript(INIT_SCRIPT);
await ctx.route('**/*', (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));

let n = 0, ok = 0, closed = 0, blocked = 0;
const queue = rows.slice();

// Each tab is its own independent, slow, sequential worker; CONCURRENCY just controls how many such tabs
// run side by side, same idea as google_ota_search.mjs's bounded check() concurrency.
async function worker(id) {
  let page = await ctx.newPage();
  for (let job; (job = queue.shift());) {
    const { url } = job;
    let state = STATE.UNREADABLE, pin = null, town = '', ev = {}, finalUrl = '';
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // poll for the JSON-LD pin instead of a fixed wait -- under concurrency, several tabs loading at once
      // means some pages take longer than a fixed wait to inject their LD node, which was producing false
      // "unreadable" results in the Agoda version of this script (confirmed by hand with more time).
      try {
        await page.waitForFunction(() => window.__rh && window.__rh.vacationRentalPin(), { timeout: 10000 });
      } catch { /* no pin ever showed up -- let extraction run anyway and classify from what's there */ }
      finalUrl = page.url();
      ev = await page.evaluate(extractAirbnb);
      ({ pin, town, state } = classify(finalUrl, ev));
    } catch (e) {
      // if the page/context itself died (not just a nav timeout), re-open a fresh page instead of letting
      // the error escape the loop and crash the whole run -- one tab's death shouldn't lose every other
      // tab's progress
      state = STATE.UNREADABLE;
      blocked++;
      if (/Target page, context or browser has been closed|Target closed/.test(String(e.message))) {
        console.log(`[tab${id}] page died (${e.message.split('\n')[0]}), reopening`);
        try { page = await ctx.newPage(); } catch (e2) { console.log(`[tab${id}] could not reopen a page, stopping this worker: ${e2.message}`); return; }
        queue.unshift(job); // retry this url with the fresh page instead of recording a false negative
        continue;
      }
    }
    n++; if (state === STATE.OK) ok++; if (state === STATE.CLOSED) closed++;
    const clean = (v) => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
    const signals = [ev.rated ? 'rated' : '', ev.bookable ? 'bookable' : ''].filter(Boolean).join(',');
    updStmt.run(clean(ev.name), pin?.[0] ?? null, pin?.[1] ?? null, town || null, state,
      new Date().toISOString().slice(0, 10), clean(ev.ltype), clean(ev.nameSrc), clean(ev.locality), clean(ev.postal),
      signals, clean(finalUrl), url);
    console.log(`[tab${id} ${n}/${rows.length}] ${state.padEnd(10)} ${url}`);
    try { await page.waitForTimeout(GAP_MS); } catch { /* page died between extraction and the gap wait -- next loop iteration reopens it */ }
  }
  await page.close().catch(() => {});
}

browser.on('disconnected', () => console.log('airbnb_unchecked_browser2: browser disconnected unexpectedly'));
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1).catch((e) => console.log(`[tab${i + 1}] worker exited: ${e.message}`))));
// awaiting close() on an already-dead connection can hang forever (observed: a zombie node process that
// already printed its own "done" line but never exited) -- race it against a timeout so the process always exits
await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
console.log(`airbnb_unchecked_browser2: done. ${n} checked, ${ok} ok, ${closed} closed, ${blocked} network-blocked`);
process.exit(0);
