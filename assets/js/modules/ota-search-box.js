// Wired into index.html's search panel (FEAT-4, 2026-10-17): destination
// autocomplete,
// the existing flatpickr date-range picker (reused as-is, see setupDatePickers
// below, copied verbatim from assets/js/modules/search-form.js), and a new
// guests/rooms stepper popover. New file, standalone — does not import or
// modify any production module, so it can be deleted with no effect on the
// live site.
//
// Destination data: the local, free place names already in the repo —
// AREAS (Rishikesh) + CITY_AREAS (Haridwar/Dehradun/Mussoorie), passed in by
// the demo page from assets/js/modules/data.js / city-areas.js. No network
// calls, no paid geocoding API.
//
// Fuzzy matching mirrors assets/js/modules/site-search.js's technique
// (normalise -> tokenise -> optimal-string-alignment edit distance ->
// similarity, with a prefix-match allowance) rather than inventing a new
// algorithm. Reimplemented here (not imported) to keep this prototype fully
// self-contained per the task's "new files only" constraint.

export const MATCH_THRESHOLD = 0.6; // a little looser than site-search's 0.7: short place names, fewer words to disambiguate
const PREFIX_FACTOR = 0.95;

export function normalise(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['''`]/g, '')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim();
}

export function tokenise(text) {
  const s = normalise(text);
  return s ? s.split(' ') : [];
}

// Optimal string alignment distance: Levenshtein plus adjacent transpositions.
export function editDistance(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
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

export function wordSimilarity(q, w) {
  if (q === w) return 1;
  let s = similarity(q, w);
  if (q.length >= 2 && w.length > q.length) {
    s = Math.max(s, similarity(q, w.slice(0, q.length)) * PREFIX_FACTOR);
  }
  return s;
}

// Score a place name against a query: best per-query-word similarity against
// any of the place's own words, averaged, with a bonus for matching every
// query word. A whole-string substring match (typing "ganga" into "Ganga
// Barrage") always wins outright, same as a real OTA's "contains" behaviour.
export function scorePlace(query, placeName) {
  const qWords = tokenise(query);
  if (!qWords.length) return 0;
  const normPlace = normalise(placeName);
  if (normPlace.includes(normalise(query))) return 1;
  const pWords = tokenise(placeName);
  if (!pWords.length) return 0;
  let total = 0;
  for (const qw of qWords) {
    let best = 0;
    for (const pw of pWords) best = Math.max(best, wordSimilarity(qw, pw));
    total += best;
  }
  return total / qWords.length;
}

// entries: [{ name, city }]. Returns matches sorted best-first, each entry
// plus its score, limited to `limit`.
export function suggestDestinations(query, entries, limit = 8) {
  const q = query.trim();
  if (!q) return [];
  return entries
    .map((e) => ({ ...e, score: scorePlace(q, e.name) }))
    .filter((e) => e.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Wiring (DOM). Call once the demo page's markup is in place.

// GEOCODE_ENDPOINT: server-side live lookup (FEAT-3, api/geocode-area.js) for
// a free-text place name that doesn't match anything in the local
// AREAS/CITY_AREAS entries (e.g. a real street or landmark name a visitor
// typed that just isn't one of our curated areas). Debounced so it only
// fires after the visitor stops typing, and only when the local fuzzy match
// came up empty — local matches stay instant with no network round trip.
const GEOCODE_ENDPOINT = '/api/geocode-area';
const GEOCODE_DEBOUNCE_MS = 450;
const GEOCODE_MIN_CHARS = 3;

const CITY_LABELS = { rishikesh: 'Rishikesh', haridwar: 'Haridwar', dehradun: 'Dehradun', mussoorie: 'Mussoorie' };

async function geocodeArea(query) {
  const response = await fetch(`${GEOCODE_ENDPOINT}?q=${encodeURIComponent(query)}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data?.city ? data : null;
}

export function setupDestinationAutocomplete(root, entries) {
  const input = root.querySelector('[data-ota-destination]');
  const list = root.querySelector('[data-ota-destination-list]');
  const hiddenCity = root.querySelector('[data-ota-city]');
  const hiddenArea = root.querySelector('[data-ota-area]');
  if (!input || !list) return;

  let activeIndex = -1;
  let current = [];
  let geocodeTimer = null;
  let lastQuery = '';

  const close = () => { list.hidden = true; list.innerHTML = ''; activeIndex = -1; current = []; };

  const render = (matches, status) => {
    current = matches;
    activeIndex = -1;
    if (!matches.length && !status) { close(); return; }
    const statusRow = status ? `<li class="ota-dest-status" aria-live="polite">${escapeHtml(status)}</li>` : '';
    list.innerHTML = statusRow + matches
      .map((m, i) => `<li role="option" id="ota-dest-opt-${i}" data-index="${i}" data-city="${m.city}" data-name="${escapeHtml(m.name)}">
        <span class="ota-dest-pin" aria-hidden="true">📍</span>
        <span class="ota-dest-name">${escapeHtml(m.name)}</span>
        <span class="ota-dest-city">${escapeHtml(cityLabel(m.city))}</span>
      </li>`)
      .join('');
    list.hidden = false;
  };

  const choose = (m) => {
    input.value = `${m.name}, ${cityLabel(m.city)}`;
    if (hiddenCity) hiddenCity.value = m.city;
    if (hiddenArea) hiddenArea.value = m.name;
    close();
  };

  const runLiveGeocode = (query) => {
    render([], 'Searching OpenStreetMap…');
    geocodeArea(query).then((result) => {
      if (input.value.trim() !== query) return; // stale response, user kept typing
      if (!result) { render([], `No match for "${query}" in Rishikesh, Haridwar, Dehradun or Mussoorie`); return; }
      render([{ name: result.matchedName || query, city: result.city, live: true }]);
    }).catch(() => {
      if (input.value.trim() === query) render([], 'Live search unavailable — try a listed area instead');
    });
  };

  input.addEventListener('input', () => {
    const query = input.value.trim();
    lastQuery = query;
    clearTimeout(geocodeTimer);
    const localMatches = suggestDestinations(query, entries);
    if (localMatches.length || query.length < GEOCODE_MIN_CHARS) {
      render(localMatches);
      return;
    }
    render([], 'Searching…');
    geocodeTimer = setTimeout(() => {
      if (input.value.trim() === query) runLiveGeocode(query);
    }, GEOCODE_DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, current.length - 1);
      highlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlight();
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && current[activeIndex]) {
        e.preventDefault();
        choose(current[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      close();
    }
  });

  function highlight() {
    [...list.children].forEach((li, i) => li.classList.toggle('is-active', i === activeIndex));
    const el = list.children[activeIndex];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-index]');
    if (!li) return;
    const m = current[Number(li.dataset.index)];
    if (m) choose(m);
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) close();
  });
}

function cityLabel(city) {
  const labels = { rishikesh: 'Rishikesh', haridwar: 'Haridwar', dehradun: 'Dehradun', mussoorie: 'Mussoorie' };
  return labels[city] || city;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Guests/rooms stepper popover — new, no equivalent exists in production.

export function setupGuestsSelector(root) {
  const toggle = root.querySelector('[data-ota-guests-toggle]');
  const panel = root.querySelector('[data-ota-guests-panel]');
  const summary = root.querySelector('[data-ota-guests-summary]');
  if (!toggle || !panel || !summary) return;

  const counts = { rooms: 1, adults: 2, children: 0 };
  const limits = { rooms: [1, 8], adults: [1, 16], children: [0, 10] };

  const updateSummary = () => {
    const adultsLabel = `${counts.adults} adult${counts.adults === 1 ? '' : 's'}`;
    const childrenLabel = counts.children ? `, ${counts.children} child${counts.children === 1 ? '' : 'ren'}` : '';
    const roomsLabel = `${counts.rooms} room${counts.rooms === 1 ? '' : 's'}`;
    summary.textContent = `${adultsLabel}${childrenLabel} · ${roomsLabel}`;
  };

  const syncButtons = () => {
    panel.querySelectorAll('[data-step]').forEach((btn) => {
      const key = btn.dataset.key;
      const dir = btn.dataset.step === 'inc' ? 1 : -1;
      const next = counts[key] + dir;
      btn.disabled = next < limits[key][0] || next > limits[key][1];
    });
    panel.querySelectorAll('[data-count-for]').forEach((el) => {
      el.textContent = counts[el.dataset.countFor];
    });
  };

  panel.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const dir = btn.dataset.step === 'inc' ? 1 : -1;
      const [min, max] = limits[key];
      counts[key] = Math.min(max, Math.max(min, counts[key] + dir));
      syncButtons();
      updateSummary();
    });
  });

  const open = () => { panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); };
  const close = () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (panel.hidden) open(); else close();
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !root.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  syncButtons();
  updateSummary();
}

// ---------------------------------------------------------------------------
// Date pickers — copied verbatim (not imported) from
// assets/js/modules/search-form.js so the prototype uses the exact same
// flatpickr config and "no past dates" / "checkout not before checkin" rules,
// per the task instruction to reuse this exactly as-is. Kept as a separate
// function here (rather than importing search-form.js) to keep this file
// fully standalone, as asked.
export function setupDatePickers() {
  if (typeof window.flatpickr !== 'function') return;

  const checkinInput = document.getElementById('ota-checkin');
  const checkoutInput = document.getElementById('ota-checkout');
  if (!checkinInput || !checkoutInput) return;

  const checkoutPicker = window.flatpickr(checkoutInput, {
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'd M Y',
    minDate: 'today'
  });

  window.flatpickr(checkinInput, {
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'd M Y',
    minDate: 'today',
    onChange: (selectedDates) => {
      const chosenCheckin = selectedDates[0];
      if (!chosenCheckin) return;
      const nextDay = new Date(chosenCheckin);
      nextDay.setDate(nextDay.getDate() + 1);
      checkoutPicker.set('minDate', nextDay);

      const currentCheckout = checkoutPicker.selectedDates[0];
      if (currentCheckout && currentCheckout <= chosenCheckin) {
        checkoutPicker.clear();
      }
    }
  });
}
