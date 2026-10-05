// Name and URL rules for google_ota_search.mjs: is a booking-site page (by its
// title) the same stay as a directory entry, and what is that page's generic URL?
// Kept apart from the browser code so tests/scripts/ota-match.test.js can pin it
// down with real cases. A wrong link sends a guest to the wrong hotel; a missed one
// costs nothing (the site still takes the lead), so every doubt is a "no".
import { words, STOP } from './booking-match.mjs';

// Chain/brand words (and a chain's tier) say nothing about which stay it is
// ("Perfectstayz Value Alpine" is not "Perfectstayz Value Hills"): never required, never "extra".
export const BRANDS = new Set(('perfectstayz perfect stayz value goroomgo oyo o spot fabhotel fabhotels fabexpress fab treebo townhouse ' +
  'collection capital flagship silverkey itsy zostel hosteller moustache bloomrooms bloom sitara aj group economy premium stayvista ihcl seleqtions').split(' '));
// Unit/type words: a name and a title that each name a unit and share none are different
// units ("Skyard Premium" vs "Skyard Hostel").
const UNITS = new Set('aparthotel hostel hostels premium retreat retreats villa villas cottage cottages camp camps resort resorts homestay homestays apartment apartments suites inn lodge dharamshala ashram aashram'.split(' '));
// Kinds of stay, judged on the title's name part (MakeMyTrip/Goibibo append their own category after it).
const KINDS = new Set('hostel hostels villa villas cottage cottages camp camps resort resorts homestay homestays apartment apartments suites inn lodge dharamshala ashram aashram retreat retreats hotel hotels home homes house stays guesthouse'.split(' '));
const HOTELISH = new Set('hotel hotels resort resorts inn lodge guesthouse suites retreat retreats palace'.split(' '));
// Words a booking site adds around the name ("Deals, Photos & Reviews", "Best Price on …").
const PAGE_WORDS = new Set('best price deals photos photo reviews review offer offers updated prices book now rooms dorms address india uttarakhand trivago compare trip com'.split(' '));
// Glue: free anywhere.
const GLUE = new Set('the a an and of by in at on to for hotel hotels stay stays bed breakfast bnb'.split(' '));
// Address words: never part of a name ("Hotel Ganga Azure@ Har Ki Pauri Road" is "Ganga Azure Hotel").
const LOCATION = new Set('road station railway har ki ke pauri harkipauri ghat jhula chowk marg bypass sector near min mins minute minutes from walk walking distance opposite opp behind main market km kms mtr mtrs meters metres uttarakhand india dehradun'.split(' '));
// Marketing words in a name's later parts ("– Prime Location – Luxury and Spacious Room").
export const MARKETING = new Set(('prime location luxury luxurious spacious best top rated selling property star four five three ' +
  'free parking lift kitchen wifi pool swimming garden tropical aesthetic mountain mountains netflix pottery studio ' +
  'airport pickup nights night point river ganga ganges view views ac room rooms family budget new pure deluxe ' +
  'clean comfortable cozy cosy beautiful amazing awesome perfect calm peaceful quiet scenic stunning private ' +
  'furnished fully member spa cafe rooftop terrace balcony bbq shared jacuzzi sauna gym equipped tranquil area ' +
  'staycation forest award winner accommodation chain veg vegetarian couple friendly dining facing').split(' '));
const CITY_WORDS = {
  rishikesh: /rish[iī]kesh|tapovan|lakshman|laxman|muni ki reti|shivpuri|narendra ?nagar|swarg|raiwala|byasi|kaudiyala|neelkanth|yamkeshwar|mohan ?chatti/i,
  haridwar: /har[iī]dw[aā]r|hardwar|kankhal|jwalapur|bhupatwala|bahadrabad|roorkee|motichur|raiwala/i,
};
const plain = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // "Rishīkesh" -> "Rishikesh"
const townIn = (city, s) => (CITY_WORDS[city] || CITY_WORDS.rishikesh).test(plain(s));
const isTownWord = (w) => /^(?:rishikesh|haridwar|hardwar|tapovan|lakshman|laxman|shivpuri|swarg|raiwala|byasi|kaudiyala|neelkanth|yamkeshwar|kankhal|jwalapur|bhupatwala|bahadrabad|roorkee|motichur|muni|reti)$/.test(w);

