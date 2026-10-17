// Prototype/demo tool (not wired into the live site). Fetches a real city-limit
// boundary polygon for each of the 4 cities in cities.py from Nominatim (free,
// OpenStreetMap), with an Overpass fallback for coarse/wrong matches. Caches
// GeoJSON to scripts/stays/.cache/city-boundaries/<city-key>.geojson so we never
// re-fetch the same city twice. Respects Nominatim's 1 req/sec policy.
//
// Usage: node scripts/stays/fetch-city-boundaries.mjs [--force]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(HERE, '.cache', 'city-boundaries');
mkdirSync(CACHE_DIR, { recursive: true });

const USER_AGENT =
  'RishikeshHomestays-CityBoundaryPrototype/1.0 (+https://rishikeshhomestays.com; contact: hello@rishikeshhomestays.com)';

// Seed from scripts/stays/cities.py CITIES dict (kept in sync by hand for this
// prototype; cities.py is Python and not imported here).
export const CITIES = {
  rishikesh: { name: 'Rishikesh', center: [30.103, 78.297] },
  haridwar: { name: 'Haridwar', center: [29.945, 78.164] },
  dehradun: { name: 'Dehradun', center: [30.3244, 78.0419] },
  mussoorie: { name: 'Mussoorie', center: [30.4598, 78.0643] },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Simple ray-casting point-in-polygon on a single [lng,lat][] ring.
function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lat, lng, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    // ring 0 = outer, rest = holes
    if (!pointInRing(lat, lng, geometry.coordinates[0])) return false;
    for (let k = 1; k < geometry.coordinates.length; k++) {
      if (pointInRing(lat, lng, geometry.coordinates[k])) return false; // inside a hole
    }
    return true;
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => pointInGeometry(lat, lng, { type: 'Polygon', coordinates: poly }));
  }
  return false;
}

