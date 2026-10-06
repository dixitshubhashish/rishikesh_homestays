// In-browser translation: one English page, translated on the go.
//
// The inline "rh-i18n" snippet in every page's <head> picks the language
// (?lang=xx, else the saved choice in localStorage 'rh-lang', else English),
// sets <html lang/dir>, hides the body for at most 1.5 s and loads this module
// only when the language is not English. This module then:
//   1. fetches /i18n/dist/<lang>.json (every page's text, the footer, text
//      written by scripts, patterns), built by scripts/i18n/build-runtime.mjs
//      from i18n/<lang>.json; one file, cached by the browser for every page;
//   2. walks the page exactly like scripts/i18n/extract.mjs does (same runs of
//      inline content with <0>…</0> placeholders, same sha1 ids of the
//      normalised English) and swaps in the translation, reusing the original
//      elements so links and listeners keep working;
//   3. watches the DOM (MutationObserver) so text that scripts add later (hero
//      slider, nav drawer, WhatsApp popup, form messages, stays lists, the 404
//      countdown) is translated too;
//   4. adds `lang` to the JSON sent to /api/contact (stored as page_lang).
//   5. on the generated stays pages (hotels/, built by scripts/stays/), also
//      fetches /i18n/dist/<lang>.stays.json: sentence templates whose numbers
//      ({n1}…) and names ({t1}…) are slots (scripts/i18n/extract-stays.mjs).
// Anything without a translation stays English. Never translated (owner,
// 2026-10-06): the "Rishikesh Homestays" name and logo, the contact forms
// (every <form> except the homepage search filter; NO_TRANSLATE below), stay
// names, prices, phones, emails, URLs (only catalogued text is ever replaced,
// and href/value/data are never touched), the WhatsApp prefilled message and
// the enquiry fields (they are built from English strings in JS, not from the page).
// The whole pipeline, and how to keep every language in sync: docs/I18N.md.
//
// Kept in step with scripts/i18n/extract.mjs: tests/modules/i18n-runtime.test.js
// checks the ids and the walk against it.


const INLINE = new Set([
  "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn", "em",
  "i", "img", "kbd", "mark", "q", "s", "samp", "small", "span", "strong",
  "sub", "sup", "time", "u", "var", "wbr", "picture", "svg",
]);
const SKIP = new Set(["script", "style", "noscript", "svg", "template", "iframe", "head", "textarea"]);
const BLOCKY = "p, div, ul, ol, li, h1, h2, h3, h4, h5, h6, section, article, table";
// Kept in step with NO_TRANSLATE in scripts/i18n/extract.mjs.
export const NO_TRANSLATE = '[translate="no"], .notranslate, form:not([data-search-form]), .brand, .site-logo, .rhs-footer-logo, .sx-name, [data-stay-name], .leaflet-control-attribution, .rh-lang-code';
// Stay names (.sx-name, [data-stay-name]) are not translated as a whole, but
// their generic words are (owner, 2026-10-06): "Hotel Ganga View" -> "होटल Ganga View".
// Proper nouns and institutions stay as written. Each word's translation is a
// UI catalogue string (extract-ui.mjs adds NAME_WORDS).
export const NAME_SELECTOR = '.sx-name, [data-stay-name], .leaflet-control-attribution, .rh-lang-code';
export const NAME_WORDS = ['Bed & Breakfast', 'Guest House', 'Guesthouse', 'Home Stay', 'Homestays', 'Homestay',
  'Hotels', 'Hotel', 'Lodges', 'Lodge', 'Resorts', 'Resort', 'Camps', 'Camp', 'Hostels', 'Hostel', 'Villas', 'Villa',
  'Apartments', 'Apartment', 'Cottages', 'Cottage', 'Inn', 'Dharamshala', 'Rooms', 'Room', 'Suites', 'Tents', 'B&B'];
