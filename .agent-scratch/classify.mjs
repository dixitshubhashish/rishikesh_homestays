// Shared classify + guarded-write helper for the candidate_pages extraction task.
// Every per-domain track should `import` this instead of hand-rolling its own
// distance/write logic, so all tracks agree on city centres and write shape.
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join('/Users/shubhashish/rishikesh_homestays/scripts/stays/.cache/stays.db');

export const CITIES = {
  rishikesh: { name: 'Rishikesh', center: [30.103, 78.297] },
  haridwar: { name: 'Haridwar', center: [29.945, 78.164] },
  dehradun: { name: 'Dehradun', center: [30.3244, 78.0419] },
  mussoorie: { name: 'Mussoorie', center: [30.4598, 78.0643] },
};
const MAX_KM = 25; // beyond this from every city centre -> 'elsewhere'

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Given a lat/lng, returns the nearest city key + km distance, or null if no lat/lng.
export function nearestCity(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  let best = null;
  for (const [key, c] of Object.entries(CITIES)) {
    const km = haversineKm([lat, lng], c.center);
    if (!best || km < best.km) best = { city: key, km };
  }
  return best;
}

// Decide state from an extraction result ({name, lat, lng, locality, closed}).
// Does NOT fall back to a Maps search itself (that needs a browser tab, done by
// the caller) -- just classifies what you already have.
export function classify(result) {
  if (result.closed) return { state: 'closed', town: null };
  const near = nearestCity(result.lat, result.lng);
  if (near) {
    return near.km <= MAX_KM
      ? { state: 'ok', town: near.city }
      : { state: 'elsewhere', town: null };
  }
  if (result.name) return { state: 'no pin', town: null }; // got a name, no coords yet -- try the Maps fallback before giving up
  return { state: 'unreadable', town: null };
}

// MAPS FALLBACK (owner instruction, 2026-10-16): when a page gives a name/locality
// but no lat/lng, don't leave it unresolved -- search Google Maps by whatever
// location text the page DID give (name + locality/area + city, or a pincode if
// that's all you have) and use that result's pin as the geo. This is a courser
// fallback than an exact building pin (it may land on the pincode/area centroid
// rather than the exact property), so always record decision_why noting it came
// from a location-text search, not the page's own exact coordinates.
// Query shape to use in the Maps search tab: `${name} ${locality||''} ${town||''} India`
// or, if only a pincode is known: `${pincode} ${town} India` (pincode/area centroid).
// Still never navigate straight to a seen_for place id -- search by text, then
// optionally cross-check the CID against seen_for as confirmation only.

let _db;
function db() {
  if (!_db) { _db = new Database(DB_PATH); _db.pragma('journal_mode = WAL'); }
  return _db;
}

// Guarded write: one row at a time, WHERE url=? AND status='unchecked'.
// decisionWhy should say which extraction method + domain + (if used) that this
// came from a Maps location-text fallback rather than the page's own geo.
export function writeChecked(url, { name, lat, lng, town, state, decisionWhy }) {
  const stmt = db().prepare(`
    UPDATE candidate_pages
    SET status='checked', state=?, name=?, lat=?, lng=?, town=?, checked=?, decision_why=?
    WHERE url=? AND status='unchecked'
  `);
  const today = new Date().toISOString().slice(0, 10);
  return stmt.run(state, name ?? null, lat ?? null, lng ?? null, town ?? null, today, decisionWhy ?? null, url).changes;
}

export function sampleUnchecked(platformKey, limit = 20) {
  return db().prepare(
    `SELECT url, platform_key, seen_for FROM candidate_pages WHERE status='unchecked' AND platform_key=? ORDER BY RANDOM() LIMIT ?`
  ).all(platformKey, limit);
}

export function unCheckedCounts() {
  return db().prepare(
    `SELECT platform_key, COUNT(*) c FROM candidate_pages WHERE status='unchecked' GROUP BY platform_key ORDER BY c DESC`
  ).all();
}
