// In-browser translation: one English page, translated on the go.
//
// The inline "rh-i18n" snippet in every page's <head> picks the language
// (?lang=xx, else the saved choice in localStorage 'rh-lang', else English),
// sets <html lang/dir>, hides the body for at most 1.5 s and loads this module
// only when the language is not English. This module then:
//   1. fetches /i18n/<lang>/_common.json (nav, footer, JS UI text, patterns)
//      and /i18n/<lang>/<page>.json (that page's own text), both built by
//      scripts/i18n/build-runtime.mjs from the i18n/<lang>.json catalogues;
//   2. walks the page exactly like scripts/i18n/extract.mjs does (same runs of
//      inline content with <0>…</0> placeholders, same sha1 ids of the
//      normalised English) and swaps in the translation, reusing the original
//      elements so links and listeners keep working;
//   3. watches the DOM (MutationObserver) so text that scripts add later (hero
//      slider, nav drawer, WhatsApp popup, form messages, stays lists, the 404
//      countdown) is translated too;
//   4. adds `lang` to the JSON sent to /api/contact (stored as page_lang).
// Anything without a translation stays English. Never translated: stay names,
// prices, phones, emails, URLs (only catalogued text is ever replaced, and
// href/value/data are never touched), the WhatsApp prefilled message and the
// enquiry fields (they are built from English strings in JS, not from the page).
//
// Kept in step with scripts/i18n/extract.mjs: tests/modules/i18n-runtime.test.js
// checks the ids and the walk against it.

export const PAGES = [
  "index", "404", "thanks", "contact", "homestays", "about-rishikesh",
  "places-to-visit", "things-to-do-in-rishikesh", "triveni-ghat",
  "kedarnath-yatra", "haridwar-kumbh-2027", "list-your-homestay",
  "driving-from-delhi-to-rishikesh", "bike-and-taxi-rental-in-rishikesh",
  "hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh",
];