// Rough bounding-box area in deg^2, used to flag suspiciously huge (district/state) polygons.
function bboxArea(geometry) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  const visit = (ring) => ring.forEach(([lng, lat]) => {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : geometry.coordinates;
  polys.forEach(visit);
  return (maxLat - minLat) * (maxLng - minLng);
}

async function fetchJson(url, attempt = 1) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (res.status === 429 || res.status === 503) {
    if (attempt > 4) throw new Error(`rate-limited/unavailable after ${attempt} attempts: ${url}`);
    const backoff = 2000 * attempt;
    console.log(`  ${res.status} from ${url}, backing off ${backoff}ms (attempt ${attempt})`);
    await sleep(backoff);
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function nominatimLookup(osmType, osmId) {
  // osmType: 'R' (relation), 'W' (way), 'N' (node)
  const url = `https://nominatim.openstreetmap.org/lookup?${new URLSearchParams({
    osm_ids: `${osmType}${osmId}`,
    format: 'geojson',
    polygon_geojson: '1',
  })}`;
  const data = await fetchJson(url);
  return (data.features || [])[0] || null;
}

async function nominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q: query,
    format: 'geojson',
    polygon_geojson: '1',
    limit: '5',
  })}`;
  const data = await fetchJson(url);
  return data.features || [];
}

const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

// Fallback: ask Overpass for any administrative/place boundary named after the
// city within a radius of its center, then convert the most specific match
// (highest admin_level, or a place=town/city boundary) to a GeoJSON polygon
// via its own geometry. Used only when Nominatim's text search gives nothing
// better than a district/tehsil polygon (or nothing at all, e.g. Mussoorie).
async function overpassBoundary(name, [lat, lng], radiusM = 10000) {
  const query = `[out:json][timeout:25];\n(\n relation(around:${radiusM},${lat},${lng})["boundary"]["name"~"${name}",i];\n way(around:${radiusM},${lat},${lng})["boundary"]["name"~"${name}",i];\n);\nout tags;`;

  let lastErr;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Rank by admin_level descending (more specific = higher number), skip state/district (<=6).
        const candidates = (data.elements || [])
          .filter((e) => e.tags && Number(e.tags.admin_level) > 6)
          .sort((a, b) => Number(b.tags.admin_level) - Number(a.tags.admin_level));
        return { elements: data.elements || [], best: candidates[0] || (data.elements || [])[0] || null };
      } catch (e) {
        lastErr = e;
        await sleep(2000 * attempt);
      }
    }
  }
  throw lastErr || new Error('overpass failed on all endpoints');
}

// Try a sequence of increasingly specific queries until one yields a polygon
// that (a) contains the known center point and (b) isn't absurdly large.
async function resolveCity(key, { name, center }) {
  const [lat, lng] = center;
  const candidates = [
    `${name}, Uttarakhand, India`,
    `${name} city, Uttarakhand, India`,
    `${name} town, Uttarakhand, India`,
    `${name}, India`,
  ];

  const attempts = [];
  for (const q of candidates) {
    console.log(`  querying Nominatim: "${q}"`);
    let features;
    try {
      features = await nominatimSearch(q);
    } catch (e) {
      console.log(`    error: ${e.message}`);
      await sleep(1100);
      continue;
    }
    await sleep(1100); // stay under 1 req/sec

    for (const f of features) {
      if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) continue;
      const contains = pointInGeometry(lat, lng, f.geometry);
      const area = bboxArea(f.geometry);
      attempts.push({ query: q, class: f.properties?.class, type: f.properties?.type, contains, area });
      if (contains && area < 2.0) {
        // area < ~2 deg^2 bbox is a generous cap that still excludes whole-state matches
        return { feature: f, query: q, source: 'nominatim', attempts };
      }
    }
  }

  // Fallback: Nominatim's text search gave nothing specific enough (either no
  // polygon, like Mussoorie, or only a district/tehsil admin boundary). Ask
  // Overpass for any administrative/boundary relation named after the city
  // within 10km of its center, preferring the most specific (highest
  // admin_level > 6, i.e. finer than district/tehsil), then fetch that
  // relation's full polygon via Nominatim's lookup endpoint (still free, still
  // rate-limited to 1/sec).
  console.log(`  falling back to Overpass for a finer boundary near (${lat}, ${lng})`);
  try {
    const { elements, best } = await overpassBoundary(name, center);
    attempts.push({ source: 'overpass', found: elements.length, best: best && { id: best.id, admin_level: best.tags.admin_level, name: best.tags.name } });
    if (best) {
      await sleep(1100);
      const feature = await nominatimLookup('R', best.id);
      if (feature && feature.geometry) {
        const contains = pointInGeometry(lat, lng, feature.geometry);
        const area = bboxArea(feature.geometry);
        attempts.push({ query: 'overpass-lookup', contains, area, admin_level: best.tags.admin_level });
        if (contains) {
          return { feature, query: `overpass: relation/${best.id} (admin_level ${best.tags.admin_level})`, source: 'overpass+nominatim-lookup', attempts };
        }
      }
    }
  } catch (e) {
    attempts.push({ source: 'overpass', error: e.message });
  }

  return { feature: null, query: null, source: null, attempts };
}

async function main() {
  const force = process.argv.includes('--force');
  const summary = [];

  for (const [key, cfg] of Object.entries(CITIES)) {
    const outPath = path.join(CACHE_DIR, `${key}.geojson`);
    if (existsSync(outPath) && !force) {
      console.log(`${key}: already cached at ${outPath} (use --force to refetch)`);
      const cached = JSON.parse(readFileSync(outPath, 'utf8'));
      const [lat, lng] = cfg.center;
      const ok = pointInGeometry(lat, lng, cached.geometry);
      summary.push({ key, ok, source: cached.properties?._source || 'cache', fromCache: true });
      continue;
    }

    console.log(`${key} (${cfg.name}):`);
    const result = await resolveCity(key, cfg);
    if (!result.feature) {
      console.log(`  FAILED to resolve a good polygon for ${key}. Attempts:`, result.attempts);
      summary.push({ key, ok: false, source: 'none', fromCache: false });
      continue;
    }

    const feature = {
      type: 'Feature',
      properties: {
        ...result.feature.properties,
        _source: result.source,
        _query: result.query,
        _fetchedAt: new Date().toISOString(),
      },
      geometry: result.feature.geometry,
    };
    writeFileSync(outPath, JSON.stringify(feature, null, 2) + '\n', 'utf8');
    console.log(`  saved ${outPath} (query: "${result.query}", osm class/type: ${feature.properties.class}/${feature.properties.type})`);
    summary.push({ key, ok: true, source: result.source, query: result.query, fromCache: false });
  }

  console.log('\nSummary:');
  for (const s of summary) console.log(' ', JSON.stringify(s));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
