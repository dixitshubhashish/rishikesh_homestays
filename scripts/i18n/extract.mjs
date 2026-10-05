#!/usr/bin/env node
// Pulls the visible English text out of the hand-made pages into i18n/en.json.
//
//   node scripts/i18n/extract.mjs            write i18n/en.json
//   node scripts/i18n/extract.mjs --stdout   print it instead
//
// Shape: { "<page>": { "<id>": "<English>" } }, page = file path without .html
// (index, contact, hotels/advaitam-...). id = first 12 hex chars of
// sha1(normalised English), so the same sentence keeps the same id on every
// page and a changed sentence gets a new id (scripts/i18n/stale.mjs reports it).
//
// What counts as text: block-level runs (headings, paragraphs, list items,
// buttons, labels, options, table cells, figcaptions...), <title>, the meta
// description and og/twitter text, alt / title / aria-label / placeholder
// attributes, the hero slider's data-captions / data-headlines / data-copy
// JSON lists, and the prose fields of JSON-LD (breadcrumb names, FAQ questions
// and answers, descriptions). Inline markup inside a run becomes numbered
// placeholders, <0>...</0> or <0/> for an empty element, so link targets and
// attributes never reach a translator.
//
// Never extracted: href/src values (so wa.me prefilled text is safe), scripts,
// styles, SVG, the generated <!-- footer-stays --> block, anything inside
// translate="no", JSON-LD names of businesses/places/addresses, and runs with
// no letters at all (prices, phone numbers, ratings). Stay and brand names on
// their own (DO_NOT_TRANSLATE) are skipped; inside a sentence they are kept as
// written by the translator.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const PAGES = [
  "index", "404", "thanks", "contact", "homestays", "about-rishikesh",
  "places-to-visit", "things-to-do-in-rishikesh", "triveni-ghat",
  "kedarnath-yatra", "haridwar-kumbh-2027", "list-your-homestay",
  "driving-from-delhi-to-rishikesh", "bike-and-taxi-rental-in-rishikesh",
  "hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh",
];

// Whole strings that stay exactly as written in every language.
export const DO_NOT_TRANSLATE = new Set([
  "Rishikesh Homestays", "rishikeshhomestays.com", "WhatsApp", "Airbnb",
  "Booking.com", "MakeMyTrip", "Agoda", "Google Maps", "Instagram", "Facebook",
  "YouTube", "Advaitam", "Elysium", "Yoga Retreat at the Ganges",
]);

const INLINE = new Set([
  "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn", "em",
  "i", "img", "kbd", "mark", "q", "s", "samp", "small", "span", "strong",
  "sub", "sup", "time", "u", "var", "wbr", "picture", "svg",
]);
const SKIP = new Set(["script", "style", "noscript", "svg", "template", "iframe", "head"]);
export const TEXT_ATTRS = ["alt", "title", "aria-label", "placeholder"];
// JSON lists of text the hero slider shows one at a time (index.html).
export const DATA_LIST_ATTRS = ["data-captions", "data-headlines", "data-copy"];
const META_TEXT = new Set([
  "description", "og:title", "og:description", "og:image:alt",
  "twitter:title", "twitter:description", "twitter:image:alt",
]);
// JSON-LD: which @types have a translatable "name"; prose keys anywhere else.
const LD_NAME_TYPES = new Set(["ListItem", "Question", "HowToStep", "LocationFeatureSpecification"]);
const LD_PROSE_KEYS = new Set(["description", "text", "headline", "abstract"]);
const LD_SKIP_TYPES = new Set(["PostalAddress", "GeoCoordinates", "Offer", "AggregateRating", "Rating"]);

export const norm = (s) => s.replace(/\s+/g, " ").trim();
export const segId = (text) => createHash("sha1").update(norm(text)).digest("hex").slice(0, 12);
const hasLetters = (s) => /\p{L}/u.test(s.replace(/<\/?\d+\/?>/g, ""));
const isEmailOrUrl = (s) => /^(\S+@\S+\.\S+|https?:\/\/\S+|[\w.-]+\.(com|in|org)(\/\S*)?)$/i.test(s);

function keep(text) {
  const t = norm(text);
  if (!t || !hasLetters(t)) return null;
  if (DO_NOT_TRANSLATE.has(t) || isEmailOrUrl(t)) return null;
  return t;
}

// Drop the generated footer-stays block (footer_links.py owns that text).
function stripGenerated(html) {
  return html.replace(/<!--\s*footer-stays\s*-->[\s\S]*?<!--\s*\/footer-stays\s*-->/g, "");
}

function isNoTranslate(el) {
  return !!el.closest('[translate="no"], .notranslate');
}

function hasText(node) {
  return (node.textContent || "").trim().length > 0;
}

