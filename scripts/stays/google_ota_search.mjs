// Finds a booking-site page (Booking.com preferred) for each stay that has none,
// by searching for it in real, visible browsers the way a person would.
//
// Two passes: a quick one over all.tsv (1 search per stay; a miss goes to unfound.tsv as 'retry'),
// then --deep over those 'retry' rows only (the flow below with up to 3 searches).
//
// Flow per stay (owner's rules, 2026-10-04):
//   * at most 3 searches (1 in the quick pass), each with different wording ("<name> <city>",
//     "… booking.com", "site:booking.com …", quoted name) and the next engine/domain
//     (Google 10 country domains, Bing 6 regions, Brave Search);
//   * the results page is scrolled down step by step; as soon as booking-site property
//     links show up, scrolling stops and no further search is run for now;
//   * open the first booking-site link — Booking.com if the page has one, else the first
//     of any other site — in a new tab. If its title names the stay in its town
//     (ota-match.mjs), save the generic URL, close the tab, next stay. Otherwise try the
//     next link, at most 3 per page. No per-site searches.
//
// One worker per browser; a worker only ever reads tabs it opened itself. An engine
// that keeps returning pages without booking-site links is switched off for that
// worker. A stay is written as 'none' only when all its searches loaded; a captcha,
// block or timeout never becomes 'none'. A challenge waits for the person at the
// screen (never solved or bypassed here), then rests that engine for 30 min.
//
// Browsers you start yourself (your own profile; best against challenges):
//   open -na "Google Chrome"  --args --remote-debugging-port=9222 --user-data-dir=$HOME/.chrome-ota-search
//   open -na "Opera"          --args --remote-debugging-port=9223 --user-data-dir=$HOME/.opera-ota-search
//   open -na "Brave Browser"  --args --remote-debugging-port=9224 --user-data-dir=$HOME/.brave-ota-search
//   open -na "Microsoft Edge" --args --remote-debugging-port=9225 --user-data-dir=$HOME/.edge-ota-search
//   node scripts/stays/google_ota_search.mjs --shard 1/5 --attach chrome=http://localhost:9222 --limit 2000
// Launched (WebKit = Safari's engine; Playwright cannot drive the Safari app):
//   node scripts/stays/google_ota_search.mjs --shard 5/5 --browsers webkit --limit 2000
//
// Other flags: --offset N, --engines google,bing,brave, --ddg, --gap 20-40,
//   --wait-captcha SEC, --proxy URL, --dry, --sync (only rewrite the two trackers),
//   --recheck FILE (re-open every 'verified' line of FILE and keep only those that still match).
// Then:  python3 scripts/stays/postcheck_matches.py <out.tsv> docs/booking-links/found.tsv, merge_ota.py <out.tsv> (see docs/HANDOFF.md)
import { chromium, firefox, webkit } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmdirSync, statSync, renameSync } from 'fs';
import { coreName, coreWords, matchReason, cleanUrl, platformOf, PLATFORMS } from './ota-match.mjs';
import { judge, fuzzyName } from './ota-evidence.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const AG = `${ROOT}docs/booking-links/`;
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const flag = (n) => process.argv.includes(n);
// --shard i/N: workers split the stays (stay number mod N), each with its own results-cl<i>.tsv
const [SHARD, SHARDS] = arg('--shard', '1/1').split('/').map(Number);
const LIMIT = Number(arg('--limit', 1));
const OFFSET = Number(arg('--offset', 0));
const PROXY = arg('--proxy');
const DRY = flag('--dry');
const RECHECK = arg('--recheck');
// Antigravity's 'none' stays (now 'retry' in unfound.tsv) came from its buggy run (two of them were
// on Booking.com and MakeMyTrip after all): they are searched again, after all never-searched stays.
// Two passes (owner, 2026-10-04: "first try find as much, later iterate on unfound only"):
//   quick (default): all.tsv only, 1 search, at most 2 links; a miss goes to unfound.tsv as 'retry'
//   --deep:          unfound.tsv 'retry' rows only, up to 3 searches and 3 links; a miss is a final 'none'
const DEEP = flag('--deep');
// --front: bring the search tab to the front before each search (owner allows it; also keeps Chrome
// from freezing the tab). Without it everything stays in background tabs.
const FRONT = flag('--front');
// nobody watches the background windows: by default a challenge is not waited on (--wait-captcha 60 to solve them)
const WAIT = Number(arg('--wait-captcha', 0));
// minimum seconds between two searches of one worker, as "min-max"
const [GAP_MIN, GAP_MAX] = arg('--gap', '10-18').split('-').map(Number);
const SYNC_ONLY = flag('--sync');
const SEARCHES_PER_STAY = DEEP ? 7 : 2, LINKS_PER_PAGE = DEEP ? 4 : 3, SCROLL_STEPS = DEEP ? 8 : 5;
const ENGINE_FALLBACKS = 2;
const MORE_PAGES = 2; // "More results" / next page, when the first page shows nothing like the stay // a search that shows nothing like the stay is repeated on up to 2 other engines
// --attach chrome=http://localhost:9222[,opera=…]: browsers you opened yourself (a bare URL means chrome)
const ATTACH = Object.fromEntries(arg('--attach', '').split(',').filter(Boolean)
  .map((x) => (/^\w+=/.test(x) ? x.split(/=(.*)/s).slice(0, 2) : ['chrome', x])));
const BROWSERS = [...Object.keys(ATTACH), ...arg('--browsers', '').split(',').filter((b) => b && !ATTACH[b])];
if (!BROWSERS.length && !flag('--sync')) throw new Error('give --attach name=url and/or --browsers webkit,…');
const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const OPERA = '/Applications/Opera.app/Contents/MacOS/Opera';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => sleep(a + Math.random() * (b - a));
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
// A stop (kill, Ctrl-C) lands between two list writes, never inside one (those are synchronous).
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => {
  log(`stopped (${s})`);
  await Promise.race([Promise.all(Object.values(tabs).map((t) => t && !t.isClosed() && t.close().catch(() => {}))), sleep(3000)]);
  process.exit(0);
});

