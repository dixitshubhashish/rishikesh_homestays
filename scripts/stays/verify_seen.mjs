#!/usr/bin/env node
// Opens the booking-site pages the search harvested (docs/booking-links/seen-pages.tsv: up to 6 property links per
// search) FAST: headless browser, 8 pages at once, no images, styles, fonts or media, DOM-ready only, 12 s at most
// per page: a few seconds for the whole batch. Reads the property's name, its pin and its town (the JSON-LD and meta
// tags the booking sites put in the HTML) and writes docs/booking-links/seen-pages-checked.tsv. Only pages whose pin is
// in Rishikesh or Haridwar (25 km of either) count (owner, 2026-10-06). map_seen_pages.py maps them to stays.
//
//   node scripts/stays/verify_seen.mjs [--limit 400] [--workers 8]
import { chromium } from 'playwright';
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'fs';
import { platformOf } from './ota-match.mjs';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BL = `${ROOT}docs/booking-links/`;
const SEEN = `${BL}seen-pages.tsv`, CHECKED = `${BL}seen-pages-checked.tsv`;
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const LIMIT = Number(arg('--limit', 400)), WORKERS = Number(arg('--workers', 8));
const CENTRES = { rishikesh: [30.0869, 78.2676], haridwar: [29.9457, 78.1642] };
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87);
const townOf = (pin) => Object.entries(CENTRES).find(([, c]) => km(pin, c) <= 25)?.[0] || '';
const norm = (u) => u.split('?')[0].replace(/\/+$/, '').toLowerCase();
const lines = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t')) : []);

const done = new Set(lines(CHECKED).map((c) => norm(c[0])));
// pages a stay already has need no look: found.tsv, ota-links.tsv and the places' links
const have = new Set();
for (const f of [`${BL}found.tsv`, `${ROOT}scripts/stays/ota-links.tsv`, `${ROOT}scripts/stays/.cache/places/ota-links.tsv`]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, 'utf8').split('\n').slice(1)) { const c = l.split('\t'); const u = c.find((x) => /^https?:\/\//.test(x)); if (u) have.add(norm(u)); }
}
const queue = [];
for (const [url, platform, label, seenFor] of lines(SEEN)) {
  const n = norm(url);
  if (done.has(n) || have.has(n) || !platformOf(url)) continue;
  done.add(n); // once per run
  queue.push({ url, platform, label, seenFor });
}
// Booking.com first: its pages carry the pin in plain HTML
queue.sort((a, b) => (b.platform === 'Booking.com') - (a.platform === 'Booking.com'));
const batch = queue.slice(0, LIMIT);
if (!existsSync(CHECKED)) writeFileSync(CHECKED, 'url\tplatform\tname\tlat\tlng\ttown\tstate\tseen_for\tchecked\n');

const extract = () => {
  let name = '', pin = null;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const nodes = [].concat(JSON.parse(s.textContent)).flatMap((n) => [n, ...(n['@graph'] || [])]);
      for (const n of nodes) {
        if (!/Hotel|LodgingBusiness|Accommodation|Hostel|Resort|BedAndBreakfast|Campground|VacationRental|House|Apartment/i.test([].concat(n['@type'] || []).join(' '))) continue;
        name ||= n.name || '';
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
  return { name: name || meta('og:title') || (h1s.length === 1 ? h1s[0] : '') || document.title, pin, dead: /no longer available|is not available on our site|this property is closed|hotel not found|page not found/i.test((document.body?.innerText || '').slice(0, 3000)) };
};

const browser = await chromium.launch();
const started = Date.now();
let n = 0, ok = 0;
// one shared browser context: Booking.com's bot check is solved once and its cookie serves every later page
const ctx = await browser.newContext();
await ctx.route('**/*', (r) => (['image', 'media', 'font', 'stylesheet'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
const worker = async () => {
  for (let job; (job = batch.shift());) {
    const page = await ctx.newPage();
    let state = 'unreadable', name = '', pin = null, town = '';
    try {
      await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
      // the first answer can be the bot-check page: the real page (with its JSON-LD) follows within a few seconds
      await page.waitForFunction(() => document.querySelector('script[type="application/ld+json"]') || /no longer available|not available on our site|page not found/i.test((document.body?.innerText || '').slice(0, 2000)), null, { timeout: 10000 }).catch(() => {});
      if (/[?&](?:closed_msg|hlrd)=/.test(page.url())) state = 'closed';
      else {
        const r = await page.evaluate(extract);
        name = r.name; pin = r.pin && r.pin.every(Number.isFinite) ? r.pin : null;
        town = pin ? townOf(pin) : '';
        state = r.dead ? 'closed' : !name ? 'unreadable' : !pin ? 'no pin' : town ? 'ok' : 'elsewhere';
      }
    } catch { /* blocked or crashed page */ }
    await page.close().catch(() => {});
    n++; if (state === 'ok') ok++;
    appendFileSync(CHECKED, [job.url, job.platform, name.replace(/[\t\n\r]+/g, ' '), pin?.[0] ?? '', pin?.[1] ?? '', town, state, job.seenFor, new Date().toISOString().slice(0, 10)].join('\t') + '\n');
  }
};
await Promise.all(Array.from({ length: WORKERS }, worker));
await ctx.close();
await browser.close();
console.log(`verify_seen: ${n} page(s) in ${((Date.now() - started) / 1000).toFixed(0)} s, ${ok} in Rishikesh or Haridwar with a pin (${queue.length - n} still queued)`);
