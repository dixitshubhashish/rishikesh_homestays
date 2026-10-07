// The order of every stays list (scripts/stays/build_pages.py order_stays, owner 2026-10-06):
// promising brands first, then one of each letter in turn (not alphabetical), badly rated stays last.
// The data modules carry the order; stays-index.js keeps it and mirrors the "bad rating" constants.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STAYS_INDEX as RISHIKESH } from '../../assets/js/modules/stays-index-data.js';
import { STAYS_INDEX as HARIDWAR } from '../../assets/js/modules/stays-index-data-haridwar.js';

const ROOT = join(import.meta.dirname, '..', '..');
const py = readFileSync(join(ROOT, 'scripts/stays/build_pages.py'), 'utf8');
const js = readFileSync(join(ROOT, 'assets/js/modules/stays-index.js'), 'utf8');
const num = (src, re) => Number(src.match(re)[1]);
const BAD_RATING = num(py, /^BAD_RATING = ([\d.]+)/m), BAD_MIN = num(py, /^BAD_MIN_REVIEWS = (\d+)/m);
const isBad = (d) => Boolean(d.g) && d.g < BAD_RATING && (d.c || 0) >= BAD_MIN;
const brands = readFileSync(join(ROOT, 'scripts/stays/promising-brands.tsv'), 'utf8').trim().split(/\r?\n/).slice(1)
  .map((l) => new RegExp(`(?<![A-Za-z])${l.split('\t')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'i'));
const promising = (d) => brands.some((b) => b.test(d.n));
// A linked, fine; D unlinked, fine; C linked, bad; E unlinked, bad
const tier = (d) => (d.o ? (isBad(d) ? 2 : 0) : (isBad(d) ? 3 : 1));
const SKIP = new Set(['hotel', 'the', 'shri', 'shree', 'sri', 'new', 'a', 'hostel', 'homestay', 'resort']);
const letter = (d) => ((d.n.match(/[A-Za-z0-9]+/g) || []).find((w) => !SKIP.has(w.toLowerCase())) || d.n)[0].toLowerCase();

test('the bad-rating constants are the same in the build and in the browser', () => {
  assert.strictEqual(num(js, /const BAD_RATING = ([\d.]+)/), BAD_RATING);
  assert.strictEqual(num(js, /const BAD_MIN_REVIEWS = (\d+)/), BAD_MIN);
});

for (const [city, list] of [['Rishikesh', RISHIKESH], ['Haridwar', HARIDWAR]]) {
  test(`${city}: linked stays first, then unlinked, then badly rated ones last`, () => {
    let last = 0;
    list.forEach((d, i) => { assert(tier(d) >= last, `${d.n} (#${i}) is out of order`); last = tier(d); });
    assert(list.some((d) => tier(d) === 0), 'some linked stays');
  });

  test(`${city}: promising brands come first among the linked stays`, () => {
    const linked = list.filter((d) => tier(d) === 0);
    const firstPlain = linked.findIndex((d) => !promising(d));
    const lastBrand = linked.map(promising).lastIndexOf(true);
    if (lastBrand >= 0) assert(lastBrand < firstPlain || firstPlain < 0, `a brand stay (${linked[lastBrand].n}) sits behind a plain one`);
  });

  test(`${city}: not alphabetical: one of each first letter in turn`, () => {
    const plain = list.filter((d) => tier(d) === 0 && !promising(d)).slice(0, 60);
    assert(new Set(plain.slice(0, 20).map(letter)).size >= 8, 'the first 20 plain linked stays start with many different letters');
    const sortedPairs = plain.slice(1).filter((d, i) => d.n.toLowerCase() >= plain[i].n.toLowerCase()).length;
    assert(sortedPairs < plain.length * 0.8, 'the list reads like an alphabetical one');
  });
}
