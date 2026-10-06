#!/usr/bin/env node
// Opens every page in every language in a real browser and lists the text that is still English.
// The static checks (sync.mjs check, npm test) prove every catalogue has every text; this proves the
// browser actually shows them: dropdown options, FAQ answers, text scripts write later, the WhatsApp drawer,
// the stays lists, the stay page.
//
//   node scripts/i18n/coverage.mjs                 all pages, all languages (about 5 minutes)
//   node scripts/i18n/coverage.mjs --lang hi,de    some languages
//   node scripts/i18n/coverage.mjs --page /homestays,/contact
//   node scripts/i18n/coverage.mjs --mixed        also texts that are translated around a name
//   node scripts/i18n/coverage.mjs --json out.json full report
//
// What counts as "still English" (a heuristic, so read the list rather than trust the count):
//   - non-Latin-script languages: a text with a Latin word of 3+ letters that is not a brand, platform or road name,
//     and no letter of the language's own script (a translated sentence around a stay name is fine);
//   - Latin-script languages: a text with 2+ common English words (the, and, with, your, stay, near, …).
// Everything under NO_TRANSLATE (brand, contact forms, stay names, map credit) is skipped, like the runtime.
// Starts its own server.js on a spare port; never posts a form.

import { spawn } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { LANGS } from "./catalog.mjs";
import { NO_TRANSLATE } from "../../assets/js/i18n-runtime.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 3922;
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const LATIN = new Set(["es", "fr", "pt", "de", "it", "id", "ms", "tr", "vi"]);
// Latin words that are fine anywhere: brands, platforms, roads, units, institutions, the names the site never translates.
const KEEP = new RegExp(`^(?:${[
  "Rishikesh", "Homestays", "WhatsApp", "Booking", "com", "Airbnb", "MakeMyTrip", "Agoda", "OYO", "Goibibo", "Trip", "Expedia", "Hotels",
  "EaseMyTrip", "Trivago", "Hostelworld", "Google", "Maps", "Instagram", "Facebook", "YouTube", "FASTag", "NHAI", "IHMCL", "UPI", "AIIMS", "THDC",
  "BHEL", "SIDCUL", "IIT", "CBRI", "ISBT", "NH", "BHK", "PM", "AM", "km", "FAQ", "Wi", "Fi", "TV", "AC", "Netflix", "Advaitam", "Elysium", "Yoga",
  "Retreat", "Ganges", "Villa", "Jolly", "Grant", "Resend", "Rajaji", "Uttarakhand", "IST", "INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "SGD", "JPY",
].join("|")})$`, "i");
const ENGLISH = new Set(["the", "and", "with", "your", "our", "you", "this", "that", "from", "are", "into", "about", "book", "stay", "stays", "near",
  "best", "rental", "guide", "drive", "driving", "how", "what", "when", "where", "before", "after", "tell", "send", "free", "view", "all", "more"]);

function pages() {
  const root = readdirSync(ROOT).filter((f) => f.endsWith(".html")).map((f) => `/${f.slice(0, -5)}`).map((p) => (p === "/index" ? "/" : p));
  const stays = ["/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh", "/hotels/best-hotels-in-rishikesh", "/hotels/best-hotels-in-haridwar",
    "/hotels/best-guest-houses-in-rishikesh", "/hotels/best-stays-near-aiims-rishikesh", "/hotels/rishikesh-accommodation",
    "/hotels/stay?s=advaitam-ganga-hill-view-homestay-by-the-ganges-ghat&c=rishikesh", "/hotels/stay?s=no-such-stay&c=rishikesh"];
  return [...root.filter((p) => p !== "/404"), "/this-page-does-not-exist", ...stays];
}

// runs in the page: every text the visitor can read or hear, outside what is never translated
const collect = (NO) => {
  const out = new Set();
  const add = (t) => { t = (t || "").replace(/\s+/g, " ").trim(); if (t) out.add(t); };
  const skip = (el) => !el || el.closest("script, style, noscript, template, svg") || el.closest(NO);
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) if (!skip(n.parentElement)) add(n.textContent);
  for (const el of document.querySelectorAll("[alt], [title], [placeholder], [aria-label]")) if (!skip(el))
    for (const a of ["alt", "title", "placeholder", "aria-label"]) add(el.getAttribute(a));
  add(document.title);
  add(document.querySelector('meta[name="description"]')?.content);
  return [...out];
};

// A non-Latin-script text that still has English words but also has letters of its own script is a translated
// sentence around a stay or place name (stay names stay as written): only counted with --mixed.
const hasOwnScript = (text) => /[^\u0000-\u024F\u2000-\u206F\s\d\p{P}\p{S}]/u.test(text);
const MIXED = process.argv.includes("--mixed");
const leftover = (text, lang) => {
  const words = text.match(/[A-Za-z][A-Za-z'’]+/g) || [];
  if (LATIN.has(lang)) return words.filter((w) => ENGLISH.has(w.toLowerCase())).length >= 2;
  return words.some((w) => w.length >= 3 && !KEEP.test(w)) && (MIXED || !hasOwnScript(text));
};

async function main() {
  const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 300 && !up; i++) { try { up = (await fetch(`http://localhost:${PORT}/`)).ok; } catch { await new Promise((r) => setTimeout(r, 200)); } }
  if (!up) { server.kill(); throw new Error(`server.js did not answer on port ${PORT}`); }
  const langs = (arg("lang") || LANGS.join(",")).split(",");
  const list = arg("page") ? arg("page").split(",") : pages();
  const browser = await chromium.launch();
  const jobs = list.flatMap((p) => langs.map((l) => [p, l]));
  const report = {};
  let done = 0;
  const worker = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    for (let job; (job = jobs.shift());) {
      const [path, lang] = job;
      try {
        await page.goto(`http://localhost:${PORT}${path}${path.includes("?") ? "&" : "?"}lang=${lang}&whatsapp=open`, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(1200);
        // ?whatsapp=open (docs/ARCHITECTURE.md) has the drawer written and open, so its text is counted too
        await page.waitForTimeout(500);
        const texts = await page.evaluate(collect, NO_TRANSLATE);
        for (const t of texts) if (leftover(t, lang)) ((report[lang] ??= {})[t] ??= []).push(path);
      } catch (e) { ((report[lang] ??= {})[`!! ${e.message.split("\n")[0]}`] ??= []).push(path); }
      if (++done % 100 === 0) console.error(`${done} / ${done + jobs.length}`);
    }
    await ctx.close();
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  await browser.close();
  server.kill();

  const summary = langs.map((l) => [l, Object.keys(report[l] || {}).length]);
  if (arg("json")) writeFileSync(arg("json"), JSON.stringify(report, null, 1));
  console.log(`pages: ${list.length}, languages: ${langs.length}`);
  for (const [l, n] of summary) console.log(`${l}: ${n} text(s) still English`);
  // the texts that are left in the most languages first: those are the real gaps
  const byText = {};
  for (const [l, o] of Object.entries(report)) for (const [t, ps] of Object.entries(o)) (byText[t] ??= { langs: new Set(), pages: new Set() }, byText[t].langs.add(l), ps.forEach((p) => byText[t].pages.add(p)));
  const top = Object.entries(byText).sort((a, b) => b[1].langs.size - a[1].langs.size).slice(0, 40);
  console.log("\nmost widespread:");
  for (const [t, v] of top) console.log(`  [${v.langs.size} langs, ${v.pages.size} pages] ${t.slice(0, 110)}  (${[...v.pages][0]})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
