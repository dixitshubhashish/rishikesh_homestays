// Dark/light theme in a real browser: no flash of the wrong theme, the toggle
// and its stored choice, storage that throws, text contrast and horizontal
// overflow in both themes, and a WCAG check of the colour token pairs.
// Pages are the screenshot set in screens.js (served by its local server,
// outside requests blocked). Generated stays pages get the head snippet at the
// next stays build, so until then they are checked with data-theme set by the
// test itself (the `force` option of openPage).
import test from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { readFileSync, readdirSync } from 'fs';
import { chromium } from 'playwright';
import { ROOT, PAGES, VIEWPORTS, startServer, openPage } from './screens.js';

const CSS = readFileSync(path.join(ROOT, 'assets/css/styles.css'), 'utf8');
const hasSnippet = (url) => {
  const rel = url === '/' ? 'index' : url.slice(1).split('?')[0];
  try {
    return readFileSync(path.join(ROOT, `${rel}.html`), 'utf8').includes('data-theme-toggle');
  } catch {
    return readFileSync(path.join(ROOT, '404.html'), 'utf8').includes('data-theme-toggle');
  }
};

// ---- WCAG maths -----------------------------------------------------------
function lum([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function hex(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function ratio(a, b) {
  const x = lum(a); const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

test('colour token pairs meet WCAG AA in both themes', () => {
  const light = tokens(CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('}', CSS.indexOf(':root {'))));
  const darkAt = CSS.indexOf(':root[data-theme="dark"] {');
  assert(darkAt > 0, 'styles.css should have a :root[data-theme="dark"] block');
  const dark = { ...light, ...tokens(CSS.slice(darkAt, CSS.indexOf('}', darkAt))) };
  // [text, background, minimum]; 4.5 for text, 3 for large/bold UI text
  const PAIRS = [
    ['ink', 'paper', 4.5], ['ink', 'panel', 4.5], ['ink', 'sky', 4.5],
    ['muted', 'paper', 4.5], ['muted', 'panel', 4.5], ['muted', 'sky', 4.5], ['muted', 'alt', 4.5],
    ['river', 'paper', 4.5], ['river', 'panel', 4.5], ['river', 'sky', 4.5], ['river-2', 'panel', 4.5],
    ['on-fill', 'river-fill', 4.5], ['on-fill', 'river-fill-2', 4.5],
    ['eyebrow', 'paper', 4.5], ['eyebrow', 'alt', 4.5],
    ['ink-2', 'panel', 4.5], ['ink-2', 'sky', 4.5], ['ink-label', 'panel', 4.5], ['ink-tag', 'sky', 4.5],
    ['clay', 'panel', 4.5], ['clay', 'paper', 4.5], ['leaf', 'panel', 4.5], ['marigold', 'panel', 3],
    ['ok', 'panel', 4.5], ['err', 'panel', 4.5], ['note-ink', 'note-bg', 4.5], ['muted', 'note-bg', 4.5],
  ];
  // Light shortfalls the site has always had: the light theme must stay
  // pixel-identical, so they are out of scope here (dark must not have any).
  const LIGHT_KNOWN = new Set(['muted/sky', 'muted/alt', 'marigold/panel', 'ok/panel', 'err/panel']);
  const fails = [];
  for (const [fg, bg, min] of PAIRS) {
    for (const [name, set] of [['light', light], ['dark', dark]]) {
      assert(set[fg] && set[bg], `${name}: tokens --${fg} and --${bg} should be plain hex colours`);
      const r = ratio(hex(set[fg]), hex(set[bg]));
      if (r < min && !(name === 'light' && LIGHT_KNOWN.has(`${fg}/${bg}`))) fails.push(`${name} --${fg} on --${bg}: ${r.toFixed(2)} < ${min}`);
    }
  }
  assert.deepStrictEqual(fails, []);
});

// ---- in the browser -------------------------------------------------------
async function withServer(fn) {
  const srv = await startServer();
  const browser = await chromium.launch();
  try {
    await fn(srv, browser);
  } finally {
    await browser.close();
    await srv.close();
  }
}

// Records the theme and the page background as the DOM finishes parsing,
// before any module (theme-toggle.js included) has run.
async function firstPaintState(browser, base, url, { stored, system }) {
  const context = await browser.newContext({ colorScheme: system, viewport: { width: 390, height: 844 } });
  await context.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()));
  await context.addInitScript((t) => {
    try { if (t) localStorage.setItem('rh-theme', t); } catch { /* blocked */ }
    document.addEventListener('DOMContentLoaded', () => {
      window.__first = {
        theme: document.documentElement.getAttribute('data-theme'),
        bg: getComputedStyle(document.body).backgroundColor,
        scheme: document.documentElement.style.colorScheme,
      };
    }, { capture: true, once: true });
  }, stored);
  const page = await context.newPage();
  await page.goto(base + url, { waitUntil: 'domcontentloaded' });
  const first = await page.evaluate(() => window.__first);
  await context.close();
  return first;
}

test('the stored theme is in place before first paint (no flash)', { timeout: 120000 }, async () => {
  await withServer(async (srv, browser) => {
    for (const url of ['/', '/contact', '/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh', '/no-such-page']) {
      const dark = await firstPaintState(browser, srv.base, url, { stored: 'dark', system: 'light' });
      assert.strictEqual(dark.theme, 'dark', `${url}: stored dark on a light system`);
      assert.strictEqual(dark.bg, 'rgb(15, 23, 21)', `${url}: dark page background at DOMContentLoaded`);
      assert.strictEqual(dark.scheme, 'dark');
      const light = await firstPaintState(browser, srv.base, url, { stored: 'light', system: 'dark' });
      assert.strictEqual(light.theme, 'light', `${url}: stored light on a dark system`);
      assert.strictEqual(light.bg, 'rgb(251, 250, 245)');
      // phase 1 is opt-in: nothing stored means light, whatever the system says
      const unset = await firstPaintState(browser, srv.base, url, { stored: null, system: 'dark' });
      assert.strictEqual(unset.theme, 'light', `${url}: no choice yet should be light`);
    }
  });
});

test('the toggle switches, remembers, and works when storage throws', { timeout: 120000 }, async () => {
  await withServer(async (srv, browser) => {
    const { context, page } = await openPage(browser, srv.base, '/', { viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.runFor(500);
    const btn = page.locator('[data-theme-toggle]');
    assert.strictEqual(await btn.getAttribute('aria-pressed'), 'false');
    assert.strictEqual(await btn.getAttribute('aria-label'), 'Dark theme');
    await btn.click();
    assert.strictEqual(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
    assert.strictEqual(await btn.getAttribute('aria-pressed'), 'true');
    assert.strictEqual(await btn.getAttribute('aria-label'), 'Dark theme', 'the label stays fixed; aria-pressed carries the state');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('rh-theme')), 'dark');
    assert.strictEqual(await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content), '#0f1715');
    await page.reload({ waitUntil: 'load' });
    await page.clock.runFor(500);
    assert.strictEqual(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark', 'choice survives a reload');
    assert.strictEqual(await page.locator('[data-theme-toggle]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-theme-toggle]').click();
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('rh-theme')), 'light');
    assert.deepStrictEqual(errors, []);
    await context.close();

    // storage blocked (private mode, blocked site data): light, and the toggle still works
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx2.route('**/*', (r) => (r.request().url().startsWith(srv.base) ? r.continue() : r.abort()));
    await ctx2.addInitScript(() => {
      const no = () => { throw new DOMException('blocked', 'SecurityError'); };
      Storage.prototype.getItem = no;
      Storage.prototype.setItem = no;
    });
    const p2 = await ctx2.newPage();
    const errs2 = [];
    p2.on('pageerror', (e) => errs2.push(e.message));
    await p2.goto(`${srv.base}/contact`, { waitUntil: 'load' });
    assert.strictEqual(await p2.evaluate(() => document.documentElement.getAttribute('data-theme')), 'light');
    await p2.locator('[data-theme-toggle]').click();
    assert.strictEqual(await p2.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
    assert(!errs2.some((m) => /theme|rh-theme/i.test(m)), `no theme errors with storage blocked: ${errs2.join('; ')}`);
    await ctx2.close();
  });
});

// Text contrast as rendered: every visible text element against the first
// solid background behind it. Text over photos or gradients (heroes, the
// always-dark footers, the gallery) is skipped: it is the same in both themes.
async function contrastProblems(page) {
  return page.evaluate(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
    const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const out = [];
    const SKIP = '.hero, .page-hero, .rhs-footer, .site-footer, .stay-gallery, .advaitam-hero-media, .ota-link, .btn-whatsapp, .whatsapp-widget, .rh-ad, .leaflet-container, [hidden], .sr-only, .skip-link, .nav-toggle-label, .rhs-more-toggle';
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest(SKIP)) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.closest('button:disabled, [aria-disabled="true"], .flatpickr-disabled')) continue;
      const fg = parse(cs.color);
      if (!fg || fg.a < 0.5) continue;
      let bg = null; let skip = false;
      for (let n = el; n; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (s.backgroundImage !== 'none') { skip = true; break; }
        const b = parse(s.backgroundColor);
        if (b && b.a >= 0.9) { bg = b.rgb; break; }
        if (b && b.a > 0.1) { skip = true; break; }
      }
      if (skip) continue;
      bg ||= parse(getComputedStyle(document.body).backgroundColor).rgb;
      const size = parseFloat(cs.fontSize); const bold = +cs.fontWeight >= 700;
      const min = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      const got = ratio(fg.rgb, bg);
      if (got < min - 0.05) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 30)}" ${got.toFixed(2)} < ${min}`);
    }
    return [...new Set(out)];
  });
}