const NAME_RE = new RegExp(`(?<![\\p{L}\\d])(?:${NAME_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\d])`, 'giu');
const CANON = new Map(NAME_WORDS.map((w) => [w.toLowerCase(), w]));
// "HOTEL GANGA" / "Hotel Ganga" -> the generic word translated, the rest kept.
export function translateNameWords(name, exact) {
  return name.replace(NAME_RE, (w) => exact(CANON.get(w.toLowerCase()) || w) || w);
}
export const TEXT_ATTRS = ["alt", "title", "aria-label", "placeholder"];
export const DATA_LIST_ATTRS = ["data-captions", "data-headlines", "data-copy"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const norm = (s) => s.replace(/\s+/g, " ").trim();

// SHA-256 (synchronous, so the MutationObserver can translate in the same tick).
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256Bytes(str) {
  const bytes = new TextEncoder().encode(str);
  const len = bytes.length;
  const words = (((len + 8) >> 6) + 1) * 16;
  const w = new Uint32Array(words);
  for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  w[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
  w[words - 1] = len * 8;
  w[words - 2] = Math.floor((len * 8) / 0x100000000);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < words; i += 16) {
    for (let t = 0; t < 16; t++) W[t] = w[i + t];
    for (let t = 16; t < 64; t++) {
      const s0 = ror(W[t - 15], 7) ^ ror(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = ror(W[t - 2], 17) ^ ror(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let t = 0; t < 64; t++) {
      const t1 = (k + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[t] + W[t]) | 0;
      const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += k;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) out[i * 4 + j] = (h[i] >>> (24 - j * 8)) & 255;
  return out;
}

// The catalogue key of a text: the first 11 characters of the base64url SHA-256
// of the normalised English (66 bits, owner 2026-10-06: "64 bit long"). The
// same sentence has the same key on every page, so it is stored and translated
// once. scripts/i18n/extract.mjs makes the same keys with node:crypto and stops
// the build if two different texts ever share one.
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export const ID_LENGTH = 11;
const idCache = new Map();
export function segId(text) {
  const t = norm(text);
  let id = idCache.get(t);
  if (!id) {
    const b = sha256Bytes(t);
    id = "";
    for (let i = 0; i < 9; i += 3) {
      const n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
      id += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    id = id.slice(0, ID_LENGTH);
    if (idCache.size < 5000) idCache.set(t, id);
  }
  return id;
}


const placeholders = (s) => (s.match(/<\/?\d+\/?>/g) || []).sort().join();
const hasLetters = (s) => /\p{L}/u.test(s.replace(/<\/?\d+\/?>/g, ""));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// { "Starting ₹{p} onwards": "₹{p} से शुरू" } -> matchers. Slot values are put
// back untouched, except that a value with its own catalogue entry (a
// category, area or city name in a stays sentence) is translated too. Slots:
// {n…} numbers only, anything else any text. A slot name may repeat
// ("{n} on {n}"): its values are put back in order.
export function compilePatterns(patterns) {
  return (Array.isArray(patterns) ? patterns : Object.entries(patterns || {})).map(([en, tr]) => {
    const slots = [];
    let literal = "";
    const src = norm(en).split(/(\{[a-z0-9_]+\})/i).map((part, i) => {
      if (i % 2) { slots.push(part); return /^\{n\d+\}$/.test(part) ? "(\\d(?:[\\d,.]*\\d)?)" : "(.+?)"; }
      if (part.trim().length > literal.length) literal = part.trim();
      return escapeRe(part);
    }).join("");
    return { re: new RegExp(`^${src}$`, "u"), slots, tr, literal };
  }).sort((a, b) => b.literal.length - a.literal.length); // most specific first
}

export function makeLookup(strings, patterns = []) {
  const exact = (english) => {
    const tr = strings[segId(english)];
    return tr != null && norm(tr) && placeholders(tr) === placeholders(english) ? tr : null;
  };
  const nameWords = (v) => { const out = translateNameWords(v, exact); return out !== v ? out : null; };
  const lookup = (english) => {
    const hit = exact(english);
    if (hit != null) return hit;
    for (const p of patterns) {
      if (p.literal && !english.includes(p.literal)) continue; // cheap filter before the regex
      const m = p.re.exec(english);
      if (!m) continue;
      const values = {};
      p.slots.forEach((slot, i) => {
        const v = m[i + 1];
        const t = /\p{L}/u.test(v) && !/[<>]/.test(v) ? exact(v) || nameWords(v) : null;
        (values[slot] ||= []).push(t || v);
      });
      const out = p.tr.replace(/\{[a-z0-9_]+\}/gi, (slot) => (values[slot] && values[slot].length ? (values[slot].length > 1 ? values[slot].shift() : values[slot][0]) : slot));
      return placeholders(out) === placeholders(english) ? out : null;
    }
    return null;
  };
  lookup.exact = exact;
  return lookup;
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

  // Stay names: only their generic words (translateNameWords); originals kept
  // in data-en so a re-run never stacks translations.
  function names(root) {
    if (!root || root.nodeType !== 1 || !lookup.exact) return;
    const els = root.matches && root.matches(NAME_SELECTOR) ? [root] : [...root.querySelectorAll(NAME_SELECTOR)];
    for (const el of els) {
      for (const n of [...el.childNodes]) {
        if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
        const out = translateNameWords(n.nodeValue, lookup.exact);
        if (out !== n.nodeValue) n.nodeValue = out;
      }
    }
  }

  return { walk, attrs, attrsOne, blockOf, translateDocHead, names };
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
  // our own listing (hotels/advaitam-…) is a hand-made page: its text is in the site file
  // /homestays lists stays too (top brands, Nirmal Bagh): their rows are patterns of the stays file
  const stays = (/^\/hotels\//.test(location.pathname) && !/^\/hotels\/advaitam-/.test(location.pathname)) || /^\/homestays\/?$/.test(location.pathname);
  const get = (file) => fetch(`/i18n/dist/${file}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const [site, st] = await Promise.all([get(lang), stays ? get(`${lang}.stays`) : {}]);
  const lookup = makeLookup({ ...(st.s || {}), ...(site.s || {}) }, compilePatterns([...(st.p || []), ...(site.p || [])]));
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
    tr.names(document.body);
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
      for (const el of attrEls) if (el.isConnected) { tr.attrs(el); tr.names(el); }
      for (const b of blocks) if (b.isConnected) tr.names(b);
      localiseCalendars();
    });
  });
  observer.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: [...TEXT_ATTRS, ...DATA_LIST_ATTRS],
  });
  // <title> set by a script after the page loaded (the stay page's "This stay has checked out | …") is translated too.
  const titleEl = document.querySelector("head > title");
  let titleDone = document.title; // what the head translation left: a change we made ourselves is not translated again
  if (titleEl) new MutationObserver(() => {
    if (document.title === titleDone) return;
    tr.translateDocHead();
    titleDone = document.title;
  }).observe(titleEl, { childList: true, characterData: true, subtree: true });
}

if (typeof window !== "undefined" && typeof document !== "undefined" && window.RH_LANG && window.RH_LANG !== "en") {
  start().catch(() => document.documentElement.classList.remove("rh-i18n-wait"));
}
