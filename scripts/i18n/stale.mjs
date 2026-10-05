#!/usr/bin/env node
// Lists English strings that a language file has not caught up with.
// A warning tool, never a test failure: the owner edits English freely, and a
// language keeps its last complete translation until someone re-syncs it.
//
//   node scripts/i18n/stale.mjs              every i18n/<lang>.json
//   node scripts/i18n/stale.mjs hi           one language
//   node scripts/i18n/stale.mjs hi --fresh   re-extract English from the pages
//                                            first (does not write en.json)
//   node scripts/i18n/stale.mjs --json       machine-readable report
//
// Per page it reports:
//   missing  English strings with no translation (new, or changed: a changed
//            sentence gets a new id because ids hash the English)
//   orphan   translations whose English no longer exists (the old side of a
//            change, or removed text); safe to delete once re-translated
//   suspect  translations whose placeholders (<0>…</0>), digits, ₹ amounts or
//            phone numbers differ from the English
// Exit code is always 0.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = join(ROOT, "i18n");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const fresh = args.includes("--fresh");
const langs = args.filter((a) => !a.startsWith("--"));

const load = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));

let en;
if (fresh) {
  const { extractAll } = await import("./extract.mjs");
  en = extractAll();
} else {
  if (!existsSync(join(DIR, "en.json"))) {
    console.error("i18n/en.json not found: run node scripts/i18n/extract.mjs first");
    process.exit(0);
  }
  en = load("en.json");
}

const files = langs.length
  ? langs.map((l) => `${l}.json`)
  : readdirSync(DIR).filter((f) => /^[a-z]{2}(-[A-Z]{2})?\.json$/.test(f) && f !== "en.json");

const placeholders = (s) => (s.match(/<\/?\d+\/?>/g) || []).sort().join(" ");
// Native digits (Devanagari, Bengali, Tamil...) -> ASCII, so ९ counts as 9.
const DIGIT_ZEROS = [0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xff10];
const asciiDigits = (s) =>
  s.replace(/\p{Nd}/gu, (d) => {
    const c = d.codePointAt(0);
    const zero = DIGIT_ZEROS.find((z) => c >= z && c <= z + 9);
    return zero === undefined ? d : String(c - zero);
  });
const numberTokens = (s) =>
  (asciiDigits(s.replace(/<\/?\d+\/?>/g, "")).match(/\d+(?:[.,]\d+)*/g) || []);
// English numbers: grouping commas dropped (₹1,000 -> 1000; ₹1,00,000 -> 100000).
const sourceNumbers = (s) => numberTokens(s).map((n) => n.replace(/,/g, ""));
// Translated numbers: also accept a decimal comma (2,5) or dot grouping (1.000).
const targetNumbers = (s) => {
  const out = new Set();
  for (const n of numberTokens(s)) {
    out.add(n.replace(/,/g, ""));
    out.add(n.replace(/,/g, "."));
    out.add(n.replace(/\./g, ""));
    for (const part of n.split(/[.,]/)) out.add(part);
  }
  return out;
};

function suspect(src, tr) {
  const why = [];
  if (placeholders(src) !== placeholders(tr)) why.push("placeholders");
  // Every number in the English must appear in the translation; extra numbers
  // (e.g. "9.1 मिलियन (91 लाख)") are allowed. A number written out as a word
  // in the translation shows up here as a warning to eyeball, nothing more.
  const have = targetNumbers(tr);
  const lost = sourceNumbers(src).filter((n) => n && !have.has(n));
  if (lost.length) why.push(`numbers missing: ${lost.join(", ")}`);
  if (src.includes("₹") !== tr.includes("₹")) why.push("₹ sign");
  return why;
}

const report = {};
for (const f of files) {
  const lang = f.replace(/\.json$/, "");
  if (!existsSync(join(DIR, f))) {
    console.error(`i18n/${f} not found`);
    continue;
  }
  const tr = load(f);
  const r = (report[lang] = { missing: 0, orphan: 0, suspect: 0, pages: {} });
  for (const [page, segs] of Object.entries(en)) {
    const t = tr[page] || {};
    const p = { missing: [], orphan: [], suspect: [] };
    for (const [id, src] of Object.entries(segs)) {
      if (!(id in t)) p.missing.push({ id, en: src });
      else {
        const why = suspect(src, t[id]);
        if (why.length) p.suspect.push({ id, en: src, tr: t[id], why });
      }
    }
    for (const [id, text] of Object.entries(t)) if (!(id in segs)) p.orphan.push({ id, tr: text });
    if (p.missing.length || p.orphan.length || p.suspect.length) r.pages[page] = p;
    r.missing += p.missing.length;
    r.orphan += p.orphan.length;
    r.suspect += p.suspect.length;
  }
  for (const page of Object.keys(tr)) {
    if (!(page in en)) {
      r.pages[page] = { missing: [], orphan: Object.entries(tr[page]).map(([id, t]) => ({ id, tr: t })), suspect: [] };
      r.orphan += Object.keys(tr[page]).length;
    }
  }
}

if (asJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  const cut = (s) => (s.length > 90 ? s.slice(0, 87) + "..." : s);
  for (const [lang, r] of Object.entries(report)) {
    console.log(`${lang}: ${r.missing} missing/changed, ${r.orphan} orphaned, ${r.suspect} suspect`);
    for (const [page, p] of Object.entries(r.pages)) {
      console.log(`  ${page}`);
      for (const m of p.missing) console.log(`    missing ${m.id}  ${cut(m.en)}`);
      for (const o of p.orphan) console.log(`    orphan  ${o.id}  ${cut(o.tr)}`);
      for (const s of p.suspect) console.log(`    suspect ${s.id}  (${s.why.join("; ")})  ${cut(s.en)}`);
    }
  }
  if (!Object.keys(report).length) console.log("no language files found in i18n/");
}
process.exit(0);
