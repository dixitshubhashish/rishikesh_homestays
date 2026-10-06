import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { JSDOM } from 'jsdom';
import {
  MATCH_THRESHOLD, normalise, tokenise, queryWords, editDistance, similarity, wordSimilarity,
  prepareIndex, score, search, highlight,
} from '../../assets/js/modules/site-search.js';

const ROOT = process.cwd();
const INDEX_FILE = join(ROOT, 'assets/search/index.json');
const all = (r) => [...r.pages, ...r.stays];

// A small hand-made index: two pages (one with headings), our own stay and
// third-party stays.
const RAW = {
  v: 1,
  p: [
    { u: '/triveni-ghat', t: 'Triveni Ghat Rishikesh', x: 'Aarti, Visit Tips & Nearby Stays', d: 'Plan a Triveni Ghat visit: Ganga Aarti, river views.',
      h: [['Ganga Aarti at dusk'], ['Quick facts: Triveni Ghat', 'quick-facts-h']] },
    { u: '/hotels/5-star-hotels-in-rishikesh-tapovan', t: '5 Star Hotels in Rishikesh Tapovan' },
    { u: '/places-to-visit', t: 'Places to Visit in Rishikesh', h: [['Little Buddha Cafe', 'restaurants']] },
  ],
  s: [
    { n: 'Advaitam Ganga & Hill View Luxury 3BHK Homestay', a: 'Nirmal Bagh near Ganges', k: 'Apartments, Homestays', id: 'advaitam', c: 'rishikesh', u: '/hotels/advaitam', o: 1 },
    { n: 'Shiv Ganga Homestay', a: 'Tapovan', k: 'Homestays', id: 'shiv-ganga', c: 'rishikesh' },
    { n: 'Hotel Pi-Tapovan', a: 'Tapovan', k: 'Hotels', id: 'pi-tapovan', c: 'rishikesh' },
    { n: 'Triveni Ghat Hotel', a: 'Triveni Ghat', k: 'Hotels', id: 'triveni-ghat-hotel', c: 'rishikesh' },
    { n: 'Gyan Ganga Hotel', a: 'Railway Station', k: 'Hotels', id: 'gyan-ganga', c: 'haridwar' },
  ],
};
const DOCS = prepareIndex(RAW);

test('site-search: tokenise', async (t) => {
  await t.test('lowercases, strips accents and punctuation', () => {
    assert.deepStrictEqual(tokenise('Café Déjà-vu, TRIVENI  Ghat!'), ['cafe', 'deja', 'vu', 'triveni', 'ghat']);
    assert.deepStrictEqual(tokenise("Haridwar's Kumbh: 2027 (dates)"), ['haridwars', 'kumbh', '2027', 'dates']);
    assert.deepStrictEqual(tokenise(''), []);
    assert.deepStrictEqual(tokenise(null), []);
  });
  await t.test('keeps non-Latin scripts whole (Devanagari vowel signs are not accents)', () => {
    assert.strictEqual(normalise('हरिद्वार'), 'हरिद्वार');
  });
  await t.test('query words drop stop words unless nothing else is left', () => {
    assert.deepStrictEqual(queryWords('hotels in the Tapovan'), ['hotels', 'tapovan']);
    assert.deepStrictEqual(queryWords('the'), ['the']);
    assert.deepStrictEqual(queryWords('ghat ghat'), ['ghat']);
  });
});