// Serialise a run of inline nodes with numbered placeholders.
function serialiseRun(nodes) {
  let n = 0;
  const walk = (node) => {
    if (node.nodeType === 3) return node.nodeValue.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "style") return "";
    const i = n++;
    if (tag === "svg" || !hasText(node)) return `<${i}/>`;
    return `<${i}>${[...node.childNodes].map(walk).join("")}</${i}>`;
  };
  return nodes.map(walk).join("");
}

// Strip placeholders that wrap the whole string: "<0>Text</0>" -> handled by
// the caller recursing instead, so this only tidies leading/trailing voids.
function tidy(s) {
  return norm(s.replace(/^(<\d+\/>\s*)+/, "").replace(/(\s*<\d+\/>)+$/, ""));
}

function collectBlock(el, out) {
  const tag = el.tagName.toLowerCase();
  if (SKIP.has(tag) || isNoTranslate(el)) return;
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const direct = run.some((n) => n.nodeType === 3 && n.nodeValue.trim());
    if (direct) {
      const t = keep(tidy(serialiseRun(run)));
      if (t) out.push(t);
    } else {
      // Only inline elements side by side (nav links, a wrapped <strong>):
      // each is its own segment.
      for (const n of run) if (n.nodeType === 1) collectBlock(n, out);
    }
    run = [];
  };
  for (const child of el.childNodes) {
    if (child.nodeType === 3) { run.push(child); continue; }
    if (child.nodeType !== 1) continue;
    const ctag = child.tagName.toLowerCase();
    if (SKIP.has(ctag) && ctag !== "svg") { flush(); continue; }
    if (isNoTranslate(child)) { flush(); continue; }
    if (INLINE.has(ctag) && !child.querySelector("p, div, ul, ol, li, h1, h2, h3, h4, h5, h6, section, article, table")) {
      run.push(child);
    } else {
      flush();
      collectBlock(child, out);
    }
  }
  flush();
}

function collectAttrs(doc, out) {
  for (const el of doc.body.querySelectorAll("*")) {
    if (el.closest("svg, script, style, template") || isNoTranslate(el)) continue;
    for (const a of TEXT_ATTRS) {
      if (el.hasAttribute(a)) {
        const t = keep(el.getAttribute(a));
        if (t) out.push(t);
      }
    }
    if (el.tagName === "INPUT" && /^(submit|button|reset)$/i.test(el.type) && el.value) {
      const t = keep(el.value);
      if (t) out.push(t);
    }
    for (const a of DATA_LIST_ATTRS) {
      if (!el.hasAttribute(a)) continue;
      let list;
      try { list = JSON.parse(el.getAttribute(a)); } catch { continue; }
      if (Array.isArray(list)) for (const item of list) {
        const t = typeof item === "string" && keep(item);
        if (t) out.push(t);
      }
    }
  }
}

function collectLd(node, out, parentType = null) {
  if (Array.isArray(node)) return node.forEach((n) => collectLd(n, out, parentType));
  if (!node || typeof node !== "object") return;
  const type = Array.isArray(node["@type"]) ? node["@type"][0] : node["@type"] || parentType;
  if (LD_SKIP_TYPES.has(type)) return;
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === "string") {
      if ((k === "name" && LD_NAME_TYPES.has(type)) || LD_PROSE_KEYS.has(k)) {
        const t = keep(v);
        if (t) out.push(t);
      }
    } else if (v && typeof v === "object") {
      collectLd(v, out, null);
    }
  }
}

export function extractPage(html) {
  const doc = new JSDOM(stripGenerated(html), { virtualConsole: new VirtualConsole() }).window.document;
  const out = [];
  const title = keep(doc.title || "");
  if (title) out.push(title);
  for (const m of doc.querySelectorAll("meta[name], meta[property]")) {
    const key = m.getAttribute("name") || m.getAttribute("property");
    if (META_TEXT.has(key)) {
      const t = keep(m.getAttribute("content") || "");
      if (t) out.push(t);
    }
  }
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try { collectLd(JSON.parse(s.textContent), out); } catch { /* malformed JSON-LD: skip */ }
  }
  collectBlock(doc.body, out);
  collectAttrs(doc, out);
  const page = {};
  for (const t of out) page[segId(t)] ??= t;
  return page;
}

export function extractAll() {
  const all = {};
  for (const p of PAGES) all[p] = extractPage(readFileSync(join(ROOT, `${p}.html`), "utf8"));
  return all;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const all = extractAll();
  const json = JSON.stringify(all, null, 2) + "\n";
  if (process.argv.includes("--stdout")) {
    process.stdout.write(json);
  } else {
    mkdirSync(join(ROOT, "i18n"), { recursive: true });
    writeFileSync(join(ROOT, "i18n", "en.json"), json);
    const total = Object.values(all).reduce((n, p) => n + Object.keys(p).length, 0);
    const unique = new Set(Object.values(all).flatMap((p) => Object.keys(p))).size;
    console.log(`i18n/en.json: ${PAGES.length} pages, ${total} strings (${unique} unique)`);
  }
}
