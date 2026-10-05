// Screenshot baseline and pixel diff for refactors that must not change how
// the site looks (the theme token refactor, later the logical-property CSS for
// right-to-left languages). Not a test file: `npm test` does not run it.
//
//   node tests/visual/screens.js shoot <dir> [light|dark] [--ui]
//   node tests/visual/screens.js compare <baselineDir> <newDir>
//
// Take the English light-theme shots before a refactor, again after it, then
// compare: a token or logical-property refactor must give identical pixels.
// `--ui` also opens the nav drawer, the WhatsApp popup, a date picker, the stay
// map and the booking-site gate, for a look at both themes by eye.
//
// Shots are deterministic: every request that leaves the local server is
// blocked (maps tiles, fonts, ads, geolocation), the clock is frozen so the
// home hero slideshow never advances, and CSS animations are disabled.
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import express from 'express';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// SCREENS_ROOT: shoot another copy of the site, e.g. an export of the last commit
export const ROOT = process.env.SCREENS_ROOT ? path.resolve(process.env.SCREENS_ROOT) : path.join(__dirname, '..', '..');

export const PAGES = [
  ['home', '/'],
  ['kumbh', '/haridwar-kumbh-2027'],
  ['contact', '/contact'],
  ['stays-master', '/hotels/best-hotels-in-rishikesh'],
  ['landmark', '/hotels/best-stays-near-aiims-rishikesh'],
  ['stay', '/hotels/stay?s=arista-haven'],
  ['advaitam', '/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh'],
  ['404', '/no-such-page-here'],
];

export const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'laptop', width: 1440, height: 900 },
];