test('site-search: similarity', async (t) => {
  await t.test('edit distance counts an adjacent swap as one edit', () => {
    assert.strictEqual(editDistance('hotel', 'hotel'), 0);
    assert.strictEqual(editDistance('hotal', 'hotel'), 1);
    assert.strictEqual(editDistance('ganag', 'ganga'), 1);
    assert.strictEqual(editDistance('', 'abc'), 3);
  });
  await t.test('similarity = 1 - distance / longer length', () => {
    assert.strictEqual(similarity('hotal', 'hotel'), 0.8);
    assert.strictEqual(similarity('', ''), 1);
    assert.ok(Math.abs(similarity('trivni', 'triveni') - 6 / 7) < 1e-9);
  });
  await t.test('the match threshold is 0.70, inclusive', () => {
    assert.strictEqual(MATCH_THRESHOLD, 0.7);
    // 3 edits in 10 letters = exactly 0.70: a match
    assert.ok(Math.abs(similarity('abcdefghij', 'abcdefgxyz') - 0.7) < 1e-9);
    assert.ok(score(['abcdefghij'], { fields: [[['abcdefgxyz'], 1]] }).matched === 1);
    // 1 edit in 3 letters = 0.67: not a match (short words must be exact)
    assert.ok(wordSimilarity('ram', 'rum') < MATCH_THRESHOLD);
    // 1 edit in 4 letters = 0.75: a match; 2 edits = 0.5: not
    assert.ok(wordSimilarity('ghat', 'goat') >= MATCH_THRESHOLD);
    assert.ok(wordSimilarity('ghat', 'gate') < MATCH_THRESHOLD);
  });
  await t.test('typos from the brief match', () => {
    assert.ok(wordSimilarity('trivn', 'triveni') >= MATCH_THRESHOLD, 'trivn -> triveni');
    assert.ok(wordSimilarity('ganag', 'ganga') >= MATCH_THRESHOLD, 'ganag -> ganga');
    assert.ok(wordSimilarity('hotal', 'hotel') >= MATCH_THRESHOLD, 'hotal -> hotel');
    assert.ok(wordSimilarity('hotal', 'hotels') >= MATCH_THRESHOLD, 'hotal -> hotels (prefix)');
    assert.ok(wordSimilarity('kedarnth', 'kedarnath') >= MATCH_THRESHOLD);
  });
  await t.test('prefixes count, a little under a whole word', () => {
    assert.ok(wordSimilarity('trive', 'triveni') >= MATCH_THRESHOLD);
    assert.ok(wordSimilarity('trive', 'triveni') < 1);
    assert.strictEqual(wordSimilarity('triveni', 'triveni'), 1);
  });
  await t.test('numbers are never fuzzy', () => {
    assert.strictEqual(wordSimilarity('207', '2027'), 0);
    assert.ok(wordSimilarity('3', '3bhk') >= MATCH_THRESHOLD);
    assert.strictEqual(wordSimilarity('2027', '2027'), 1);
  });
});

test('site-search: score and ranking', async (t) => {
  await t.test('score counts matched words and their quality', () => {
    const page = DOCS.find((d) => d.url === '/triveni-ghat');
    assert.deepStrictEqual(score(['triveni', 'ghat'], page), { matched: 2, quality: 1 });
    assert.strictEqual(score(['trivni', 'ghat'], page).matched, 2);
    assert.strictEqual(score(['zzzz'], page).matched, 0);
  });
  await t.test('a heading must match on its own text, not only its page title', () => {
    const heading = DOCS.find((d) => d.type === 'heading' && d.title === 'Ganga Aarti at dusk');
    assert.strictEqual(score(['triveni'], heading).matched, 0);
    assert.strictEqual(score(['aarti', 'triveni'], heading).matched, 2);
  });
  await t.test('"trivni ghat" ranks the Triveni Ghat page first', () => {
    const r = search(DOCS, 'trivni ghat');
    assert.strictEqual(r.pages[0].doc.url, '/triveni-ghat');
    assert.ok(r.stays.some((s) => s.doc.title === 'Triveni Ghat Hotel'));
  });
  await t.test('all words matched beats more similar but partial matches', () => {
    const r = search(DOCS, 'hotal tapovan');
    const urls = all(r).map((h) => h.doc.url);
    assert.ok(urls.includes('/hotels/5-star-hotels-in-rishikesh-tapovan'));
    assert.strictEqual(r.stays[0].doc.title, 'Hotel Pi-Tapovan', 'the stay matching both words comes first');
    for (const list of [r.pages, r.stays]) {
      for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].matched >= list[i].matched);
    }
  });
  await t.test('pages and headings outrank stays at equal quality', () => {
    const r = search(DOCS, 'triveni ghat', { limit: 8, minEach: 0 });
    const ranked = [...r.pages, ...r.stays].sort((a, b) => b.matched - a.matched || b.quality - a.quality);
    const firstStay = ranked.findIndex((h) => h.doc.type === 'stay');
    const firstPage = ranked.findIndex((h) => h.doc.type === 'page');
    assert.ok(firstPage < firstStay);
  });
  await t.test('our own stays come first among stays', () => {
    const r = search(DOCS, 'ganga homestay');
    assert.strictEqual(r.stays[0].doc.url, '/hotels/advaitam');
    assert.ok(r.stays[0].doc.own);
    assert.strictEqual(r.stays[1].doc.title, 'Shiv Ganga Homestay');
    const g = search(DOCS, 'ganag');
    assert.strictEqual(g.stays[0].doc.own, true, '"ganag" still lists Advaitam first');
  });
  await t.test('stays without their own page open the stay page for their city', () => {
    const r = search(DOCS, 'gyan ganga');
    assert.strictEqual(r.stays[0].doc.url, '/hotels/stay?s=gyan-ganga&c=haridwar');
  });
  await t.test('headings link to their id, their tab, or a text fragment', () => {
    const urls = DOCS.filter((d) => d.type === 'heading').map((d) => d.url);
    assert.ok(urls.includes('/triveni-ghat#quick-facts-h'));
    assert.ok(urls.includes('/places-to-visit#restaurants'));
    assert.ok(urls.includes('/triveni-ghat#:~:text=Ganga%20Aarti%20at%20dusk'));
  });
  await t.test('limit, no results, empty query', () => {
    assert.ok(all(search(DOCS, 'rishikesh', { limit: 3 })).length <= 3);
    assert.strictEqual(all(search(DOCS, 'qqqqzzzz')).length, 0);
    assert.strictEqual(all(search(DOCS, '   ')).length, 0);
  });
  await t.test('highlight marks matched words and escapes HTML', () => {
    assert.strictEqual(highlight('Hotel <b>Tapovan</b>', ['hotal']), '<mark>Hotel</mark> &lt;b&gt;Tapovan&lt;/b&gt;');
    assert.strictEqual(highlight('Triveni Ghat', ['trivn', 'ghat']), '<mark>Triveni</mark> <mark>Ghat</mark>');
  });
});