// A possessive is the word itself ("Sushma's Homestay" is "Sushma Homestay"), never a word "s";
// dharmshala / dharmsala / dharamsala are one word.
const unPossess = (s) => s.replace(/([a-z0-9])['’ʼ`]s\b/gi, '$1').replace(/\bdhar?a?m\s?sh?ala\b/gi, 'dharamshala');

// Tokens of every length ("KG", "Om", "W", "Pi" identify stays too): "2 BHK"/"2-BHK" -> "2bhk",
// "K G"/"J.P." -> "kg"/"jp".
export function tokens(s) {
  const out = [];
  const num = { one: 1, two: 2, three: 3, four: 4, five: 5 }; // "Two-Bedroom" is a 2bhk too (unit clash check)
  s = unPossess(s).replace(/\b(one|two|three|four|five|\d)[\s-]*bed(?:room)?s?\b/gi, (m, n) => `${num[n.toLowerCase()] || n}bhk`);
  for (const w of words(s.replace(/\b0*(\d)\s*-?\s*bhk\b/gi, '$1bhk'))) {
    const prev = out[out.length - 1];
    if (/^[a-z]$/.test(w) && prev?.single) { prev.w += w; continue; }
    out.push({ w, single: /^[a-z]$/.test(w) });
  }
  return out.map((t) => t.w);
}
const isId = (w) => /^\d{4,}$/.test(w), isBhk = (w) => /^\d+bhk$/.test(w);
const neutral = (w) => STOP.has(w) || GLUE.has(w) || BRANDS.has(w) || UNITS.has(w) || LOCATION.has(w) || isId(w) || isBhk(w);

// A later part of the name counts only if it names something: it does not open like a
// tagline and has a word that is not generic, marketing or an address.
const TAGLINE = /^(?:a|an|best|top|the best|luxury|budget|free|walking|new|family|pure|deluxe|near|opp|opposite|member|fully|no)\b|\b(?:star|property|selling|rated)\b|\b\d+\s*(?:km|kms|min|mins|minutes?|mtrs?|meters?|metres?|adults?|guests?|persons?|people|pax|child|children|kids?|beds?)\b|\b(?:one|two|three|four|five|\d+)[\s-]*(?:bedroom|bed)s?\b|\bdouble bed\b|\b(?:double|single|twin|triple|deluxe|superior|standard|family|premium)\s+(?:room|apartment|suite|cottage|villa)\b/i;
const naming = (part) => !TAGLINE.test(part) && tokens(part).some((w) => !neutral(w) && !MARKETING.has(w));
const CUT = /\s+(?:near|opposite|opp\.?|with|walking distance|close to|behind|next to|formerly)\s+/i;

// "The Ramawati – A Four Star Luxury Hotel near Ganga Ghat" -> "The Ramawati"
// "Around Stays – Shanti Villas, Tapovan"                  -> "Around Stays Shanti Villas"
// "Hotel – Montreal Rishikesh Madhuban Inn"                -> "Hotel Montreal Rishikesh Madhuban Inn"
export function coreName(name) {
  name = name.split(/[#!]/)[0] // hashtags and "!" taglines are marketing
    .replace(/\b((?:oyo|collection o|capital o|townhouse|spot on)(?: townhouse)?)\s+\d{3,}\b/gi, '$1') // OYO's own numbers
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ');
  const head = name.split(CUT)[0];
  // a full stop before a capital starts a new part too: "Krishna Kunj Homestay Rishikesh. A Family Friendly Homestay at Best Price"
  const parts = head.split(/\s+[–—|-]\s+|,|\(|\)|\.\s+(?=[A-Z])/).map((p) => p.trim()).filter(Boolean);
  let first = 0; // a first part with no name in it ("Hotel") takes the next one
  const named = (p) => tokens(p).some((w) => !neutral(w) && !isTownWord(w));
  while (first < parts.length - 1 && !named(parts[first]) && named(parts[first + 1])) first++;
  const core = [...parts.slice(0, first + 1), ...parts.slice(first + 1).filter(naming)].join(' ').replace(/\s+/g, ' ').trim();
  return core || parts.join(' ');
}

// The words of a stay's core name that must all be on the page. A name of nothing but
// generic/chain words ("Zostel Rishikesh", "Hotel Laxman Ganga") falls back to those words;
// a name with no word at all ("Homestay") can never be matched and is never searched.
export function coreWords(name) {
  const t = [...new Set(tokens(coreName(name)))];
  const own = t.filter((w) => !neutral(w));
  if (own.length) return own;
  const generic = t.filter((w) => !GLUE.has(w) && !UNITS.has(w) && !isId(w) && !LOCATION.has(w));
  const noCity = generic.filter((w) => !/^(?:rishikesh|haridwar|hardwar)$/.test(w)); // the town is checked on its own
  return noCity.length ? noCity : generic;
}

// The title's own name part: no site wrapping ("Best Price on … in Town + Reviews!",
// ", Town (updated prices …)", "𝗕𝗢𝗢𝗞 …", ": Reviews…") and no "near …/with …" tail.
function titleHead(title) {
  const goibibo = /\s-\s+reviews,\s*photos\s*&\s*offer/i.test(title);
  // Booking.com: "<name, which may hold commas>, <town> (updated prices …)": only the last part is the town
  const booking = /\(updated prices/i.test(title);
  const head = title.replace(/^best price on /i, '')
    .replace(/\s*\(updated prices.*$/i, '').replace(booking ? /,[^,]*$/ : /$^/, '')
    .replace(/\s+in\s+[^+]*\+\s*reviews!?.*$/i, '')                          // Agoda "… in Town + Reviews!"
    .replace(/\s+[-–]\s+(?:reviews|deals|photos|hotel reviews|book|compare)\b.*$/i, '') // Goibibo, Agoda, Trivago
    .replace(/:\s+(?:reviews|price|photos)\b.*$/i, '')                         // EaseMyTrip
    .split(/\s*\|\s*|[\u{1D400}-\u{1D7FF}]/u)[0]                               // Agoda "| 2026 …", MakeMyTrip "𝗕𝗢𝗢𝗞 …"
    .split(booking ? /\(/ : /,|\(/)[0]                                            // ", Town" / "(Town)"
    .split(CUT)[0]
    .trim();
  // Goibibo files the stay as "<name> Hotel <Town> - Reviews, Photos & Offer": that kind + town is its label
  return goibibo ? head.replace(/\s+(?:hotel|homestay|home stay|resort|guest ?house|hostel|villa|apartment|cottage|camp|lodge|dharamshala|a+shram)?\s*(?:rish[iī]kesh|har[iī]dw[aā]r|hardwar)$/i, '').trim() : head;
}
const kindsOf = (s) => words(s.replace(/guest\s*house/gi, 'guesthouse').replace(/home\s+stay\b/gi, 'homestay')).filter((w) => KINDS.has(w));
const base = (k) => (k === 'aashram' ? 'ashram' : k.replace(/s$/, ''));
const sameKind = (k, list) => list.some((x) => base(x) === base(k) || (HOTELISH.has(k) && HOTELISH.has(x)));

// Why a page with this title is or is not the stay called `name` in `city`.
// -> { ok, why: 'ok'|'no-title'|'core-empty'|'core-word-missing'|'town-missing'|'unit-clash'|'kind-clash'|'bhk-clash'|'id-clash'|'extra-words', detail }
export function matchReason(name, city, title) {
  if (!title) return { ok: false, why: 'no-title' };
  name = unPossess(name); title = unPossess(title);
  const core = coreWords(name);
  if (!core.length) return { ok: false, why: 'core-empty', detail: coreName(name) };
  const t = title.replace(/^best price on /i, '');
  const head = titleHead(title);
  const headT = tokens(head);
  const headSet = new Set(headT);
  // every core word in the title's own name (not just its address tail); a long core may
  // lack its last word ("Sterling Palm Bliss Wellness Resort" vs "Sterling Palm Bliss")
  const need = core.length >= 4 && !headSet.has(core.at(-1)) ? core.slice(0, -1) : core;
  const missing = need.filter((w) => !headSet.has(w));
  if (missing.length) return { ok: false, why: 'core-word-missing', detail: missing.join(',') };
  // the town must be named by the page, not only inside the stay's own name
  const left = words(coreName(name)); // the name's own words, not its tagline ("Best Property in Haridwar")
  const spare = words(head).filter((w) => { const i = left.indexOf(w); if (i < 0) return true; left.splice(i, 1); return false; });
  const rest = t.slice(t.indexOf(head) + head.length);
  if (!townIn(city, rest) && !townIn(city, spare.join(' '))) return { ok: false, why: 'town-missing' };
  const nameAll = new Set(tokens(name));
  const got = new Set(tokens(title));
  const nameUnits = tokens(coreName(name)).filter((w) => UNITS.has(w));
  const titleUnits = headT.filter((w) => UNITS.has(w));
  if (nameUnits.length && titleUnits.length && !nameUnits.some((w) => got.has(w) || got.has(w.replace(/s$/, '')) || got.has(`${w}s`))) return { ok: false, why: 'unit-clash', detail: `${nameUnits} vs ${titleUnits}` };
  const nameKinds = kindsOf(name.split(CUT)[0]), headKinds = kindsOf(head);
  if (nameKinds.length && headKinds.length && !nameKinds.some((k) => sameKind(k, headKinds))) return { ok: false, why: 'kind-clash', detail: `${nameKinds} vs ${headKinds}` };
  // with one name word ("Krishna"), the title may not add a kind either ("Krishna Home" for
  // "Krishna Rooms"); a site's own "Hotel" after the name does not count
  if (core.length === 1 && headKinds.some((k) => !sameKind(k, nameKinds) && (!/^hotels?$/.test(k) || /^\W*(?:the\s+)?hotels?\b/i.test(head)))) return { ok: false, why: 'kind-clash', detail: `adds ${headKinds}` };
  const nb = [...nameAll].filter(isBhk), hb = headT.filter(isBhk);
  if (nb.length && hb.length && !nb.some((w) => hb.includes(w))) return { ok: false, why: 'bhk-clash', detail: `${nb} vs ${hb}` }; // 1 BHK is not the 2 BHK next door
  const ni = [...nameAll].filter(isId), hi = headT.filter(isId);
  if (ni.length && hi.length && !ni.some((w) => hi.includes(w))) return { ok: false, why: 'id-clash', detail: `${ni} vs ${hi}` }; // another OYO number
  // The title's name part must not add a word of its own: generic words like ganga, view,
  // home or cottage change the name too ("Hotel Shiva" is not "Hotel Shiva Ganga View").
  const inName = (w) => nameAll.has(w) || nameAll.has(w.replace(/s$/, '')) || nameAll.has(`${w}s`); // home = homes
  // an operator suffix the directory leaves out ("Hotel Shreya Galaxy By Antara Group") is not a new name
  const ownHead = /\sby\s/i.test(name) ? head : head.split(/\s+by\s+/i)[0];
  const extra = tokens(ownHead).filter((w) => !inName(w) && !GLUE.has(w) && !BRANDS.has(w) && !PAGE_WORDS.has(w) && !LOCATION.has(w)
    && !isTownWord(w) && !isBhk(w) && !isId(w) && !(UNITS.has(w) && core.length >= 2));
  if (extra.length) return { ok: false, why: 'extra-words', detail: `${extra}` };
  return { ok: true, why: 'ok', detail: `core [${core}]${extra.length ? ` extra ${extra}` : ''}` };
}
export const pageMatches = (name, city, title) => matchReason(name, city, title).ok;

// Which link on a results page is a platform's property page (never a city list or a sub-page).
export const PLATFORMS = [
  { name: 'Booking.com', host: 'booking.com', page: /^https?:\/\/[^/]*booking\.com\/hotel\/[a-z]{2}\/[^/?#]+\.html/ },
  { name: 'MakeMyTrip', host: 'makemytrip.com', page: /^https?:\/\/[^/]*makemytrip\.[a-z.]+\/hotels\/[^/?#]+-details-[^/?#]+\.html/ },
  { name: 'Goibibo', host: 'goibibo.com', page: /^https?:\/\/[^/]*goibibo\.com\/hotels\/[^/?#]+-\d{8,}\/?(?:[?#]|$)/ },
  { name: 'Agoda', host: 'agoda.com', page: /^https?:\/\/[^/]*agoda\.com\/(?:[a-z]{2}-[a-z]{2}\/)?[^/]+\/hotel\/[^/?#]+\.html/ },
  { name: 'Airbnb', host: 'airbnb.', page: /^https?:\/\/[^/]*airbnb\.[a-z.]+\/rooms\/\d+/ },
  { name: 'EaseMyTrip', host: 'easemytrip.com', page: /^https?:\/\/[^/]*easemytrip\.com\/hotels\/[^/]+-\d+\/?(?:[?#]|$)/ },
  // in.trip.com / uk.trip.com / www.trip.com (strict host: "makemytrip.com" and "easemytrip.com" end in trip.com too)
  { name: 'Trip.com', host: 'trip.com', page: /^https?:\/\/(?:[a-z]{2}\.|www\.)?trip\.com\/hotels\/[^/?#]*hotel-detail-\d+/ },
  // more booking sites (owner, 2026-10-05: "the other OTAs we discussed as well")
  { name: 'Expedia', host: 'expedia.', page: /^https?:\/\/[^/]*expedia\.[a-z.]+\/[^?#]*\.h\d+\.Hotel-Information/ },
  { name: 'Hotels.com', host: 'hotels.com', page: /^https?:\/\/(?:[a-z]{2}\.|www\.)?hotels\.com\/ho\d+/ },
  { name: 'Cleartrip', host: 'cleartrip.com', page: /^https?:\/\/[^/]*cleartrip\.com\/hotels\/details\/[^/?#]+/ },
  { name: 'Hostelworld', host: 'hostelworld.com', page: /^https?:\/\/[^/]*hostelworld\.com\/(?:pwa\/hosteldetails\.php\/[^/?#]+\/[^/?#]+\/\d+|hostels\/p\/\d+\/[^/?#]+)/ },
  { name: 'OYO', host: 'oyorooms.com', page: /^https?:\/\/(?:www\.)?oyorooms\.com\/(?:[a-z-]+-)?\d{3,}\/?(?:[?#]|$)/ },
  // a price-comparison site: its own hotel page only (its "View deal" buttons are paid clicks, never followed)
  { name: 'Trivago', host: 'trivago.', page: /^https?:\/\/[^/]*trivago\.[a-z.]+\/(?:[a-z]{2}-[A-Za-z]{2}\/)?(?:oar\/[^/?#]+\?(?:[^#]*&)?search=\d+-\d+|[^?#]*\/hotel\/[^/?#]+-\d+)/ },
];
export const platformOf = (url) => PLATFORMS.find((p) => p.page.test(url));

// The generic property URL: no tracking, no language/country variant, no regional host,
// no sub-page (booking.com/hotel/in/x.en-gb.html -> …/x.html, agoda.com/en-gb/… -> agoda.com/…,
// airbnb.co.uk/rooms/1?s=76 -> airbnb.com/rooms/1, makemytrip …/address-of-x-details… -> …/x-details…).
const HOSTS = { 'Booking.com': 'www.booking.com', Agoda: 'www.agoda.com', Airbnb: 'www.airbnb.com', MakeMyTrip: 'www.makemytrip.com', Goibibo: 'www.goibibo.com', EaseMyTrip: 'www.easemytrip.com', 'Trip.com': 'www.trip.com', Cleartrip: 'www.cleartrip.com', Hostelworld: 'www.hostelworld.com', OYO: 'www.oyorooms.com' };
const SUBPAGE = /\/hotels\/(?:address-of-|reviews?-of-|rooms-(?:in|of)-|photos-of-|amenities-of-|policies-of-|location-of-)/;
export function cleanUrl(u, platform) {
  const url = new URL(u);
  let path = url.pathname.replace(/(\.[a-z]{2}(?:-[a-z]{2})?)?\.html$/i, '.html');
  if (platform === 'Agoda') path = path.replace(/^\/[a-z]{2}-[a-z]{2}\//i, '/');
  if (platform === 'Airbnb') path = path.match(/\/rooms\/\d+/)[0];
  if (platform === 'MakeMyTrip' || platform === 'Goibibo') path = path.replace(SUBPAGE, '/hotels/');
  // Trivago's hotel id lives in ?search=100-<id>; it only runs country sites, so the host stays as landed
  const keep = platform === 'Trivago' && url.searchParams.get('search') ? `?search=${url.searchParams.get('search')}` : '';
  return `https://${HOSTS[platform] || url.host}${path}${keep}`;
}