// A static server with the same clean URLs and 404 fallback as server.js
// (no API routes: forms are not submitted here).
export async function startServer(root = ROOT) {
  const app = express();
  app.use((req, res, next) => {
    if (path.extname(req.path)) return next();
    const file = path.join(root, `${req.path.replace(/\/$/, '') || '/index'}.html`);
    if (file.startsWith(root) && existsSync(file)) return res.sendFile(file);
    next();
  });
  app.use(express.static(root));
  app.use((req, res) => res.status(404).sendFile(path.join(root, '404.html')));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { server, base: `http://localhost:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

// A page with the stored theme choice set before any script runs.
export async function openPage(browser, base, url, { viewport, theme = null, system = 'light' } = {}) {
  const context = await browser.newContext({ viewport, colorScheme: system });
  await context.route('**/*', (route) => {
    const u = route.request().url();
    return u.startsWith(base) ? route.continue() : route.abort();
  });
  // same "random" picks on every run (404 sightings, stay-page questions)
  await context.addInitScript(() => {
    let s = 42;
    Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  });
  if (theme) {
    await context.addInitScript((t) => {
      try { localStorage.setItem('rh-theme', t); } catch { /* storage blocked */ }
    }, theme);
  }
  const page = await context.newPage();
  // timers only move when settle() says so (nudge bubble, 404 countdown, hero slides)
  const t0 = new Date('2026-10-05T09:00:00+05:30').getTime();
  await page.clock.install({ time: t0 });
  await page.clock.pauseAt(t0 + 1000);
  await page.goto(base + url, { waitUntil: 'load', timeout: 30000 });
  return { context, page };
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.clock.runFor(1500);
}

// UI states worth a look in both themes; each is shot on a fresh page load.
export function uiStates(name, width) {
  const s = [];
  if (width < 1381) s.push(['drawer', (p) => p.click('[data-nav-toggle]', { timeout: 4000 })]);
  s.push(['whatsapp', (p) => p.click('.whatsapp-fab', { timeout: 4000 })]);
  if (name === 'contact') s.push(['datepicker', (p) => p.click('#check_in', { timeout: 4000 })]);
  if (name === 'stay' || name === 'landmark') {
    s.push(['map', (p) => p.locator('.leaflet-container').first().scrollIntoViewIfNeeded({ timeout: 4000 })]);
  }
  if (name === 'advaitam') s.push(['ota-gate', (p) => p.locator('.ota-link').first().click({ timeout: 4000 })]);
  return s;
}

async function shootUi(browser, base, url, viewport, theme, name, outDir) {
  for (const [label, act] of uiStates(name, viewport.width)) {
    const { context, page } = await openPage(browser, base, url, { viewport, theme });
    try {
      await settle(page);
      await act(page);
      await page.clock.runFor(800);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.clock.runFor(800);
      writeFileSync(path.join(outDir, `${name}-${viewport.name}-${label}.png`), await page.screenshot({ animations: 'disabled' }));
    } catch (err) {
      console.warn(`${name}-${viewport.name}-${label}: ${err.message.split('\n')[0]}`);
    } finally {
      await context.close();
    }
  }
}

export async function shoot(outDir, { theme = null, ui = false } = {}) {
  mkdirSync(outDir, { recursive: true });
  const srv = await startServer();
  const browser = await chromium.launch();
  try {
    for (const [name, url] of PAGES) {
      for (const viewport of VIEWPORTS) {
        const { context, page } = await openPage(browser, srv.base, url, { viewport, theme });
        try {
          await settle(page);
          const file = path.join(outDir, `${name}-${viewport.name}.png`);
          writeFileSync(file, await page.screenshot({ fullPage: true, animations: 'disabled' }));
        } finally {
          await context.close();
        }
        if (ui) await shootUi(browser, srv.base, url, viewport, theme, name, outDir);
      }
    }
  } finally {
    await browser.close();
    await srv.close();
  }
}

// Counts differing pixels between same-named PNGs in two folders.
export async function compare(aDir, bDir) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];
  try {
    for (const f of readdirSync(aDir).filter((x) => x.endsWith('.png') && !x.startsWith('diff-')).sort()) {
      const b = path.join(bDir, f);
      if (!existsSync(b)) { results.push([f, 'missing']); continue; }
      const A = readFileSync(path.join(aDir, f));
      const B = readFileSync(b);
      if (A.equals(B)) { results.push([f, 0]); continue; }
      const diff = await page.evaluate(async ([a, b]) => {
        const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return `size ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`;
        const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
        const da = px(ia); const db = px(ib);
        // a difference of 1-2 per channel is anti-aliasing noise on rounded
        // corners (it varies run to run too); a real colour change is bigger
        let n = 0; let top = -1;
        for (let i = 0; i < da.length; i += 4) {
          const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
          if (d > 2) { n++; if (top < 0) top = Math.floor(i / 4 / ia.width); }
        }
        if (!n) return 0;
        // side-by-side crop around the first difference, for a look by eye
        const y0 = Math.max(0, top - 150); const h = Math.min(500, ia.height - y0);
        const c = document.createElement('canvas'); c.width = ia.width * 2 + 10; c.height = h;
        const x = c.getContext('2d'); x.fillStyle = '#f0f'; x.fillRect(0, 0, c.width, h);
        x.drawImage(ia, 0, y0, ia.width, h, 0, 0, ia.width, h);
        x.drawImage(ib, 0, y0, ib.width, h, ia.width + 10, 0, ib.width, h);
        return { text: `${n} px differ (first at y=${top})`, crop: c.toDataURL('image/png') };
      }, [`data:image/png;base64,${A.toString('base64')}`, `data:image/png;base64,${B.toString('base64')}`]);
      if (diff && diff.crop) {
        writeFileSync(path.join(bDir, `diff-${f}`), Buffer.from(diff.crop.split(',')[1], 'base64'));
        results.push([f, diff.text]);
      } else results.push([f, diff]);
    }
  } finally {
    await browser.close();
  }
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'shoot' && a) {
    const theme = ['light', 'dark'].includes(b) ? b : null;
    await shoot(path.resolve(a), { theme, ui: process.argv.includes('--ui') });
    console.log(`shots in ${a}`);
  } else if (cmd === 'compare' && a && b) {
    const res = await compare(path.resolve(a), path.resolve(b));
    let bad = 0;
    for (const [f, d] of res) { if (d !== 0) bad++; console.log(`${d === 0 ? 'same' : 'DIFF'}  ${f}${d === 0 ? '' : `  ${d}`}`); }
    console.log(bad ? `${bad} of ${res.length} differ` : `all ${res.length} identical`);
    process.exitCode = bad ? 1 : 0;
  } else {
    console.log('usage: node tests/visual/screens.js shoot <dir> [light|dark] [--ui] | compare <a> <b>');
    process.exitCode = 2;
  }
}
