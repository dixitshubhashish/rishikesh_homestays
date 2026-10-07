#!/usr/bin/env node
// Collects the English UI text that lives only in JavaScript (plus
// NAME_WORDS and i18n/ui/rendered.json, see extractUi below) (form messages,
// button states, the WhatsApp popup, the stays lists, the 404 countdown...)
// for extract.mjs, which adds it to i18n/en.json ("site"):
//
//   node scripts/i18n/extract-ui.mjs --stdout   print it
//
// A text with
// {name} slots ("{n} reviews", "Starting ₹{price} onwards") is a pattern: the
// runtime matches the English shape and puts the original values back into
// the translation, so numbers and prices are never translated. Month and day
// names (flatpickr's calendar) are always included.
//
// The scan is a heuristic over string literals: sentences and capitalised
// labels are kept, code-looking strings (selectors, URLs, class names, event
// names) are dropped. Texts that only go to the owner (WhatsApp prefilled
// messages, enquiry email fields) are never shown translated, so they are
// left out by EXCLUDE below. Review the diff after running it.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PAGES } from "./extract.mjs";
import { NAME_WORDS } from "../../assets/js/i18n-runtime.js";
import { AREAS } from "../../assets/js/modules/data.js";
import { STAYS_INDEX as RISHIKESH_STAYS } from "../../assets/js/modules/stays-index-data.js";
import { STAYS_INDEX as HARIDWAR_STAYS } from "../../assets/js/modules/stays-index-data-haridwar.js";
export const SIGHTING_2 = "Possible sighting: <0>joined a Naga akhada procession at Har Ki Pauri and hasn’t looked back.</0> <1>Plan your Kumbh 2027 visit →</1>";
const FACILITIES = [...new Set([...RISHIKESH_STAYS, ...HARIDWAR_STAYS].flatMap((d) => d.f || []))].sort();

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const UI_FILES = [
  "assets/js/modules/whatsapp-widget.js", "assets/js/modules/contact-form.js",
  "assets/js/modules/rental-form.js", "assets/js/modules/host-form.js",
  "assets/js/modules/ota-lead-gate.js", "assets/js/modules/stays-index.js",
  "assets/js/modules/stay-page.js", "assets/js/modules/email-otp.js",
  "assets/js/modules/validators.js", "assets/js/modules/nav.js",
  "assets/js/modules/search-form.js", "assets/js/modules/stays-renderer.js",
  "assets/js/modules/currency.js", "assets/js/modules/button-loading.js",
  "assets/js/modules/landmark-map.js", "assets/js/modules/country-select.js",
  "assets/js/modules/lang-picker.js", "assets/js/modules/site-search.js",
];

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAYS_SHORT = DAYS.map((d) => d.slice(0, 3));

