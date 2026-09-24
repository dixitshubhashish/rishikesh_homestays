// Real-browser layout check: every page must fit its viewport width with no
// horizontal overflow, on both a phone-width and a laptop-width screen.
//
// This exists because of a real bug: the Airbnb embed widget's fixed
// `width: 800px` inline style silently blew out an entire mobile page's
// layout (headings, tags, image captions all clipped off-screen) even
// though `document.documentElement.scrollWidth` looked fine at a glance in
// some contexts — plain jsdom-based tests can't catch this class of bug at
// all, since jsdom doesn't run real CSS layout. Only a real rendered
// browser can.
import test from 'node:test';
import assert from 'node:assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';
import express from 'express';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

function discoverPages() {
  const pages = ['/'];
  for (const dir of ['pages', 'hotels']) {
    const dirPath = path.join(ROOT, dir);
    let files;
    try {
      files = readdirSync(dirPath);
    } catch {
      continue;
    }
    files
      .filter((f) => f.endsWith('.html'))
      .forEach((f) => pages.push(`/${dir}/${f}`));
  }
  return pages;
}

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 844 },
  { name: 'laptop', width: 1440, height: 900 },
];

// A tiny bit of slack — sub-pixel rounding from real layout engines can
// report a fraction of a pixel of "overflow" that isn't a real bug.
const OVERFLOW_TOLERANCE_PX = 2;

test('No page overflows horizontally on mobile or laptop', { timeout: 120000 }, async (t) => {
  const pages = discoverPages();
  const app = express();
  app.use(express.static(ROOT));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const browser = await chromium.launch();

  try {
    for (const pagePath of pages) {
      for (const viewport of VIEWPORTS) {
        await t.test(`${pagePath} @ ${viewport.name} (${viewport.width}px)`, async () => {
          const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
          try {
            await page.goto(`http://localhost:${port}${pagePath}`, { waitUntil: 'load', timeout: 20000 });
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth
            );
            assert(
              overflow <= OVERFLOW_TOLERANCE_PX,
              `${pagePath} overflows horizontally by ${overflow}px at ${viewport.width}px viewport — some element is wider than the screen.`
            );
          } finally {
            await page.close();
          }
        });
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
