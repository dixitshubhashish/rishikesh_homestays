// Shared script for every best-<category>-in-rishikesh page.
//
// The lists are already in the HTML (written by scripts/stays/build_pages.py)
// in a fixed order, so search engines, AI crawlers and no-JS visitors see
// every stay. This script only adds filtering, search and regrouping, and it
// downloads the data module (stays-index-data.js) the first time someone
// uses a control, not on page load. #sx-root's data-filter narrows the data:
// "all" | "k:<type>" | "t:<theme tag>".

const PAGE_SIZE = 20; // rows per section before "Show all" on the master page
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inr = (n) => n.toLocaleString('en-IN');

function matchFilter(d, filter) {
  if (!filter || filter === 'all') return true;
  const [kind, value] = filter.split(':');
  return kind === 'k' ? d.ks.includes(value) : d.t.includes(value);
}

// Must stay in step with item_html() in scripts/stays/build_pages.py.
function itemHtml(d) {
  const parts = [d.s ? `<span class="sx-stars-ico">${'★'.repeat(d.s)}</span>` : '<span>Unrated</span>', `<span>${esc(d.a)}</span>`, `<span>${esc(d.k)}</span>`];
  if (d.g) parts.push(`<span>Guests ${d.g}/10${d.c ? ` · ${d.c} reviews` : ''}</span>`);
  if (d.p) parts.push(`<span>From ₹${inr(d.p)}</span>`);
  return `<li class="sx-item"><span class="sx-name">${esc(d.n)}</span><span class="sx-meta">${parts.join('')}</span>` +
    `<a class="sx-go" href="/stay?s=${esc(d.id)}" aria-label="View ${esc(d.n)}">View property</a></li>`;
}

export function setupStaysIndex() {
  const root = $('sx-root');
  const out = $('sx-out');
  if (!root || !out) return;
  const pageFilter = root.dataset.filter || 'all';
  const isMaster = pageFilter === 'all';
  const allTitle = root.dataset.allTitle || 'All stays';
  const state = { q: '', g: isMaster ? 'c' : 'all', stars: new Set(), area: '', kind: '', fac: new Set(), open: new Set() };
  let data = null; // { base, meta } once loaded
  let loading = null;

  const seg = root.querySelector('.sx-seg');
  const syncSeg = () => seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.g === state.g)));
  syncSeg();

  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) {
      root.classList.add('sx-loading');
      loading = import('./stays-index-data.js').then((m) => {
        const base = m.STAYS_INDEX.filter((d) => matchFilter(d, pageFilter));
        data = { base, meta: m.STAYS_INDEX_META };
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
    const { base, meta } = data;
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
      rows.forEach((d) => (groups[d[state.g]] ||= []).push(d));
      sections = Object.keys(groups)
        .sort(state.g === 's' ? (a, b) => b - a : (a, b) => groups[b].length - groups[a].length)
        .map((k) => ({ title: state.g === 's' ? (k === '0' ? 'Unrated' : `${k}-star`) : k, list: groups[k], slug: null }));
    }
    const limit = isMaster && state.g === 'c';
    out.innerHTML = sections.map(({ title, list, slug }) => {
      const key = `${state.g}:${title}`, open = !limit || state.open.has(key);
      const shown = open ? list : list.slice(0, PAGE_SIZE);
      const actions = limit ? [
        list.length > PAGE_SIZE && !open && !slug ? `<button type="button" class="sx-more" data-k="${esc(key)}">Show all ${inr(list.length)}</button>` : '',
        slug ? `<a class="sx-open" href="/best-${slug}-in-rishikesh">View all ${inr(list.length)} ${esc(title.toLowerCase())}</a>` : ''
      ].join('') : '';
      return `<section class="sx-group"><h2>${esc(title)} <span>${inr(list.length)}</span></h2>` +
        `<ul class="sx-list${limit && open && list.length > PAGE_SIZE ? ' sx-scroll' : ''}">${shown.map(itemHtml).join('')}</ul>` +
        `${actions ? `<div class="sx-actions">${actions}</div>` : ''}</section>`;
    }).join('');
  }
}

setupStaysIndex();
