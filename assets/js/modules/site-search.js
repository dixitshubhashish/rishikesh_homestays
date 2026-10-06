// Site search: the magnifier button in the header opens a small search panel
// over the page. It searches our own pages (titles, descriptions, headings),
// the stays-list pages and every stay of both cities, tolerant of typos.
//
// The index is assets/search/index.json, built by scripts/search/build-index.mjs
// (`npm run build:search`, also run at the end of `npm run build:stays`). It is
// fetched the first time the button is focused, hovered or clicked, never on
// page load.
//
// Matching: text is lowercased, accents and punctuation stripped, and split
// into words. A query word matches an index word when their similarity
// (1 - edit distance / longer length, an adjacent swap counting as one edit) is
// at least 0.70, or when it matches the start of a longer word the same way
// (typing "trive" finds Triveni; "trivn" finds Triveni, "ganag" Ganga, "hotal"
// Hotel). Ranking: more query words matched first (all of them best), then a
// closer match, then pages and headings before stays; our own stays get a boost.

export const MATCH_THRESHOLD = 0.7;
const MATCH_MIN = MATCH_THRESHOLD - 1e-9; // 1 - 3/10 must count as 0.70 whatever the float rounding
export const PREFIX_FACTOR = 0.95; // a prefix match scores a little under a whole-word one
export const OWN_BOOST = 0.15;
export const INDEX_URL = '/assets/search/index.json';
const TYPE_RANK = { page: 0, heading: 1, stay: 2 };
const STOP = new Set(['a', 'an', 'the', 'in', 'of', 'to', 'and', 'for', 'at', 'on', 'with', 'by', 'is', 'or']);
const CITY_NAMES = { rishikesh: 'Rishikesh', haridwar: 'Haridwar' };

// ---------------------------------------------------------------------------
// Pure functions (unit-tested in tests/modules/site-search.test.js)