const INLINE = new Set([
  "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn", "em",
  "i", "img", "kbd", "mark", "q", "s", "samp", "small", "span", "strong",
  "sub", "sup", "time", "u", "var", "wbr", "picture", "svg",
]);
const SKIP = new Set(["script", "style", "noscript", "svg", "template", "iframe", "head", "textarea"]);
const BLOCKY = "p, div, ul, ol, li, h1, h2, h3, h4, h5, h6, section, article, table";
const NO_TRANSLATE = '[translate="no"], .notranslate';
export const TEXT_ATTRS = ["alt", "title", "aria-label", "placeholder"];
export const DATA_LIST_ATTRS = ["data-captions", "data-headlines", "data-copy"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const norm = (s) => s.replace(/\s+/g, " ").trim();

// SHA-1 (synchronous, so the MutationObserver can translate in the same tick).
export function sha1Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const len = bytes.length;
  const words = (((len + 8) >> 6) + 1) * 16;
  const w = new Int32Array(words);
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  w[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  w[words - 1] = len * 8;
  const W = new Int32Array(80);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const rol = (x, n) => (x << n) | (x >>> (32 - n));
  for (let i = 0; i < words; i += 16) {
    for (let t = 0; t < 16; t++) W[t] = w[i + t];
    for (let t = 16; t < 80; t++) W[t] = rol(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let t = 0; t < 80; t++) {
      let f, k;
      if (t < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (t < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (t < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const tmp = (rol(a, 5) + f + e + k + W[t]) | 0;
      e = d; d = c; c = rol(b, 30); b = a; a = tmp;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, "0")).join("");
}

// Same id as extract.mjs's segId(): first 12 hex chars of sha1(normalised English).
const idCache = new Map();
export function segId(text) {
  const t = norm(text);
  let id = idCache.get(t);
  if (!id) { id = sha1Hex(t).slice(0, 12); if (idCache.size < 5000) idCache.set(t, id); }
  return id;
}

// "/contact" -> "contact", "/" -> "index", a page without its own file -> null.
export function pageKey(pathname, explicit) {
  if (explicit) return explicit;
  let p = "";
  try { p = decodeURIComponent(pathname || "/"); } catch { p = pathname || "/"; }
  p = p.replace(/\/+$/, "").replace(/\.html$/, "").replace(/^\/+/, "");
  if (!p || p === "index") p = "index";
  return PAGES.includes(p) ? p : null;
}

const placeholders = (s) => (s.match(/<\/?\d+\/?>/g) || []).sort().join();
const hasLetters = (s) => /\p{L}/u.test(s.replace(/<\/?\d+\/?>/g, ""));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// { "Starting ₹{p} onwards": "₹{p} से शुरू" } -> matchers; slot values are put
// back untouched (numbers, prices, names).
export function compilePatterns(patterns) {
  return Object.entries(patterns || {}).map(([en, tr]) => {
    const slots = [];
    const src = norm(en).split(/(\{[a-z0-9_]+\})/i).map((part, i) => {
      if (i % 2) { slots.push(part); return "(.+?)"; }
      return escapeRe(part);
    }).join("");
    return { re: new RegExp(`^${src}$`, "u"), slots, tr };
  });
}

export function makeLookup(strings, patterns = []) {
  return (english) => {
    const tr = strings[segId(english)];
    if (tr != null) return norm(tr) && placeholders(tr) === placeholders(english) ? tr : null;
    for (const p of patterns) {
      const m = p.re.exec(english);
      if (!m) continue;
      let out = p.tr;
      p.slots.forEach((slot, i) => { out = out.split(slot).join(m[i + 1]); });
      return placeholders(out) === placeholders(english) ? out : null;
    }
    return null;
  };
}

// The page walker. `lookup(english)` returns the translation or null.
export function createTranslator(doc, lookup) {
  const hasText = (node) => (node.textContent || "").trim().length > 0;
  const isNo = (el) => !!(el.closest && el.closest(NO_TRANSLATE));

  // Serialise a run like extract.mjs, remembering the element behind each number.
  function serialiseRun(nodes) {
    let n = 0;
    const map = [];
    const walk = (node) => {
      if (node.nodeType === 3) return node.nodeValue.replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"));
      if (node.nodeType !== 1) return "";
      const tag = node.tagName.toLowerCase();
      if (tag === "script" || tag === "style") return "";
      const i = n++;
      map[i] = node;
      if (tag === "svg" || !hasText(node)) return `<${i}/>`;
      return `<${i}>${[...node.childNodes].map(walk).join("")}</${i}>`;
    };
    return { raw: nodes.map(walk).join(""), map };
  }

  // Rebuild nodes from a translated string, moving the original elements into
  // place (a placeholder used twice gets a copy).
  function build(str, map) {
    const frag = doc.createDocumentFragment();
    const stack = [frag];
    const used = new Set();
    const take = (i, deep) => {
      const el = map[i];
      if (used.has(i)) return el.cloneNode(deep);
      used.add(i);
      if (!deep) while (el.firstChild) el.removeChild(el.firstChild);
      return el;
    };
    const text = (s) => {
      if (s) stack[stack.length - 1].appendChild(doc.createTextNode(s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")));
    };
    const re = /<(\/?)(\d+)(\/?)>/g;
    let last = 0, m;
    while ((m = re.exec(str))) {
      text(str.slice(last, m.index));
      last = re.lastIndex;
      const top = stack[stack.length - 1];
      if (m[3]) top.appendChild(take(+m[2], true));
      else if (!m[1]) { const el = take(+m[2], false); top.appendChild(el); stack.push(el); }
      else if (stack.length > 1) stack.pop();
    }
    text(str.slice(last));
    return frag;
  }

  function translateRun(run) {
    const { raw, map } = serialiseRun(run);
    const lead = (raw.match(/^(<\d+\/>\s*)+/) || [""])[0];
    const rest = raw.slice(lead.length);
    const trail = (rest.match(/(\s*<\d+\/>)+$/) || [""])[0];
    const t = norm(raw.replace(/^(<\d+\/>\s*)+/, "").replace(/(\s*<\d+\/>)+$/, ""));
    if (!t || !hasLetters(t)) return;
    const tr = lookup(t);
    if (tr == null || tr === t) return;
    const first = run[0], lastNode = run[run.length - 1];
    const parent = first.parentNode;
    if (!parent) return;
    const before = first.nodeType === 3 && !lead && /^\s/.test(first.nodeValue) ? " " : "";
    const after = lastNode.nodeType === 3 && !trail && /\s$/.test(lastNode.nodeValue) ? " " : "";
    const marker = doc.createTextNode("");
    parent.insertBefore(marker, first);
    const frag = build(`${lead}${before}${tr}${after}${trail}`, map);
    for (const n of run) if (n.parentNode === parent) parent.removeChild(n);
    parent.insertBefore(frag, marker);
    parent.removeChild(marker);
  }

  function walk(el) {
    if (!el || el.nodeType !== 1) return;
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag) || isNo(el)) return;
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const nodes = run;
      run = [];
      const direct = nodes.some((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (direct) translateRun(nodes);
      else for (const n of nodes) if (n.nodeType === 1) walk(n);
    };
    for (const child of [...el.childNodes]) {
      if (child.nodeType === 3) { run.push(child); continue; }
      if (child.nodeType !== 1) continue;
      const ctag = child.tagName.toLowerCase();
      if (SKIP.has(ctag) && ctag !== "svg") { flush(); continue; }
      if (child.matches && child.matches(NO_TRANSLATE)) { flush(); continue; }
      if (INLINE.has(ctag) && !child.querySelector(BLOCKY)) run.push(child);
      else { flush(); walk(child); }
    }
    flush();
  }

  function attrsOne(el) {
    if (el.closest("svg, script, style, template") || isNo(el)) return;
    for (const a of TEXT_ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const t = norm(el.getAttribute(a));
      const tr = t && hasLetters(t) && lookup(t);
      if (tr && tr !== t) el.setAttribute(a, tr);
    }
    if (el.tagName === "INPUT" && /^(submit|button|reset)$/i.test(el.type) && el.value) {
      const tr = lookup(norm(el.value));
      if (tr) el.value = tr;
    }
    for (const a of DATA_LIST_ATTRS) {
      if (!el.hasAttribute(a)) continue;
      let list;
      try { list = JSON.parse(el.getAttribute(a)); } catch { continue; }
      if (!Array.isArray(list)) continue;
      const out = list.map((s) => (typeof s === "string" && lookup(norm(s))) || s);
      if (out.some((s, i) => s !== list[i])) el.setAttribute(a, JSON.stringify(out));
    }
  }

  function attrs(root) {
    if (!root || root.nodeType !== 1) return;
    attrsOne(root);
    for (const el of root.querySelectorAll("*")) attrsOne(el);
  }

  // Text added inside a run (a <strong> in a <p>) is re-read with its block.
  function blockOf(node) {
    let el = node.nodeType === 1 ? node : node.parentNode;
    while (el && el.nodeType === 1 && INLINE.has(el.tagName.toLowerCase()) && el.parentNode && el.parentNode.nodeType === 1) el = el.parentNode;
    return el && el.nodeType === 1 ? el : null;
  }

  function translateDocHead() {
    const t = norm(doc.title || "");
    const tr = t && lookup(t);
    if (tr) doc.title = tr;
    const meta = doc.querySelector('meta[name="description"]');
    const d = meta && norm(meta.getAttribute("content") || "");
    const dtr = d && lookup(d);
    if (dtr) meta.setAttribute("content", dtr);
  }

  return { walk, attrs, attrsOne, blockOf, translateDocHead };
}

// Month and day names: the catalogue first, else the browser's own (Intl).
export function flatpickrLocale(lang, lookup) {
  const intl = (opts, date) => {
    try { return new Intl.DateTimeFormat(lang, opts).format(date); } catch { return null; }
  };
  const name = (en, opts, date) => {
    const tr = lookup(en);
    if (tr && tr !== en) return tr;
    return intl(opts, date) || en;
  };
  const month = (i, style) => name(style === "long" ? MONTHS[i] : MONTHS[i].slice(0, 3), { month: style }, new Date(2026, i, 15));
  // 2026-02-01 is a Sunday
  const day = (i, style) => name(style === "long" ? DAYS[i] : DAYS[i].slice(0, 3), { weekday: style }, new Date(2026, 1, 1 + i));
  return {
    weekdays: { shorthand: DAYS.map((_, i) => day(i, "short")), longhand: DAYS.map((_, i) => day(i, "long")) },
    months: { shorthand: MONTHS.map((_, i) => month(i, "short")), longhand: MONTHS.map((_, i) => month(i, "long")) },
  };
}

// Every JSON POST to /api/contact carries the page language (page_lang).
function installFetchLang(lang) {
  const orig = window.fetch;
  if (!orig || orig.rhLang) return;
  const wrapped = function (input, init) {
    try {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      if (/\/api\/contact(\?|$)/.test(url) && init && typeof init.body === "string") {
        const body = JSON.parse(init.body);
        if (body && typeof body === "object" && !body.lang) init = { ...init, body: JSON.stringify({ ...body, lang }) };
      }
    } catch { /* not JSON: send as it is */ }
    return orig.call(this, input, init);
  };
  wrapped.rhLang = true;
  window.fetch = wrapped;
}

// Without storage (private mode), carry ?lang= on internal links instead.
function carryLangOnLinks(lang) {
  let saved = false;
  try { saved = localStorage.getItem("rh-lang") === lang; } catch { /* blocked */ }
  if (saved) return;
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    let u;
    try { u = new URL(a.getAttribute("href"), location.href); } catch { return; }
    if (u.origin !== location.origin || u.searchParams.has("lang") || /\.(json|xml|txt|pdf)$/.test(u.pathname)) return;
    u.searchParams.set("lang", lang);
    a.setAttribute("href", u.pathname + u.search + u.hash);
  }, true);
}

export async function start(lang = window.RH_LANG) {
  const root = document.documentElement;
  const reveal = () => root.classList.remove("rh-i18n-wait");
  if (!lang || lang === "en") return reveal();
  installFetchLang(lang);
  carryLangOnLinks(lang);
  const page = pageKey(location.pathname, root.getAttribute("data-i18n-page"));
  const get = (path) => fetch(`/i18n/${lang}/${path}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const [common, own] = await Promise.all([get("_common"), page ? get(page) : {}]);
  const lookup = makeLookup({ ...(common.strings || {}), ...own }, compilePatterns(common.patterns));
  if (document.readyState === "loading") await new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }));

  const tr = createTranslator(document, lookup);
  const fpLocale = flatpickrLocale(lang, lookup);
  let fpDone = false;
  const localiseCalendars = () => {
    const fp = window.flatpickr;
    if (!fp) return;
    if (!fpDone) { try { fp.localize(fpLocale); } catch { /* old flatpickr */ } fpDone = true; }
    for (const input of document.querySelectorAll("input")) {
      const inst = input._flatpickr;
      if (inst && !inst.rhLocalised) { inst.rhLocalised = true; try { inst.set("locale", fpLocale); } catch { /* ignore */ } }
    }
  };

  let observer;
  const run = (fn) => { fn(); if (observer) observer.takeRecords(); };
  run(() => {
    tr.translateDocHead();
    tr.walk(document.body);
    tr.attrs(document.body);
    localiseCalendars();
  });
  reveal();

  observer = new MutationObserver((records) => {
    const blocks = new Set();
    const attrEls = new Set();
    for (const r of records) {
      if (r.type === "attributes") { attrEls.add(r.target); continue; }
      if (r.type === "characterData") { const b = tr.blockOf(r.target); if (b) blocks.add(b); continue; }
      for (const n of r.addedNodes) {
        if (n.nodeType === 1) { const b = tr.blockOf(n); if (b) blocks.add(b); attrEls.add(n); }
        else if (n.nodeType === 3) { const b = tr.blockOf(n); if (b) blocks.add(b); }
      }
    }
    run(() => {
      for (const b of blocks) if (b.isConnected && b !== document.documentElement) tr.walk(b);
      for (const el of attrEls) if (el.isConnected) tr.attrs(el);
      localiseCalendars();
    });
  });
  observer.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: [...TEXT_ATTRS, ...DATA_LIST_ATTRS],
  });
  // <title> changes made by scripts (none today) would need the head observed too.
}

if (typeof window !== "undefined" && typeof document !== "undefined" && window.RH_LANG && window.RH_LANG !== "en") {
  start().catch(() => document.documentElement.classList.remove("rh-i18n-wait"));
}
