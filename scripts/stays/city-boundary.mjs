// Point-in-city-boundary helper for the city-limits prototype (see
// fetch-city-boundaries.mjs and city-boundary-demo.mjs). Reads the cached
// Nominatim/Overpass GeoJSON polygons and does a plain ray-casting
// point-in-polygon test. No new dependency; ESM, same style as the rest of
// scripts/stays/*.mjs. Used live by api/geocode-area.js.

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Committed (not in the git-ignored .cache): api/geocode-area.js reads these on Vercel too.
const CACHE_DIR = path.join(HERE, 'city-boundaries');

// Mussoorie checked first: it has no real OSM polygon (falls back to a small
// radius, see below) and sits inside Dehradun's coarse tehsil-level boundary,
// so checking Dehradun first would wrongly swallow Mussoorie points.
export const CITY_KEYS = ['mussoorie', 'rishikesh', 'haridwar', 'dehradun'];

// Mussoorie currently has no administrative or boundary polygon in OSM (only
// a point node for the town; confirmed via both Nominatim and Overpass) --
// see the Overpass fallback in fetch-city-boundaries.mjs. Until that changes,
// callers should fall back to a radius check for this one city.
export const MUSSOORIE_FALLBACK_RADIUS_KM = 5;
export const MUSSOORIE_CENTER = [30.4598, 78.0643];

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

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const _cache = new Map();

/** Reads and caches (in-process) the boundary GeoJSON Feature for a city key, or null if not cached on disk. */
export function loadBoundary(cityKey) {
  if (_cache.has(cityKey)) return _cache.get(cityKey);
  const file = path.join(CACHE_DIR, `${cityKey}.geojson`);
  if (!existsSync(file)) {
    _cache.set(cityKey, null);
    return null;
  }
  const feature = JSON.parse(readFileSync(file, 'utf8'));
  _cache.set(cityKey, feature);
  return feature;
}

/**
 * Is (lat, lng) inside cityKey's real boundary? Falls back to a radius check
 * for cities with no cached polygon (currently just Mussoorie).
 */
export function pointInCity(lat, lng, cityKey) {
  const feature = loadBoundary(cityKey);
  if (feature) return pointInGeometry(lat, lng, feature.geometry);
  if (cityKey === 'mussoorie') {
    const [clat, clng] = MUSSOORIE_CENTER;
    return haversineKm(lat, lng, clat, clng) <= MUSSOORIE_FALLBACK_RADIUS_KM;
  }
  return false;
}

/** Which of the 4 cities (if any) contains (lat, lng). Returns the city key or null. */
export function cityContaining(lat, lng) {
  for (const key of CITY_KEYS) {
    if (pointInCity(lat, lng, key)) return key;
  }
  return null;
}
