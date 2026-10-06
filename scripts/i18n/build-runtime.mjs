#!/usr/bin/env node
// Builds what the browser fetches for in-browser translation
// (assets/js/i18n-runtime.js) from the catalogues (scripts/i18n/catalog.mjs):
//
//   i18n/dist/<lang>.json        { "s": { "<id>": "<text>" }, "p": [["<English {slot}>", "<text>"], …] }
//                                every page's text, the footer, text written by scripts
//   i18n/dist/<lang>.stays.json  the same shape, for the generated stays pages only
//                                (their sentence templates and names)
//
// Two files per language, cached by the browser across pages. Strings are
// looked up by id; patterns (texts with {slots}) carry their English shape so
// the browser can match it. A translation whose <0>…</0> placeholders or
// {slots} differ from the English is left out (the page shows English there:
// node scripts/i18n/sync.mjs status lists what is missing).
//
//   node scripts/i18n/build-runtime.mjs          every language
//   node scripts/i18n/build-runtime.mjs hi de    some languages

import { rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DIR, LANGS, readEn, readLang, writeJson, segId, norm, isPattern, slotOnly } from "./catalog.mjs";
import { problem } from "./sync.mjs";

export { LANGS };
const DIST = join(DIR, "dist");

function pack(section, tr) {
  const s = {}, p = [];
  for (const [id, en] of Object.entries(section)) {
    const t = slotOnly(en) ? en : tr[id];
    if (problem(en, t)) continue;
    if (isPattern(en)) p.push([en, norm(t)]);
    else if (norm(t) !== en) s[id] = t;
  }
  return { s, p };
}

export function buildLang(lang, en = readEn()) {
  const tr = readLang(lang);
  const site = pack(en.site, tr);
  // "<0/> Book on WhatsApp" (an icon, then text) is also offered without the
  // icon, for the same words that scripts insert as plain text (nav drawer).
  for (const [id, english] of Object.entries(en.site)) {
    const m = /^<(\d+)\/>\s*([^<]+)$/.exec(english);
    const t = site.s[id];
    if (!m || !t) continue;
    const bare = t.replace(new RegExp(`\\s*<${m[1]}\\/>\\s*`), " ").trim();
    if (!/<\/?\d+\/?>/.test(bare)) site.s[segId(m[2])] ??= bare;
  }
  return { site, stays: pack(en.stays, tr) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const en = readEn();
  // only the two files per language are kept (the old per-page folders go)
  for (const d of LANGS) if (existsSync(join(DIR, d))) rmSync(join(DIR, d), { recursive: true });
  if (!want.length && existsSync(DIST)) for (const f of readdirSync(DIST)) rmSync(join(DIST, f));
  const total = (o) => Object.values(o).filter((t) => !slotOnly(t)).length;
  for (const lang of want.length ? want : LANGS) {
    const { site, stays } = buildLang(lang, en);
    writeJson(join(DIST, `${lang}.json`), site, 0);
    writeJson(join(DIST, `${lang}.stays.json`), stays, 0);
    const n = (x) => Object.keys(x.s).length + x.p.length;
    console.log(`i18n/dist/${lang}: site ${n(site)}/${total(en.site)}, stays ${n(stays)}/${total(en.stays)}`);
  }
}