// the screenshot set at both widths, plus every other hand-made root page at phone width
const ALL_PAGES = [
  ...PAGES,
  ...readdirSync(ROOT)
    .filter((f) => f.endsWith('.html') && !['index.html', '404.html'].includes(f))
    .map((f) => f.replace(/\.html$/, ''))
    .filter((slug) => !PAGES.some(([, u]) => u === `/${slug}`))
    .map((slug) => [slug, `/${slug}`]),
];

test('text contrast and overflow in both themes', { timeout: 600000 }, async (t) => {
  await withServer(async (srv, browser) => {
    const light = {};
    for (const theme of ['light', 'dark']) {
      for (const [name, url] of ALL_PAGES) {
        for (const viewport of VIEWPORTS.filter((v) => PAGES.some(([n]) => n === name) || v.name === 'phone')) {
          await t.test(`${name} @ ${viewport.width}px, ${theme}`, async () => {
            const { context, page } = await openPage(browser, srv.base, url, { viewport, theme, force: !hasSnippet(url) });
            try {
              await page.waitForLoadState('networkidle').catch(() => {});
              await page.clock.runFor(1500);
              assert.strictEqual(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), theme);
              const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
              assert(overflow <= 2, `${url} overflows by ${overflow}px at ${viewport.width}px in ${theme}`);
              const problems = await contrastProblems(page);
              const key = `${name}-${viewport.name}`;
              if (theme === 'light') {
                light[key] = new Set(problems);
              } else {
                // dark must be at least as readable as light: no new low-contrast text
                const added = problems.filter((p) => !light[key]?.has(p));
                assert.deepStrictEqual(added, [], `${url} @ ${viewport.width}px: text below WCAG AA in dark`);
              }
            } finally {
              await context.close();
            }
          });
        }
      }
    }
  });
});
