// Shared by import-new-stays.test.js and coverage-report.test.js: a small fixture tree (scripts/stays, docs/booking-links,
// assets/js/modules) the Python tools are pointed at with --root, and a way to run them with the OS's own interpreter.
// No network, no repo files touched: the tree lives in the OS temp directory.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pythonCommand, pythonEnv } from '../../scripts/py.mjs';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TODAY = '2026-10-07';
export const CHECKED_COLS = ['url', 'platform', 'name', 'lat', 'lng', 'town', 'state', 'seen_for', 'checked', 'ltype', 'name_src', 'locality', 'postal', 'signals', 'final_url'];
export const NEW_COLS = ['url', 'platform', 'name', 'town', 'lat', 'lng', 'seen_for', 'checked'];

export const tsv = (cols, rows) => cols.join('\t') + '\n' + rows.map((r) => cols.map((c) => r[c] ?? '').join('\t') + '\n').join('');

/** A page the search read (one row of seen-pages-checked.tsv) with sensible defaults for a clean Booking.com property. */
export function page(over = {}) {
  const p = {
    url: 'https://www.booking.com/hotel/in/riverside-nook.html', platform: 'Booking.com', name: 'Riverside Nook', lat: '30.1210', lng: '78.3300',
    town: 'rishikesh', state: 'ok', seen_for: 'some-stay', checked: '2026-10-06', ltype: 'Hotel', name_src: 'ld', locality: 'Tapovan', postal: '249192',
    signals: 'rated,bookable', final_url: '', ...over,
  };
  p.final_url ||= p.url;
  return p;
}

export function makeTree({ pages = [], stays = [], own = [], registry = null, otaLinks = [], found = [], unfound = [], extraFiles = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'rh-newstays-'));
  const w = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text, { encoding: 'utf8' }); };
  const BL = 'docs/booking-links/';
  w(BL + 'seen-pages-checked.tsv', tsv(CHECKED_COLS, pages));
  w(BL + 'new-properties.tsv', tsv(NEW_COLS, pages.filter((p) => p.state === 'ok' || p.inbox).map((p) => ({ ...p, town: p.town || 'rishikesh' }))));
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
