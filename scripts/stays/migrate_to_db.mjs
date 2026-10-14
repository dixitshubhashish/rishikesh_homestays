// One-time (re-runnable) import: reads the docs/booking-links/*.tsv files and
// scripts/stays/{cities.py,listing-ids.tsv,ota-priority.tsv} and populates the
// local SQLite DB (db.mjs). Safe to re-run: every insert is "replace by key".
// Nothing is deleted by this script -- the TSVs stay put until the DB round-trips
// and npm test / check:stays pass against data read from it.
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from './db.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const AG = `${ROOT}docs/booking-links/`;
const SS = `${ROOT}scripts/stays/`;

function tsv(file) {
  if (!existsSync(file)) return [];
  const [head, ...rows] = readFileSync(file, 'utf8').trim().split(/\r?\n/).map((l) => l.split('\t'));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const num = (v) => (v === '' || v === undefined || v === '-' || v == null ? null : Number(v));

const db = getDb();

// --- cities (from cities.py's CITIES dict, read as text since it's Python) ---
const citiesPy = readFileSync(`${SS}cities.py`, 'utf8');
const cityRows = [...citiesPy.matchAll(/'(\w+)':\s*\{'name':\s*'([^']+)',\s*'directory':[^,]+,\s*'center':\s*\(([-.\d]+),\s*([-.\d]+)\)/g)]
  .map((m) => ({ city_key: m[1], name: m[2], lat: Number(m[3]), lng: Number(m[4]) }));
const insCity = db.prepare(`INSERT INTO cities (city_key, name, center_lat, center_lng) VALUES (?,?,?,?)
  ON CONFLICT(city_key) DO UPDATE SET name=excluded.name, center_lat=excluded.center_lat, center_lng=excluded.center_lng`);
db.transaction(() => cityRows.forEach((c) => insCity.run(c.city_key, c.name, c.lat, c.lng)))();

// --- platforms (from ota-priority.tsv) ---
const platformRows = tsv(`${SS}ota-priority.tsv`);
const insPlatform = db.prepare(`INSERT INTO platforms (platform_key, rank, autolist) VALUES (?,?,?)
  ON CONFLICT(platform_key) DO UPDATE SET rank=excluded.rank, autolist=excluded.autolist`);
db.transaction(() => platformRows.forEach((p) => insPlatform.run(p.ota, Number(p.rank), p.autolist === 'y' ? 1 : 0)))();
// A platform seen in the data but missing from ota-priority.tsv still needs a row (FK) -- rank it last.
const knownPlatforms = new Set(platformRows.map((p) => p.ota));
const ensurePlatform = db.prepare(`INSERT OR IGNORE INTO platforms (platform_key, rank, autolist) VALUES (?, 999, 1)`);

// --- properties (listing-ids.tsv gives slug/city/listing_id for the directory stays) ---
const listingRows = tsv(`${SS}listing-ids.tsv`);
const insProp = db.prepare(`INSERT INTO properties (key, listing_id, slug, city_key, active) VALUES (?,?,?,?,?)
  ON CONFLICT(key) DO UPDATE SET listing_id=excluded.listing_id, slug=excluded.slug, city_key=excluded.city_key, active=excluded.active`);
const ownKeys = new Set(['advaitam-ganga-hill-view-homestay-by-the-ganges-ghat',
  'villa-elysium-the-himalayan-ganges-view-yoga-retreat', 'villa-yoga-retreat-at-the-ganges-in']);
db.transaction(() => listingRows.forEach((r) => insProp.run(r.slug, Number(r.listing_id), r.slug, r.city, r.active === '1' ? 1 : 0)))();

// A property mentioned only in the booking-link files (mostly g-<placeid> Google Maps
// finds not yet in listing-ids.tsv) still needs a row to hang its links off.
const ensureProp = db.prepare(`INSERT OR IGNORE INTO properties (key, slug, city_key, name) VALUES (?, ?, ?, ?)`);
function touchProperty(key, city, name) {
  city = city || null;
  if (city && !cityRows.some((c) => c.city_key === city)) city = null; // unknown/blank city text -> leave NULL rather than violate the FK
  try {
    ensureProp.run(key, key, city, name || null);
  } catch (e) {
    console.error('touchProperty failed on', JSON.stringify({ key, city, name }));
    throw e;
  }
}

// --- booking_links: review.tsv first (status review), then found.tsv (verified wins on conflict) ---
const reviewRows = tsv(`${AG}review.tsv`);
const foundRows = tsv(`${AG}found.tsv`);
const insLink = db.prepare(`INSERT INTO booking_links (key, platform_key, status, url, note, page_shows, why_review, source, checked)
  VALUES (@key,@platform_key,@status,@url,@note,@page_shows,@why_review,@source,@checked)
  ON CONFLICT(key, platform_key) DO UPDATE SET
    status=CASE WHEN booking_links.status='verified' AND excluded.status!='verified' THEN booking_links.status ELSE excluded.status END,
    url=excluded.url, note=excluded.note, page_shows=excluded.page_shows, why_review=excluded.why_review,
    source=excluded.source, checked=excluded.checked`);
db.transaction(() => {
  for (const r of reviewRows) {
    touchProperty(r.key, r.city, r.name);
    ensurePlatform.run(r.platform);
    insLink.run({ key: r.key, platform_key: r.platform, status: 'review', url: r.url, note: null,
      page_shows: r.page_shows, why_review: r.why_review, source: null, checked: r.last_checked || null });
  }
  for (const r of foundRows) {
    touchProperty(r.key, r.city, r.name);
    ensurePlatform.run(r.platform);
    insLink.run({ key: r.key, platform_key: r.platform, status: 'verified', url: r.url, note: r.note,
      page_shows: null, why_review: null, source: r.source, checked: null });
  }
})();

// --- search_log (owner-to-search.tsv: the "still looking" pool) ---
const ownerRows = tsv(`${AG}owner-to-search.tsv`);
const insSearch = db.prepare(`INSERT INTO search_log (key, status, note, updated_at) VALUES (?,?,?,?)
  ON CONFLICT(key) DO UPDATE SET status=excluded.status, note=excluded.note, updated_at=excluded.updated_at`);
db.transaction(() => ownerRows.forEach((r) => {
  touchProperty(r.key, r.city, r.name);
  insSearch.run(r.key, r.status, r.search_log, new Date().toISOString().slice(0, 10));
}))();

// --- candidate_pages: seen-pages.tsv (unchecked) overlaid by seen-pages-checked.tsv (checked), then new-properties*.tsv (decisions) ---
const insCand = db.prepare(`INSERT INTO candidate_pages
  (url, platform_key, label, seen_for, name, lat, lng, town, state, ltype, name_src, locality, postal, signals, final_url, status, checked)
  VALUES (@url,@platform_key,@label,@seen_for,@name,@lat,@lng,@town,@state,@ltype,@name_src,@locality,@postal,@signals,@final_url,@status,@checked)
  ON CONFLICT(url) DO UPDATE SET
    platform_key=excluded.platform_key, label=COALESCE(excluded.label, candidate_pages.label),
    seen_for=excluded.seen_for, name=COALESCE(excluded.name, candidate_pages.name),
    lat=COALESCE(excluded.lat, candidate_pages.lat), lng=COALESCE(excluded.lng, candidate_pages.lng),
    town=COALESCE(excluded.town, candidate_pages.town), state=COALESCE(excluded.state, candidate_pages.state),
    ltype=COALESCE(excluded.ltype, candidate_pages.ltype), name_src=COALESCE(excluded.name_src, candidate_pages.name_src),
    locality=COALESCE(excluded.locality, candidate_pages.locality), postal=COALESCE(excluded.postal, candidate_pages.postal),
    signals=COALESCE(excluded.signals, candidate_pages.signals), final_url=COALESCE(excluded.final_url, candidate_pages.final_url),
    status=excluded.status, checked=COALESCE(excluded.checked, candidate_pages.checked)`);

console.log('Loading seen-pages.tsv (this is the big one)...');
const seenRows = tsv(`${AG}seen-pages.tsv`);
db.transaction(() => seenRows.forEach((r) => {
  ensurePlatform.run(r.platform);
  insCand.run({ url: r.url, platform_key: r.platform || null, label: r.label, seen_for: r.seen_for,
    name: null, lat: null, lng: null, town: null, state: null, ltype: null, name_src: null, locality: null,
    postal: null, signals: null, final_url: null, status: 'unchecked', checked: null });
}))();
console.log(`  ${seenRows.length} rows.`);

const checkedRows = tsv(`${AG}seen-pages-checked.tsv`);
db.transaction(() => checkedRows.forEach((r) => {
  ensurePlatform.run(r.platform);
  insCand.run({ url: r.url, platform_key: r.platform || null, label: null, seen_for: r.seen_for,
    name: r.name || null, lat: num(r.lat), lng: num(r.lng), town: r.town || null, state: r.state || null,
    ltype: r.ltype || null, name_src: r.name_src || null, locality: r.locality || null, postal: r.postal || null,
    signals: r.signals || null, final_url: r.final_url || null, status: 'checked', checked: r.checked || null });
}))();
console.log(`  +${checkedRows.length} checked rows.`);

const decisionRows = tsv(`${AG}new-properties-decisions.tsv`);
const updDecision = db.prepare(`UPDATE candidate_pages SET status=?, decision_why=?, decided=? WHERE url=?`);
db.transaction(() => decisionRows.forEach((r) => {
  const status = r.decision === 'imported' ? 'imported' : r.decision === 'rejected' ? 'rejected' : r.decision === 'held' ? 'held' : 'checked';
  updDecision.run(status, r.why || null, r.decided || null, r.url);
}))();
console.log(`  +${decisionRows.length} decisions applied.`);

// --- resolved_duplicates (prune_unfound.py's audit log: duplicates-resolved.tsv, append-only, keyed by `key`) ---
const resolvedRows = tsv(`${AG}duplicates-resolved.tsv`);
const insResolved = db.prepare(`INSERT OR IGNORE INTO resolved_duplicates
  (key, name, city, status_was, reason, same_as_key, same_as_name, metres, url)
  VALUES (@key,@name,@city,@status_was,@reason,@same_as_key,@same_as_name,@metres,@url)`);
db.transaction(() => resolvedRows.forEach((r) => insResolved.run(r)))();
console.log(`resolved_duplicates: ${resolvedRows.length} rows read from duplicates-resolved.tsv.`);

// found_properties / found_links / found_duplicates are organise_found.py's own computed cache (rebuilt in full
// every run, not imported here): run `node scripts/py.mjs scripts/stays/organise_found.py` to populate them.

const counts = Object.fromEntries(['cities', 'platforms', 'properties', 'booking_links', 'search_log', 'candidate_pages', 'resolved_duplicates']
  .map((t) => [t, db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c]));
console.log('Row counts:', counts);
