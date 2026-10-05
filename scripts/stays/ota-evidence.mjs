// Is a booking-site page the same PLACE as one of our stays, beyond its name?
// (owner, 2026-10-05: "fuzzy level to a high extent is fine" — a renamed or misspelt listing is
// accepted when the place itself confirms it: the page's map pin or the address it shows.)
// Shared by google_ota_search.mjs (automatic search) and record_manual.mjs (checks by hand).
//
//   name fits (ota-match's rule)       -> verified, unless the page's pin is over 2 km away (review)
//   name close (fuzzyName) and pin within 250 m, or the page shows the stay's PIN code + village
//                                      -> verified (the note says which evidence)
//   name close, pin within 1 km        -> review (the owner decides)
//   name close in every word, no pin or address to check -> review
//   anything else                      -> not this stay
import { readFileSync } from 'fs';
import { coreWords, MARKETING } from './ota-match.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
export const SAME_PLACE_KM = 0.25, REVIEW_KM = 1, NEAR_KM = 2, ON_PIN_KM = 0.1;

let PLACES = null;
/** key -> { ll: [lat, lng], address } for directory stays (crawl) and Google Maps places (g-<id>) */
export function places() {
  if (PLACES) return PLACES;
  PLACES = {};
  for (const f of ['scripts/stays/.cache/stays.json', 'scripts/stays/.cache/haridwar/stays.json']) {
    try { for (const x of JSON.parse(readFileSync(ROOT + f, 'utf8'))) PLACES[x.id] = { ll: x.ll || null, address: '', street: streetWords(x.ad, x.n), area: /^(elsewhere|outside)\b/i.test(x.a || '') ? '' : (x.a || '') }; } catch { /* no crawl here */ }
  }
  try {
    for (const x of JSON.parse(readFileSync(`${ROOT}scripts/stays/.cache/places/places.json`, 'utf8'))) {
      PLACES[`g-${x.id}`] = { ll: x.lat ? [x.lat, x.lng] : null, address: x.address || '', maps: x.maps || '' };
    }
  } catch { /* no sweep here */ }
  // a pin shared by 3+ stays is a placeholder (an area centre): never used to confirm a place, only to rule out far ones
  const n = {};
  for (const v of Object.values(PLACES)) if (v.ll) n[v.ll.map((x) => x.toFixed(4)).join()] = (n[v.ll.map((x) => x.toFixed(4)).join()] || 0) + 1;
  for (const v of Object.values(PLACES)) if (v.ll && n[v.ll.map((x) => x.toFixed(4)).join()] >= 3) v.coarse = true;
  return PLACES;
}

export function kmBetween(a, b) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

// Words too common around here to tell two places apart on their own.
const COMMON = new Set(('ganga ganges view river shiva shiv yoga divine om shanti krishna ram hari himalaya himalayan grand royal '
  + 'palace residency inn heritage paradise valley hills hill comfort golden sun sunshine green blue white new city holy pure '
  + 'luxury cafe stays stay homestay home house rooms room camp camps resort double single deluxe suite village retreat cottage '
  + 'cottages villa villas guest hostel lodge dharamshala ashram').split(' '));
const words = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/home stay/g, 'homestay').split(/[^a-z0-9]+/).filter(Boolean);
const like = (w, t) => t === w || (w.length >= 4 && (t.startsWith(w) || (w.startsWith(t) && t.length >= 4)))
  || (w.length >= 5 && t.length >= 5 && lev(w, t) <= 2) || (w.length >= 4 && t.length >= 4 && Math.abs(w.length - t.length) <= 1 && lev(w, t) <= 1);

