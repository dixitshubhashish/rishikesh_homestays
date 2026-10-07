// Record a stay checked by hand (Claude in Chrome, the owner's normal Chrome) into docs/booking-links/,
// under the same lock and with the same rules as google_ota_search.mjs: the name rule (ota-match.mjs),
// then the place itself (ota-evidence.mjs: the page's map pin or the address it shows).
//
//   node scripts/stays/record_manual.mjs stay <key>
//        -> JSON: name, city, area, address and map pin we hold, the words that must match
//   node scripts/stays/record_manual.mjs verified <key> <url> "<page title or heading>" [<lat,lng> | -] ["<address shown on the page>"]
//        -> found.tsv when it is this stay; review.tsv when only the owner can tell; refused otherwise
//   node scripts/stays/record_manual.mjs review <key> <platform> <url> "<page shows>" "<why>"
//   node scripts/stays/record_manual.mjs unfind <key> "<why the found link is wrong>"   (back to review.tsv)
//   node scripts/stays/record_manual.mjs none|retry|manual <key> "<what was searched and seen>"
//        none: searched well by hand, no booking page for it; retry: blocked or unsure, try later;
//        manual: the name cannot identify it on a booking site
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmdirSync, statSync, renameSync } from 'fs';
import { matchReason, cleanUrl, platformOf, coreName, coreWords } from './ota-match.mjs';
import { judge, places } from './ota-evidence.mjs';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const AG = `${ROOT}docs/booking-links/`, QUEUE = `${AG}all.tsv`, FOUND = `${AG}found.tsv`, UNFOUND = `${AG}unfound.tsv`, REVIEW = `${AG}review.tsv`;
const FOUND_COLS = ['key', 'status', 'platform', 'url', 'note', 'name', 'city', 'source'];
const UNFOUND_COLS = ['key', 'name', 'city', 'area', 'search_log', 'status'];
const QUEUE_COLS = ['key', 'name', 'city', 'area', 'type', 'rating', 'reviews', 'price_from_inr'];
const REVIEW_COLS = ['key', 'name', 'city', 'platform', 'url', 'page_shows', 'why_review'];
const SOURCE = "claude in chrome (owner's normal Chrome), checked by hand";