// ---- the three lists in docs/booking-links/ (every stay is in exactly one) ------
//   all.tsv      stays still to sort; a stay leaves it the moment it is sorted
//   found.tsv    verified links, one row per link (the first five columns are what
//                postcheck_matches.py / merge_ota.py read)
//   unfound.tsv  searched, nothing found: none, retry (search again after all.tsv is done) or
//                manual (name too generic to identify)
// Sorting a stay is a move between files (all -> found/unfound, unfound retry -> found/unfound),
// done under a lock so parallel workers never overwrite each other. Nothing is rebuilt.
const QUEUE = `${AG}all.tsv`, FOUND = `${AG}found.tsv`, UNFOUND = `${AG}unfound.tsv`;
const FOUND_COLS = ['key', 'status', 'platform', 'url', 'note', 'name', 'city', 'source'];
const UNFOUND_COLS = ['key', 'name', 'city', 'area', 'search_log', 'status'];
const QUEUE_COLS = ['key', 'name', 'city', 'area', 'type', 'rating', 'reviews', 'price_from_inr'];
function tsv(file) {
  if (!existsSync(file)) return [];
  const [head, ...rows] = readFileSync(file, 'utf8').trim().split('\n').map((l) => l.split('\t'));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
// Atomic: written to a temp file, then renamed over the list, so an editor or another reader never sees a
// half-written file. \r and Unicode line separators are flattened too (an editor would show them as breaks).
// A field never carries a stray quote (a TSV viewer would read on into the next rows): \" -> ", and an
// unmatched " is dropped.
const cleanField = (v) => {
  let s = String(v ?? '').replace(/[\t\n\r\u0085\u2028\u2029]/g, ' ').replace(/\\"/g, '"');
  if ((s.match(/"/g) || []).length % 2) s = s.replace(/"([^"]*)$/, '$1');
  return s;
};
const writeTsv = (file, cols, rows) => {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, [cols.join('\t'), ...rows.map((r) => cols.map((c) => cleanField(r[c])).join('\t'))].join('\n') + '\n');
  renameSync(tmp, file);
};
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function withLock(fn) {
  const dir = `${AG}.lists-lock`;
  for (;;) {
    try { mkdirSync(dir); break; } catch {
      try { if (Date.now() - statSync(dir).mtimeMs > 30000) rmdirSync(dir); } catch {} // a crashed worker's lock
      sleepSync(100);
    }
  }
  try { return fn(); } finally { try { rmdirSync(dir); } catch {} }
}
// Our own stays (OWN and OWN_ALIASES in build_pages.py: Advaitam and co.) are never searched,
// listed or linked to a booking site here: they are ours, sold direct.
const BUILD = readFileSync(`${ROOT}scripts/stays/build_pages.py`, 'utf8');
const OWN_KEYS = new Set([
  ...[...(BUILD.match(/^OWN = \[([\s\S]*?)^\]/m)?.[1] || '').matchAll(/\(\s*'([^']+)'/g)].map((m) => m[1]),
  ...[...(BUILD.match(/^OWN_ALIASES = \{([\s\S]*?)^\}/m)?.[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1]),
]);
if (OWN_KEYS.size < 3) throw new Error(`could not read our own stays from build_pages.py (got ${[...OWN_KEYS]})`);
const counts = () => ({ all: tsv(QUEUE).length, found: new Set(tsv(FOUND).map((r) => r.key)).size, unfound: tsv(UNFOUND).length });
// A worker's share: a fixed hash of the stay's key, so it never depends on any list's order.
const shareOf = (key) => { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % SHARDS; };
// Pages already linked to a stay (on the site, or found today): a page that belongs to a
// differently named stay is never accepted for another one (postcheck_matches.py's rule).
const NAMES = {};
for (const f of ['scripts/stays/.cache/stays.json', 'scripts/stays/.cache/haridwar/stays.json']) {
  try { for (const x of JSON.parse(readFileSync(ROOT + f, 'utf8'))) NAMES[x.id] = [x.n, x.cy || 'rishikesh']; } catch {}
}
for (const x of [...tsv(QUEUE), ...tsv(UNFOUND), ...tsv(FOUND)]) NAMES[x.key] ||= [x.name, x.city];
// Where each stay is (owner, 2026-10-05: a Booking page already given to another stay may be a second
// Google Maps pin of that same place, or a different place with a similar name; the map decides).
const LL = {};
for (const f of ['scripts/stays/.cache/stays.json', 'scripts/stays/.cache/haridwar/stays.json']) {
  try { for (const x of JSON.parse(readFileSync(ROOT + f, 'utf8'))) if (x.ll) LL[x.id] = x.ll; } catch {}
}
try { for (const x of JSON.parse(readFileSync(`${ROOT}scripts/stays/.cache/places/places.json`, 'utf8'))) if (x.lat) LL[`g-${x.id}`] = [x.lat, x.lng]; } catch {}
const kmBetween = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
const SAME_PLACE_KM = 0.25, NEAR_KM = 2; // pins this close: same place; up to NEAR_KM: the owner decides (review.tsv)
const nameSet = (n) => [...new Set(n.toLowerCase().replace(/home stay/g, 'homestay').replace(/guest house/g, 'guesthouse')
  .replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w && !/^(?:hotel|hotels|the|a|an|and|of|in|at|by|with|rishikesh|haridwar|hardwar|tapovan)$/.test(w)))].sort().join(' ');
const normUrl = (u) => { const p = platformOf(u); try { if (p) u = cleanUrl(u, p.name); } catch {} return u.split('?')[0].replace(/\/+$/, ''); };
function ownedByOther(stay, url) {
  const owners = [...tsv(`${ROOT}scripts/stays/ota-links.tsv`).filter((r) => r.status === 'verified'), ...tsv(FOUND)]
    .filter((r) => r.key !== stay.key && normUrl(r.url) === normUrl(url)).map((r) => r.key);
  return owners.find((k) => !NAMES[k] || nameSet(NAMES[k][0]) !== nameSet(stay.name) || NAMES[k][1] !== stay.city) || null;
}

// Sort one stay: move it out of all.tsv (or out of its unfound row) into found.tsv or unfound.tsv.
function record(stay, outcome, data) {
  if (DRY) return null;
  return withLock(() => {
    writeTsv(QUEUE, QUEUE_COLS, tsv(QUEUE).filter((r) => r.key !== stay.key));
    const unfound = tsv(UNFOUND).filter((r) => r.key !== stay.key);
    if (outcome === 'verified') {
      writeTsv(FOUND, FOUND_COLS, [...tsv(FOUND), { key: stay.key, status: 'verified', city: stay.city, name: stay.name, ...data }]);
      writeTsv(UNFOUND, UNFOUND_COLS, unfound);
    } else { // 'none' (searched, nothing matched), 'retry' (a page would not load: search again later), 'manual'
      writeTsv(UNFOUND, UNFOUND_COLS, [...unfound, { key: stay.key, name: stay.name, city: stay.city, area: stay.area, search_log: data.log, status: outcome }]);
    }
    return counts();
  });
}

// Name fits but the map says "check": review.tsv for the owner, and back to retry in unfound.tsv.
function recordReview(stay, r) {
  if (DRY) return null;
  return withLock(() => {
    const R = `${ROOT}docs/booking-links/review.tsv`;
    if (!existsSync(R)) writeFileSync(R, 'key\tname\tcity\tplatform\turl\tpage_shows\twhy_review\n');
    const cols = ['key', 'name', 'city', 'platform', 'url', 'page_shows', 'why_review'];
    writeTsv(R, cols, [...tsv(R).filter((x) => x.key !== stay.key), { key: stay.key, name: stay.name, city: stay.city, platform: r.platform, url: r.url, page_shows: r.title, why_review: r.review }]);
    writeTsv(QUEUE, QUEUE_COLS, tsv(QUEUE).filter((x) => x.key !== stay.key));
    writeTsv(UNFOUND, UNFOUND_COLS, [...tsv(UNFOUND).filter((x) => x.key !== stay.key), { key: stay.key, name: stay.name, city: stay.city, area: stay.area, search_log: `in review.tsv for the owner: ${r.review}`, status: 'review' }]);
    return counts();
  });
}

// ---- search engines ------------------------------------------------------------
const cssHit = (page, sel) => page.locator(sel).count().then((n) => n > 0).catch(() => false);
const textHit = (page, re) => page.getByText(re).count().then((n) => n > 0).catch(() => false);
const ENGINES = {
  google: {
    regions: [['co.in', 'in'], ['co.uk', 'uk'], ['ca', 'ca'], ['de', 'de'], ['fr', 'fr'], ['es', 'es'], ['it', 'it'], ['ae', 'ae'], ['com.au', 'au'], ['co.za', 'za']],
    label: ([tld]) => `google.${tld}`,
    host: /(^|\.)google\.[a-z.]+$/,
    home: ([tld, gl]) => `https://www.google.${tld}/?hl=en&gl=${gl}`,
    search: ([tld, gl], q) => `https://www.google.${tld}/search?q=${encodeURIComponent(q)}&hl=en&gl=${gl}`,
    box: 'textarea[name=q], input[name=q]',
    resultsUrl: /\/search\?/,
    results: '#rso, #search',
    more: 'a#pnnext, a[aria-label="Next page"], a[aria-label="More results"]',
    blocked: async (p) => /\/sorry\//.test(p.url()) || await cssHit(p, 'form#captcha-form, iframe[src*="recaptcha"]') || textHit(p, /unusual traffic/i),
  },
  bing: {
    regions: [['in'], ['gb'], ['us'], ['au'], ['ca'], ['de']],
    label: ([cc]) => `bing(${cc})`,
    host: /(^|\.)bing\.com$/,
    home: ([cc]) => `https://www.bing.com/?cc=${cc}&setlang=en`,
    search: ([cc], q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}&cc=${cc}&setlang=en`,
    box: 'textarea[name=q], input[name=q]',
    resultsUrl: /\/search\?/,
    results: '#b_results',
    more: 'a.sb_pagN, a[title="Next page"], a[aria-label="Next page"]',
    blocked: async (p) => /turing|captcha/i.test(p.url()) || textHit(p, /verify you are human|one last step|solve the challenge/i),
  },
  brave: {
    regions: [['all']],
    label: () => 'search.brave',
    host: /^search\.brave\.com$/,
    home: () => 'https://search.brave.com/',
    search: (r, q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
    box: 'input[name=q], textarea[name=q]',
    resultsUrl: /\/search\?/,
    results: '#results, main',
    more: 'a[href*="offset="]:has-text("Next"), a.btn:has-text("Next"), a[role="button"]:has-text("Next")',
    blocked: async (p) => /captcha/i.test(p.url()) || textHit(p, /not a robot|verify you are human/i),
  },
  ddg: {
    regions: [['in-en'], ['uk-en'], ['us-en'], ['wt-wt']],
    label: ([kl]) => `duckduckgo(${kl})`,
    host: /(^|\.)duckduckgo\.com$/,
    home: ([kl]) => `https://duckduckgo.com/?kl=${kl}`,
    search: ([kl], q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}&kl=${kl}`,
    box: 'input[name=q]',
    resultsUrl: /[?&]q=/,
    results: '[data-testid=result], #links',
    more: '#more-results, button:has-text("More results"), button:has-text("More Results")',
    blocked: async (p) => /anomaly/.test(p.url()) || await cssHit(p, '.anomaly-modal__modal') || textHit(p, /select all squares/i),
  },
};
const ENGINES_ON = [...arg('--engines', 'google,bing,brave').split(',').filter(Boolean), ...(flag('--ddg') ? ['ddg'] : [])];
// "If an engine is not helping, stop using it": after MIN_TRIES searches, an engine whose
// results pages carry booking-site links less than MIN_YIELD of the time is switched off.
const MIN_TRIES = 12, MIN_YIELD = 0.15;
const stats = Object.fromEntries(ENGINES_ON.map((e) => [e, { searches: 0, withLinks: 0, matches: 0 }]));

// Result links come wrapped: Google /url?q=<t>, Bing /ck/a?u=a1<base64url t>, DuckDuckGo /l/?uddg=<t>.
function unwrap(h) {
  try {
    const u = new URL(h);
    if (u.searchParams.get('uddg')) return u.searchParams.get('uddg');
    if (u.pathname === '/url') return u.searchParams.get('q') || u.searchParams.get('url') || h;
    const b = u.searchParams.get('u');
    if (/bing\.com$/.test(u.hostname) && b?.startsWith('a1')) return Buffer.from(b.slice(2), 'base64url').toString('utf8');
    return h;
  } catch { return h; }
}

// ---- (browser x engine/region) combinations ---------------------------------
const combos = shuffle(BROWSERS.flatMap((b) => ENGINES_ON.flatMap((e) =>
  ENGINES[e].regions.map((r) => ({ b, e, r, where: ENGINES[e].label(r), until: 0 })))));
let cursor = 0, lastCombo = null, lastOk = false, lastSearchAt = 0;
// The next search differs from the last in browser and engine if possible, else in engine, else in domain.
// avoid: engines already tried for this stay (owner, 2026-10-05: when one engine shows nothing that
// looks like the stay, the same search goes to another engine before the stay is put aside)
function nextCombo(avoid = new Set()) {
  // owner's rule: while a session gives results, keep using it; move on only after a block, an error
  // or a results page with no booking-site links
  if (lastCombo && lastOk && lastCombo.until <= Date.now() && !avoid.has(lastCombo.e)) return lastCombo;
  for (let i = 0; i < combos.length; i++) {
    const c = combos[cursor++ % combos.length];
    if (avoid.size && c.until <= Date.now() && !avoid.has(c.e)) return (lastCombo = c);
  }
  const tiers = [
    (c) => c.b !== lastCombo.b && c.e !== lastCombo.e,
    (c) => c.e !== lastCombo.e,
    (c) => c.where !== lastCombo.where,
    (c) => c !== lastCombo,
    () => true, // only one combination left: reuse it
  ];
  for (const ok of lastCombo ? tiers : [() => true]) {
    for (let i = 0; i < combos.length; i++) {
      const c = combos[cursor++ % combos.length];
      if (c.until <= Date.now() && ok(c)) return (lastCombo = c);
    }
  }
  return null; // everything is resting
}
const noAnswer = {}; // browser/engine -> searches in a row that got no results page (not a challenge)
// Pace (owner, 2026-10-05: "speed up and down based on rate limit"): the gap between searches is
// multiplied by `pace`; a challenge or block makes it 1.25x slower (never more than 1.5x: owner, "not much slower than a person"), every 15 clean results
// pages make it 10% faster (down to half the --gap).
let pace = 1, cleanRun = 0;
function adjustPace(what) {
  if (what === 'slower') { pace = Math.min(1.5, pace * 1.25); cleanRun = 0; log(`   pace: slower, searches now ${Math.round(GAP_MIN * pace)}-${Math.round(GAP_MAX * pace)} s apart`); }
  else if (what === 'ok' && ++cleanRun >= 15) { cleanRun = 0; if (pace > 0.5) { pace = Math.max(0.5, pace * 0.9); log(`   pace: faster, searches now ${Math.round(GAP_MIN * pace)}-${Math.round(GAP_MAX * pace)} s apart`); } }
}
const rest = (pred, ms, why) => {
  for (const c of combos) if (pred(c)) {
    c.until = Math.max(c.until, Date.now() + ms);
    if (ms >= 10 * 60e3 && combos.filter((x) => x.b === c.b && x.e === c.e).every((x) => x.until > Date.now())) closeEngineTab(c.b, c.e);
  }
  log(`   ${why}`);
};

// ---- browsers and tabs -------------------------------------------------------
const contexts = {}, tabs = {};
async function context(b) {
  if (contexts[b]) return contexts[b];
  if (ATTACH[b]) {
    const n = await tidyTabs(b);
    if (n) log(`   ${b}: closed ${n} leftover booking-site/search tab(s) of earlier workers`);
    await replaceFrozen(b);
    const browser = await chromium.connectOverCDP(ATTACH[b], { timeout: 60000 });
    return (contexts[b] = browser.contexts()[0] || await browser.newContext());
  }
  const dir = `${process.env.HOME}/.ota-search-profiles/${b}-w${SHARD}`; // cookies and solved challenges are kept
  mkdirSync(dir, { recursive: true });
  const base = { headless: !flag('--headed'), viewport: { width: 1280, height: 800 }, ...(PROXY ? { proxy: { server: PROXY } } : {}) };
  const launch = {
    chrome: () => chromium.launchPersistentContext(dir, { ...base, channel: 'chrome' }),
    edge: () => chromium.launchPersistentContext(dir, { ...base, channel: 'msedge' }),
    brave: () => chromium.launchPersistentContext(dir, { ...base, executablePath: BRAVE }),
    opera: () => chromium.launchPersistentContext(dir, { ...base, executablePath: OPERA }),
    firefox: () => firefox.launchPersistentContext(dir, base),
    webkit: () => webkit.launchPersistentContext(dir, base),
  }[b];
  if (!launch) throw new Error(`unknown browser ${b}`);
  const ctx = await launch();
  ctx.on('close', () => { delete contexts[b]; for (const k of Object.keys(tabs)) if (k.startsWith(`${b}:`)) delete tabs[k]; });
  return (contexts[b] = ctx);
}
// A search-results/challenge page of a search engine (never Gmail, Maps or any other tab of yours).
const isSearchTab = (u) => { try { const x = new URL(u); return (/^(?:www\.google\.[a-z.]+|www\.bing\.com|search\.brave\.com)$/.test(x.hostname) && /^\/(?:search|sorry)\b/.test(x.pathname))
  || (/(^|\.)duckduckgo\.com$/.test(x.hostname) && x.searchParams.has('q')); } catch { return false; } };
// A blank or new-tab page: nothing on it to lose.
const isEmptyTab = (u) => /^(?:about:blank|(?:chrome|edge|brave|opera):\/\/(?:newtab|new-tab-page|startpage)\/?)$/.test(u);
// A booking-site page (property page, its search results or a list): only our workers open these here.
const isBookingTab = (u) => { try { return /(^|\.)(?:booking\.com|goibibo\.com|makemytrip\.[a-z.]+|agoda\.com|easemytrip\.com|trip\.com|trivago\.[a-z.]+|airbnb\.[a-z.]+)$/.test(new URL(u).hostname); } catch { return false; } };
// Keep memory in check (owner): in your own browser, close our leftovers (booking-site pages and every
// search/challenge page but one) through the browser's plain HTTP endpoint, so a stuck tab can't block
// it. Any other tab of yours is never touched. Returns how many were closed.
async function tidyTabs(b, keepUrls = []) {
  if (!ATTACH[b]) return 0;
  const base = ATTACH[b].replace(/\/+$/, '');
  try {
    const pages = (await (await fetch(`${base}/json/list`, { signal: AbortSignal.timeout(8000) })).json()).filter((t) => t.type === 'page');
    const keep = new Set(keepUrls.filter((u) => !isEmptyTab(u)));
    // empty tabs (blank / new-tab pages) go too (owner, 2026-10-05), except as many as our own engine
    // tabs that are still blank, and never the last tab of the browser (a window is never closed)
    let blanksToKeep = keepUrls.filter(isEmptyTab).length;
    let closed = 0;
    for (const t of pages) {
      const empty = isEmptyTab(t.url);
      if (empty && blanksToKeep > 0) { blanksToKeep--; continue; }
      if (keep.has(t.url) || !(empty || isBookingTab(t.url) || isSearchTab(t.url))) continue;
      if (pages.length - closed <= 1) break;
      await fetch(`${base}/json/close/${t.id}`, { signal: AbortSignal.timeout(8000) }).catch(() => {}); closed++;
    }
    return closed;
  } catch { return 0; }
}

// Chrome/Brave freeze tabs that sat in the background while no worker ran; a frozen tab never answers,
// and Playwright then waits forever to attach. Before attaching: every frozen tab of ours (search,
// booking-site, blank or new-tab page) is replaced by one fresh background tab (so the window and your
// logged-in session stay); a frozen tab that is not ours is left alone and named in the log.
async function replaceFrozen(b) {
  if (!ATTACH[b]) return;
  const base = ATTACH[b].replace(/\/+$/, '');
  let ws;
  try {
    const v = await (await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(8000) })).json();
    ws = new WebSocket(v.webSocketDebuggerUrl);
    let id = 0; const pending = new Map();
    const send = (method, params = {}, sessionId, ms = 4000) => new Promise((res) => {
      const i = ++id; pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => { if (pending.has(i)) { pending.delete(i); res({ timeout: true }); } }, ms);
    });
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; setTimeout(j, 8000); });
    const ours = (u) => /^(?:chrome|brave|edge|opera):\/\/(?:newtab|startpage)|^about:blank/.test(u) || isSearchTab(u) || isBookingTab(u);
    const pages = ((await send('Target.getTargets')).result?.targetInfos || []).filter((t) => t.type === 'page');
    const frozen = [];
    for (const t of pages) {
      const sid = (await send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).result?.sessionId;
      const ev = sid ? await send('Runtime.evaluate', { expression: '1', returnByValue: true }, sid, 3000) : { timeout: true };
      if (sid) await send('Target.detachFromTarget', { sessionId: sid });
      if (ev.timeout) frozen.push(t);
    }
    const mine = frozen.filter((t) => ours(t.url)), theirs = frozen.filter((t) => !ours(t.url));
    if (mine.length) {
      await send('Target.createTarget', { url: 'about:blank', background: true });
      for (const t of mine) await send('Target.closeTarget', { targetId: t.targetId });
      log(`   ${b}: replaced ${mine.length} frozen tab(s) of ours with a fresh background tab`);
    }
    if (theirs.length) log(`   ${b}: ${theirs.length} of your tabs is frozen (${theirs.map((t) => t.url.slice(0, 50)).join(', ')}); click it once if attaching hangs`);
  } catch (e) { log(`   ${b}: could not check for frozen tabs (${String(e?.message || e).slice(0, 80)})`); }
  finally { try { ws?.close(); } catch {} }
}

// One search tab per browser and engine (owner, 2026-10-05): kept while the engine answers and reused
// through the engine's own search box; closed when the engine is rested or blocked, and when the worker stops.
const tabKey = (b, e) => `${b}:${e}`;
const ourTabs = (b) => Object.entries(tabs).filter(([k, t]) => k.startsWith(`${b}:`) && t && !t.isClosed());
async function searchTab(b, e = 'google') {
  const key = tabKey(b, e);
  if (tabs[key] && !tabs[key].isClosed()) return tabs[key];
  const ctx = await context(b);
  const t = ATTACH[b] ? await openBackground(b, 'about:blank') : await ctx.newPage();
  t.__ota_browser = b;
  t.on('popup', (p) => p.close().catch(() => {})); // candidates open in background tabs of our own; any popup is unwanted
  return (tabs[key] = t);
}
async function closeEngineTab(b, e) {
  const t = tabs[tabKey(b, e)];
  delete tabs[tabKey(b, e)];
  if (t && !t.isClosed()) await t.close().catch(() => {});
}
// A search tab kept for hundreds of searches grows to gigabytes (Bing's pages leak; on 2026-10-04 two
// such tabs pushed the Mac to 10 GB of swap): it is swapped for a fresh background tab every RECYCLE stays.
const RECYCLE = Number(arg('--recycle', 40));
async function freshSearchTab(b) {
  for (const [key] of ourTabs(b)) await closeEngineTab(b, key.split(':')[1]); // the next search opens a clean one
  log(`   ${b}: closed its search tabs to keep memory down; next searches start fresh ones`);
}
async function usable(b) {
  try { await context(b); return true; } catch (e) {
    rest((c) => c.b === b, Infinity, `${b} cannot start (${e.message.split('\n')[0].slice(0, 90)}): dropped`);
    return false;
  }
}

async function dismissConsent(page) {
  if (!/consent\.google/.test(page.url())) return;
  const btn = page.getByRole('button', { name: /reject all|alle ablehnen|tout refuser|rechazar todo|rifiuta tutto/i }).first();
  if (await btn.count()) { await btn.click().catch(() => {}); await page.waitForLoadState('domcontentloaded').catch(() => {}); }
}
// A challenge in a visible window: wait for the person to solve it. Never solved or bypassed here.
let challenged = false; // set when a person solved one: that engine then rests a while
async function waitForPerson(page, isBlocked, what) {
  if (WAIT <= 0 || (!ATTACH[page.__ota_browser] && !flag('--headed'))) return false; // headless: nobody can solve it
  log(`   ${what} challenge in the open window: solve it there (waiting up to ${WAIT}s)`);
  for (let t = 0; t < WAIT; t += 2) {
    await sleep(2000);
    if (!(await isBlocked(page).catch(() => true))) { await page.waitForLoadState('domcontentloaded').catch(() => {}); challenged = true; return true; }
  }
  return false;
}

// read every link; if the page is still navigating, wait for it and read again
// Every link on the results page with the text a person reads next to it: the result's title and
// snippet (owner, 2026-10-05: "read each url and its heading": an Airbnb address is only a number,
// an Agoda address often differs from the name, but the result's title names the stay).
async function pageResults(page) {
  for (let i = 0; ; i++) {
    try {
      const raw = await page.$$eval('a[href]', (as) => as.map((a) => {
        const box = a.closest('li, article, [data-testid=result], .b_algo, div.g, .result, .snippet, [data-type=web]');
        return [a.href, `${a.innerText || ''} ${box && box !== document.body ? (box.innerText || '').slice(0, 400) : ''}`.replace(/\s+/g, ' ').trim()];
      }));
      const links = [], titles = {};
      for (const [h, t] of raw) { const u = unwrap(h); if (!titles[u]) { links.push(u); titles[u] = t; } }
      return { links, titles };
    } catch (e) {
      if (i >= 2) throw e;
      await page.waitForLoadState('domcontentloaded').catch(() => {}); await sleep(1500);
    }
  }
}

// Google hides result targets behind opaque /goto?url=<token> links, so its booking-site results
// are found by their label ("Booking.com", "Agoda.com", …) and opened by clicking, like a person.
async function googlePicks(page) {
  return page.$$eval('#rso a[href], #search a[href]', (as) => {
    const sites = [['Booking.com', /booking\.com/i], ['MakeMyTrip', /makemytrip/i], ['Goibibo', /goibibo/i], ['Agoda', /agoda/i], ['Airbnb', /airbnb/i], ['EaseMyTrip', /easemytrip/i], ['Trip.com', /\btrip\.com\b/i],
      ['Expedia', /expedia/i], ['Hotels.com', /hotels\.com/i], ['Cleartrip', /cleartrip/i], ['Hostelworld', /hostelworld/i], ['OYO', /oyorooms/i], ['Trivago', /trivago/i]];
    const out = [];
    for (const a of as) {
      if (!a.querySelector('h3')) continue; // only a result's title link
      const site = sites.find(([, re]) => re.test(a.innerText || ''));
      if (!site) continue;
      // the breadcrumb Google shows ("https://www.booking.com › hotel › in") tells a hotel page from a list page
      const cite = (a.querySelector('cite')?.innerText || '').toLowerCase();
      if (/searchresults|landmark|placestostay|› ?city|› ?region|› ?district|hotels-in|› ?deals/.test(cite)) continue;
      if (site[0] === 'Booking.com' && cite && !/› ?hotel\b/.test(cite)) continue;
      const id = a.getAttribute('data-ota-pick') || `g${out.length}-${Math.random().toString(36).slice(2, 7)}`;
      a.setAttribute('data-ota-pick', id);
      out.push({ id, platform: site[0], label: (a.querySelector('h3')?.innerText || '').slice(0, 90) });
    }
    return out;
  });
}

// One search typed into the engine's box. The results page is scrolled down step by step
// and scrolling stops as soon as booking-site property links are on it.
// -> { state: 'ok'|'blocked'|'error', links }
async function search(combo, query, stay) {
  const eng = ENGINES[combo.e];
  const page = await searchTab(combo.b, combo.e);
  if (FRONT) await page.bringToFront().catch(() => {});
  try {
    // same session, same tab: on this engine's results page already, put the query into the page's own
    // search box and submit its form (what Enter does; no typing or focus, so it works in a background
    // tab); otherwise open the search address in this tab (what the address bar does)
    const before = page.url();
    const here = (() => { try { return eng.host.test(new URL(before).hostname); } catch { return false; } })();
    const submitted = here && await page.evaluate(([sel, q]) => {
      const box = document.querySelector(sel);
      if (!box || !box.form) return false;
      box.value = q;
      if (box.form.requestSubmit) box.form.requestSubmit(); else box.form.submit();
      return true;
    }, [eng.box, query]).catch(() => false);
    if (!submitted) await page.goto(eng.search(combo.r, query), { waitUntil: 'domcontentloaded', timeout: 35000 });
    await dismissConsent(page);
    await page.waitForURL((u) => u.href !== before && (eng.resultsUrl.test(u.href) || /sorry|captcha|turing|anomaly|challenge/i.test(u.href)), { timeout: 20000 }).catch(() => {});
    if (page.url() === before) return { state: 'error', links: [], picks: [] };
    if (await eng.blocked(page) && !(await waitForPerson(page, eng.blocked, 'results-page'))) return { state: 'blocked', links: [], picks: [] };
    if (!eng.resultsUrl.test(page.url())) return { state: 'error', links: [], picks: [] };
    await page.locator(eng.results).first().waitFor({ timeout: 15000 }).catch(() => {});
    await jitter(500, 900);
    const read = async () => ({ ...(await pageResults(page)), picks: combo.e === 'google' ? await googlePicks(page) : [] });
    let got = await read();
    const fits = () => (stay ? relevant(stay, candidates(got, new Set())).length > 0 : got.links.some(platformOf) || got.picks.length > 0);
    for (let step = 0; step < SCROLL_STEPS && !fits(); step++) {
      await page.evaluate((dy) => window.scrollBy(0, dy), 700 + Math.random() * 400).catch(() => {}); // works in a background tab
      await jitter(400, 800);
      got = await read();
    }
    // still nothing like the stay: "More results" (DuckDuckGo) or the next page (Google, Bing, Brave),
    // like a person would (owner, 2026-10-05); links already read stay in the list
    for (let extra = 0; extra < MORE_PAGES && !fits() && eng.more; extra++) {
      const more = page.locator(eng.more).first();
      if (!(await more.count().catch(() => 0))) break;
      const prev = got;
      await more.scrollIntoViewIfNeeded().catch(() => {});
      await jitter(600, 1200);
      await more.click({ timeout: 8000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await jitter(800, 1400);
      if (await eng.blocked(page)) break;
      for (let step = 0; step < 2; step++) { await page.evaluate(() => window.scrollBy(0, 900)).catch(() => {}); await jitter(500, 900); }
      const next = await read();
      // addresses from every page read so far; Google's click-only results only from the page now shown
      got = { links: [...new Set([...prev.links, ...next.links])], titles: { ...prev.titles, ...next.titles }, picks: next.picks || [] };
      log(`   ${combo.e}: ${extra === 0 && combo.e === 'ddg' ? 'more results' : `page ${extra + 2}`} read`);
    }
    return { state: 'ok', ...got };
  } catch (e) {
    const msg = e.message.split('\n')[0];
    // no internet / DNS: nothing to do with this engine; the caller waits and retries the same search
    if (/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_ADDRESS_UNREACHABLE|hostname could not be found|network connection was lost|NS_ERROR_UNKNOWN_HOST|NS_ERROR_OFFLINE/i.test(msg)) return { state: 'offline', links: [], picks: [] };
    log('   search error:', msg);
    return { state: 'error', links: [], picks: [] };
  }
}

// Open url without touching the screen: in your own browsers a background tab (like Cmd-click:
// the window and its active tab stay as they are), in a launched (headless) browser a hidden page.
async function openBackground(b, url) {
  const ctx = await context(b);
  if (!ATTACH[b]) { const p = await ctx.newPage(); await p.goto(url, { waitUntil: 'commit', timeout: 25000 }).catch(() => {}); return p; }
  const before = new Set(ctx.pages());
  const cdp = await ctx.browser().newBrowserCDPSession();
  try { await cdp.send('Target.createTarget', { url, background: true }); } finally { await cdp.detach().catch(() => {}); }
  for (const end = Date.now() + 15000; Date.now() < end; await sleep(200)) {
    const p = ctx.pages().find((x) => !before.has(x)); // one worker per browser: the new tab is ours
    if (p) return p;
  }
  throw new Error('new tab did not open');
}
// A Google result (marked by googlePicks): open its own link (Google's redirect) in the background and follow it off Google.
async function openPick(b, host, id) {
  const href = await host.$eval(`[data-ota-pick="${id}"]`, (a) => a.href);
  const tab = await openBackground(b, href);
  await tab.waitForURL((u) => !/(^|\.)google\./.test(u.hostname), { timeout: 25000 }).catch(() => {});
  return tab;
}

// Open one candidate ({p, url} or a Google {p, pick}) in a new tab beside browser b's search
// tab, decide, close it. -> { ok, title, url, unreadable? }  (url = generic URL of where it landed)
async function check(b, stay, cand) {
  let page, finalUrl = '';
  try {
    const host = await searchTab(b, 'google'); // Google's click-only results live in its tab
    page = cand.pick ? await openPick(b, host, cand.pick) : await openBackground(b, cand.url);
    await page.waitForLoadState('domcontentloaded', { timeout: 25000 });
    await jitter(1500, 2500);
    const title = (await page.title()).trim();
    finalUrl = page.url();
    const landed = platformOf(finalUrl);
    const url = landed ? cleanUrl(finalUrl, landed.name) : finalUrl;
    if (!title || /just a moment|access denied|captcha|robot|attention required|^403|^404|not found/i.test(title)) return { ok: false, unreadable: true, title, url: landed ? url : '' };
    // still that site's property page (a closed Booking listing redirects to a city search) and the same stay
    // judged on where it landed (a Google result labelled Booking.com may land elsewhere)
    if (!landed) return { ok: false, title, url, why: 'not a property page' };
    const seen = await page.evaluate(() => ({
      pin: (document.querySelector('[data-atlas-latlng]')?.getAttribute('data-atlas-latlng') || '').split(',').map(Number),
      text: (document.body?.innerText || '').slice(0, 40000),
    })).catch(() => ({ pin: [], text: '' }));
    const pin = seen.pin;
    const pageLL = pin.length === 2 && pin.every(Number.isFinite) && pin[0] ? pin : null;
    const here = LL[stay.key];
    const m = matchReason(stay.name, stay.city, title);
    const fz = m.ok ? { ok: true } : fuzzyName(stay.name, `${title} ${new URL(url).pathname.replace(/[-_/.]+/g, ' ')}`);
    const owner = ownedByOther(stay, url);
    if (owner) {
      // a second listing of the same place (same name, pins together) is a duplicate of the stay that has
      // the page, not a miss; same name but further apart is for the owner to judge
      const there = pageLL || LL[owner];
      const d = here && there ? kmBetween(here, there) : null;
      if (fz.ok && d !== null && d <= SAME_PLACE_KM) return { ok: false, duplicate: owner, title, url, platform: landed.name, d };
      if (fz.ok && d !== null && d <= NEAR_KM) return { ok: false, review: `same name as ${NAMES[owner]?.[0] || owner}, which has this page; pins ${Math.round(d * 1000)} m apart`, title, url, platform: landed.name };
      return { ok: false, title, url, why: `already the page of ${NAMES[owner]?.[0] || owner}${d !== null ? `, ${d.toFixed(1)} km from this stay` : ''}` };
    }
    // name, then the place itself: map pin or the address the page shows (ota-evidence.mjs)
    const j = judge({ key: stay.key, name: stay.name, city: stay.city, nameOk: m.ok, title, urlPath: new URL(url).pathname, pageLL, pageText: seen.text });
    if (j.verdict === 'review') return { ok: false, review: j.why, title, url, platform: landed.name };
    if (j.verdict === 'verified') return { ok: true, title, url, platform: landed.name, evidence: j.why };
    return { ok: false, title, url, why: m.ok ? j.why : `${m.why}${m.detail ? ` (${m.detail})` : ''}; ${j.why}` };
  } catch (e) {
    return { ok: false, unreadable: true, title: e.message.split('\n')[0], url: platformOf(finalUrl) ? cleanUrl(finalUrl, platformOf(finalUrl).name) : '' };
  } finally {
    await page?.close().catch(() => {});
  }
}

// ---- one stay ---------------------------------------------------------------
function queries(stay) {
  const n = coreName(stay.name), c = stay.city;
  const hostel = /hostel|backpack|zostel|dorm/i.test(stay.name), oyo = /\b(oyo|townhouse|capital o|collection o|spot on|flagship)\b/i.test(stay.name);
  const sites = ['site:booking.com', 'site:agoda.com', 'airbnb', ...(hostel ? ['site:hostelworld.com'] : []), ...(oyo ? ['site:oyorooms.com'] : []),
    'site:goibibo.com', 'site:makemytrip.com', 'site:expedia.co.in', 'site:hotels.com', 'site:cleartrip.com', 'site:trip.com', 'site:easemytrip.com'];
  return [`${n} ${c}`, ...sites.map((x) => (x.startsWith('site:') ? `${x} ${n} ${c}` : `${n} ${c} ${x}`))].slice(0, SEARCHES_PER_STAY);
}
// How much a link looks like this stay: core-name words in its address slug or Google result
// title, small spelling differences allowed ("pardesi" ~ "paradesi").
const close = (a, b) => {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 2) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] <= 2;
};
function relevance(stay, text) {
  const got = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
  return coreWords(stay.name).filter((w) => got.some((g) => g === w || (w.length >= 4 && (g.startsWith(w) || w.startsWith(g) && g.length >= 4)) || close(w, g))).length;
}
// Only links that look like this stay count; among them Booking.com first, then the other
// booking sites in page order, Trivago (price comparison) last.
// A candidate is {p, url} when the address is on the page, or {p, pick} for a Google result to click.
function relevant(stay, cands) {
  const scored = cands.map((c) => ({ ...c, score: relevance(stay, c.url ? `${new URL(c.url).pathname.replace(/[-_/.]+/g, ' ')} ${c.label || ''}` : c.label) })).filter((c) => c.score > 0);
  const rank = (c) => (c.p.name === 'Booking.com' ? 0 : c.p.name === 'Trivago' ? 2 : 1);
  return scored.map((c, i) => [c.score, rank(c), i, c]).sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]).map((x) => x[3]);
}
function candidates(res, tried) {
  const found = [];
  for (const l of res.links) {
    const p = platformOf(l);
    if (!p) continue;
    let u; try { u = cleanUrl(l, p.name); } catch { continue; }
    if (!tried.has(u) && !found.some((c) => c.url === u)) found.push({ p, url: u, label: res.titles?.[l] || '' });
  }
  for (const g of res.picks || []) {
    const p = PLATFORMS.find((x) => x.name === g.platform);
    if (p && !tried.has(`pick:${g.label}`)) found.push({ p, pick: g.id, label: `${g.label} (Google result)` });
  }
  return [...found.filter((c) => c.p.name === 'Booking.com'), ...found.filter((c) => c.p.name !== 'Booking.com')];
}

// -> 'verified' | 'none' | 'retry' | 'manual' | 'unresolved'
async function processStay(stay) {
  // sorted meanwhile by another worker or by hand (lists are shared): never searched or written twice
  const still = DEEP ? tsv(UNFOUND).some((r) => r.key === stay.key && r.status === 'retry') : tsv(QUEUE).some((r) => r.key === stay.key);
  if (!still) { log('   already sorted elsewhere: skipped'); return 'skipped'; }
  if (!coreWords(stay.name).length) { // nothing in the name can identify it on a booking site
    log(`   name "${stay.name}" has nothing distinctive (core "${coreName(stay.name)}"): not searched, left for a person`);
    log('   lists:', JSON.stringify(record(stay, 'manual', { log: `name too generic to identify on a booking site (core "${coreName(stay.name)}"); check by hand` }) || 'dry run: not touched'));
    return 'manual';
  }
  const tried = new Set(), skipped = new Set();
  let searches = 0;
  const qs = queries(stay), usedEngines = new Set();
  let fallbacks = ENGINE_FALLBACKS;
  for (let qi = 0; qi < qs.length; qi++) {
    const q = qs[qi];
    let res, combo;
    for (let attempt = 0; attempt < 6; attempt++) {
      combo = nextCombo(usedEngines);
      if (!combo) { // everything is resting: wait for the first engine to be free again
        const free = Math.min(...combos.map((c) => c.until).filter(Number.isFinite));
        if (!Number.isFinite(free)) { log('   no usable browser/engine left'); return 'unresolved'; }
        log(`   every engine is resting: waiting ${Math.ceil((free - Date.now()) / 60e3)} min`);
        await sleep(Math.max(0, free - Date.now()) + 5000);
        attempt--; continue;
      }
      if (!(await usable(combo.b))) continue;
      log(`   ${combo.b}/${combo.where}: ${q}`);
      challenged = false;
      const wait = lastSearchAt + (GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN)) * pace * 1000 - Date.now();
      if (wait > 0) await sleep(wait); // keeps this worker's searches spaced, whatever the stay
      lastSearchAt = Date.now();
      res = await search(combo, q, stay);
      lastOk = res.state === 'ok' && !challenged && (res.links.some(platformOf) || res.picks?.length > 0);
      if (challenged) rest((c) => c.b === combo.b && c.e === combo.e, 10 * 60e3, `a challenge was solved on ${combo.b}/${combo.e}: resting it there for 10 min`);
      adjustPace(res.state === 'blocked' || challenged ? 'slower' : res.state === 'ok' ? 'ok' : 'error');
      if (res.state === 'ok') { noAnswer[`${combo.b}/${combo.e}`] = 0; break; }
      if (res.state === 'offline') { log('   no internet connection: waiting 30 s, then the same search again'); await sleep(30000); attempt--; continue; }
      if (res.state === 'blocked') rest((c) => c.b === combo.b && c.e === combo.e, 30 * 60e3, `challenged on ${combo.b}/${combo.e}: resting ${combo.e} there for 30 min`);
      else { // owner: an engine that is not responding gets no more requests (every region of it, in this browser)
        const k = `${combo.b}/${combo.e}`; noAnswer[k] = (noAnswer[k] || 0) + 1;
        if (noAnswer[k] >= 3) rest((c) => c.b === combo.b && c.e === combo.e, Infinity, `${combo.e} not responding on ${combo.b} (${noAnswer[k]} times in a row): no more requests to it`);
        else rest((c) => c.b === combo.b && c.e === combo.e, 10 * 60e3, `${combo.e} not responding on ${combo.b}: resting it there for 10 min`);
      }
      await jitter(2000, 4000);
    }
    if (res?.state !== 'ok') { log('   could not get a results page'); return 'unresolved'; }
    searches++;
    usedEngines.add(combo.e);

    const all = candidates(res, tried).filter((c) => !skipped.has(c.p.name));
    const cands = relevant(stay, all);
    const st = stats[combo.e];
    st.searches++; if (res.links.some(platformOf) || res.picks?.length) st.withLinks++; // links on the page, tried or not
    log(`   ${cands.length ? `opening the first of ${cands.length} link(s) that look like this stay: ${cands.slice(0, LINKS_PER_PAGE).map((c) => c.p.name).join(', ')}` : all.length ? `${all.length} booking-site link(s), none looks like this stay` : 'no booking-site links on this page'}`);
    if (!cands.length && fallbacks > 0 && combos.some((c) => c.until <= Date.now() && !usedEngines.has(c.e))) {
      fallbacks--; qi--; // the same search on an engine not tried for this stay yet
      log(`   nothing that looks like this stay on ${combo.e}: the same search on another engine`);
      continue;
    }
    for (const cand of cands.slice(0, LINKS_PER_PAGE)) {
      const p = cand.p;
      if (skipped.has(p.name) || (cand.url && tried.has(cand.url))) continue;
      tried.add(cand.url || `pick:${cand.label}`);
      let r = await check(combo.b, stay, cand);
      if (r.url && platformOf(r.url)) tried.add(r.url);
      // a site that refuses this browser/connection (Goibibo outside India): same URL in another browser of this worker
      const other = r.unreadable && r.url && BROWSERS.find((b) => b !== combo.b && combos.some((c) => c.b === b && c.until !== Infinity));
      if (other) { log(`     unreadable in ${combo.b} ("${r.title}"), retrying in ${other}`); r = await check(other, stay, { p, url: r.url }); }
      log(`     ${r.ok ? 'MATCH' : r.duplicate ? 'DUPLICATE of an already linked stay' : r.review ? `REVIEW, ${r.review}` : r.unreadable ? 'unreadable' : `no match, ${r.why}`}: ${r.url || cand.label} "${r.title}"`);
      if (r.ok) {
        st.matches++;
        log('   lists:', JSON.stringify(record(stay, 'verified', { platform: r.platform || p.name, url: r.url, note: `page title as shown: "${r.title}"${r.evidence ? `; ${r.evidence}` : ''}`, source: `claude browser search, worker ${SHARD} (${combo.b}/${combo.where})` }) || 'dry run: not touched'));
        return 'verified'; // found: nothing more for this stay
      }
      if (r.duplicate) {
        log('   lists:', JSON.stringify(record(stay, 'duplicate', { log: `same place as ${NAMES[r.duplicate]?.[0] || r.duplicate} (${r.duplicate}), pins ${Math.round(r.d * 1000)} m apart: already listed with ${r.url}` }) || 'dry run: not touched'));
        return 'duplicate';
      }
      if (r.review) {
        log('   lists:', JSON.stringify(recordReview(stay, r) || 'dry run: not touched'));
        return 'review';
      }
      if (r.unreadable) { skipped.add(p.name); log(`     ${p.name} pages will not load here: skipping ${p.name} for this stay`); }
      await jitter(1200, 2200);
    }
    if (st.searches >= MIN_TRIES && st.withLinks / st.searches < MIN_YIELD) {
      rest((c) => c.e === combo.e, Infinity, `${combo.e} is not helping (${st.withLinks}/${st.searches} pages with booking-site links): switched off`);
    }
    // quick pass: once a results page showed links that look like this stay, no further search for now;
    // deep pass (owner, 2026-10-05): go on to the next booking site until one is this stay
    if (cands.length && !DEEP) {
      const skipNote = skipped.size ? `; pages would not load: ${[...skipped].join(', ')}` : '';
      const outcome = skipped.size || !DEEP ? 'retry' : 'none'; // quick pass, or a page that would not load: search again later
      log('   lists:', JSON.stringify(record(stay, outcome, { log: `${DEEP ? 'deep' : 'quick'} pass: links found on search ${searches} (${combo.b}/${combo.where}); opened ${Math.min(cands.length, LINKS_PER_PAGE)} booking-site link(s), none was this stay${skipNote}` }) || 'dry run: not touched'));
      return outcome;
    }
  }
  if (skipped.size) { // a site that would not load: search again later
    log('   lists:', JSON.stringify(record(stay, 'retry', { log: `${DEEP ? 'deep' : 'quick'} pass: ${searches} search(es); pages would not load: ${[...skipped].join(', ')}` }) || 'dry run: not touched'));
    return 'retry';
  }
  const miss = DEEP ? 'none' : 'retry';
  log("   lists:", JSON.stringify(record(stay, miss, { log: `${DEEP ? "deep" : "quick"} pass: ${searches} search(es) (${[...usedEngines].join("/") || ENGINES_ON.join("/")}), no booking-site link that looks like this stay` }) || "dry run: not touched"));
  return miss;
}

// ---- --recheck: re-open saved 'verified' lines, keep only those that still match ----
async function recheck(file) {
  const byKey = Object.fromEntries([...tsv(QUEUE), ...tsv(UNFOUND), ...tsv(FOUND)].map((s) => [s.key, s]));
  const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.split('\t')[1] === 'verified');
  const b = BROWSERS[0];
  let kept = 0;
  for (const l of lines) {
    const [key, , platformName, url] = l.split('\t');
    const stay = byKey[key], p = PLATFORMS.find((x) => x.name === platformName);
    if (!stay || !p) { log(`drop ${key}: unknown stay or platform`); continue; }
    const r = await check(b, stay, { p, url: cleanUrl(url, p.name) });
    log(`${r.ok ? 'KEEP' : r.unreadable ? 'UNREADABLE (dropped)' : 'DROP'} ${stay.name} -> ${p.name} "${r.title}"`);
    if (r.ok) { kept++; record(stay, 'verified', { platform: r.platform || p.name, url: r.url, note: `page title as shown: "${r.title}"`, source: 'claude recheck' }); }
    await jitter(3000, 5000);
  }
  log(`recheck done: kept ${kept}/${lines.length}${DRY ? ' (dry, nothing written)' : ''}`);
}

// ---- main -------------------------------------------------------------------
if (SYNC_ONLY) {
  log('lists:', JSON.stringify(counts()));
} else if (RECHECK) {
  await recheck(RECHECK);
} else {
  log('lists:', JSON.stringify(counts()));
  // each worker takes its share (stay number mod N, stable across restarts) of the unsearched
  // list in random order, then its share of the 'retry' stays
  const mine = (r) => shareOf(r.key) === SHARD - 1 && !OWN_KEYS.has(r.key);
  const fresh = tsv(QUEUE).filter(mine);
  const retry = tsv(UNFOUND).filter((r) => r.status === 'retry' && mine(r));
  const todo = (DEEP ? shuffle(retry) : shuffle(fresh)).slice(OFFSET, OFFSET + LIMIT);
  log(`worker ${SHARD}/${SHARDS}: ${todo.length} stay(s) (${fresh.length} never searched, ${retry.length} retry); browsers ${BROWSERS.join('/')}; engines ${ENGINES_ON.join('/')} = ${combos.length} combinations${PROXY ? `; proxy ${PROXY}` : ''}${DRY ? '; DRY (nothing written)' : ''}`);
  // leftovers of earlier runs (search and booking-site tabs of ours) go before the first search
  for (const b of BROWSERS) { const n = await tidyTabs(b, []); if (n) log(`   ${b}: closed ${n} leftover search/booking tab(s) from earlier runs`); }
  const tally = { verified: 0, duplicate: 0, review: 0, none: 0, retry: 0, manual: 0, unresolved: 0, skipped: 0 };
  let i = 0;
  for (const stay of todo) {
    log(`[${++i}/${todo.length}] ${stay.name} (${stay.city}) key=${stay.key}`);
    const r = await processStay(stay);
    tally[r]++;
    for (const b of BROWSERS) await tidyTabs(b, ourTabs(b).map(([, t]) => t.url()));
    // after the first stay too: a search tab an earlier worker left may already be huge
    if (i % RECYCLE === 0) for (const b of BROWSERS) await freshSearchTab(b).catch((e) => log(`   ${b}: could not swap the search tab (${String(e?.message || e).slice(0, 80)})`));
    log(`   -> ${r}   engines: ${Object.entries(stats).map(([e, s]) => `${e} ${s.matches} found, ${s.withLinks}/${s.searches} pages with links`).join('; ')}`);
    if (r === 'unresolved' && tally.unresolved >= 3 && tally.unresolved === i) { log('first 3 stays all unresolved: the engines are blocking this browser; stopping'); break; }
    await jitter(3000, 6000);
  }
  log('done', JSON.stringify(tally));
}
// attached browsers are yours: only close what this worker launched
await Promise.all(Object.entries(contexts).filter(([b]) => !ATTACH[b]).map(([, c]) => c.close().catch(() => {})));
process.exit(0);