test('site-search: assets/search/index.json', async (t) => {
  assert.ok(existsSync(INDEX_FILE), 'run `npm run build:search`');
  const raw = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  const urls = new Set(raw.p.map((p) => p.u));
  const noindex = (file) => /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(readFileSync(file, 'utf8'));

  await t.test('stays well under 1 MB', () => {
    assert.ok(statSync(INDEX_FILE).size < 1024 * 1024, `${statSync(INDEX_FILE).size} bytes`);
  });
  await t.test('lists every root page (except noindex ones like 404 and thanks)', () => {
    for (const f of readdirSync(ROOT).filter((n) => n.endsWith('.html'))) {
      const url = f === 'index.html' ? '/' : `/${f.replace(/\.html$/, '')}`;
      if (noindex(join(ROOT, f))) assert.ok(!urls.has(url), `${f} is noindex`);
      else assert.ok(urls.has(url), `${f} missing: run npm run build:search`);
    }
  });
  await t.test('lists every hotels/best-*.html page', () => {
    const best = readdirSync(join(ROOT, 'hotels')).filter((n) => n.startsWith('best-') && n.endsWith('.html'));
    assert.ok(best.length > 50);
    for (const f of best) assert.ok(urls.has(`/hotels/${f.replace(/\.html$/, '')}`), `hotels/${f} missing: run npm run build:search`);
  });
  await t.test('has every stay of both cities, our own stays first', async () => {
    const rk = await import('../../assets/js/modules/stays-index-data.js');
    const hw = await import('../../assets/js/modules/stays-index-data-haridwar.js');
    const own = rk.STAYS_OWN.map((o) => o.id);
    assert.deepStrictEqual(raw.s.slice(0, own.length).map((s) => s.id), own);
    assert.ok(raw.s.slice(0, own.length).every((s) => s.o === 1 && s.u));
    assert.strictEqual(raw.s.length, own.length + rk.STAYS_INDEX.length + hw.STAYS_INDEX.length);
    assert.ok(raw.s.slice(own.length).every((s) => !s.o && s.n && s.id && (s.c === 'rishikesh' || s.c === 'haridwar')));
  });
  await t.test('the real index answers the typo examples', () => {
    const docs = prepareIndex(raw);
    assert.strictEqual(search(docs, 'trivni ghat').pages[0].doc.url, '/triveni-ghat');
    const hotal = search(docs, 'hotal tapovan');
    assert.ok(hotal.pages.some((h) => h.doc.url === '/hotels/5-star-hotels-in-rishikesh-tapovan'));
    assert.ok(hotal.stays.length && hotal.stays.every((h) => h.matched === 2));
    assert.ok(all(search(docs, 'ganag')).some((h) => /ganga/i.test(h.doc.title)));
    assert.ok(search(docs, 'advaitam').stays[0].doc.own);
  });
});

