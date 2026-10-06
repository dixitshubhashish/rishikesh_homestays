// The translation catalogues: one English file, one flat file per language.
// Every tool in scripts/i18n/ reads and writes them through this module
// (docs/I18N.md has the whole pipeline).
//
//   i18n/en.json      { "site":  { "<id>": "<English>" },   every page's shared and own text,
//                                                           the footer, text written by scripts
//                       "stays": { "<id>": "<English>" },   the generated stays pages' sentence
//                                                           templates and names (only those pages load it)
//                       "rendered": ["<English>", …] }      what extract-rendered.mjs found in the browser
//   i18n/<lang>.json  { "<id>": "<translation>" }         one entry per text, whatever page it is on
//   i18n/dist/<lang>.json, i18n/dist/<lang>.stays.json    what the browser fetches (build-runtime.mjs)
//   i18n/STYLE.md     each language's house style and glossary
//
// <id> = the first 11 base64url characters of SHA-256(normalised English):
// 64+ bits, the same in every catalogue and on every page, so a text that
// appears on 40 pages is stored and translated once. segId() in
// assets/js/i18n-runtime.js makes the same id in the browser; addText() stops
// the build if two different texts ever share one.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DIR = join(ROOT, "i18n");
export const LANGS = ["hi", "bn", "ta", "te", "kn", "mr", "ne", "si", "zh", "es", "fr", "pt",
  "ru", "de", "it", "ja", "ko", "id", "ms", "tr", "vi", "he"];
export const ID_LENGTH = 11;

export const norm = (s) => s.replace(/\s+/g, " ").trim();
export const segId = (text) => createHash("sha256").update(norm(text)).digest("base64url").slice(0, ID_LENGTH);

// A text with {slots} is a pattern: the browser matches its shape.
export const isPattern = (s) => /\{[a-z0-9_]+\}/i.test(s);
// No words of its own ("{t1} <0>{n1}</0>"): kept as is in every language.
export const slotOnly = (s) => !/\p{L}/u.test(s.replace(/\{[a-z0-9_]+\}/gi, "").replace(/<\/?\d+\/?>/g, ""));

const readJson = (f, fallback) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : fallback);
// Sorted keys, so a re-run only changes what really changed.
const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
// `space` 0 for the files the browser fetches (no indentation, fewer bytes).
export const writeJson = (f, data, space = 1) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(data, null, space || undefined) + "\n"); };

export const readEn = () => readJson(join(DIR, "en.json"), { site: {}, stays: {}, rendered: [] });
export const writeEn = (en) => writeJson(join(DIR, "en.json"), { site: sorted(en.site), stays: sorted(en.stays), rendered: [...en.rendered].sort() });
export const readLang = (lang) => readJson(join(DIR, `${lang}.json`), {});
export const writeLang = (lang, tr) => writeJson(join(DIR, `${lang}.json`), sorted(tr));

// Adds a text under its id; two different texts with one id stop the build.
export function addText(section, text) {
  const t = norm(text);
  const id = segId(t);
  if (section[id] != null && section[id] !== t) throw new Error(`i18n id collision ${id}: "${section[id]}" vs "${t}"`);
  section[id] = t;
  return id;
}
