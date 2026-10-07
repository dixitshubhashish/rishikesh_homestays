#!/usr/bin/env node
// Keeps every language in step with the English site (docs/I18N.md).
// Files and ids: scripts/i18n/catalog.mjs (i18n/en.json + one flat i18n/<lang>.json).
//
//   node scripts/i18n/sync.mjs status [--only hi,de]   what each language is missing
//   node scripts/i18n/sync.mjs jobs <dir> [--size N] [--only hi,de]
//        writes <dir>/<lang>-<part>.json: { lang, items: [{ k, en, where }] } for
//        translators, at most N characters of English per file (default 45000);
//        k is the text's id, where is "site" or "stays"
//   node scripts/i18n/sync.mjs merge <dir> [--dry]
//        reads every <dir>/<lang>-<part>.out.json ({ k: translation }), checks each
//        line (same <0>…</0> placeholders, same {slots}, every English number
//        kept; extra numbers are fine) and writes the good ones into i18n/<lang>.json;
//        prints the rejects (also saved as <lang>-<part>.rejects.json)
//   node scripts/i18n/sync.mjs prune [--dry]     drop translations whose English is gone
//   node scripts/i18n/sync.mjs suspect [--only hi]
//        translations whose numbers differ from the English (10:00 PM -> 22:00):
//        they count as translated; a person should glance at them
//   node scripts/i18n/sync.mjs check [--no-stays]
//        exit 1 if any language misses anything (npm test runs it with --no-stays)
//
// It reads i18n/en.json: run `node scripts/i18n/extract.mjs` (npm run i18n:extract)
// after changing English text; tests/integration/i18n-sync.test.js fails while
// en.json is out of date.

import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { LANGS, readEn, readLang, writeLang, writeJson, slotOnly, norm } from "./catalog.mjs";

export { LANGS };

const tags = (s) => (s.match(/<\/?\d+\/?>/g) || []).sort().join();
const slots = (s) => (s.match(/\{[a-z0-9_]+\}/gi) || []).sort().join();
const digits = (s) => (s.replace(/\{[a-z0-9_]+\}/gi, "").replace(/<\/?\d+\/?>/g, "").match(/\d+/g) || []);

// Why a translation is not usable for this English, or null when it is.
// `strict` (new lines being merged) also wants every English number kept.
export function problem(en, tr, strict = false) {
  if (typeof tr !== "string" || !norm(tr)) return "empty";
  if (tags(en) !== tags(tr)) return `placeholders ${tags(en) || "none"} vs ${tags(tr) || "none"}`;
  if (slots(en) !== slots(tr)) return `slots ${slots(en) || "none"} vs ${slots(tr) || "none"}`;
  if (strict) {
    const have = digits(tr);
    const lost = digits(en).filter((d) => { const i = have.indexOf(d); if (i < 0) return true; have.splice(i, 1); return false; });
    if (lost.length) return `numbers missing: ${lost.join(", ")}`;
  }
  return null;
}

// Every text a language must have: [{ k, en, where }] (slot-only texts need none).
export function texts(en = readEn(), { stays = true } = {}) {
  const out = [];
  for (const where of stays ? ["site", "stays"] : ["site"]) {
    for (const [k, t] of Object.entries(en[where] || {})) if (!slotOnly(t)) out.push({ k, en: t, where });
  }
  return out;
}

export const missing = (lang, all) => { const tr = readLang(lang); return all.filter((it) => problem(it.en, tr[it.k])); };

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = args[0];
  const only = opt("--only") ? opt("--only").split(",") : LANGS;
  const en = readEn();
  if (cmd === "status" || cmd === "check") {
    const all = texts(en, { stays: !flag("--no-stays") });
    let total = 0;
    for (const lang of only) {
      const m = missing(lang, all);
      total += m.length;
      const by = {};
      for (const it of m) by[it.where] = (by[it.where] || 0) + 1;
      console.log(`${lang}: ${m.length ? `${m.length} missing ${JSON.stringify(by)}` : "complete"}`);
    }
    if (cmd === "check" && total) {
      console.error(`${total} translations missing: node scripts/i18n/sync.mjs jobs <dir>, translate, then merge (docs/I18N.md)`);
      process.exit(1);
    }
  } else if (cmd === "jobs") {
    const dir = resolve(args[1]);
    const size = +opt("--size", 45000);
    mkdirSync(dir, { recursive: true });
    const all = texts(en);
    for (const lang of only) {
      const m = missing(lang, all);
      let part = 0, chunk = [], chars = 0;
      const flush = () => { if (!chunk.length) return; writeJson(join(dir, `${lang}-${++part}.json`), { lang, items: chunk }); chunk = []; chars = 0; };
      for (const it of m) { if (chars + it.en.length > size) flush(); chunk.push(it); chars += it.en.length; }
      flush();
      console.log(`${lang}: ${m.length} texts in ${part} file(s)`);
    }
  } else if (cmd === "merge") {
    const dir = resolve(args[1]);
    const dry = flag("--dry");
    for (const f of readdirSync(dir).filter((f) => /^[a-z]{2}-\d+\.json$/.test(f)).sort()) {
      const outFile = join(dir, f.replace(/\.json$/, ".out.json"));
      if (!existsSync(outFile)) { console.log(`${f}: no .out.json yet`); continue; }
      const job = JSON.parse(readFileSync(join(dir, f), "utf8"));
      let got;
      try { got = JSON.parse(readFileSync(outFile, "utf8")); } catch (e) { console.log(`${f}: bad JSON in the .out file (${e.message})`); continue; }
      const tr = readLang(job.lang);
      const rejects = [];
      let ok = 0;
      for (const it of job.items) {
        if (!(it.k in got)) continue;
        const why = problem(it.en, got[it.k], true);
        if (why) { rejects.push({ ...it, tr: got[it.k], why }); continue; }
        tr[it.k] = got[it.k]; ok++;
      }
      if (!dry) writeLang(job.lang, tr);
      const absent = job.items.filter((it) => !(it.k in got)).length;
      console.log(`${f}: ${ok} merged, ${rejects.length} rejected, ${absent} not translated`);
      for (const r of rejects.slice(0, 10)) console.log(`   ${r.why}: ${r.en.slice(0, 80)}  →  ${String(r.tr).slice(0, 80)}`);
      if (rejects.length) writeJson(join(dir, f.replace(/\.json$/, ".rejects.json")), rejects);
    }
  } else if (cmd === "prune") {
    const live = new Set([...Object.keys(en.site), ...Object.keys(en.stays)]);
    for (const lang of LANGS) {
      const tr = readLang(lang);
      let n = 0;
      for (const k of Object.keys(tr)) if (!live.has(k)) { delete tr[k]; n++; }
      if (!flag("--dry")) writeLang(lang, tr);
      console.log(`${lang}: ${n} translation(s) of English that is gone ${flag("--dry") ? "would be" : ""} removed`);
    }
  } else if (cmd === "suspect") {
    for (const lang of only) {
      const tr = readLang(lang);
      const bad = texts(en).filter((it) => tr[it.k] && !problem(it.en, tr[it.k]) && problem(it.en, tr[it.k], true));
      console.log(`${lang}: ${bad.length} with changed numbers`);
      for (const it of bad.slice(0, 20)) console.log(`   ${it.k}  ${it.en.slice(0, 70)}  →  ${tr[it.k].slice(0, 70)}`);
    }
  } else {
    console.log(readFileSync(new URL(import.meta.url), "utf8").split(/\r?\n/).slice(1, 25).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  }
}
