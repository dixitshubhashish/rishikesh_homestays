// Live area/place geocoding (FEAT-3, owner architecture decision 2026-10-17):
// resolves a free-text place name typed into the destination search (any
// area, not just the ones in AREAS/CITY_AREAS) to one of our 4 cities via
// OpenStreetMap Nominatim, server-side only (CORS, and so the 1 req/sec
// usage policy is enforced in one place instead of per-browser-tab).
// https://operations.osmfoundation.org/policies/nominatim/
//
// Never a paid Google API (CLAUDE.md "No paid Google API calls"): Nominatim
// is free, no key, no account.
import { cityContaining } from '../scripts/stays/city-boundary.mjs';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'RishikeshHomestaysSiteSearch/1.0 (+https://rishikeshhomestays.com; hello@rishikeshhomestays.com)';
const MIN_GAP_MS = 1000; // Nominatim policy: max 1 request/second
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h: repeat queries within the function instance's life are free

// Confirmed gaps where a real, well-known neighborhood's point falls outside
// its intuitive city's own OSM admin polygon (Tapovan sits in Narendra Nagar
// tehsil, Tehri Garhwal, not Rishikesh's tehsil) — see scripts/stays/
// city-boundary.mjs and CLAUDE.md. Matched case-insensitively against the
// query and against Nominatim's returned display name. Add more rows here as
// further gaps are confirmed; never guess one without checking the polygon.
const NEIGHBORHOOD_OVERRIDES = [
  { pattern: /\btapovan\b/i, city: 'rishikesh' }
];

let lastRequestAt = 0;
const cache = new Map(); // normalised query -> { result, expiresAt }

function normaliseQuery(q) {
  return String(q || '').trim().toLowerCase();
}

function matchOverride(query, displayName) {
  for (const { pattern, city } of NEIGHBORHOOD_OVERRIDES) {
    if (pattern.test(query) || pattern.test(displayName || '')) return city;
  }
  return null;
}

async function waitForSlot() {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < MIN_GAP_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_GAP_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

async function geocode(query) {
  await waitForSlot();
  const url = `${NOMINATIM_URL}?${new URLSearchParams({
    q: `${query}, Uttarakhand, India`,
    format: 'json',
    limit: '3',
    addressdetails: '0'
  })}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' } });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  const query = normaliseQuery(req.query?.q);
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'query too short' });
  }

  const cached = cache.get(query);
  if (cached && Date.now() < cached.expiresAt) {
    return res.json(cached.result);
  }

  let result;
  try {
    const rows = await geocode(query);
    const results = Array.isArray(rows) ? rows : [];
    let resolved = null;
    // Pass 1: trust the polygon only (no override), so a genuine in-polygon
    // match always wins over a same-named place somewhere else entirely.
    for (const row of results) {
      const lat = parseFloat(row.lat);
      const lng = parseFloat(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const city = cityContaining(lat, lng);
      if (city) { resolved = { city, lat, lng, matchedName: row.display_name || query }; break; }
    }
    // Pass 2: the query itself names a known gap (Tapovan) and nothing landed
    // inside a polygon — trust the override rather than a same-named place
    // elsewhere in India that Nominatim happened to rank higher.
    if (!resolved) {
      const overrideCity = matchOverride(query, '');
      if (overrideCity) {
        const first = results[0];
        const lat = first ? parseFloat(first.lat) : null;
        const lng = first ? parseFloat(first.lon) : null;
        resolved = { city: overrideCity, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, matchedName: query };
      }
    }
    result = resolved || { city: null, lat: null, lng: null, matchedName: null, notFound: true };
  } catch (err) {
    return res.status(502).json({ error: 'geocoding unavailable', detail: String(err?.message || err) });
  }

  cache.set(query, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return res.json(result);
}
