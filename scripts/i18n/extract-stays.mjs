#!/usr/bin/env node
// Pulls the English text of the generated stays pages (hotels/, written by
// scripts/stays/build_pages.py), as sentence templates instead of ~44,000
// one-off sentences; extract.mjs adds them to i18n/en.json ("stays"):
//
//   node scripts/i18n/extract-stays.mjs --stdout   print them
//
// Every sentence is read the way i18n-runtime.js reads it (extract.mjs's
// extractPage: same runs, same <0>…</0> placeholders), then:
//   - numbers become {n1}, {n2}… (the runtime puts the page's own back); a
//     number never ends in a comma or period ("3, 4 and 5" -> "{n1}, {n2} and {n3}"),
//   - known names become {t1}, {t2}…: cities, categories, areas, landmarks,
//     search phrases (TERMS: translated once, on their own) and stay names
//     (never translated), and build_pages.py's AREA_NOTES descriptions. The runtime translates a {t} value that has its
//     own catalogue entry and keeps the rest as written.
// Shape:
//   { "templates": { "{n1} of the {n2} {t1} in {t2} allow pets.": "…" },
//     "terms":     { "Tapovan": "Tapovan", "Guest Houses": "Guest Houses" } }
// A template with no words of its own ("{t1} <0>{n1}</0>") is kept as is in
// every language (build-runtime.mjs adds it) and not sent to translators.
//
// Left out: the stay rows (names, prices: the UI catalogue's patterns cover
// their labels), JSON-LD, og/twitter tags, the footer-stays block (i18n/footer/),
// the shared header/footer (already in the hand-made catalogues) and anything
// extract.mjs never takes (contact forms, brand, translate="no").
// npm run build:stays re-extracts after every build. See docs/I18N.md.

import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { extractPage, extractAll, segId, norm } from "./extract.mjs";
import { pythonCommand, pythonEnv } from "../py.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HAND_MADE = new Set(["advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh.html"]);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const tsv = (f) => readFileSync(join(ROOT, f), "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#"));

// Names the generator puts into its sentences.
export async function vocabulary() {
  const terms = new Set(), names = new Set();
  // every city that has a built stays data module (stays-index-data.js = Rishikesh, stays-index-data-<city>.js)
  const files = readdirSync(join(ROOT, "assets/js/modules")).filter((f) => /^stays-index-data(-[a-z]+)?\.js$/.test(f)).sort();
  const cities = files.map((f) => { const m = /-([a-z]+)\.js$/.exec(f); return m ? m[1][0].toUpperCase() + m[1].slice(1) : "Rishikesh"; });
  cities.forEach((c) => terms.add(c));
  for (const f of files) {
    const m = await import(pathToFileURL(join(ROOT, "assets/js/modules", f)).href);
    for (const c of m.STAYS_INDEX_META.categories) { terms.add(c.title); terms.add(c.title.toLowerCase()); }
    for (const s of m.STAYS_INDEX) { if (s.a) terms.add(s.a); if (s.k) terms.add(s.k); for (const k of s.ks || []) terms.add(k); if (s.n) names.add(s.n); }
    for (const o of m.STAYS_OWN) { names.add(o.n); if (o.a) terms.add(o.a); }
  }
  for (const l of tsv("scripts/stays/landmarks.tsv").slice(1)) { const n = l.split("\t")[1]; if (n) terms.add(n); }
  for (const l of tsv("scripts/stays/search-pages.tsv")) {
    const phrase = l.split("\t")[0];
    if (!phrase || phrase === "phrase") continue;
    for (const c of cities) { const t = phrase.replace(/\{City\}/g, c); terms.add(t); terms.add(t.toLowerCase()); terms.add(t[0].toUpperCase() + t.slice(1)); }
  }
  // The short area descriptions build_pages.py strings together ("Tapovan is the busy cafe…;
  // Kankhal is an older…"): as terms they are translated once, not in every combination.
  // scripts/py.mjs picks the interpreter this machine has (python3 on macOS, python or py -3 on Windows).
  const [py, ...pre] = pythonCommand();
  const notes = JSON.parse(execFileSync(py, [...pre, "-c",
    "import json,sys; sys.path.insert(0,'scripts/stays'); import build_pages as b; print(json.dumps(list(b.AREA_NOTES.values())))"],
  { cwd: ROOT, encoding: "utf8", env: pythonEnv, windowsHide: true }));
  for (const n of notes) terms.add(n);
  for (const t of [...terms]) if (!t || t.length < 3 || !/\p{L}/u.test(t)) terms.delete(t);
  for (const n of [...names]) if (!n || n.length < 3 || terms.has(n)) names.delete(n);
  return { terms, names };
}

export function templater({ terms, names }) {
  const all = [...terms, ...names].sort((a, b) => b.length - a.length); // longest name wins
  const re = new RegExp(`(?<![\\p{L}\\d])(?:${all.map(esc).join("|")})(?![\\p{L}\\d])`, "gu");
  return (text) => {
    let n = 0, t = 0;
    const out = text.split(/(<\/?\d+\/?>)/).map((part, i) => {
      if (i % 2) return part; // a placeholder tag
      // names first (some hold digits: "2 BHK Stays"), as a digit-free marker, then numbers
      return part.replace(re, "\u0000").replace(/\d(?:[\d,.]*\d)?/g, () => `{n${++n}}`).replace(/\u0000/g, () => `{t${++t}}`);
    }).join("");
    return out;
  };
}

export async function extractStays() {
  const vocab = await vocabulary();
  const tpl = templater(vocab);
  const handMade = new Set(Object.values(extractAll()).flatMap((p) => Object.keys(p)));
  const templates = {};
  for (const f of readdirSync(join(ROOT, "hotels")).sort()) {
    if (!f.endsWith(".html") || HAND_MADE.has(f)) continue;
    const html = readFileSync(join(ROOT, "hotels", f), "utf8")
      .replace(/<li class="sx-item[^"]*">[\s\S]*?<\/li>/g, "")
      .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")
      .replace(/<meta (?:property="og:|name="twitter:)[^>]*>/g, "");
    for (const [id, text] of Object.entries(extractPage(html))) {
      if (handMade.has(id)) continue; // header, nav, footer: the hand-made catalogues have them
      const k = norm(tpl(text));
      templates[k] ??= k;
    }
  }
  const terms = {};
  for (const t of [...vocab.terms].sort()) terms[t] = t;
  return { templates, terms };
}

export { slotOnly } from "./catalog.mjs";

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(JSON.stringify(await extractStays(), null, 1) + "\n");
