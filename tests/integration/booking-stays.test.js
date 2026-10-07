// Invariants of the booking-found stays (owner, 2026-10-07: auto-listed from the search): the committed registry
// scripts/stays/booking-stays.tsv, its ota-links.tsv rows, and the built data. The registry checks skip while it is absent
// (the first real merge_found.sh run creates it); the two code-level checks always run.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const S = join(ROOT, 'scripts', 'stays');
const text = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const table = (p) => {
  if (!existsSync(p)) return [];
  const [head, ...lines] = text(p).split('\n').filter(Boolean);
  const cols = head.split('\t');
  return lines.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));
};
const REG = join(S, 'booking-stays.tsv');
const registry = table(REG);
const centres = () => {
  const py = text(join(S, 'cities.py'));
  return Object.fromEntries([...py.matchAll(/'(\w+)': \{'name'[^}]*'center': \(([\d.]+), ([\d.]+)\)/g)].map((m) => [m[1], [Number(m[2]), Number(m[3])]]));
};
const km = (a, b) => Math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87);
const metres = (a, b) => km(a, b) * 1000;

test('verify_seen.mjs uses the city centres of cities.py (a stay\'s city is the nearer centre)', () => {
  const js = text(join(S, 'verify_seen.mjs'));
  const m = js.match(/const CENTRES = \{ rishikesh: \[([\d.]+), ([\d.]+)\], haridwar: \[([\d.]+), ([\d.]+)\] \};/);
  assert(m, 'CENTRES literal in verify_seen.mjs');
  const c = centres();
  assert.deepStrictEqual([[Number(m[1]), Number(m[2])], [Number(m[3]), Number(m[4])]], [c.rishikesh, c.haridwar]);
  assert(/\.sort\(\(a, b\) => a\[1\] - b\[1\]\)/.test(js), 'townOf picks the NEAREST centre, not the first within 25 km');
});

test('process.py OWN_KEYS equal booking_stays.OWN_KEYS (a slug may never contain one)', () => {
  const keys = (src, re) => [...src.match(re)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const proc = keys(text(join(S, 'process.py')), /OWN_KEYS=\[(.*?)\]/s);
  const lib = keys(text(join(S, 'booking_stays.py')), /OWN_KEYS = \[(.*?)\]/s);
  assert.deepStrictEqual(lib, proc);
});

test('registry: unique slug and url, a valid state, no own key in a slug', { skip: !registry.length && 'no registry yet' }, () => {
  const own = keys();
  assert.strictEqual(new Set(registry.map((r) => r.slug)).size, registry.length, 'slugs are unique');
  assert.strictEqual(new Set(registry.map((r) => r.url)).size, registry.length, 'primary urls are unique');
  for (const r of registry) {
    assert(['listed', 'closed'].includes(r.state), `${r.slug}: state ${r.state}`);
    assert(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug) && !/^g-/.test(r.slug) && r.slug.length <= 90, `${r.slug}: slug shape`);
    assert(!own.some((k) => r.slug.includes(k)), `${r.slug} contains one of our own stays' keys`);
  }
});

function keys() {
  return [...text(join(S, 'process.py')).match(/OWN_KEYS=\[(.*?)\]/s)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('registry: every stay has its permanent listing id and a verified ota-links row for its primary page', { skip: !registry.length && 'no registry yet' }, () => {
  const ids = new Set(table(join(S, 'listing-ids.tsv')).map((r) => r.slug));
  const ota = Object.fromEntries(table(join(S, 'ota-links.tsv')).map((r) => [r.key, r]));
  for (const r of registry.filter((x) => x.state === 'listed')) {
    assert(ota[r.slug], `${r.slug}: no ota-links.tsv row`);
    assert.strictEqual(ota[r.slug].status, 'verified', r.slug);
    assert.strictEqual(ota[r.slug].url, r.url, `${r.slug}: the ota row is for the primary page`);
    assert.strictEqual(ota[r.slug].ota, r.platform, r.slug);
  }
  for (const r of registry) assert(ids.has(r.slug), `${r.slug} is not in listing-ids.tsv yet: run process.py (both cities)`);
});

test('registry: the city is the nearer centre and the pin is within 25 km', { skip: !registry.length && 'no registry yet' }, () => {
  const c = centres();
  for (const r of registry) {
    const pin = [Number(r.lat), Number(r.lng)];
    const near = Object.keys(c).sort((a, b) => km(pin, c[a]) - km(pin, c[b]))[0];
    assert(km(pin, c[near]) <= 25, `${r.slug}: pin ${km(pin, c[near]).toFixed(1)} km from ${near}`);
    assert.strictEqual(r.city, near, `${r.slug} is nearer ${near}`);
  }
});

test('registry: no two stays within 200 m with the same name and size (they would be one property)', { skip: !registry.length && 'no registry yet' }, () => {
  const norm = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const unit = (n) => (n.toLowerCase().match(/\d+\s*bhk|studio/g) || []).join();
  for (let i = 0; i < registry.length; i++) for (let j = i + 1; j < registry.length; j++) {
    const a = registry[i], b = registry[j];
    if (norm(a.name) !== norm(b.name) || unit(a.name) !== unit(b.name)) continue;
    assert(metres([Number(a.lat), Number(a.lng)], [Number(b.lat), Number(b.lng)]) > 200, `${a.slug} and ${b.slug} are one property`);
  }
});

test('built data: every listed registry stay is in its city\'s module, linked, and never a gm stay', { skip: !registry.length && 'no registry yet' }, async () => {
  const mods = {
    rishikesh: (await import('../../assets/js/modules/stays-index-data.js')).STAYS_INDEX,
    haridwar: (await import('../../assets/js/modules/stays-index-data-haridwar.js')).STAYS_INDEX,
  };
  const missing = [];
  for (const r of registry.filter((x) => x.state === 'listed')) {
    const d = mods[r.city].find((x) => x.id === r.slug);
    if (!d) { missing.push(r.slug); continue; }
    assert(!d.gm, `${r.slug} must not be a Google Maps stay`);
    assert(d.o, `${r.slug} has no booking link in the data`);
  }
  assert.deepStrictEqual(missing, [], 'registry stays missing from the built data: run process.py and npm run build:stays');
});
