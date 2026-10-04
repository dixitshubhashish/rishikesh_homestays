// Shared script for every best-<category>-in-<city> page (Rishikesh by default).
//
// The lists are already in the HTML (written by scripts/stays/build_pages.py)
// in a fixed order, so search engines, AI crawlers and no-JS visitors see
// every stay. This script only adds filtering, search and regrouping, and it
// downloads the data module (stays-index-data.js) the first time someone
// uses a control, not on page load. #sx-root's data-filter narrows the data:
// "all" | "k:<type>" | "t:<theme tag>" | "b:<min>-<max>" (bedrooms).

// City of this page (#sx-root data-city; Rishikesh by default): picks the
// data module and adds &c=<city> to /stay links for cities other than Rishikesh.
let CQ = '';
const PAGE_SIZE = 20; // rows per section before "Show all" on the master page
// Stays with a verified booking link (d.o) come first and are listed directly; the rest
// wait behind "View all". A list with fewer is topped up to SHOW_MIN. In step with
// SHOW_MIN / split_shown() in scripts/stays/build_pages.py.
const SHOW_MIN = 10;
const shownCount = (list) => Math.max(list.filter((d) => d.o).length, Math.min(SHOW_MIN, list.length));
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = (n) => n.toLocaleString('en-IN');

// Search-phrase pages (scripts/stays/search_pages.py) filter with a small rule language
// ("home & price<3000", "hotel & near:laxman-jhula:1.5", ...); this mirrors rule_matches() there.
let META = null; // the data module's meta: kinds, landmarks, riverside areas
const OYO = /\b(oyo|townhouse|capital o|collection o|spot on|flagship|silverkey|hotel o)\b/i;
const km = (a, b) => {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
function ruleMatches(d, rule) {
  return rule.split(' & ').map((c) => c.trim()).every((c) => {
    if (c === 'any') return true;
    if (META.kinds[c]) return d.ks.some((k) => META.kinds[c].includes(k));
    let m = c.match(/^price(<=|<)(\d+)$/);
    if (m) return !!d.p && (m[1] === '<=' ? d.p <= +m[2] : d.p < +m[2]);
    m = c.match(/^stars(>=|=)(\d)$/);
    if (m) return m[1] === '>=' ? (d.s || 0) >= +m[2] : (d.s || 0) === +m[2];
    if (c.startsWith('kind:')) return d.ks.includes(c.slice(5));
    if (c === 'top10') return true; // the ranking itself is in load()
    if (c.startsWith('area:')) return d.a === c.slice(5);
    if (c.startsWith('near:')) {
      const [, slug, dist] = c.split(':');
      return !!d.ll && !!META.landmarks[slug] && km(d.ll, META.landmarks[slug]) <= +dist;
    }
    const f = d.f || [];
    switch (c) {
      case 'priced': return !!d.p;
      case 'river': return d.t.includes('ganga') || META.river.includes(d.a);
      case 'gangaview': return d.t.includes('ganga');
      case 'family': return d.t.includes('family') || d.t.includes('pool') || (d.bd || 0) >= 2 || d.ks.some((k) => ['Resorts', 'Villas', 'Holiday rentals'].includes(k));
      case 'kitchen': case 'pool': case 'luxury': return d.t.includes(c);
      case 'wedding': return f.includes('Meeting/ Banquet facilities') || (d.ks.includes('Resorts') && f.includes('Garden area'));
      case 'oyo': return OYO.test(d.n);
      case 'linked': return !!d.o;
      default: return false;
    }
  });
}
// Price bands for "price" pages, in step with PRICE_BANDS in search_pages.py.
const BANDS = [[1000, 'Under ₹1,000'], [2000, '₹1,000 to ₹2,000'], [3000, '₹2,000 to ₹3,000'], [5000, '₹3,000 to ₹5,000'], [null, '₹5,000 and up']];
const band = (p) => (BANDS.find(([cap]) => cap === null || p < cap) || BANDS[BANDS.length - 1])[1];
// Distance bands for "near <place>" pages, in step with DIST_BANDS in build_pages.py.
const DBANDS = [[0.5, 'Under 500 m'], [1, '500 m to 1 km'], [2, '1 to 2 km'], [3, '2 to 3 km'], [null, '3 km and more']];
const dband = (k) => DBANDS.find(([top]) => top === null || k <= top)[1];

function matchFilter(d, filter) {
  if (!filter || filter === 'all') return true;
  if (filter.startsWith('q:')) return ruleMatches(d, filter.slice(2));
  const [kind, value] = filter.split(':');
  if (kind === 'b') { // bedrooms "b:<min>-<max>"; unknown size never matches
    const [lo, hi] = value.split('-').map(Number);
    return d.bd != null && d.bd >= lo && d.bd <= hi;
  }
  return kind === 'k' ? d.ks.includes(value) : d.t.includes(value);
}
// Category title for running text, keeping "BHK" (lc() in build_pages.py).
const lc = (t) => t.toLowerCase().replace(/\bbhk\b/g, 'BHK');

// Our stays mixed into every list: after the 3rd row, then every 7th,
// rotating; in hostel lists pitched as the private, not-shared option.
// Must stay in step with mix_html() in scripts/stays/build_pages.py.
const MIX_FIRST = 3, MIX_EVERY = 7;
const PRIVATE_ALT = ['k:Hostels', 't:backpacker']; // lists where ours read as "Private stay"
// Same look as every other row; real guest rating only, and only if 9+.
function ownMixHtml(o, isPrivate) {
  const parts = ['<span>Unrated</span>', `<span>${esc(o.a)}</span>`, `<span>${isPrivate ? 'Private stay' : esc(o.k)}</span>`];
  if (o.g >= 9) parts.push(`<span>Guests ${o.g}/10${o.c ? ` · ${o.c} reviews` : ''}</span>`);
  if (o.p) parts.push(`<span>Starting ₹${inr(o.p)} onwards</span>`);
  return `<li class="sx-item"><span class="sx-name">${esc(o.n)}</span><span class="sx-meta">${parts.join('')}</span>` +
    `<a class="sx-go" href="${esc(o.u)}">View property</a></li>`;
}
function mixHtml(items, own, isPrivate) {
  let k = 0;
  return items.map((d, idx) => {
    const i = idx + 1;
    const mix = own.length && i < items.length && (i === MIX_FIRST || (i > MIX_FIRST && (i - MIX_FIRST) % MIX_EVERY === 0));
    return itemHtml(d) + (mix ? ownMixHtml(own[k++ % own.length], isPrivate) : '');
  }).join('');
}

// Must stay in step with item_html() in scripts/stays/build_pages.py.
function itemHtml(d) {
  const parts = [d.s ? `<span class="sx-stars-ico">${'★'.repeat(d.s)}</span>` : '<span>Unrated</span>', `<span>${esc(d.a)}</span>`, `<span>${esc(d.k)}</span>`];
  if (d.g) parts.push(`<span>Guests ${d.g}/10${d.c ? ` · ${d.c} reviews` : ''}</span>`);
  if (d.p) parts.push(`<span>Starting ₹${inr(d.p)} onwards</span>`);
  return `<li class="sx-item"><span class="sx-name">${esc(d.n)}</span><span class="sx-meta">${parts.join('')}</span>` +
    `<a class="sx-go" href="/hotels/stay?s=${esc(d.id)}${CQ}" aria-label="View ${esc(d.n)}">View property</a></li>`;
}

export function setupStaysIndex() {
  const root = $('sx-root');
  const out = $('sx-out');
  if (!root || !out) return;
  const pageFilter = root.dataset.filter || 'all';
  const city = root.dataset.city || 'rishikesh';
  CQ = city === 'rishikesh' ? '' : `&c=${city}`;
  const isMaster = pageFilter === 'all';
  const allTitle = root.dataset.allTitle || 'All stays';
  const state = { q: '', g: root.dataset.group || (isMaster ? 'c' : 'all'), stars: new Set(), area: '', kind: '', fac: new Set(), open: new Set() };
  let data = null; // { base, meta } once loaded
  let loading = null;

  const seg = root.querySelector('.sx-seg');
  const syncSeg = () => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === state.g)));
  syncSeg();

  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) {
      root.classList.add('sx-loading');
      loading = import(city === 'rishikesh' ? './stays-index-data.js' : `./stays-index-data-${city}.js`).then((m) => {
        META = m.STAYS_INDEX_META;
        let base = m.STAYS_INDEX.filter((d) => matchFilter(d, pageFilter));
        // "Top 10" pages: the 10 best guest scores with enough reviews, ranked (select() in search_pages.py)
        if (/\btop10\b/.test(pageFilter)) {
          base = base.filter((d) => d.g && (d.c || 0) >= 5).sort((a, b) => b.g - a.g || (b.c || 0) - (a.c || 0) || a.n.localeCompare(b.n))
            .slice(0, 10).map((d, i) => ({ ...d, n: `${i + 1}. ${d.n}` }));
        }
        data = { base, meta: m.STAYS_INDEX_META, own: /\btop10\b/.test(pageFilter) ? [] : m.STAYS_OWN };
        buildControls(base);
        root.classList.remove('sx-loading');
        return data;
      });
    }
    return loading;
  }

  function tally(base, key) {
    return base.reduce((m, d) => ((m[d[key]] = (m[d[key]] || 0) + 1), m), {});
  }

  function buildControls(base) {
    const stars = tally(base, 's');
    $('sx-stars').innerHTML = [5, 4, 3, 2, 1, 0].filter((s) => stars[s])
      .map((s) => `<button type="button" class="sx-chip" data-s="${s}" aria-pressed="${state.stars.has(s)}">${s ? `${s}★` : 'Unrated'} <small>${stars[s]}</small></button>`).join('');
    const options = (obj, all, current) => `<option value="">${all}</option>` +
      Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<option value="${esc(k)}"${k === current ? ' selected' : ''}>${esc(k)} (${v})</option>`).join('');
    $('sx-area').innerHTML = options(tally(base, 'a'), 'All areas', state.area);
    const kinds = {};
    base.forEach((d) => d.ks.forEach((k) => (kinds[k] = (kinds[k] || 0) + 1)));
    $('sx-kind').innerHTML = options(kinds, 'All types', state.kind);
    const facCount = {};
    base.forEach((d) => d.f.forEach((f) => (facCount[f] = (facCount[f] || 0) + 1)));
    $('sx-fac').innerHTML = Object.entries(facCount).sort((a, b) => b[1] - a[1]).slice(0, 14)
      .map(([f]) => `<button type="button" class="sx-chip" data-f="${esc(f)}" aria-pressed="${state.fac.has(f)}">${esc(f)}</button>`).join('');
  }

  // Controls exist in the HTML from the start; the first interaction loads
  // the data, then re-renders.
  const act = (fn) => (e) => { fn(e); load().then(render); };
  const warm = () => { load(); };
  ['focusin', 'pointerdown'].forEach((ev) => root.querySelector('.sx-controls').addEventListener(ev, warm, { once: true }));

  seg.addEventListener('click', act((e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.g = b.dataset.g; syncSeg();
  }));
  $('sx-stars').addEventListener('click', act((e) => {
    const b = e.target.closest('button'); if (!b) return;
    const s = Number(b.dataset.s); state.stars.has(s) ? state.stars.delete(s) : state.stars.add(s);
    b.setAttribute('aria-pressed', String(state.stars.has(s)));
  }));
  $('sx-fac').addEventListener('click', act((e) => {
    const b = e.target.closest('button'); if (!b) return;
    const f = b.dataset.f; state.fac.has(f) ? state.fac.delete(f) : state.fac.add(f);
    b.setAttribute('aria-pressed', String(state.fac.has(f)));
  }));
  $('sx-q').addEventListener('input', act((e) => { state.q = e.target.value.trim().toLowerCase(); }));
  $('sx-area').addEventListener('change', act((e) => { state.area = e.target.value; }));
  $('sx-kind').addEventListener('change', act((e) => { state.kind = e.target.value; }));
  $('sx-clear').addEventListener('click', act(() => {
    Object.assign(state, { q: '', area: '', kind: '' }); state.stars.clear(); state.fac.clear();
    $('sx-q').value = ''; $('sx-area').value = ''; $('sx-kind').value = '';
    root.querySelectorAll('.sx-chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
  }));
  out.addEventListener('click', (e) => {
    const b = e.target.closest('.sx-more'); if (!b) return;
    state.open.add(b.dataset.k);
    load().then(render);
  });

  function render() {
    const { base, meta, own } = data;
    const rows = base.filter((d) =>
      (!state.q || d.n.toLowerCase().includes(state.q)) && (!state.stars.size || state.stars.has(d.s)) &&
      (!state.area || d.a === state.area) && (!state.kind || d.ks.includes(state.kind)) &&
      [...state.fac].every((f) => d.f.includes(f)));
    if (!rows.length) {
      out.innerHTML = '<p class="sx-empty">No stays match these filters. Remove a facility or star filter, or press Clear all.</p>';
      return;
    }
    let sections;
    if (state.g === 'c') {
      sections = meta.sections.map((sec) => ({ ...sec, list: rows.filter((d) => matchFilter(d, sec.filter)) })).filter((sec) => sec.list.length);
    } else if (state.g === 'all') {
      sections = [{ title: allTitle, list: rows, slug: null }];
    } else {
      const groups = {};
      // by type on a search page: the page's own kinds first (in step with build_pages.py)
      const ruleKinds = pageFilter.startsWith('q:') ? pageFilter.slice(2).split(' & ').map((t) => META.kinds[t.trim()]).find(Boolean) : null;
      const near = pageFilter.startsWith('q:') ? pageFilter.slice(2).split(' & ').find((t) => t.trim().startsWith('near:')) : null;
      const here = near ? META.landmarks[near.trim().split(':')[1]] : null;
      const keyOf = state.g === 'd' ? (d) => (here && d.ll ? dband(km(here, d.ll)) : DBANDS[DBANDS.length - 1][1])
        : state.g === 'pb' ? (d) => (d.p ? band(d.p) : 'No price listed')
        : state.g === 'k' && ruleKinds ? (d) => d.ks.find((k) => ruleKinds.includes(k)) || d.k : (d) => d[state.g];
      rows.forEach((d) => (groups[keyOf(d)] ||= []).push(d));
      const bandOrder = state.g === 'd' ? DBANDS.map((b) => b[1]) : [...BANDS.map((b) => b[1]), 'No price listed'];
      sections = Object.keys(groups)
        .sort(state.g === 's' ? (a, b) => b - a : state.g === 'pb' || state.g === 'd' ? (a, b) => bandOrder.indexOf(a) - bandOrder.indexOf(b) : (a, b) => groups[b].length - groups[a].length)
        .map((k) => ({ title: state.g === 's' ? (k === '0' || k === 'undefined' ? 'Unrated' : `${k}-star`) : k, list: groups[k], slug: null }));
    }
    const limit = isMaster && state.g === 'c';
    out.innerHTML = sections.map(({ title, plural, list, slug, filter }) => {
      const key = `${state.g}:${title}`, open = state.open.has(key);
      const size = limit ? PAGE_SIZE : shownCount(list);
      const shown = open ? list : list.slice(0, size);
      const actions = limit ? [
        list.length > PAGE_SIZE && !open && !slug ? `<button type="button" class="sx-more" data-k="${esc(key)}">Show all ${inr(list.length)}</button>` : '',
        slug ? `<a class="sx-open" href="/hotels/best-${slug}-in-${root.dataset.city || 'rishikesh'}">View all ${inr(list.length)} ${esc(plural || lc(title))}</a>` : ''
      ].join('') : (list.length > size && !open ? `<button type="button" class="sx-more" data-k="${esc(key)}">View all ${inr(list.length)}</button>` : '');
      return `<section class="sx-group"><h2>${esc(title)} <span>${inr(list.length)}</span></h2>` +
        `<ul class="sx-list${limit && open && list.length > PAGE_SIZE ? ' sx-scroll' : ''}">${mixHtml(shown, own, PRIVATE_ALT.includes(pageFilter) || PRIVATE_ALT.includes(filter))}</ul>` +
        `${actions ? `<div class="sx-actions">${actions}</div>` : ''}</section>`;
    }).join('');
  }
}

setupStaysIndex();

// Category filters sidebar: open on wide screens, folded into a "Filter stays"
// button on phones so the stays come first.
const filters = document.querySelector('details.sx-filters');
if (filters && window.matchMedia('(max-width: 900px)').matches) filters.open = false;
