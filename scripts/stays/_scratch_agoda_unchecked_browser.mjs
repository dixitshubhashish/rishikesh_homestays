#!/usr/bin/env node
// Scratch script (this session, Agoda track): resolve candidate_pages rows where platform_key='Agoda'
// AND status='unchecked', using the same per-page extraction logic as scripts/stays/verify_seen_browser.mjs's
// extractAgoda()/classify() (duplicated here rather than imported since those are unexported inner functions).
// Deliberately HEADED (not headless) + single worker + a real pause between pages: the coordination ledger's
// 2026-10-16 owner correction says go slowly/deliberately because headless Playwright already got blocked on
// Agoda going too fast; this mirrors the real-browser-extension approach but automated and resumable in bulk.
// Only writes rows guarded by `AND status = 'unchecked'`, so it can't clobber a row another track already touched.
import { chromium } from 'playwright';
import { getDb } from './db.mjs';

const db = getDb();

const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const LIMIT = Number(arg('--limit', 150));
const GAP_MS = Number(arg('--gap', 3500)); // pause between page loads on a given tab, same spirit as the search's own pacing
const CONCURRENCY = Number(arg('--concurrency', 1)); // bounded tabs in parallel, same idea as google_ota_search.mjs's check() concurrency

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
    readLdLodgingNodes() {
      const RE = /Hostel|BedAndBreakfast|Campground|VacationRental|Resort|Apartment|House|Hotel|LodgingBusiness|Accommodation/i;
      return window.__rh.readLdNodes().filter((n) => RE.test([].concat(n['@type'] || []).join(' ')));
    },
    lodgingType(node) {
      const types = [].concat(node['@type'] || []).join(' ');
      return ['Hostel', 'BedAndBreakfast', 'Campground', 'VacationRental', 'Resort', 'Apartment', 'House', 'Hotel', 'LodgingBusiness', 'Accommodation'].find((t) => new RegExp(t, 'i').test(types)) || '';
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

// A redirect to a city-listing/search page (agoda.com/city/..., /search, no /hotel/ path) means the
// property page itself is gone -- Agoda sends dead listings to the city hub instead of a 404.
function redirectedToHub(finalUrl) {
  try {
    const u = new URL(finalUrl);
    return u.hostname.includes('agoda.com') && !/\/hotel\//.test(u.pathname);
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

const rows = db.prepare(`SELECT url FROM candidate_pages WHERE platform_key = 'Agoda' AND status = 'unchecked' ORDER BY url LIMIT ?`).all(LIMIT);
console.log(`agoda_unchecked_browser: ${rows.length} row(s) queued (gap ${GAP_MS}ms, concurrency ${CONCURRENCY}, headed)`);

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
await ctx.addInitScript(INIT_SCRIPT);
await ctx.route('**/*', (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));

let n = 0, ok = 0, closed = 0, blocked = 0;
const queue = rows.slice();

// Each tab is its own independent, slow, sequential worker (same gap/pacing as the single-tab version);
// CONCURRENCY just controls how many such tabs run side by side, same idea as google_ota_search.mjs's
// bounded check() concurrency -- the per-tab pacing that avoids bot-detection is unchanged.
async function worker(id) {
  let page = await ctx.newPage();
  for (let job; (job = queue.shift());) {
    const { url } = job;
    let state = STATE.UNREADABLE, pin = null, town = '', ev = {}, finalUrl = '';
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // poll for the geo meta tags instead of a fixed wait -- under concurrency, several tabs loading at
      // once means some pages take longer than a fixed 4s to inject them, which was producing false
      // "unreadable" results (confirmed by hand: a page flagged unreadable loaded fine with more time)
      try {
        await page.waitForFunction(() => window.__rh && window.__rh.metaGeo(), { timeout: 10000 });
      } catch { /* no geo ever showed up -- let extraction run anyway and classify from what's there */ }
      finalUrl = page.url();
      ev = await page.evaluate(extractAgoda);
      ({ pin, town, state } = classify(finalUrl, ev));
    } catch (e) {
      // if the page/context itself died (not just a nav timeout), re-open a fresh page instead of
      // letting the error escape the loop and crash the whole run -- one tab's death shouldn't lose
      // every other tab's progress
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

browser.on('disconnected', () => console.log('agoda_unchecked_browser: browser disconnected unexpectedly'));
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1).catch((e) => console.log(`[tab${i + 1}] worker exited: ${e.message}`))));
await browser.close().catch(() => {});
console.log(`agoda_unchecked_browser: done. ${n} checked, ${ok} ok, ${closed} closed, ${blocked} network-blocked`);
