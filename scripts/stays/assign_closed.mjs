// Closed listings with a found booking page are assigned anyway (owner, 2026-10-06: "closed listing, if it has
// a found url, assign that"). The deep pass of google_ota_search.mjs does this for new misses; this moves the
// earlier unfound.tsv rows (status none, log "closed listing: <url> …") into found.tsv, under the same lock.
//   node scripts/stays/assign_closed.mjs --dry     list what would move
//   node scripts/stays/assign_closed.mjs           move them (a URL another stay already has is skipped)
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmdirSync, statSync, renameSync } from 'fs';
import { platformOf, cleanUrl } from './ota-match.mjs';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url)), AG = `${ROOT}docs/booking-links/`;
const FOUND = `${AG}found.tsv`, UNFOUND = `${AG}unfound.tsv`;
const FOUND_COLS = ['key', 'status', 'platform', 'url', 'note', 'name', 'city', 'source'];
const UNFOUND_COLS = ['key', 'name', 'city', 'area', 'search_log', 'status'];
const DRY = process.argv.includes('--dry');

const tsv = (f) => { if (!existsSync(f)) return []; const [h, ...r] = readFileSync(f, 'utf8').trim().split(/\r?\n/).map((l) => l.split('\t')); return r.map((x) => Object.fromEntries(h.map((c, i) => [c, x[i] ?? '']))); };
const clean = (v) => String(v ?? '').replace(/[\t\n\r\u0085\u2028\u2029]/g, ' ');
// Windows refuses to replace a file another process has open (Python's open(), Defender, an editor): retry briefly. POSIX never throws these.
const renameRetry = (a, b) => { for (let i = 0; ; i++) { try { return renameSync(a, b); } catch (e) { if (i >= 40 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; sleep(50); } } };
const writeTsv = (f, cols, rows) => { const t = `${f}.tmp-${process.pid}`; writeFileSync(t, [cols.join('\t'), ...rows.map((r) => cols.map((c) => clean(r[c])).join('\t'))].join('\n') + '\n'); renameRetry(t, f); };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function withLock(fn) {
  const dir = `${AG}.lists-lock`;
  for (;;) { try { mkdirSync(dir); break; } catch { try { if (Date.now() - statSync(dir).mtimeMs > 30000) rmdirSync(dir); } catch {} sleep(100); } }
  try { return fn(); } finally { try { rmdirSync(dir); } catch {} }
}
const norm = (u) => u.split('?')[0].replace(/\/+$/, '').toLowerCase();

withLock(() => {
  const unfound = tsv(UNFOUND), found = tsv(FOUND);
  const taken = new Map([...tsv(`${ROOT}scripts/stays/ota-links.tsv`).filter((r) => r.status === 'verified'), ...found].map((r) => [norm(r.url), r.key]));
  const move = [], skip = [];
  for (const r of unfound) {
    if (r.status !== 'none' || !/^closed listing:/.test(r.search_log)) continue;
    const url = (r.search_log.match(/https?:\/\/\S+/g) || []).find((u) => platformOf(u));
    if (!url) continue;
    const platform = platformOf(url).name, clean_ = cleanUrl(url, platform);
    const owner = taken.get(norm(clean_));
    if (owner && owner !== r.key) { skip.push(`${r.name}: ${clean_} already belongs to ${owner}`); continue; }
    taken.set(norm(clean_), r.key);
    move.push({ key: r.key, status: 'verified', platform, url: clean_, name: r.name, city: r.city,
      note: 'closed listing: the page no longer takes bookings, assigned anyway (owner, 2026-10-06)', source: 'closed listing, assigned from unfound.tsv' });
  }
  console.log(`${move.length} to assign, ${skip.length} skipped`);
  for (const s of skip) console.log('  skip', s);
  if (DRY) { for (const m of move.slice(0, 8)) console.log('  ', m.name, m.url); return; }
  const keys = new Set(move.map((m) => m.key));
  writeTsv(FOUND, FOUND_COLS, [...found.filter((f) => !keys.has(f.key)), ...move]);
  writeTsv(UNFOUND, UNFOUND_COLS, unfound.filter((r) => !keys.has(r.key)));
});