/** The stay's distinctive words found (spelling slips allowed) in a page's title, address slug or text. */
export function fuzzyName(stayName, text) {
  // marketing words inside the name ("Tapasya Homestay budget accommodation") do not have to be on the page
  const all = coreWords(stayName), strong = all.filter((w) => !MARKETING.has(w));
  const core = strong.length ? strong : all;
  const got = words(text);
  const shared = core.filter((w) => got.some((t) => like(w, t)));
  const distinctive = shared.some((w) => !COMMON.has(w));
  // a one-word name ("Amigos") only counts in full when that word is on the page exactly and is not short
  const single = core.length === 1 && core[0].length >= 6 && got.includes(core[0]);
  const exact = core.length > 0 && core.every((w) => got.includes(w));
  return { core, shared, exact, all: core.length > 0 && shared.length === core.length && distinctive && (core.length >= 2 || single), ok: core.length > 0 && shared.length * 2 >= core.length && distinctive };
}

// The crawl's street address, cleaned: without the stay's own name, towns, areas, ghats and highways (words found on
// every page's "nearby" list), so two of what is left really point at the street (critics of the 2026-10-05 lessons).
const PLACE_WORDS = new Set(('rishikesh haridwar hardwar tapovan laxman lakshman jhula swarg ashram muni reti ghat ghats ganga ganges triveni parmarth '
  + 'niketan pauri kankhal jwalapur bhupatwala bhoopatwala ranipur sidcul shivpuri neelkanth badrinath kedarnath delhi dehradun bypass highway '
  + 'national uttarakhand india tehri garhwal near opposite behind beside upper lower').split(' '));
function streetWords(address, name) {
  if (!address) return [];
  const own = new Set(words(name || ''));
  return [...new Set(words(address.replace(/\b\d{6}\b/g, ' ')))].filter((w) => w.length >= 5 && !own.has(w) && !PLACE_WORDS.has(w) && !/^\d/.test(w));
}
const ADDRESS_NOISE = new Set(('uttarakhand india rishikesh haridwar hardwar dehradun tehri garhwal pauri district block road marg near '
  + 'opposite opp post office village vill po ps teh tehsil main lane gali street mohalla colony nagar ward no number').split(' '));
/** The page shows the stay's PIN code and one of its own address words (village, street, landmark). */
export function addressMatch(address, pageText) {
  if (!address || !pageText) return { ok: false };
  const pin = (address.match(/\b(2[0-9]{5})\b/) || [])[1];
  const own = [...new Set(words(address.replace(/\b\d{6}\b/g, ' ')))].filter((w) => w.length >= 4 && !ADDRESS_NOISE.has(w) && !/^\d/.test(w));
  const page = new Set(words(pageText));
  const hits = own.filter((w) => page.has(w));
  return { ok: Boolean(pin && pageText.includes(pin) && hits.length), pin, hits };
}

// The page names the stay's town or its area ("Tapovan", "Bhupatwala", "Laxman Jhula"...), or the village of its address.
const TOWNS = { rishikesh: ['rishikesh', 'rishīkesh', 'tapovan', 'laxman jhula', 'lakshman jhula', 'ram jhula', 'swarg ashram', 'muni ki reti', 'shivpuri', 'neelkanth', 'mohan chatti', 'mohanchatti'],
  haridwar: ['haridwar', 'hardwar', 'har ki pauri', 'kankhal', 'jwalapur', 'bhupatwala', 'bhoopatwala', 'ranipur', 'bhel', 'sidcul', 'bahadrabad', 'motichur', 'shantikunj'] };
export function placeNamed({ city, area, address }, pageText) {
  const t = ` ${words(pageText || '').join(' ')} `;
  const has = (x) => x && t.includes(` ${words(x).join(' ')} `);
  if (area && has(area.split('&')[0])) return `the page names its area (${area})`;
  const own = address ? [...new Set(words(address.replace(/\b\d{6}\b/g, ' ')))].filter((w) => w.length >= 4 && !ADDRESS_NOISE.has(w)) : [];
  const village = own.find((w) => t.includes(` ${w} `));
  if (village) return `the page names its locality (${village})`;
  const town = (TOWNS[city] || []).find(has);
  return town ? `the page names its town (${town})` : '';  // weakest: only with an exactly spelt name (judge)
}

/**
 * key, name: our stay; nameOk: ota-match's verdict on the page title; title, urlPath, pageLL ([lat, lng] or
 * null), pageText (the page's visible text, for its address).
 * -> { verdict: 'verified' | 'review' | 'reject', why, km }
 */
