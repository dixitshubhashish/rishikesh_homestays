// Lists every place to stay that Google Maps knows within 20 km of Rishikesh
// and Haridwar, via the Places API (New), the official API (no scraping).
// Two steps:
//
// 1. --phase ids: cover each city's 20 km circle with ~2 km tiles and run a
//    few one-word Text Searches per tile ("hotel", "homestay", "guest house"…)
//    asking for place ids only (Google's cheapest "IDs only" tier). A tile that
//    returns the 60-result maximum is split into four and searched again, so
//    dense areas (Tapovan, Har Ki Pauri) are covered completely. The two
//    circles overlap; a place belongs to the nearer city centre.
// 2. --phase details: one Place Details "Pro" call per new id for name,
//    address, location, type and open/closed (≈5,000 free a month). Enough
//    to reconcile with our directory (push_places.mjs).
// 3. --phase phones --ids <file>: phone + website, only for the place ids in
//    the file (e.g. stays not in our directory). These are "Enterprise" calls
//    (≈1,000 free a month, then ≈$20 per 1,000), so always --dry-run first.
//
// Usage: node scripts/stays/places_sweep.mjs --phase ids|details|phones [--ids file] [--dry-run] [--max-calls N]
// Uses the BigQuery service account (OAuth), billed to its project. Phones are
// for our own outreach only: they go to BigQuery (push_places.mjs), never the
// site. Google's terms let us keep place ids for good; re-run details within
// 30 days rather than keeping the other fields longer.
import { GoogleAuth } from 'google-auth-library';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';

const HERE = new URL('.', import.meta.url).pathname;
const DIR = `${HERE}.cache/places`;
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const PHASE = arg('--phase');
const DRY = process.argv.includes('--dry-run');
const MAX_CALLS = Number(arg('--max-calls', { ids: 8000, details: 5000, phones: 1000 }[PHASE]));
if (!['ids', 'details', 'phones'].includes(PHASE)) throw new Error('--phase ids|details|phones is required');
const CENTRES = { rishikesh: [30.103, 78.297], haridwar: [29.945, 78.164] }; // same as cities.py
const RADIUS_KM = 20;
const TILE = 0.018; // ≈ 2 km
const QUERIES = ['hotel', 'homestay', 'guest house', 'hostel', 'resort', 'dharamshala', 'ashram', 'camp', 'apartment', 'cottage'];
const DETAIL_FIELDS = 'id,displayName,formattedAddress,location,primaryType,types,businessStatus,googleMapsUri'; // Pro
const PHONE_FIELDS = 'id,nationalPhoneNumber,internationalPhoneNumber,websiteUri'; // Enterprise

const km = ([a, b], [c, d]) => {
  const r = Math.PI / 180, x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};
const nearestCity = (ll) => Object.keys(CENTRES).sort((a, b) => km(ll, CENTRES[a]) - km(ll, CENTRES[b]))[0];
// tiles of the union of both circles, each tile listed once
function tiles() {
  const lats = Object.values(CENTRES).map(([la]) => la), lngs = Object.values(CENTRES).map(([, lo]) => lo);
  const dLat = RADIUS_KM / 111, dLng = RADIUS_KM / (111 * Math.cos((30 * Math.PI) / 180));
  const out = [];
  for (let la = Math.min(...lats) - dLat; la < Math.max(...lats) + dLat; la += TILE)
    for (let lo = Math.min(...lngs) - dLng; lo < Math.max(...lngs) + dLng; lo += TILE) {
      const mid = [la + TILE / 2, lo + TILE / 2];
      if (Object.values(CENTRES).some((c) => km(mid, c) <= RADIUS_KM + 1.5)) out.push([la, lo, la + TILE, lo + TILE]);
    }
  return out;
}

let calls = 0, headers;
async function api(url, init) {
  if (calls >= MAX_CALLS) throw new Error(`max calls (${MAX_CALLS}) reached`);
  calls++;
  let res;
  // 429 = the per-minute quota: wait for the next minute and retry
  for (let attempt = 1; ; attempt++) {
    res = await fetch(url, { ...init, headers: { ...headers, ...init.headers } });
    if (res.status !== 429 || attempt === 6) break;
    await new Promise((r) => setTimeout(r, 65000));
  }
  if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}
