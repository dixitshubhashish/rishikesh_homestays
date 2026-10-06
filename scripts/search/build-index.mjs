#!/usr/bin/env node
// Builds assets/search/index.json, the index behind the header search box
// (assets/js/modules/site-search.js). Run with `npm run build:search`;
// `npm run build:stays` runs it at the end, so the index follows every stays build.
//
// What goes in (short keys keep it small; the browser fetches it on first use):
//   p: pages. Every indexable page at the repo root and in hotels/ (pages with a
//      robots noindex, like 404, thanks and hotels/stay, are skipped).
//      { u: url, t: label, x?: other title words, d?: meta description,
//        h?: [[heading, anchor?], ...] }
//      Hand-made pages give their title, description and h1/h2/h3 headings
//      (anchor = the heading's id, or its tab panel when that panel is hidden on
//      load; without one the browser links a #:~:text= fragment). Generated stays pages
//      (h1.sx-title) give only their h1 and title.
//   s: stays. Our own stays (STAYS_OWN) first, then every stay of both cities.
//      { n: name, a: area, k: kinds, id, c: city, u?: own page, o?: 1 = ours }
//      A stay without u opens /hotels/stay?s=<id>&c=<city>.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'assets', 'search', 'index.json');
const SITE_SUFFIX = 'Rishikesh Homestays';
const CITY_DATA = [
  ['rishikesh', 'assets/js/modules/stays-index-data.js'],
  ['haridwar', 'assets/js/modules/stays-index-data-haridwar.js'],
];

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const lower = (s) => clean(s).toLowerCase();
const isNoindex = (html) => /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html);
const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

export function pageUrl(rel) {
  const path = rel.replace(/\.html$/, '');
  return path === 'index' ? '/' : `/${path}`;
}

// Title segments ("A | B | Rishikesh Homestays") without a trailing site name
// (the home page's title starts with it and keeps it as its label).
function titleParts(title) {
  return clean(title).split(/\s+\|\s+/).map(clean).filter((p, i) => p && (i === 0 || p !== SITE_SUFFIX));
}

function handMadePage(rel, html) {
  const dom = new JSDOM(html);
  try {
    const doc = dom.window.document;
    const parts = titleParts(doc.title);
    const t = parts[0] || SITE_SUFFIX;
    const seen = new Set([lower(t)]);
    const extra = [];
    const add = (text) => {
      const key = lower(text);
      if (key && !seen.has(key)) { seen.add(key); extra.push(clean(text)); }
    };
    parts.slice(1).forEach(add);
    const h1 = doc.querySelector('main h1') || doc.querySelector('h1');
    if (h1) add(h1.textContent);
    const entry = { u: pageUrl(rel), t };
    if (extra.length) entry.x = extra.join(' · ');
    const d = clean(doc.querySelector('meta[name="description"]')?.getAttribute('content'));
    if (d) entry.d = d;
    const headings = [];
    for (const el of doc.querySelectorAll('h2, h3')) {
      if (el.closest('header, footer, nav, [data-nav], aside.ad, .rh-ad')) continue;
      const text = clean(el.textContent);
      const key = lower(text);
      if (!text || text.length > 140 || seen.has(key)) continue;
      seen.add(key);
      // The heading's own id; in a tab panel that is hidden on load (not the
      // page's first tab), the panel's name (page-tabs.js opens it from the
      // hash). Otherwise none: the browser links a #:~:text= fragment.
      const panel = el.closest('[data-tab-panel]');
      const firstPanel = doc.querySelector('[data-tab-panel]')?.dataset.tabPanel;
      const tab = panel && panel.dataset.tabPanel !== firstPanel ? panel.dataset.tabPanel : '';
      const anchor = el.id || tab;
      headings.push(anchor ? [text, anchor] : [text]);
    }
    if (headings.length) entry.h = headings;
    return entry;
  } finally {
    dom.window.close();
  }
}

// Generated stays pages are big (up to ~1,800 stays inline): regexes, no DOM.
function generatedPage(rel, html) {
  const title = decode(html.match(/<title>([^<]*)<\/title>/i)?.[1] || '');
  const h1 = clean(decode((html.match(/<h1[^>]*class="[^"]*sx-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').replace(/<[^>]+>/g, ' ')));
  const parts = titleParts(title);
  const t = h1 || parts[0] || SITE_SUFFIX;
  const entry = { u: pageUrl(rel), t };
  // The other title segments, minus the ones with live counts ("440 to Compare
  // by Area & Price"), which would only churn the index on every rebuild.
  const extra = parts.filter((p) => lower(p) !== lower(t) && !/\d/.test(p));
  if (extra.length) entry.x = extra.join(' · ');
  return entry;
}

export function pagesFrom(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.html')).sort()) {
    const html = readFileSync(join(dir, name), 'utf8');
    if (isNoindex(html)) continue;
    const rel = prefix + name;
    out.push(/<h1[^>]*class="[^"]*sx-title/.test(html) ? generatedPage(rel, html) : handMadePage(rel, html));
  }
  return out;
}

function stayEntry(s, city) {
  const kinds = [...new Set([s.k, ...(s.ks || [])].filter(Boolean))];
  const e = { n: clean(s.n), a: clean(s.a), k: kinds.join(', '), id: s.id, c: city };
  if (!e.a) delete e.a;
  if (!e.k) delete e.k;
  return e;
}

export async function staysFrom(root = ROOT) {
  const own = [];
  const rest = [];
  const ownIds = new Set();
  for (const [city, file] of CITY_DATA) {
    const mod = await import(pathToFileURL(join(root, file)).href);
    for (const o of mod.STAYS_OWN || []) {
      if (ownIds.has(o.id)) continue; // the same 3 stays ship in every city's data
      ownIds.add(o.id);
      // Haridwar's copy labels the area "Rishikesh · …": ours are all in Rishikesh.
      const e = stayEntry({ ...o, a: String(o.a || '').replace(/^Rishikesh\s*·\s*/, '') }, 'rishikesh');
      if (o.u) e.u = o.u;
      e.o = 1;
      own.push(e);
    }
    for (const s of mod.STAYS_INDEX || []) {
      if (!ownIds.has(s.id)) rest.push(stayEntry(s, s.cy || city));
    }
  }
  return [...own, ...rest];
}

export async function buildIndex(root = ROOT) {
  const p = [...pagesFrom(root), ...pagesFrom(join(root, 'hotels'), 'hotels/')];
  const s = await staysFrom(root);
  return { v: 1, p, s };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = await buildIndex();
  const json = JSON.stringify(index);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${json}\n`);
  const headings = index.p.reduce((n, pg) => n + (pg.h?.length || 0), 0);
  console.log(`search index: ${index.p.length} pages (${headings} headings), ${index.s.length} stays, ${(json.length / 1024).toFixed(0)} KB -> ${OUT.slice(ROOT.length + 1)}`);
}
