#!/usr/bin/env node
// Scratch script (2026-10-17): resolves MakeMyTrip (RH-BUG-1 remainder) and Goibibo (RH-BUG-2) candidate_pages
// rows via Playwright connected over CDP to the ALREADY-RUNNING real Edge instance the project's own search
// tooling manages (scripts/search-ctl.mjs, port 9225, launched as a real installed app with just a debug
// port -- not Playwright's own automation launcher, so it never sets navigator.webdriver=true). Confirmed by
// hand: a MakeMyTrip URL that returned a bot-mitigation stub to a fresh Playwright-launched browser loaded
// the real page fine through this connection (navigator.webdriver: false). Same approach should clear
// Goibibo's block too (that one keys off navigator.webdriver specifically, confirmed earlier tonight).
// Owner-directed (2026-10-17): "you can use already open edge as well" / "i dont do anything on it in macbook".
import { chromium } from 'playwright';
import { getDb } from './db.mjs';

const db = getDb();
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const LIMIT = Number(arg('--limit', 150));
const GAP_MS = Number(arg('--gap', 1200));
const CONCURRENCY = Number(arg('--concurrency', 2));
const PLATFORMS = (arg('--platform', 'MakeMyTrip,Goibibo')).split(',').map((s) => s.trim());
const CDP_PORT = arg('--port', '9225');

const STATE = { OK: 'ok', ELSEWHERE: 'elsewhere', NO_PIN: 'no pin', UNREADABLE: 'unreadable', CLOSED: 'closed' };
const CENTRES = { rishikesh: [30.103, 78.297], haridwar: [29.945, 78.164], dehradun: [30.3244, 78.0419], mussoorie: [30.4598, 78.0643] };
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87);
function townOf(pin) { const [name, d] = Object.entries(CENTRES).map(([n, c]) => [n, km(pin, c)]).sort((a, b) => a[1] - b[1])[0]; return d <= 25 ? name : ''; }

function extractMakeMyTrip() {
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
  const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found/i;
  const bodyText = (document.body?.innerText || '').slice(0, 3000);
  return { name: name || h1 || document.title, pin: m ? [Number(m[1]), Number(m[2])] : null, dead: DEAD_RE.test(bodyText) };
}

function extractGoibibo() {
  const DEAD_RE = /no longer available|is not available on our site|this property is closed|hotel not found|page not found/i;
  try {
    const hd = window.__initial_state__?.detailsUnif?.static?.hotelDetails;
    if (hd) {
      const bodyText = (document.body?.innerText || '').slice(0, 3000);
      return { name: hd.name || hd.hotelName || document.title, pin: typeof hd.lat === 'number' && typeof hd.lng === 'number' ? [hd.lat, hd.lng] : null, dead: DEAD_RE.test(bodyText) };
    }
  } catch {}
  const bodyText = (document.body?.innerText || '').slice(0, 300);
  // Goibibo sends a dead listing to its generic homepage, which carries no name/geo at all
  const redirectedToHub = location.pathname === '/' || location.pathname === '/hotels/' || location.pathname === '/hotels';
  return { name: '', pin: null, dead: redirectedToHub || DEAD_RE.test(bodyText) };
}

const READY = {
  MakeMyTrip: () => /"lat"\s*:\s*-?\d+\.\d+/.test(document.documentElement.innerHTML) || /no longer available|page not found/i.test(document.body?.innerText || ''),
  Goibibo: () => !!window.__initial_state__ || location.pathname === '/' || location.pathname === '/hotels/',
};
const EXTRACTORS = { MakeMyTrip: extractMakeMyTrip, Goibibo: extractGoibibo };

const updStmt = db.prepare(`
  UPDATE candidate_pages SET name = ?, lat = ?, lng = ?, town = ?, state = ?, checked = ?, decision_why = ?
  WHERE url = ? AND status = 'checked' AND state IN ('unreadable', 'no pin')
`);

let allRows = [];
for (const p of PLATFORMS) {
  const rows = db.prepare(`SELECT url, ? AS platform FROM candidate_pages WHERE status = 'checked' AND state IN ('unreadable','no pin') AND platform_key = ? ORDER BY url LIMIT ?`).all(p, p, LIMIT);
  allRows = allRows.concat(rows);
}
// interleave platforms so one doesn't drain before the other
for (let i = allRows.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [allRows[i], allRows[j]] = [allRows[j], allRows[i]];
}
console.log(`recheck_via_edge: ${allRows.length} row(s) queued across [${PLATFORMS.join(', ')}] via Edge CDP :${CDP_PORT} (gap ${GAP_MS}ms, concurrency ${CONCURRENCY})`);

const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
const ctx = browser.contexts()[0] || (await browser.newContext());

const queue = allRows.slice();
let n = 0, ok = 0, closed = 0, stillBad = 0;
const byPlatform = {};

async function worker(id) {
  let page = await ctx.newPage();
  for (let job; (job = queue.shift());) {
    const { url, platform } = job;
    const extractFn = EXTRACTORS[platform];
    let state = STATE.UNREADABLE, pin = null, town = '', ev = {};
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForFunction(READY[platform], { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(600);
      try { await page.mouse.move(80 + Math.random() * 500, 120 + Math.random() * 400, { steps: 6 }); await page.mouse.wheel(0, 200 + Math.random() * 500); } catch {}
      ev = await page.evaluate(extractFn);
      pin = ev.pin && ev.pin.every(Number.isFinite) ? ev.pin : null;
      town = pin ? townOf(pin) : '';
      state = ev.dead ? STATE.CLOSED : !pin ? (ev.name ? STATE.NO_PIN : STATE.UNREADABLE) : town ? STATE.OK : STATE.ELSEWHERE;
    } catch (e) {
      if (/Target page, context or browser has been closed|Target closed/.test(String(e.message))) {
        try { page = await ctx.newPage(); } catch { return; }
        queue.unshift(job);
        continue;
      }
      state = STATE.UNREADABLE;
    }
    n++;
    byPlatform[platform] = byPlatform[platform] || { n: 0, ok: 0 };
    byPlatform[platform].n++;
    if (state === STATE.OK) { ok++; byPlatform[platform].ok++; }
    if (state === STATE.CLOSED) closed++;
    if (state === STATE.UNREADABLE || state === STATE.NO_PIN) stillBad++;
    const clean = (v) => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
    updStmt.run(clean(ev.name), pin?.[0] ?? null, pin?.[1] ?? null, town || null, state,
      new Date().toISOString().slice(0, 10), 'via real Edge (CDP, no automation flag) 2026-10-17', url);
    console.log(`[tab${id} ${n}/${allRows.length}] ${platform.padEnd(12)} ${state.padEnd(10)} ${url}`);
    try { await page.waitForTimeout(GAP_MS * (0.6 + Math.random() * 1.2)); } catch {}
  }
  await page.close().catch(() => {});
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1).catch((e) => console.log(`[tab${i + 1}] worker exited: ${e.message}`))));
console.log(`recheck_via_edge: done. ${n} checked, ${ok} ok, ${closed} closed, ${stillBad} still unreadable/no-pin`);
console.log('by platform:', byPlatform);
process.exit(0);