async function auth() {
  const a = new GoogleAuth({ keyFile: `${HERE}../../credentials/bigquery-service-account.json`, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${(await (await a.getClient()).getAccessToken()).token}`, 'X-Goog-User-Project': await a.getProjectId() };
}
const load = (f, d) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);

async function searchTile(tile, query, ids, depth = 0) {
  let pageToken, count = 0;
  const [s, w, n, e] = tile;
  do {
    const page = await api('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', headers: { 'X-Goog-FieldMask': 'places.id,nextPageToken' },
      body: JSON.stringify({ textQuery: query, includedType: 'lodging', pageSize: 20, pageToken,
        locationRestriction: { rectangle: { low: { latitude: s, longitude: w }, high: { latitude: n, longitude: e } } } }),
    });
    for (const p of page.places || []) { ids.add(p.id); count++; }
    pageToken = page.nextPageToken;
  } while (pageToken);
  // 60 = the API's ceiling: there may be more, so search each quarter too
  if (count >= 60 && depth < 4) {
    const ml = (s + n) / 2, mg = (w + e) / 2;
    for (const q of [[s, w, ml, mg], [s, mg, ml, e], [ml, w, n, mg], [ml, mg, n, e]]) await searchTile(q, query, ids, depth + 1);
  }
  return count;
}

mkdirSync(DIR, { recursive: true });
if (PHASE === 'ids') {
  const all = tiles();
  console.log(`${all.length} tiles of ~2 km cover ${RADIUS_KM} km around ${Object.keys(CENTRES).join(' and ')}, × up to ${QUERIES.length} searches`);
  console.log(`estimate: ${all.length * 2} calls if every tile were empty, ~${all.length * QUERIES.length} if every tile had stays (cap ${MAX_CALLS})`);
  if (DRY) process.exit(0);
  await auth();
  const ids = new Set(load(`${DIR}/ids.json`, []));
  const done = new Set(load(`${DIR}/tiles-done.json`, []));
  try {
    for (const t of all) {
      const key = t.map((v) => v.toFixed(3)).join(',');
      if (done.has(key)) continue; // resumable
      // nothing for "hotel" or "homestay" means fields or forest: skip the rest
      const first = (await searchTile(t, QUERIES[0], ids)) + (await searchTile(t, QUERIES[1], ids));
      if (first) for (const q of QUERIES.slice(2)) await searchTile(t, q, ids);
      done.add(key);
    }
  } finally {
    writeFileSync(`${DIR}/ids.json`, JSON.stringify([...ids]));
    writeFileSync(`${DIR}/tiles-done.json`, JSON.stringify([...done]));
    console.log(`${ids.size} place ids from ${done.size}/${all.length} tiles (${calls} calls)`);
  }
} else if (PHASE === 'details') {
  const have = load(`${DIR}/places.json`, []);
  const seen = new Set(have.map((p) => p.id));
  const todo = load(`${DIR}/ids.json`, []).filter((id) => !seen.has(id));
  console.log(`details: ${todo.length} Place Details (Pro) calls to make (cap ${MAX_CALLS})`);
  if (DRY) process.exit(0);
  await auth();
  // 6 calls at a time (well inside the API's per-minute quota)
  const pool = async (items, fn) => { const q = [...items]; await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) await fn(q.shift()); })); };
  try {
    await pool(todo, async (id) => {
      const p = await api(`https://places.googleapis.com/v1/places/${id}`, { method: 'GET', headers: { 'X-Goog-FieldMask': DETAIL_FIELDS } });
      const ll = [p.location?.latitude, p.location?.longitude];
      have.push({ id: p.id, city: nearestCity(ll), km: Math.round(km(ll, CENTRES[nearestCity(ll)]) * 10) / 10,
        name: p.displayName?.text, address: p.formattedAddress, lat: ll[0], lng: ll[1],
        type: p.primaryType, types: p.types, status: p.businessStatus, maps: p.googleMapsUri,
        fetched: new Date().toISOString().slice(0, 10) });
    });
  } finally {
    writeFileSync(`${DIR}/places.json`, JSON.stringify(have, null, 1));
    console.log(`details saved for ${have.length} places (${calls} calls)`);
  }
} else {
  const want = load(arg('--ids'), null);
  if (!want) throw new Error('--ids <file with a JSON array of place ids> is required');
  const phones = load(`${DIR}/phones.json`, {});
  const todo = want.filter((id) => !(id in phones));
  console.log(`phones: ${todo.length} Place Details (Enterprise) calls to make (cap ${MAX_CALLS})`);
  if (DRY) process.exit(0);
  await auth();
  try {
    for (const id of todo) {
      const p = await api(`https://places.googleapis.com/v1/places/${id}`, { method: 'GET', headers: { 'X-Goog-FieldMask': PHONE_FIELDS } });
      phones[id] = { phone: p.internationalPhoneNumber || p.nationalPhoneNumber || null, website: p.websiteUri || null };
    }
  } finally {
    writeFileSync(`${DIR}/phones.json`, JSON.stringify(phones, null, 1));
    console.log(`phones saved for ${Object.keys(phones).length} places (${calls} calls)`);
  }
}