function tsv(file) {
  if (!existsSync(file)) return [];
  const [head, ...rows] = readFileSync(file, 'utf8').trim().split(/\r?\n/).map((l) => l.split('\t'));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const cleanField = (v) => {
  let s = String(v ?? '').replace(/[\t\n\r\u0085\u2028\u2029]/g, ' ').replace(/\\"/g, '"');
  if ((s.match(/"/g) || []).length % 2) s = s.replace(/"([^"]*)$/, '$1');
  return s;
};
// Windows refuses to replace a file another process has open (Python's open(), Defender, an editor): retry briefly. POSIX never throws these.
const renameRetry = (a, b) => { for (let i = 0; ; i++) { try { return renameSync(a, b); } catch (e) { if (i >= 40 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e; sleepSync(50); } } };
const writeTsv = (file, cols, rows) => { // atomic: nobody ever reads a half-written list
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, [cols.join('\t'), ...rows.map((r) => cols.map((c) => cleanField(r[c])).join('\t'))].join('\n') + '\n');
  renameRetry(tmp, file);
};
const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function withLock(fn) {
  const dir = `${AG}.lists-lock`;
  for (;;) {
    try { mkdirSync(dir); break; } catch {
      try { if (Date.now() - statSync(dir).mtimeMs > 30000) rmdirSync(dir); } catch { /* gone meanwhile */ }
      sleepSync(100);
    }
  }
  try { return fn(); } finally { try { rmdirSync(dir); } catch { /* already gone */ } }
}
const norm = (u) => u.split('?')[0].replace(/\/+$/, '');
const out = (msg, code = 0) => { console.log(msg); process.exit(code); };

const [cmd, key, ...rest] = process.argv.slice(2);
if (cmd === 'unfind') { // a second look disproved a found link: review.tsv for the owner, status review
  const [why] = rest;
  const row = tsv(FOUND).find((r) => r.key === key);
  if (!row) out(`no found row for ${key}`, 1);
  withLock(() => {
    writeTsv(FOUND, FOUND_COLS, tsv(FOUND).filter((r) => r.key !== key));
    writeTsv(REVIEW, REVIEW_COLS, [...tsv(REVIEW).filter((r) => r.key !== key), { key, name: row.name, city: row.city, platform: row.platform, url: row.url, page_shows: row.note, why_review: `second check: ${why}` }]);
    writeTsv(UNFOUND, UNFOUND_COLS, [...tsv(UNFOUND).filter((r) => r.key !== key), { key, name: row.name, city: row.city, area: '', search_log: `in review.tsv for the owner: second check: ${why}`, status: 'review' }]);
  });
  out(`unfound + review: ${row.name}`);
}
const stay = [...tsv(QUEUE), ...tsv(UNFOUND)].find((r) => r.key === key);
if (!cmd || !key) out('usage: see the top of scripts/stays/record_manual.mjs', 1);
if (!stay) out(`skip: ${key} is not unsorted any more (a worker or another check sorted it)`);

if (cmd === 'stay') {
  const pl = places()[key] || {};
  out(JSON.stringify({ key, name: stay.name, city: stay.city, area: stay.area, address: pl.address || '', pin: pl.ll || null, google_maps: pl.maps || '',
    core_name: coreName(stay.name), must_match: coreWords(stay.name), status: stay.status || 'queued', earlier: stay.search_log || '' }));
}

if (cmd === 'verified') {
  const [url, title, pin = '-', address = ''] = rest;
  const p = platformOf(url || '');
  if (!p) out(`refused: not a booking-site property page: ${url}`, 1);
  const clean = cleanUrl(url, p.name);
  const taken = [...tsv(FOUND), ...tsv(`${ROOT}scripts/stays/ota-links.tsv`).filter((r) => r.status === 'verified')]
    .find((r) => r.key !== key && norm(r.url) === norm(clean));
  if (taken) out(`refused: that page already belongs to ${taken.key} (${taken.name || ''}); if it is the same place, record "review" saying so`, 1);
  const ll = pin && pin !== '-' ? pin.split(',').map(Number) : null;
  const m = matchReason(stay.name, stay.city, title);
  const j = judge({ key, name: stay.name, city: stay.city, nameOk: m.ok, title, urlPath: new URL(clean).pathname, pageLL: ll && ll.every(Number.isFinite) ? ll : null, pageText: `${title} ${address}` });
  if (j.verdict === 'reject') out(`refused: ${m.ok ? '' : `${m.why} ${m.detail || ''}; `}${j.why}`, 1);
  withLock(() => {
    if (existsSync(QUEUE)) writeTsv(QUEUE, QUEUE_COLS, tsv(QUEUE).filter((r) => r.key !== key));
    if (j.verdict === 'verified') {
      writeTsv(UNFOUND, UNFOUND_COLS, tsv(UNFOUND).filter((r) => r.key !== key));
      writeTsv(FOUND, FOUND_COLS, [...tsv(FOUND).filter((r) => r.key !== key), { key, status: 'verified', platform: p.name, url: clean,
        note: `page shows "${title}"${address ? `, address "${address}"` : ''}; ${j.why}`, name: stay.name, city: stay.city, source: SOURCE }]);
    } else {
      writeTsv(REVIEW, REVIEW_COLS, [...tsv(REVIEW).filter((r) => r.key !== key), { key, name: stay.name, city: stay.city, platform: p.name, url: clean, page_shows: `${title}${address ? ` | ${address}` : ''}`, why_review: j.why }]);
      writeTsv(UNFOUND, UNFOUND_COLS, [...tsv(UNFOUND).filter((r) => r.key !== key), { key, name: stay.name, city: stay.city, area: stay.area, search_log: `in review.tsv for the owner: ${j.why}`, status: 'review' }]);
    }
  });
  out(j.verdict === 'verified' ? `FOUND ${stay.name} -> ${p.name} ${clean} (${j.why})` : `REVIEW ${stay.name} -> ${p.name} ${clean} (${j.why})`);
}

if (cmd === 'review') {
  const [platform, url, shows, why] = rest;
  withLock(() => {
    writeTsv(REVIEW, REVIEW_COLS, [...tsv(REVIEW).filter((r) => r.key !== key), { key, name: stay.name, city: stay.city, platform, url, page_shows: shows, why_review: why }]);
    if (existsSync(QUEUE)) writeTsv(QUEUE, QUEUE_COLS, tsv(QUEUE).filter((r) => r.key !== key));
    writeTsv(UNFOUND, UNFOUND_COLS, [...tsv(UNFOUND).filter((r) => r.key !== key), { key, name: stay.name, city: stay.city, area: stay.area, search_log: `in review.tsv for the owner: ${why}`, status: 'review' }]);
  });
  out(`review ${stay.name}`);
}

if (['none', 'retry', 'manual'].includes(cmd)) {
  withLock(() => {
    if (existsSync(QUEUE)) writeTsv(QUEUE, QUEUE_COLS, tsv(QUEUE).filter((r) => r.key !== key));
    writeTsv(UNFOUND, UNFOUND_COLS, [...tsv(UNFOUND).filter((r) => r.key !== key), { key, name: stay.name, city: stay.city, area: stay.area, search_log: `by hand in the owner's Chrome: ${rest.join(' ')}`, status: cmd }]);
  });
  out(`${cmd} ${stay.name}`);
}
out(`unknown command: ${cmd}`, 1);