test('site-search: header button and panel', async (t) => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <header class="site-header"><div class="nav-wrap"><a class="brand" href="/">Rishikesh Homestays</a>
      <button class="theme-toggle" data-theme-toggle></button><button class="nav-toggle"></button><nav class="site-nav" data-nav></nav></div></header>
    <main><h1>Page</h1></main></body></html>`, { url: 'http://localhost/' });
  const { window } = dom;
  const saved = { window: global.window, document: global.document, fetch: global.fetch };
  global.window = window;
  global.document = window.document;
  let fetches = 0;
  global.fetch = async (url) => {
    fetches++;
    assert.strictEqual(url, '/assets/search/index.json');
    return { ok: true, json: async () => RAW };
  };
  const { setupSiteSearch } = await import('../../assets/js/modules/site-search.js');
  const doc = window.document;
  const ui = setupSiteSearch(doc);
  const flush = () => new Promise((r) => setTimeout(r, 90));

  await t.test('injects the button before the theme toggle, once', () => {
    const btn = doc.querySelector('[data-search-open]');
    assert.ok(btn);
    assert.strictEqual(btn.nextElementSibling, doc.querySelector('.theme-toggle'));
    assert.strictEqual(setupSiteSearch(doc), null);
    assert.strictEqual(doc.querySelectorAll('[data-search-open]').length, 1);
    assert.strictEqual(doc.querySelector('.site-search').hidden, true);
  });
  await t.test('does not fetch the index on page load', () => {
    assert.strictEqual(fetches, 0);
  });
  await t.test('opening fetches the index and searching renders grouped results', async () => {
    ui.button.click();
    assert.strictEqual(ui.panel.hidden, false);
    assert.strictEqual(ui.button.getAttribute('aria-expanded'), 'true');
    const input = ui.panel.querySelector('input');
    input.value = 'trivni ghat';
    input.dispatchEvent(new window.Event('input'));
    await flush();
    assert.strictEqual(fetches, 1);
    const groups = [...ui.panel.querySelectorAll('.site-search-group')].map((g) => g.textContent);
    assert.deepStrictEqual(groups, ['Pages', 'Stays']);
    const first = ui.panel.querySelector('[role="option"]');
    assert.strictEqual(first.getAttribute('href'), '/triveni-ghat');
    assert.match(first.innerHTML, /<mark>Triveni<\/mark>/);
  });
  await t.test('arrow keys move the active result and Enter follows it', async () => {
    const input = ui.panel.querySelector('input');
    const opts = [...ui.panel.querySelectorAll('[role="option"]')];
    let followed = null;
    ui.panel.addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) { followed = a.getAttribute('href'); e.preventDefault(); } }, { once: true });
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    assert.strictEqual(opts[1].getAttribute('aria-selected'), 'true');
    assert.strictEqual(input.getAttribute('aria-activedescendant'), opts[1].id);
    ui.panel.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true, bubbles: true }));
    assert.strictEqual(followed, opts[1].getAttribute('href'));
    assert.strictEqual(ui.panel.hidden, true, 'following a result closes the panel');
  });
  await t.test('no results shows a line with a link to /contact; Esc closes', async () => {
    ui.open();
    const input = ui.panel.querySelector('input');
    input.value = 'qqqqzzzz';
    input.dispatchEvent(new window.Event('input'));
    await flush();
    const status = ui.panel.querySelector('.site-search-status');
    assert.match(status.textContent, /No results/);
    assert.strictEqual(status.querySelector('a').getAttribute('href'), '/contact');
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.strictEqual(ui.panel.hidden, true);
    assert.strictEqual(doc.activeElement, ui.button);
    assert.strictEqual(fetches, 1, 'the index is fetched once');
  });

  window.close();
  Object.assign(global, saved);
});