export function judge({ key, name, city = '', nameOk, title, urlPath = '', pageLL = null, pageText = '' }) {
  const me = places()[key] || {};
  const dAll = pageLL && me.ll ? kmBetween(me.ll, pageLL) : null;
  const d = me.coarse && dAll !== null && dAll <= NEAR_KM ? null : dAll; // a placeholder pin only rules out far pages
  // OYO's own numbers identify the property: two different numbers are two different hotels
  const oyoNo = (x) => (String(x).match(/\b(?:oyo|capital o|collection o|townhouse|spot on|flagship|silverkey)\s*(\d{3,})\b/i) || [])[1];
  if (oyoNo(name) && oyoNo(title) && oyoNo(name) !== oyoNo(title)) return { verdict: 'reject', why: `a different OYO property (${oyoNo(title)}, ours ${oyoNo(name)})`, km: d };
  // a page that sits in another town (its address or link says so) is not this stay
  const elsewhere = /\b(mussoorie|dehradun city|delhi|noida|gurgaon|nainital|manali|shimla|mukteshwar|jim corbett|kasauli|chandigarh|agra|jaipur|varanasi)\b/i;
  if (elsewhere.test(`${urlPath} ${title}`) && !elsewhere.test(name)) return { verdict: 'reject', why: `the page is in another town (${(`${urlPath} ${title}`.match(elsewhere) || [])[0]})`, km: d };
  const where = d === null ? '' : `map pin ${d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`} from this stay`;
  if (nameOk) {
    if (d !== null && d > NEAR_KM) return { verdict: 'review', why: `name fits but the page's ${where}`, km: d };
    return { verdict: 'verified', why: where ? `name fits, ${where}` : 'name fits', km: d };
  }
  const fz = fuzzyName(name, `${title} ${urlPath.replace(/[-_/.]+/g, ' ')}`);
  // right on our pin (within 100 m), a name of common words is enough ("Hotel Shiva Palace", 0 m)
  if (d !== null && d <= ON_PIN_KM && fz.shared.length && fz.shared.length * 2 >= fz.core.length) return { verdict: 'verified', why: `same name words [${fz.shared}], ${where}`, km: d };
  if (!fz.ok) return { verdict: 'reject', why: `name too different (shared [${fz.shared}] of [${fz.core}])`, km: d };
  // every distinctive word of the name, and the page names its area, locality or town: the same place
  const named = placeNamed({ city, area: me.area, address: me.address }, `${title} ${pageText}`);
  // the town alone only backs an exactly spelt name ("Krishn Kunj" is not "Krishna Kunj" on the town's say-so)
  if (fz.all && named && (fz.exact || !named.includes('its town')) && (d === null || d <= NEAR_KM)) return { verdict: 'verified', why: `name matches in every word [${fz.shared}] and ${named}${where ? `, ${where}` : ''}`, km: d };
  const addr = addressMatch(me.address, pageText);
  if (d !== null && d <= SAME_PLACE_KM) return { verdict: 'verified', why: `similar name (shared [${fz.shared}]), ${where}`, km: d };
  if (addr.ok && (d === null || d <= NEAR_KM)) return { verdict: 'verified', why: `similar name (shared [${fz.shared}]), the page shows its address (PIN ${addr.pin}, ${addr.hits.join(', ')})`, km: d };
  if (d !== null && d <= REVIEW_KM) return { verdict: 'review', why: `similar name (shared [${fz.shared}]), ${where}`, km: d };
  const street = (me.street || []).filter((w) => words(pageText).includes(w));
  if (fz.all && street.length >= 2 && (d === null || d <= NEAR_KM)) return { verdict: 'review', why: `name matches in every word [${fz.shared}] and the page shows our street words (${street.join(', ')})`, km: d };
  if (d === null && fz.all) return { verdict: 'review', why: `similar name in every word (shared [${fz.shared}]) but no map pin or address on the page to confirm it`, km: d };
  return { verdict: 'reject', why: `similar name (shared [${fz.shared}]) but ${where || 'nothing on the page confirms the place'}`, km: d };
}
