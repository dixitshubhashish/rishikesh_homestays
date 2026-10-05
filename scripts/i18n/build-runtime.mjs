#!/usr/bin/env node
// Builds the small per-page files the browser fetches for in-browser
// translation (assets/js/i18n-runtime.js), from the translators' catalogues:
//
//   i18n/<lang>.json          { "<page>": { "<id>": "<translation>" } }  (page text)
//   i18n/footer/<lang>.json   { "<English>": "<translation>" }           (footer-stays block)
//   i18n/ui/<lang>.json       { "<English>": "<translation>" }           (text that lives in JS;
//                                                                         keys with {slots} are patterns)
// ->
//   i18n/<lang>/_common.json  { "strings": { id: text }, "patterns": { "<English {n}>": "<text {n}>" } }
//                             header, nav, footer (incl. footer-stays), JS UI text and patterns:
//                             everything every page needs, also the generated stays pages
//   i18n/<lang>/<page>.json   { id: text }  one hand-made page's own text
//
//   node scripts/i18n/build-runtime.mjs          every language
//   node scripts/i18n/build-runtime.mjs hi de    some languages
//
// Ids are extract.mjs's (sha1 of the normalised English). The English is read
// fresh from the pages, so a translation whose English has changed or gone is
// left out (the page shows English there until it is re-translated:
// scripts/i18n/stale.mjs lists them). A translation whose <0>…</0>
// placeholders differ from the English is left out too.
//
// Add a language: put i18n/<code>.json (+ footer/ and ui/ files when ready),
// add the code to LANGS here, to the rh-i18n head snippet (scripts/i18n/
// snippet.mjs, then re-run it) and to LANGUAGES in assets/js/modules/lang-picker.js.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES, extractAll, extractPage, segId, norm } from "./extract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "i18n");

export const LANGS = ["hi", "bn", "ta", "te", "kn", "mr", "ne", "si", "zh", "es", "fr", "pt",
  "ru", "de", "it", "ja", "ko", "id", "ms", "tr", "vi", "he"];

const placeholders = (s) => (s.match(/<\/?\d+\/?>/g) || []).sort().join();
const readJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {});
const isPattern = (k) => /\{[a-z0-9_]+\}/i.test(k);

// Ids of the shared shell (header, nav, footer) as the generated stays pages
// copy it from thanks.html, plus anything on 3+ hand-made pages.
export function commonIds(en) {
  const shellHtml = readFileSync(join(ROOT, "thanks.html"), "utf8").replace(/<main>[\s\S]*<\/main>/, "<main></main>");
  const ids = new Set(Object.keys(extractPage(shellHtml)));
  const seen = new Map();
  for (const page of Object.values(en)) for (const id of Object.keys(page)) seen.set(id, (seen.get(id) || 0) + 1);
  for (const [id, n] of seen) if (n >= 3) ids.add(id);
  return ids;
}

export function buildLang(lang, en, common) {
  const cat = readJson(join(DIR, `${lang}.json`));
  // ids are global (same English, same id): any page's translation will do
  const any = {};
  for (const p of Object.values(cat)) for (const [k, v] of Object.entries(p || {})) if (typeof v === "string") any[k] ??= v;
  const englishOf = {};
  for (const page of Object.values(en)) Object.assign(englishOf, page);
  const good = (id, tr) => tr != null && norm(tr) && englishOf[id] != null && placeholders(tr) === placeholders(englishOf[id]);
  const pick = (page, id) => {
    const tr = (cat[page] || {})[id] ?? any[id];
    return good(id, tr) ? tr : null;
  };

  const strings = {};
  for (const id of common) {
    const tr = pick(null, id);
    if (tr) strings[id] = tr;
  }
  const pages = {};
  for (const page of PAGES) {
    const out = {};
    for (const id of Object.keys(en[page] || {})) {
      if (common.has(id)) continue;
      const tr = pick(page, id);
      if (tr) out[id] = tr;
    }
    pages[page] = out;
  }

  // "<0/> Book on WhatsApp" (an icon, then text) is also offered without the
  // icon, for the same words that scripts insert as plain text (nav drawer).
  for (const [id, english] of Object.entries(englishOf)) {
    const m = /^<(\d+)\/>\s*([^<]+)$/.exec(english);
    const tr = pick(null, id);
    if (!m || !tr) continue;
    const bare = tr.replace(new RegExp(`\\s*<${m[1]}\\/>\\s*`), " ").trim();
    if (!/<\/?\d+\/?>/.test(bare)) strings[segId(m[2])] ??= bare;
  }

  // Footer-stays labels and JS UI text are keyed by their English.
  const patterns = {};
  const byEnglish = { ...readJson(join(DIR, "footer", `${lang}.json`)), ...readJson(join(DIR, "ui", `${lang}.json`)) };
  for (const [english, tr] of Object.entries(byEnglish)) {
    if (typeof tr !== "string" || !norm(tr) || norm(tr) === norm(english)) continue;
    if (isPattern(english)) patterns[norm(english)] = norm(tr);
    else strings[segId(english)] ??= tr;
  }
  return { common: { strings, patterns }, pages };
}

function write(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const json = JSON.stringify(data);
  writeFileSync(file, json + "\n");
  return Buffer.byteLength(json);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const langs = want.length ? want : LANGS;
  const en = extractAll();
  const common = commonIds(en);
  const totalEn = new Set(Object.values(en).flatMap((p) => Object.keys(p))).size;
  console.log(`English: ${PAGES.length} pages, ${totalEn} unique strings (${common.size} shared)`);
  for (const lang of langs) {
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(lang)) { console.error(`skip ${lang}: not a language code`); continue; }
    const out = join(DIR, lang);
    if (existsSync(out) && statSync(out).isDirectory()) rmSync(out, { recursive: true });
    const { common: c, pages } = buildLang(lang, en, common);
    let bytes = write(join(out, "_common.json"), c);
    const done = new Set(Object.keys(c.strings));
    for (const [page, strings] of Object.entries(pages)) {
      if (!Object.keys(strings).length) continue;
      bytes += write(join(out, `${page}.json`), strings);
      for (const id of Object.keys(strings)) done.add(id);
    }
    const allEn = new Set(Object.values(en).flatMap((p) => Object.keys(p)));
    const n = [...allEn].filter((id) => done.has(id)).length;
    const pct = Math.round((n / (totalEn || 1)) * 100);
    console.log(`i18n/${lang}/: page text ${n}/${totalEn} (${pct}%), shared ${Object.keys(c.strings).length} strings + ${Object.keys(c.patterns).length} patterns, ${(bytes / 1024).toFixed(0)} KB`);
  }
}