// Owner-only text (WhatsApp prefill, email bodies) and code that looks like text.
const EXCLUDE = [
  /^Hi\b/, /\bI'd like to\b/, /^\*/, /^(Name|Phone|Email|Dates?|Guests|Pets|Check-in|Check-out|Message|Notes|Service|Source|Page|Listing|Stay)\s*:/,
  /^(GET|POST|PUT|Content-Type|application\/|text\/)/, /^DOMContentLoaded$/, /^(Escape|Enter|Tab|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/,
  /^(Intl|Promise|Error|Date|Math|JSON|Number|String|Object|Array|Set|Map)$/, /^[A-Z][A-Z0-9_]+$/,
  /^(Rishikesh Homestays|WhatsApp|Airbnb|Booking\.com|MakeMyTrip|Agoda|Google Maps|Instagram|Facebook|YouTube|Leaflet|OpenStreetMap)$/,
  /^(Rishikesh|Haridwar|India|INR|USD|EUR|GBP|AUD|CAD|JPY)$/, /^Ad area/,
  // message and email lines that go to the owner, console and library text
  /^- /, /^---/, /^\((max-width|min-width|prefers-)/, /^[A-Z]\$$/, /^[dYmMDjF][ -/][dYmMDjF]/,
  /^IntersectionObserver$/, /: failed to /, /failed to load$/, /^Request failed$/, /^Clicked through/,
  /^Interested in /, /^My name is /, /^No verified booking page/, /^Sent on to /, /^Ref:/,
  /^WhatsApp widget booking request/, /^We're \{guests\} in total/, /^Could you help with availability/,
  /^(People|Pickup point|City):/, /^search index\b/, /^[^\p{Script=Latin}]*\p{Script=Devanagari}/u,
];

// Tokenise string literals ('..', "..", `..${x}..`) skipping comments and regexes (roughly).
export function stringLiterals(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  let prevSignificant = "";
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2); if (i < 0) break; i += 2; continue; }
    if (c === "/" && /[(,=:[!&|?{};+\-*%<>~^]|^$|return$/.test(prevSignificant)) {
      // regex literal
      i++;
      let inClass = false;
      while (i < n && (src[i] !== "/" || inClass)) {
        if (src[i] === "\\") i++;
        else if (src[i] === "[") inClass = true;
        else if (src[i] === "]") inClass = false;
        else if (src[i] === "\n") break;
        i++;
      }
      i++;
      prevSignificant = "x";
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1, s = "";
      while (j < n && src[j] !== c && src[j] !== "\n") {
        if (src[j] === "\\") { s += unescape(src[j + 1]); j += 2; continue; }
        s += src[j++];
      }
      out.push({ text: s, template: false });
      i = j + 1;
      prevSignificant = "x";
      continue;
    }
    if (c === "`") {
      let j = i + 1, s = "", depth = 0;
      while (j < n) {
        if (depth === 0 && src[j] === "`") break;
        if (src[j] === "\\") { s += unescape(src[j + 1]); j += 2; continue; }
        if (depth === 0 && src[j] === "$" && src[j + 1] === "{") { depth = 1; s += "${"; j += 2; continue; }
        if (depth > 0) {
          if (src[j] === "{") depth++;
          else if (src[j] === "}") { depth--; if (depth === 0) { s += "}"; j++; continue; } }
          s += src[j++];
          continue;
        }
        s += src[j++];
      }
      out.push({ text: s, template: true });
      i = j + 1;
      prevSignificant = "x";
      continue;
    }
    if (c === "r" && src.startsWith("return", i) && !/\w/.test(src[i - 1] || "")) { prevSignificant = "return"; i += 6; continue; }
    if (!/\s/.test(c)) prevSignificant = /\w/.test(c) ? "x" : c;
    i++;
  }
  return out;
}
function unescape(ch) {
  return ({ n: "\n", t: "\t", "'": "'", '"': '"', "`": "`", "\\": "\\" })[ch] ?? ch;
}

// "${stay.reviews}" -> "{reviews}"
function slotName(expr) {
  const ids = expr.match(/[A-Za-z_$][\w$]*/g) || ["n"];
  const name = ids.filter((x) => !/^(esc|fmt|format\w*|Math|String|Number|toLocaleString|round|ceil|floor|length)$/.test(x)).pop() || "n";
  return name.replace(/\W/g, "").toLowerCase() || "n";
}

const norm = (s) => s.replace(/\s+/g, " ").trim();
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&rsquo;/g, "’").replace(/&middot;/g, "·")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// Text pieces of one literal: HTML is split at tags, ${} become {slots}.
function pieces({ text, template }) {
  let s = text;
  if (template) s = s.replace(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_, e) => `{${slotName(e)}}`);
  if (/<\/?[a-z][^>]*>/i.test(s)) {
    const parts = s.split(/<[^>]+>/).map((p) => decode(norm(p))).filter(Boolean);
    // aria-label / title / placeholder / alt values inside the HTML
    for (const m of s.matchAll(/\b(?:aria-label|title|placeholder|alt)="([^"$]+)"/g)) parts.push(decode(norm(m[1])));
    return parts;
  }
  return [norm(s)];
}

