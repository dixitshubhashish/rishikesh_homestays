// coverage_report.py (npm run report:coverage): read-only table of what we list and what is still uncovered.
// Runs on a small fixture tree (--root): the per-city arithmetic must add up, and an input a machine lacks prints n/a.
import test from 'node:test';
import assert from 'node:assert';
import { page, makeTree, cleanup, run, tsv, CHECKED_COLS } from './stays-fixture.js';

const REG_COLS = ['slug', 'name', 'city', 'lat', 'lng', 'type', 'type_word', 'platform', 'url', 'extra_links', 'state', 'first_listed', 'checked', 'seen_for', 'note'];
const S = (id, n, extra = {}) => ({ id, n, ll: [30.1, 78.3], a: 'Tapovan', ...extra });
const json = (root) => {
  const r = run(root, 'coverage_report.py', ['--json']);
  assert.strictEqual(r.status, 0, r.out);
  return JSON.parse(r.out);
};

test('per-city arithmetic: directory + Google Maps + booking-found = total; linked + unlinked = each', () => {
  const stays = [
    S('a', 'A', { o: { n: 'Booking.com', u: 'x' } }), S('b', 'B'), S('g1', 'G1', { gm: 'https://maps', o: { n: 'Agoda', u: 'y' } }), S('g2', 'G2', { gm: 'https://maps' }),
    S('riverside-nook', 'Riverside Nook', { o: { n: 'Booking.com', u: 'z' } }),
  ];
  const reg = tsv(REG_COLS, [{ slug: 'riverside-nook', name: 'Riverside Nook', city: 'rishikesh', lat: '30.1', lng: '78.3', platform: 'Booking.com', url: 'https://www.booking.com/hotel/in/riverside-nook.html', state: 'listed' }]);
  const root = makeTree({ stays, own: [S('own-1', 'Own')], registry: reg, pages: [page(), page({ url: 'https://www.agoda.com/x/hotel/rishikesh-in.html', platform: 'Agoda', state: 'unreadable', ltype: '', name_src: '', signals: '', final_url: '' })],
    unfound: [{ key: 'g-1', name: 'N', city: 'rishikesh', status: 'retry' }, { key: 'k', name: 'K', city: 'haridwar', status: 'none' }] });
  try {
    const rep = json(root);
    const r = rep.stays.rishikesh;
    assert.strictEqual(r.directory.total, 2);
    assert.strictEqual(r.google.total, 2);
    assert.strictEqual(r.booking.total, 1);
    assert.strictEqual(r.total, r.directory.total + r.google.total + r.booking.total);
    for (const k of ['directory', 'google', 'booking']) assert.strictEqual(r[k].linked + r[k].unlinked, r[k].total, k);
    assert.deepStrictEqual([r.directory.linked, r.google.linked, r.booking.linked], [1, 1, 1]);
    assert.strictEqual(rep.stays.haridwar, null, 'no Haridwar module in the fixture: n/a, not a crash');
    assert.strictEqual(rep.stays.total.total, r.total);
    assert.strictEqual(rep.stays.own, 1);
    assert.strictEqual(rep.search.rishikesh.retry, 1);
    assert.strictEqual(rep.search.haridwar.none, 1);
    assert.strictEqual(rep.uncovered.google_without_link.count, 1, 'one g- key awaits a link');
    assert.strictEqual(rep.uncovered.google_without_link['new-with-link.json'], 'n/a');
    assert.strictEqual(rep.uncovered.unreadable_seen_pages.count, 1);
    assert.strictEqual(rep.seen.checked_total, 2);
  } finally { cleanup(root); }
});

test('the printed table says n/a for inputs this machine lacks and still ends with the estimate lines', () => {
  const root = makeTree({});
  try {
    const r = run(root, 'coverage_report.py');
    assert.strictEqual(r.status, 0, r.out);
    assert.match(r.out, /COVERAGE: stays on the site/);
    assert.match(r.out, /n\/a \(no data module\)/);
    assert.match(r.out, /n\/a \(import_new_stays\.py has not run for real yet\)/);
    assert.match(r.out, /STILL UNCOVERED/);
    assert.match(r.out, /out of scope/);
  } finally { cleanup(root); }
});

test('checked columns of the fixture match the ones verify_seen.mjs writes', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../scripts/stays/verify_seen.mjs', import.meta.url), 'utf8');
  const head = src.match(/const HEADER = \[(.*?)\];/)[1].replace(/['\s]/g, '').split(',');
  assert.deepStrictEqual(head, CHECKED_COLS);
});
