#!/usr/bin/env node
// Catches the text that only exists once the browser has run the page's
// scripts: the stay page (map key, directions, city notes, "Book direct"),
// the stays lists after filtering, the cards data.js writes, the WhatsApp
// drawer… The source scan in extract-ui.mjs cannot see text inside large
// HTML template literals, so this opens the pages in a headless browser,
// walks them exactly as i18n-runtime.js would, and keeps every text that no
// catalogue covers yet.
//
//   node scripts/i18n/extract-rendered.mjs     write the "rendered" list of i18n/en.json
//
// Needs Playwright's Chromium (npx playwright install chromium). Starts its
// own server.js on a spare port (it never posts a form, so no email is sent). Numbers and known names in what it finds
// become {n1}/{t1} slots (extract-stays.mjs's templater), so "Rajendra Bhawan
// B&B is 2.4 km from Har Ki Pauri" is one pattern, not one string per stay.
// Output: the "rendered" list in i18n/en.json; extract.mjs adds it to "site",
// so translators get it through the usual sync jobs.
// Re-run it after changing a script that writes text (docs/I18N.md).

import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { vocabulary, templater } from "./extract-stays.mjs";
import { norm, readEn, writeEn, slotOnly, isPattern } from "./catalog.mjs";
import { segId, makeLookup, compilePatterns } from "../../assets/js/i18n-runtime.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 3917;

async function stayIds() {
  const pick = async (f) => (await import(pathToFileURL(join(ROOT, "assets/js/modules", f)).href)).STAYS_INDEX;
  const r = await pick("stays-index-data.js"), h = await pick("stays-index-data-haridwar.js");
  const first = (list, fn) => list.find(fn)?.id;
  return [
    ["rishikesh", first(r, (s) => s.ll && !s.gm && s.o)], ["rishikesh", first(r, (s) => s.gm)],
    ["rishikesh", first(r, (s) => s.ll && !s.o)], ["haridwar", first(h, (s) => s.ll && !s.gm && s.o)],
    ["haridwar", first(h, (s) => s.gm)], ["rishikesh", "no-such-stay"],
  ].filter(([, id]) => id);
}

// Every text and attribute the runtime would look up on the page as it is now.
async function seen(page) {
  return page.evaluate(async () => {
    const R = await import("/assets/js/i18n-runtime.js");
    const out = new Set();
    const t = R.createTranslator(document, (s) => { out.add(s); return null; });
    t.translateDocHead(); t.walk(document.body); t.attrs(document.body);
    return [...out];
  });
}

async function main() {
  const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  try {
    let up = false;
    for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(`http://localhost:${PORT}/`)).ok; } catch { await new Promise((r) => setTimeout(r, 200)); } }
    if (!up) throw new Error(`server.js did not answer on port ${PORT} within 60 s`);
    const base = `http://localhost:${PORT}`;
    const views = [["/?whatsapp=open"], ["/homestays"], ["/hotels/best-hotels-in-rishikesh", "filter"], ["/hotels/best-hotels-in-haridwar", "filter"],
      ["/hotels/best-stays-near-triveni-ghat"], ...(await stayIds()).map(([c, s]) => [`/hotels/stay?s=${s}&c=${c}`])];
    const browser = await chromium.launch();
    const texts = new Set();
    for (const [url, how] of views) {
      for (const width of [1280, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        await page.goto(base + url, { waitUntil: "networkidle" }).catch(() => {});
        await page.waitForTimeout(600);
        (await seen(page)).forEach((s) => texts.add(s));
        if (how === "filter") { // a category filter re-renders the list and its counts
          const pill = page.locator(".sx-filters a, .sx-filters button").nth(2);
          if (await pill.count()) { await pill.click().catch(() => {}); await page.waitForTimeout(500); (await seen(page)).forEach((s) => texts.add(s)); }
        }
        await page.close();
      }
    }
    await browser.close();

    // What the catalogues already cover (an identity lookup over all English),
    // leaving out this tool's own earlier finds so a text that is gone drops out.
    const en = readEn();
    const own = new Set((en.rendered || []).map(segId));
    const strings = {}, patterns = {};
    for (const part of ["site", "stays"]) for (const [id, t] of Object.entries(en[part])) {
      if (own.has(id) || slotOnly(t)) continue;
      if (isPattern(t)) patterns[t] = t; else strings[id] = t;
    }
    const covered = makeLookup(strings, compilePatterns(patterns));
    const tpl = templater(await vocabulary());
    const out = {};
    const { DO_NOT_TRANSLATE } = await import("./extract.mjs");
    for (const s of [...texts].map(norm)) {
      if (!s || !/\p{L}/u.test(s) || covered(s) != null || DO_NOT_TRANSLATE.has(s)) continue;
      const k = norm(tpl(s));
      if (slotOnly(k)) continue;
      out[k] = k;
    }
    en.rendered = Object.keys(out).sort((a, b) => a.localeCompare(b));
    writeEn(en);
    console.log(`i18n/en.json "rendered": ${en.rendered.length} texts the browser shows that the source scans miss (${views.length} views × 2 widths). Now run node scripts/i18n/extract.mjs`);
  } finally {
    server.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
