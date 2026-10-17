#!/usr/bin/env node
// One-off (this session, 2026-10-16): properties whose candidate_pages row on one platform (e.g. Airbnb)
// came back `state='closed'` still deserve a search on OTHER platforms by name -- a listing being gone
// from Airbnb says nothing about Booking.com/Agoda/etc. Finds every such property with NO verified link
// on any platform yet, and where `properties.name` is known (skips g-<placeid> Google Maps keys and bare
// slug fragments with no name row -- those need separate handling, not a name search), then appends them
// to docs/booking-links/unfound.tsv with status='retry' under the same .lists-lock mutex
// scripts/stays/prune_unfound.py/seed_unfound_new_cities.py already use, so it's safe even if the search
// supervisor is live. Idempotent: skips any key already in found.tsv or unfound.tsv.
import { getDb } from './db.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BL = path.join(ROOT, 'docs/booking-links');
const UNFOUND = path.join(BL, 'unfound.tsv');
const FOUND = path.join(BL, 'found.tsv');
const DRY = process.argv.includes('--dry');

class Lock {
  async acquire() {
    this.dir = path.join(BL, '.lists-lock');
    for (;;) {
      try { fs.mkdirSync(this.dir); return; } catch {
        try { if (Date.now() / 1000 - fs.statSync(this.dir).mtimeMs / 1000 > 30) fs.rmdirSync(this.dir); } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  }
  release() { try { fs.rmdirSync(this.dir); } catch {} }
}

function tsvRows(p) {
  if (!fs.existsSync(p)) return [];
  const [head, ...lines] = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = head.split('\t');
  return lines.map((l) => { const v = l.split('\t'); return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? ''])); });
}
const clean = (s) => String(s ?? '').replace(/\t/g, ' ').replace(/[\n\r]/g, ' ').replace(/"/g, '').trim();

const db = getDb();
const closedKeys = db.prepare(`
  SELECT DISTINCT cp.seen_for AS key
  FROM candidate_pages cp
  WHERE cp.state = 'closed' AND cp.seen_for IS NOT NULL
    AND cp.seen_for NOT IN (SELECT key FROM booking_links WHERE status = 'verified')
`).all().map((r) => r.key);

const already = new Set([...tsvRows(UNFOUND), ...tsvRows(FOUND)].map((r) => r.key));

// Decode a slug key into a human-readable name when there's no properties.name row: title-case each
// hyphen-separated word, uppercase a few common acronyms/numbers that title-case would mangle. This is
// a best-effort guess, not a verified name -- it's a search query to feed the existing name-based OTA
// search, not something written back as a confirmed property name anywhere.
function decodeSlugName(slug) {
  return slug
    .split('-')
    .map((w) => (/^\d+$/.test(w) || /^[a-z]\d|\d[a-z]/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

const toQueue = [];
for (const key of closedKeys) {
  if (already.has(key)) continue;
  const p = db.prepare('SELECT name, city_key, area FROM properties WHERE key = ?').get(key);
  if (p && p.name) {
    // "g-<placeid>" Google Maps keys: real cached name from the existing Maps sweep data (no new paid call)
    toQueue.push({ key, name: clean(p.name), city: p.city_key || '', area: clean(p.area || ''), src: 'properties' });
    continue;
  }
  if (key.startsWith('g-')) continue; // a Maps place with no cached name -- nothing to decode from a placeid
  const town = db.prepare("SELECT town FROM candidate_pages WHERE seen_for = ? AND town IS NOT NULL LIMIT 1").get(key);
  toQueue.push({ key, name: decodeSlugName(key), city: town?.town || '', area: '', src: 'decoded-slug' });
}

console.log(`${toQueue.length} named propert${toQueue.length === 1 ? 'y' : 'ies'} to queue (of ${closedKeys.length} with a closed candidate and no verified link anywhere)`);
if (DRY) { console.log(toQueue.slice(0, 10)); process.exit(0); }
if (!toQueue.length) process.exit(0);

const lock = new Lock();
await lock.acquire();
try {
  const exists = fs.existsSync(UNFOUND);
  const header = 'key\tname\tcity\tarea\tsearch_log\tstatus\n';
  if (!exists) fs.writeFileSync(UNFOUND, header);
  const lines = toQueue.map((r) => [r.key, r.name, r.city, r.area, r.src === 'decoded-slug' ? 'name decoded from slug, unverified' : '', 'retry'].join('\t')).join('\n') + '\n';
  fs.appendFileSync(UNFOUND, lines);
  console.log(`appended ${toQueue.length} rows to ${UNFOUND}`);
} finally {
  lock.release();
}
