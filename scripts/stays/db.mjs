// The local database for the stays + booking-link pipeline: one SQLite file,
// properly normalized, instead of the sprawl of docs/booking-links/*.tsv repeating
// name/city/platform strings on every row. Regenerable (like scripts/stays/.cache/
// already is): if deleted, `node scripts/stays/migrate_to_db.mjs` rebuilds it from
// the TSVs (while they still exist) or from BigQuery (`sync_bigquery.mjs --pull`)
// afterwards.
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import path from 'path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CACHE_DIR = path.join(ROOT, 'scripts/stays/.cache');
export const DB_PATH = path.join(CACHE_DIR, 'stays.db');

let db;
export function getDb() {
  if (db) return db;
  mkdirSync(CACHE_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    -- Lookup: the 4 cities (mirrors cities.py's CITIES).
    CREATE TABLE IF NOT EXISTS cities (
      city_key TEXT PRIMARY KEY,   -- rishikesh | haridwar | dehradun | mussoorie
      name TEXT NOT NULL,
      center_lat REAL,
      center_lng REAL
    );

    -- Lookup: the OTA platforms (mirrors ota-priority.tsv) with their fixed rank,
    -- so "Booking.com first, else rank the rest" is one ORDER BY, not app logic.
    CREATE TABLE IF NOT EXISTS platforms (
      platform_key TEXT PRIMARY KEY,  -- Booking.com | Agoda | MakeMyTrip | ...
      rank INTEGER NOT NULL,
      autolist INTEGER NOT NULL DEFAULT 1
    );

    -- The one row per real-world listing. Keyed by the same "key" string every
    -- other file already uses (a directory slug, or "g-<google place id>" for a
    -- Google Maps find not yet in the directory). listing_id is the permanent
    -- numeric id from listing-ids.tsv -- NULL until that pipeline assigns one;
    -- never assigned here, since ids are never reused and that pipeline owns them.
    -- Deeper fields (area, geo, bedrooms, rating...) are filled by a later phase
    -- that mirrors process.py's output; for now this is the identity + link anchor.
    CREATE TABLE IF NOT EXISTS properties (
      key TEXT PRIMARY KEY,
      listing_id INTEGER UNIQUE,
      slug TEXT,
      city_key TEXT REFERENCES cities(city_key),
      name TEXT,
      area TEXT,
      lat REAL,
      lng REAL,
      bedrooms INTEGER,            -- 0 = studio, 1-8, 9 = 8+, NULL = unknown
      is_own INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city_key);
    CREATE INDEX IF NOT EXISTS idx_properties_listing_id ON properties(listing_id);

    -- One row per (property, platform): the booking page we found, ranked by
    -- platform rank so "send to Booking.com if we have it, else the next best"
    -- is just ORDER BY rank LIMIT 1.
    CREATE TABLE IF NOT EXISTS booking_links (
      key TEXT NOT NULL REFERENCES properties(key),
      platform_key TEXT NOT NULL REFERENCES platforms(platform_key),
      status TEXT NOT NULL,        -- verified | review
      url TEXT NOT NULL,
      note TEXT,
      page_shows TEXT,
      why_review TEXT,
      source TEXT,
      checked TEXT,
      images_json TEXT,            -- JSON array of image URLs scraped off the page
      details_json TEXT,           -- JSON: whatever else the page gave (price, amenities, description...)
      details_fetched TEXT,        -- date the page was last scraped for images_json/details_json
      PRIMARY KEY (key, platform_key)
    );
    CREATE INDEX IF NOT EXISTS idx_booking_links_status ON booking_links(status);

    -- One row per property still being searched (replaces owner-to-search.tsv).
    CREATE TABLE IF NOT EXISTS search_log (
      key TEXT PRIMARY KEY REFERENCES properties(key),
      status TEXT NOT NULL,        -- none | retry | manual
      note TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_search_log_status ON search_log(status);

    -- One row per URL the "discover new stays" sweep has seen (replaces
    -- seen-pages.tsv, seen-pages-checked.tsv, new-properties*.tsv: all the same
    -- entity -- a candidate page -- at different stages, now one status column).
    -- listing_id is set once the page is matched to (or imported as) a property.
    CREATE TABLE IF NOT EXISTS candidate_pages (
      url TEXT PRIMARY KEY,
      platform_key TEXT REFERENCES platforms(platform_key),
      label TEXT,
      seen_for TEXT,
      name TEXT,
      lat REAL,
      lng REAL,
      town TEXT,
      state TEXT,
      ltype TEXT,
      name_src TEXT,
      locality TEXT,
      postal TEXT,
      signals TEXT,
      final_url TEXT,
      status TEXT NOT NULL DEFAULT 'unchecked',  -- unchecked | checked | held | imported | rejected
      decision_why TEXT,
      key TEXT REFERENCES properties(key),       -- set once matched to / imported as a property
      images_json TEXT,            -- JSON array of image URLs scraped off the page
      details_json TEXT,           -- JSON: whatever else the page gave (price, amenities, description, check-in/out times...)
      details_fetched TEXT,        -- date the page was last scraped for images_json/details_json
      checked TEXT,
      decided TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_candidate_pages_status ON candidate_pages(status);
    CREATE INDEX IF NOT EXISTS idx_candidate_pages_town ON candidate_pages(town);

    -- organise_found.py's computed, deduped view of the booking links the search found, one property per
    -- real-world stay (merging raw keys -- a directory slug, a g-<place id> -- that are the same place):
    -- replaces found-by-property.tsv. Rebuilt in full (DELETE + INSERT, one transaction) every run -- a cache
    -- of the dedup computation, not authoritative data (properties / booking_links are); the clustering logic
    -- that fills it still lives in organise_found.py. Nothing here is read back as foreign keys: "key" and
    -- "slug" are two different identities a run can still be reshuffling (a merge can rename the survivor).
    CREATE TABLE IF NOT EXISTS found_properties (
      slug TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      google_place_id TEXT,
      listing_id TEXT,
      name TEXT,
      name_at_search TEXT,
      city TEXT,
      area TEXT,
      lat TEXT,
      lng TEXT,
      maps_url TEXT,
      primary_ota TEXT,
      primary_url TEXT,
      urls_json TEXT,       -- {ota: url}, one entry per booking site this property has (found-by-property.tsv's <ota>_url columns)
      sources TEXT,
      alias_keys TEXT,      -- ';'-joined raw keys merged into this slug (same text the TSV column had)
      other_urls TEXT
    );

    -- organise_found.py's one-row-per-link output (replaces found-links.tsv): the same links as booking_links,
    -- re-keyed to the survivor slug a dedup merge picked. Also rebuilt in full every run.
    CREATE TABLE IF NOT EXISTS found_links (
      key TEXT NOT NULL,
      slug TEXT NOT NULL,
      ota TEXT NOT NULL,
      rank INTEGER,
      url TEXT NOT NULL,
      status TEXT,
      note TEXT,
      checked TEXT,
      source_file TEXT,
      PRIMARY KEY (key, ota)
    );
    CREATE INDEX IF NOT EXISTS idx_found_links_slug ON found_links(slug);

    -- organise_found.py's dedup audit log (replaces found-duplicates.tsv): which raw key got folded into which
    -- survivor slug, and why. Rebuilt in full every run.
    CREATE TABLE IF NOT EXISTS found_duplicates (
      merged_key TEXT PRIMARY KEY,
      kept_slug TEXT NOT NULL,
      kept_key TEXT NOT NULL,
      merged_name TEXT,
      merged_slug_would_be TEXT
    );

    -- prune_unfound.py's audit log (replaces duplicates-resolved.tsv): one row per unfound.tsv/review.tsv key
    -- that turned out to already be listed. Append-only: prune_unfound.py never rewrites a key it already has.
    CREATE TABLE IF NOT EXISTS resolved_duplicates (
      key TEXT PRIMARY KEY,
      name TEXT,
      city TEXT,
      status_was TEXT,
      reason TEXT,
      same_as_key TEXT,
      same_as_name TEXT,
      metres TEXT,
      url TEXT
    );
  `);
  return db;
}

// The property's booking links, Booking.com first, by platform rank.
export const bestLinksStmt = (db) => db.prepare(`
  SELECT bl.*, p.rank FROM booking_links bl JOIN platforms p ON p.platform_key = bl.platform_key
  WHERE bl.key = ? ORDER BY p.rank
`);
