#!/usr/bin/env node
// One-off (2026-10-17): re-extract the ~32 candidate_pages rows just cleared of a placeholder/default
// geocode (India's geographic centre, null island) via the real Edge CDP connection (see
// _scratch_recheck_via_edge.mjs's header for why: avoids the navigator.webdriver bot-mitigation block).
// Covers Agoda, Booking.com, EaseMyTrip -- the three platforms this specific bad-geocode batch touched.
import { chromium } from 'playwright';
import { getDb } from './db.mjs';

const db = getDb();
const CDP_PORT = '9225';
const STATE = { OK: 'ok', ELSEWHERE: 'elsewhere', NO_PIN: 'no pin', UNREADABLE: 'unreadable', CLOSED: 'closed' };
const CENTRES = { rishikesh: [30.103, 78.297], haridwar: [29.945, 78.164], dehradun: [30.3244, 78.0419], mussoorie: [30.4598, 78.0643] };
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87);
function townOf(pin) { const [name, d] = Object.entries(CENTRES).map(([n, c]) => [n, km(pin, c)]).sort((a, b) => a[1] - b[1])[0]; return d <= 25 ? name : ''; }
const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found/i;

function extractAgoda() {
  const lat = document.querySelector('meta[property="place:location:latitude"]')?.content;
  const lng = document.querySelector('meta[property="place:location:longitude"]')?.content;
  let name = '';
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { const nodes = [].concat(JSON.parse(s.textContent)); for (const n of nodes) if (!name && n.name) name = n.name; } catch {}
  }
  const bodyText = (document.body?.innerText || '').slice(0, 3000);
  const redirectedToHub = !/\/hotel\//.test(location.pathname);
  return { name: name || document.title, pin: lat && lng ? [Number(lat), Number(lng)] : null, dead: redirectedToHub || DEAD_RE.test(bodyText) };
}

function extractGeneric() {
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
  if (!pin) {
    try {
      const lat = window.booking?.env?.b_map_center_latitude, lng = window.booking?.env?.b_map_center_longitude;
      if (lat && lng) pin = [Number(lat), Number(lng)];
    } catch {}
  }
  const bodyText = (document.body?.innerText || '').slice(0, 3000);
  return { name: name || document.title, pin, dead: DEAD_RE.test(bodyText) };
}

const EXTRACTORS = { Agoda: extractAgoda, 'Booking.com': extractGeneric, EaseMyTrip: extractGeneric };

const updStmt = db.prepare(`
  UPDATE candidate_pages SET name = ?, lat = ?, lng = ?, town = ?, state = ?, checked = ?, decision_why = ?
  WHERE url = ? AND status = 'checked' AND state = 'no pin'
`);

const rows = db.prepare(`SELECT url, platform_key as platform FROM candidate_pages WHERE state='no pin' AND decision_why LIKE '%placeholder geocode%'`).all();
console.log(`fix_placeholder_geocode: ${rows.length} row(s) to re-extract via Edge CDP`);

const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
const ctx = browser.contexts()[0] || (await browser.newContext());
const page = await ctx.newPage();

let ok = 0;
for (const { url, platform } of rows) {
  const extractFn = EXTRACTORS[platform] || extractGeneric;
  let state = STATE.UNREADABLE, pin = null, town = '', ev = {};
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    ev = await page.evaluate(extractFn);
    pin = ev.pin && ev.pin.every(Number.isFinite) ? ev.pin : null;
    town = pin ? townOf(pin) : '';
    state = ev.dead ? STATE.CLOSED : !pin ? (ev.name ? STATE.NO_PIN : STATE.UNREADABLE) : town ? STATE.OK : STATE.ELSEWHERE;
  } catch (e) {
    state = STATE.UNREADABLE;
  }
  if (state === STATE.OK) ok++;
  const clean = (v) => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
  updStmt.run(clean(ev.name), pin?.[0] ?? null, pin?.[1] ?? null, town || null, state,
    new Date().toISOString().slice(0, 10), 're-extracted after clearing a placeholder geocode 2026-10-17', url);
  console.log(`${platform.padEnd(12)} ${state.padEnd(10)} ${url}`);
  await page.waitForTimeout(1200);
}
await page.close().catch(() => {});
console.log(`done. ${rows.length} checked, ${ok} ok`);
process.exit(0);