function looksLikeText(t) {
  if (!/\p{L}/u.test(t) || t.length < 2 || t.length > 400) return false;
  if (/^\{[a-z]+\}$/.test(t)) return false;
  const bare = t.replace(/\{[a-z]+\}/g, "").trim();
  if (!/\p{L}/u.test(bare)) return false;
  if (/^(https?:|mailto:|tel:|\/|\.|#|\[|data:|wa\.me)/.test(bare)) return false;
  if (/[=;{}]|=>|\(\)|\$\{/.test(bare)) return false;
  if (/^[a-z0-9_-]+$/.test(bare)) return false; // class names, keys, events
  if (/^[a-z]+[A-Z]\w*$/.test(bare)) return false; // camelCase
  if (/^[\w-]+\.(js|css|json|png|webp|svg|html)$/.test(bare)) return false;
  if (/^[a-z][\w-]*(\s+[a-z][\w-]*)*$/.test(bare) && !/\s/.test(bare)) return false;
  if (/^[a-z][\w-]*( [a-z][\w-]*)+$/.test(bare) && /-/.test(bare)) return false; // "btn btn-primary"
  if (EXCLUDE.some((re) => re.test(bare))) return false;
  // A UI string starts with a capital, a digit/slot or a symbol (₹, ★, ·)
  // or is a lower-case sentence with a space ("or", "per night").
  return /^[\p{Lu}\d{₹★·(“"‘'+–—…→←]/u.test(t) || /\s/.test(bare);
}

// The pages' inline scripts (404 countdown and sightings, small helpers).
function inlineScripts(page) {
  const html = readFileSync(join(ROOT, `${page}.html`), "utf8");
  return [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

export function extractUi(rendered = []) {
  const found = new Map();
  const add = (t, where) => { if (!found.has(t)) found.set(t, where); };
  const sources = [];
  for (const f of UI_FILES) if (existsSync(join(ROOT, f))) sources.push([f, readFileSync(join(ROOT, f), "utf8")]);
  for (const p of PAGES) inlineScripts(p).forEach((js, i) => sources.push([`${p}.html#script${i}`, js]));
  for (const [where, src] of sources) {
    // The rh-i18n head snippet itself has no UI text.
    if (src.includes("/* rh-i18n:")) continue;
    for (const lit of stringLiterals(src)) for (const t of pieces(lit)) if (looksLikeText(t)) add(t, where);
  }
  const out = {};
  for (const t of [...found.keys()].sort((a, b) => a.localeCompare(b, "en"))) out[t] = t;
  for (const t of [...MONTHS, ...MONTHS_SHORT, ...DAYS, ...DAYS_SHORT]) out[t] = t;
  // the amenity labels of every stay page ("Garden furniture", "VIP check-in/ -out"): stay-page.js writes them from the data modules
  for (const f of FACILITIES) out[f] ??= f;
  // slot values the browser fills into a bigger text: " · 6 reviews" in "Guests 5.8/10 · 6 reviews"
  out["· {n1} reviews"] ??= "· {n1} reviews";
  // the 404 picks one of two "possible sighting" lines at random after the page loaded, so the whole run for the
  // second line needs its own entry (the first is in the page's HTML); the stay page's title when a stay is not found
  out[SIGHTING_2] ??= SIGHTING_2;
  for (const c of ["Rishikesh", "Haridwar"]) out[`This stay has checked out | ${c} | Rishikesh Homestays`] ??= `This stay has checked out | ${c} | Rishikesh Homestays`;
  // the area names of the search and filter dropdowns (data.js AREAS, written by search-form.js and stays-renderer.js)
  for (const a of AREAS) out[a] ??= a;
  // generic words inside stay names ("Hotel", "Guest House"): i18n-runtime.js translates just these
  for (const t of NAME_WORDS) out[t] = t;
  // text the browser renders that the scan above cannot see (inside big HTML
  // template literals, data.js cards): en.json "rendered", from extract-rendered.mjs
  for (const t of rendered) out[t] ??= t;
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { readEn } = await import("./catalog.mjs");
  process.stdout.write(JSON.stringify(extractUi(readEn().rendered), null, 2) + "\n");
}