export function normalise(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Latin accents only: Devanagari vowel signs are marks too
    .toLowerCase()
    .replace(/['‘’`]/g, '') // haridwar's -> haridwars
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

export function tokenise(text) {
  const s = normalise(text);
  return s ? s.split(' ') : [];
}

// Query words: stop words dropped unless nothing else is left.
export function queryWords(query) {
  const words = [...new Set(tokenise(query))];
  const kept = words.filter((w) => !STOP.has(w));
  return kept.length ? kept : words;
}

// Optimal string alignment distance: Levenshtein plus adjacent transpositions.
export function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev2 = null;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

export function similarity(a, b) {
  const len = Math.max(a.length, b.length);
  return len ? 1 - editDistance(a, b) / len : 1;
}

// How well query word q matches index word w: the whole word, or the start of a
// longer word (q of 2+ letters against w cut to q's length).
export function wordSimilarity(q, w) {
  if (q === w) return 1;
  // Numbers ("2027", "3bhk") are never fuzzy: 207 is not 2027. Exact prefix only.
  if (/\d/.test(q) || /\d/.test(w)) return w.startsWith(q) ? PREFIX_FACTOR : 0;
  let s = similarity(q, w);
  if (q.length >= 2 && w.length > q.length) s = Math.max(s, similarity(q, w.slice(0, q.length)) * PREFIX_FACTOR);
  return s;
}

const stayUrl = (s) => s.u || `/hotels/stay?s=${encodeURIComponent(s.id)}&c=${encodeURIComponent(s.c || 'rishikesh')}`;
// A #:~:text= fragment scrolls to (and highlights) a heading without an id.
const textFragment = (text) => `#:~:text=${encodeURIComponent(text).replace(/-/g, '%2D')}`;

// The raw index.json -> searchable docs, each with weighted word lists.
export function prepareIndex(raw) {
  const docs = [];
  const field = (text, weight) => [tokenise(text), weight];
  for (const p of raw?.p || []) {
    docs.push({
      type: 'page', url: p.u, title: p.t, sub: p.d || p.x || '',
      fields: [field(p.t, 1), field(p.x, 0.85), field(p.d, 0.6)],
    });
    for (const [text, anchor] of p.h || []) {
      docs.push({
        type: 'heading', url: p.u + (anchor ? `#${anchor}` : textFragment(text)), title: text, sub: p.t,
        // the page title only adds context: a heading must match on its own text
        fields: [field(text, 1), field(p.t, 0.5)], ownTextNeeded: true,
      });
    }
  }
  for (const s of raw?.s || []) {
    const city = CITY_NAMES[s.c] || s.c || '';
    const kind = String(s.k || '').split(', ')[0];
    docs.push({
      type: 'stay', url: stayUrl(s), title: s.n, own: Boolean(s.o),
      sub: [s.a, kind, city].filter(Boolean).join(' · '),
      fields: [field(s.n, 1), field(s.a, 0.8), field(s.k, 0.8), field(city, 0.6)],
    });
  }
  return docs;
}

// One doc against the query words: how many matched, and how well (0..1+).
export function score(words, doc, sim = wordSimilarity) {
  let matched = 0;
  let total = 0;
  let firstFieldHit = false;
  for (const q of words) {
    let best = 0;
    doc.fields.forEach(([tokens, weight], f) => {
      for (const t of tokens) {
        const s = sim(q, t);
        if (s < MATCH_MIN) continue;
        if (f === 0) firstFieldHit = true;
        if (s * weight > best) best = s * weight;
      }
    });
    if (best > 0) { matched++; total += best; }
  }
  if (doc.ownTextNeeded && !firstFieldHit) return { matched: 0, quality: 0 };
  const raw = words.length ? total / words.length + (doc.own && matched ? OWN_BOOST : 0) : 0;
  return { matched, quality: Math.round(raw * 100) / 100 };
}

export function compareResults(a, b) {
  return b.matched - a.matched
    || b.quality - a.quality
    || TYPE_RANK[a.doc.type] - TYPE_RANK[b.doc.type]
    || a.doc.title.length - b.doc.title.length
    || a.i - b.i;
}

// Up to `limit` results split into pages (pages + headings) and stays. Each
// group keeps up to `minEach` places among the best-matching tier; the rest go
// by rank. Weaker matches only fill in when the best tier is short.
export function search(docs, query, { limit = 8, minEach = 3, perPage = 3 } = {}) {
  const words = queryWords(query);
  const empty = { words, pages: [], stays: [] };
  if (!words.length || !docs?.length) return empty;
  const cache = words.map(() => new Map());
  const sim = (q, w) => {
    const c = cache[words.indexOf(q)];
    let s = c.get(w);
    if (s === undefined) { s = wordSimilarity(q, w); c.set(w, s); }
    return s;
  };
  const hits = [];
  const seen = new Set();
  docs.forEach((doc, i) => {
    const r = score(words, doc, sim);
    if (!r.matched) return;
    hits.push({ doc, i, ...r });
  });
  hits.sort(compareResults);
  if (!hits.length) return empty;
  // No repeats, and at most `perPage` results (page + headings) from one page.
  const perPath = new Map();
  const unique = hits.filter((h) => {
    const key = `${h.doc.url}|${h.doc.title}`;
    const path = h.doc.url.split('#')[0];
    if (seen.has(key) || (perPath.get(path) || 0) >= perPage) return false;
    seen.add(key);
    perPath.set(path, (perPath.get(path) || 0) + 1);
    return true;
  });
  const top = unique[0].matched;
  const pages = unique.filter((h) => h.doc.type !== 'stay');
  const stays = unique.filter((h) => h.doc.type === 'stay');
  const topCount = (list) => list.filter((h) => h.matched === top).length;
  let np = Math.min(minEach, topCount(pages), limit);
  let ns = Math.min(minEach, topCount(stays), limit - np);
  while (np + ns < limit && (np < pages.length || ns < stays.length)) {
    const p = pages[np];
    const s = stays[ns];
    if (p && (!s || compareResults(p, s) <= 0)) np++;
    else ns++;
  }
  return { words, pages: pages.slice(0, np), stays: stays.slice(0, ns) };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The text, HTML-escaped, with every word that matches a query word in <mark>.
export function highlight(text, words) {
  return String(text ?? '').split(/([\p{L}\p{N}\p{M}'’]+)/u).map((part, i) => {
    if (i % 2 === 0) return esc(part);
    const t = normalise(part);
    return t && words.some((q) => wordSimilarity(q, t) >= MATCH_MIN) ? `<mark>${esc(part)}</mark>` : esc(part);
  }).join('');
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s);

// ---------------------------------------------------------------------------
// The header button and the panel

let indexPromise = null;
export function loadIndex(fetchImpl = globalThis.fetch) {
  if (!indexPromise) {
    indexPromise = fetchImpl(INDEX_URL)
      .then((r) => { if (!r.ok) throw new Error(`search index ${r.status}`); return r.json(); })
      .then(prepareIndex)
      .catch((err) => { indexPromise = null; throw err; });
  }
  return indexPromise;
}

const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

function buildPanel(doc) {
  const wrap = doc.createElement('div');
  wrap.className = 'site-search';
  wrap.id = 'site-search';
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="site-search-backdrop" data-search-close></div>
    <div class="site-search-panel" role="dialog" aria-modal="true" aria-label="Search the site">
      <form class="site-search-form" role="search" action="/" data-search-form>
        ${ICON}
        <input class="site-search-input" type="search" name="q" autocomplete="off" spellcheck="false"
          placeholder="Search places, areas, stays" aria-label="Search the site"
          role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="site-search-results">
        <button class="site-search-close" type="button" data-search-close aria-label="Close search">Esc</button>
      </form>
      <div class="site-search-results" id="site-search-results" role="listbox" aria-label="Search results"></div>
      <p class="site-search-status" aria-live="polite"></p>
    </div>`;
  return wrap;
}

function resultHtml(r, words, n) {
  const d = r.doc;
  const sub = d.sub ? clip(d.sub, 96) : '';
  const badge = d.own ? '<span class="site-search-own">Our homestay</span>' : '';
  return `<a class="site-search-item${d.own ? ' is-own' : ''}" id="site-search-opt-${n}" role="option" aria-selected="false" href="${esc(d.url)}">
      <span class="site-search-title">${highlight(d.title, words)}${badge}</span>
      ${sub ? `<span class="site-search-sub">${highlight(sub, words)}</span>` : ''}
    </a>`;
}

export function renderResults(container, result) {
  let n = 0;
  const group = (label, list) => (list.length
    ? `<div class="site-search-group" role="presentation">${label}</div>${list.map((r) => resultHtml(r, result.words, n++)).join('')}`
    : '');
  container.innerHTML = group('Pages', result.pages) + group('Stays', result.stays);
  return n;
}

export function setupSiteSearch(doc = document) {
  const header = doc.querySelector('.site-header .nav-wrap');
  if (!header || header.querySelector('[data-search-open]')) return null;

  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.className = 'site-search-btn';
  btn.setAttribute('data-search-open', '');
  btn.setAttribute('aria-label', 'Search');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'site-search');
  btn.innerHTML = ICON;
  const before = header.querySelector('.theme-toggle') || header.querySelector('.nav-toggle') || header.querySelector('.site-nav');
  header.insertBefore(btn, before);

  const panel = buildPanel(doc);
  doc.body.appendChild(panel);
  const input = panel.querySelector('input');
  const list = panel.querySelector('.site-search-results');
  const status = panel.querySelector('.site-search-status');
  let docs = null;
  let active = -1;
  let timer = 0; // set while typed text waits to be searched

  const options = () => [...list.querySelectorAll('[role="option"]')];
  const setActive = (i) => {
    const opts = options();
    active = opts.length ? (i + opts.length) % opts.length : -1;
    opts.forEach((o, k) => o.setAttribute('aria-selected', k === active ? 'true' : 'false'));
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', opts[active].id);
      opts[active].scrollIntoView?.({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };

  const run = () => {
    timer = 0;
    const q = input.value.trim();
    active = -1;
    input.removeAttribute('aria-activedescendant');
    if (!q) { list.innerHTML = ''; status.textContent = ''; input.setAttribute('aria-expanded', 'false'); return; }
    if (!docs) { status.textContent = 'Loading…'; return; }
    const n = renderResults(list, search(docs, q));
    input.setAttribute('aria-expanded', n ? 'true' : 'false');
    if (n) status.textContent = '';
    else status.innerHTML = `No results for “${esc(q)}”. <a href="/contact">Ask us</a> and we will help you find it.`;
  };

  const prefetch = () => loadIndex().then((d) => { docs = d; if (!panel.hidden) run(); }).catch(() => {
    if (!panel.hidden) status.innerHTML = 'Search is not available right now. <a href="/contact">Ask us</a> instead.';
  });

  const open = () => {
    if (!panel.hidden) return;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    doc.documentElement.classList.add('site-search-open');
    prefetch();
    input.focus();
    if (input.value) { input.select(); run(); }
  };
  const close = (refocus = true) => {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    doc.documentElement.classList.remove('site-search-open');
    if (refocus) btn.focus();
  };

  btn.addEventListener('click', open);
  btn.addEventListener('focus', prefetch, { once: true });
  btn.addEventListener('pointerenter', prefetch, { once: true });
  panel.querySelectorAll('[data-search-close]').forEach((el) => el.addEventListener('click', () => close()));
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 60); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active < 0 ? -1 : active - 1); }
  });
  panel.querySelector('[data-search-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    if (timer) { clearTimeout(timer); run(); } // Enter before the results caught up
    const target = options()[active >= 0 ? active : 0];
    if (target) target.click();
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  // A result on this same page (a heading anchor) only scrolls: close the panel.
  list.addEventListener('click', (e) => { if (e.target.closest('a')) close(false); });
  list.addEventListener('mousemove', (e) => {
    const opt = e.target.closest('[role="option"]');
    if (opt) { const i = options().indexOf(opt); if (i !== active) setActive(i); }
  });
  // Focus leaving the panel (Tab past the last result) closes it.
  panel.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !panel.contains(e.relatedTarget) && e.relatedTarget !== btn) close(false);
  });
  return { button: btn, panel, open, close };
}
