// Shared by import-new-stays.test.js and coverage-report.test.js: a small fixture tree (scripts/stays, docs/booking-links,
// assets/js/modules) the Python tools are pointed at with --root, and a way to run them with the OS's own interpreter.
// No network, no repo files touched: the tree lives in the OS temp directory.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { pythonCommand, pythonEnv } from '../../scripts/py.mjs';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TODAY = '2026-10-07';
// kept for coverage-report.test.js's cross-check against verify_seen.mjs's HEADER array (the evidence columns a
// checked candidate_pages row carries, by another name)
export const CHECKED_COLS = ['url', 'platform', 'name', 'lat', 'lng', 'town', 'state', 'seen_for', 'checked', 'ltype', 'name_src', 'locality', 'postal', 'signals', 'final_url'];

export const tsv = (cols, rows) => cols.join('\t') + '\n' + rows.map((r) => cols.map((c) => r[c] ?? '').join('\t') + '\n').join('');

/** A page the search read (one candidate_pages row, status 'checked') with sensible defaults for a clean Booking.com property. */
export function page(over = {}) {
  const p = {
    url: 'https://www.booking.com/hotel/in/riverside-nook.html', platform: 'Booking.com', name: 'Riverside Nook', lat: '30.1210', lng: '78.3300',
    town: 'rishikesh', state: 'ok', seen_for: 'some-stay', checked: '2026-10-06', ltype: 'Hotel', name_src: 'ld', locality: 'Tapovan', postal: '249192',
    signals: 'rated,bookable', final_url: '', ...over,
  };
  p.final_url ||= p.url;
  return p;
}

/** Creates scripts/stays/.cache/stays.db at root with just enough schema (candidate_pages + properties) for the Python
 * tools under test; db.py's own CREATE TABLE IF NOT EXISTS fills in the rest (cities, platforms, ...) the first time it
 * runs against this file. Every `pages` row becomes a candidate_pages row, status 'checked' (import_new_stays.py's and
 * map_seen_pages.py's input pool) unless `status` is given explicitly. */
function makeDb(root, pages) {
  const dir = join(root, 'scripts', 'stays', '.cache');
  mkdirSync(dir, { recursive: true });
  const db = new Database(join(dir, 'stays.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      key TEXT PRIMARY KEY, listing_id INTEGER UNIQUE, slug TEXT, city_key TEXT, name TEXT, area TEXT,
      lat REAL, lng REAL, bedrooms INTEGER, is_own INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS candidate_pages (
      url TEXT PRIMARY KEY, platform_key TEXT, label TEXT, seen_for TEXT, name TEXT, lat REAL, lng REAL, town TEXT,
      state TEXT, ltype TEXT, name_src TEXT, locality TEXT, postal TEXT, signals TEXT, final_url TEXT,
      status TEXT NOT NULL DEFAULT 'unchecked', decision_why TEXT, key TEXT, images_json TEXT, details_json TEXT,
      details_fetched TEXT, checked TEXT, decided TEXT
    );
  `);
  const insCand = db.prepare(`INSERT INTO candidate_pages
    (url, platform_key, name, lat, lng, town, state, seen_for, checked, ltype, name_src, locality, postal, signals, final_url, status)
    VALUES (@url,@platform,@name,@lat,@lng,@town,@state,@seen_for,@checked,@ltype,@name_src,@locality,@postal,@signals,@final_url,@status)`);
  for (const p of pages) {
    insCand.run({
      url: p.url, platform: p.platform ?? null, name: p.name ?? null,
      lat: p.lat === '' || p.lat == null ? null : Number(p.lat), lng: p.lng === '' || p.lng == null ? null : Number(p.lng),
      town: p.town ?? null, state: p.state ?? null, seen_for: p.seen_for ?? null, checked: p.checked ?? null,
      ltype: p.ltype ?? null, name_src: p.name_src ?? null, locality: p.locality ?? null, postal: p.postal ?? null,
      signals: p.signals ?? null, final_url: p.final_url ?? null, status: p.status || 'checked',
    });
  }
  db.close();
}

/** Opens the fixture's DB read-only, for assertions (candidateOf below). */
function openDb(root) {
  return new Database(join(root, 'scripts', 'stays', '.cache', 'stays.db'), { readonly: true, fileMustExist: true });
}

/** The candidate_pages row for one url, after running a script against the fixture (import-new-stays.test.js,
 * map-seen-pages tests): { status, decision_why, key, decided, ... }, or undefined. */
export function candidateOf(root, url) {
  const db = openDb(root);
  try { return db.prepare('SELECT * FROM candidate_pages WHERE url = ?').get(url); } finally { db.close(); }
}

export function makeTree({ pages = [], stays = [], own = [], registry = null, otaLinks = [], found = [], unfound = [], extraFiles = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rh-newstays-'));
  const w = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text, { encoding: 'utf8' }); };
  const BL = 'docs/booking-links/';
  makeDb(root, pages);
  w(BL + 'found.tsv', tsv(['key', 'status', 'platform', 'url', 'note', 'name', 'city', 'source'], found));
  w(BL + 'unfound.tsv', tsv(['key', 'name', 'city', 'area', 'search_log', 'status'], unfound));
  w('scripts/stays/ota-links.tsv', tsv(['key', 'status', 'ota', 'url', 'note', 'checked'], otaLinks));
  w('scripts/stays/listing-ids.tsv', 'listing_id\tslug\tactive\tcity\n');
  w('assets/js/modules/stays-index-data.js',
    `export const STAYS_INDEX = ${JSON.stringify(stays)};\nexport const STAYS_OWN = ${JSON.stringify(own)};\n`);
  if (registry) w('scripts/stays/booking-stays.tsv', registry);
  for (const [rel, text] of Object.entries(extraFiles)) w(rel, text);
  return root;
}

export const read = (root, rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n') : null);
export const rows = (root, rel) => {
  const t = read(root, rel);
  if (!t) return [];
  const [head, ...lines] = t.split('\n').filter(Boolean);
  const cols = head.split('\t');
  return lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));
};
export const cleanup = (root) => rmSync(root, { recursive: true, force: true });

/** Runs scripts/stays/<script> on the fixture tree with the OS's Python (scripts/py.mjs); returns { out, status }. */
let PY = null;   // the interpreter probe spawns up to three processes: do it once
export function run(root, script, args = []) {
  const [cmd, ...pre] = (PY ||= pythonCommand());
  const r = spawnSync(cmd, [...pre, join(REPO, 'scripts', 'stays', script), ...args, '--root', root], { env: pythonEnv, encoding: 'utf8', windowsHide: true });
  return { out: (r.stdout || '') + (r.stderr || ''), status: r.status };
}
export const runImport = (root, args = []) => run(root, 'import_new_stays.py', ['--today', TODAY, ...args]);
