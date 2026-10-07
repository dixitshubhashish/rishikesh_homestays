// import_new_stays.py (owner, 2026-10-07: "no listing in Rishikesh or Haridwar should be missed"): a page the search found for
// a property we do not list is auto-listed as a new stay. Runs the real script on a fixture tree (--root) with the OS's Python:
// no network, nothing in the repo is written.
import test from 'node:test';
import assert from 'node:assert';
import { page, makeTree, rows, read, cleanup, runImport, tsv, REPO, TODAY } from './stays-fixture.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REG_COLS = ['slug', 'name', 'city', 'lat', 'lng', 'type', 'type_word', 'platform', 'url', 'extra_links', 'state', 'first_listed', 'checked', 'seen_for', 'note'];
const registryRow = (o) => ({ type: '', type_word: '', extra_links: '', state: 'listed', first_listed: '2026-10-01', checked: '2026-10-01', seen_for: 'x', note: 'ld Hotel', ...o });
const stay = (id, n, lat, lng, extra = {}) => ({ id, n, ll: [lat, lng], a: 'Tapovan', ...extra });

function withTree(opts, fn) {
  const root = makeTree(opts);
  try { return fn(root); } finally { cleanup(root); }
}
const decisionOf = (root, url) => rows(root, 'docs/booking-links/new-properties-decisions.tsv').find((d) => d.url === url);

test('lists a clean Booking.com page as a new stay with its verified link', () => withTree({ pages: [page()] }, (root) => {
  const r = runImport(root);
  assert.strictEqual(r.status, 0, r.out);
  assert.match(r.out, /1 listed/);
  const reg = rows(root, 'scripts/stays/booking-stays.tsv');
  assert.strictEqual(reg.length, 1);
  assert.strictEqual(reg[0].slug, 'riverside-nook');
  assert.strictEqual(reg[0].city, 'rishikesh');
  assert.strictEqual(reg[0].platform, 'Booking.com');
  assert.strictEqual(reg[0].state, 'listed');
  const ota = rows(root, 'scripts/stays/ota-links.tsv');
  assert.deepStrictEqual(ota.map((o) => [o.key, o.status, o.ota, o.url]), [['riverside-nook', 'verified', 'Booking.com', 'https://www.booking.com/hotel/in/riverside-nook.html']]);
  assert.strictEqual(decisionOf(root, reg[0].url).decision, 'listed');
}));

test('holds what is not clearly a property page, with the reason, and never lists it', () => {
  const cases = [
    ['a list-page name', { name: '10 Best Hotels in Haridwar', url: 'https://www.booking.com/hotel/in/best-hotels-haridwar.html' }, /list or a title/],
    ['a name that is not in the URL', { name: 'Hotel Tara ji Bliss', url: 'https://www.booking.com/hotel/in/the-gold-regency-haridwar.html' }, /no word with the page address/],
    ['a name from the browser title', { name_src: 'title' }, /name is not from the page data/],
    ['a page with no lodging type', { ltype: '' }, /no lodging type/],
    ['an Airbnb page', { platform: 'Airbnb', url: 'https://www.airbnb.com/rooms/123456', name: 'Riverside Nook Room' }, /not auto-listed/],
    ['a page read three weeks ago', { checked: '2026-09-10' }, /days ago/],
    ['a page with no booking button or rating', { signals: '' }, /no availability/],
    ['a page that redirected elsewhere', { final_url: 'https://www.booking.com/city/in/rishikesh.html' }, /redirects/],
    ['a page the later read found closed', { state: 'closed', inbox: true }, /not read ok yet/],
    ['a one-word name', { name: 'Zostel', url: 'https://www.booking.com/hotel/in/zostel.html' }, /1 word/],
    ['a page with no evidence (an old row)', { ltype: '', name_src: '', signals: '', final_url: '' }, /no lodging type/],
  ];
  for (const [label, over, why] of cases) {
    withTree({ pages: [page(over)] }, (root) => {
      const r = runImport(root);
      assert.strictEqual(r.status, 0, r.out);
      assert.strictEqual(read(root, 'scripts/stays/booking-stays.tsv'), null, `${label}: nothing is listed`);
      const d = decisionOf(root, over.url || page().url);
      assert.strictEqual(d.decision, 'held', label);
      assert.match(d.why, why, label);
    });
  }
});

test('a pin more than 25 km from both centres is out of scope', () => withTree({ pages: [page({ lat: '30.30', lng: '79.02' })] }, (root) => {
  const r = runImport(root);
  assert.match(r.out, /1 out of scope/);
  assert.strictEqual(read(root, 'scripts/stays/booking-stays.tsv'), null);
  assert.strictEqual(decisionOf(root, page().url).decision, 'out_of_scope');
}));

test('the city is the nearer centre, whatever town the page was stored with', () => {
  // 3 km from Haridwar, 15 km from Rishikesh, stored as "rishikesh" (the first-match bug of verify_seen.mjs)
  withTree({ pages: [page({ lat: '29.9727', lng: '78.1759', town: 'rishikesh' })] }, (root) => {
    runImport(root);
    assert.strictEqual(rows(root, 'scripts/stays/booking-stays.tsv')[0].city, 'haridwar');
  });
});

test('duplicates: a URL a stay already has is never a new stay, whatever its name', () => {
  const owned = [{ key: 'some-other-stay', status: 'verified', ota: 'Booking.com', url: 'https://www.booking.com/hotel/in/riverside-nook.en-gb.html?aid=1', note: '', checked: '2026-10-01' }];
  withTree({ pages: [page()], otaLinks: owned }, (root) => {
    runImport(root);
    assert.strictEqual(read(root, 'scripts/stays/booking-stays.tsv'), null);
    const d = decisionOf(root, page().url);
    assert.strictEqual(d.decision, 'duplicate');
    assert.match(d.why, /some-other-stay/);
  });
  const found = [{ key: 'g-abc', status: 'verified', platform: 'Booking.com', url: 'https://www.booking.com/hotel/in/riverside-nook.html', note: '', name: 'X', city: 'rishikesh', source: '' }];
  withTree({ pages: [page()], found }, (root) => {
    runImport(root);
    assert.strictEqual(decisionOf(root, page().url).decision, 'duplicate');
  });
});

test('duplicates: a pin within 200 m with the same name is the same stay; another size or a far pin is not', () => {
  // 55 m north of the page's pin
  const near = stay('riverside-nook-hotel', 'Riverside Nook', 30.12150, 78.3300);
  withTree({ pages: [page()], stays: [near] }, (root) => {
    runImport(root);
    assert.strictEqual(read(root, 'scripts/stays/booking-stays.tsv'), null);
    const d = decisionOf(root, page().url);
    assert.strictEqual(d.decision, 'duplicate');
    assert.match(d.why, /riverside-nook-hotel/);
  });
  // the same name 1BHK vs 2BHK is another stay (the page is "Riverside Nook 2BHK")
  withTree({ pages: [page({ name: 'Riverside Nook 2BHK', url: 'https://www.booking.com/hotel/in/riverside-nook-2bhk.html' })], stays: [stay('rn1', 'Riverside Nook 1BHK', 30.1215, 78.33)] }, (root) => {
    runImport(root);
    assert.strictEqual(rows(root, 'scripts/stays/booking-stays.tsv').length, 1);
  });
  // the same name 900 m away is another place
  withTree({ pages: [page()], stays: [stay('far', 'Riverside Nook', 30.1290, 78.3300)] }, (root) => {
    runImport(root);
    assert.strictEqual(rows(root, 'scripts/stays/booking-stays.tsv').length, 1);
  });
  // our own stay is in the pool
  withTree({ pages: [page()], own: [stay('villa-yoga-retreat-at-the-ganges-in', 'Riverside Nook', 30.1212, 78.3301)] }, (root) => {
    runImport(root);
    assert.strictEqual(read(root, 'scripts/stays/booking-stays.tsv'), null);
    assert.match(decisionOf(root, page().url).why, /our own stay/);
  });
});

test('a near-miss name within 200 m is held, not listed (a wrong duplicate is worse than a delayed listing)', () => {
  withTree({ pages: [page({ name: 'Riverside Nook', url: 'https://www.booking.com/hotel/in/riverside-nook.html' })], stays: [stay('rn', 'Riversyde Nooks Cottage', 30.1212, 78.33)] }, (root) => {
    runImport(root);
    assert.strictEqual(read(root, 'scripts/stays/booking-stays.tsv'), null);
    const d = decisionOf(root, page().url);
    assert.strictEqual(d.decision, 'held');
    assert.match(d.why, /possibly rn/);
  });
});

test('one property on two sites is ONE stay with Booking.com as the primary link and the other site as an extra link', () => {
  const mmt = page({ platform: 'MakeMyTrip', url: 'https://www.makemytrip.com/hotels/riverside-nook-details-9001234.html', lat: '30.1211', lng: '78.3301', seen_for: 'other' });
  withTree({ pages: [mmt, page()], }, (root) => {
    const r = runImport(root);
    assert.match(r.out, /1 listed, 1 extra links/);
    const reg = rows(root, 'scripts/stays/booking-stays.tsv');
    assert.strictEqual(reg.length, 1);
    assert.strictEqual(reg[0].platform, 'Booking.com');
    assert.strictEqual(reg[0].extra_links, 'MakeMyTrip|https://www.makemytrip.com/hotels/riverside-nook-details-9001234.html');
    assert.strictEqual(decisionOf(root, mmt.url).decision, 'extra_link');
    assert.strictEqual(rows(root, 'scripts/stays/ota-links.tsv').length, 1);
  });
});

test('a better-ranked page arriving later takes over as the primary; slug and name never change', () => {
  const reg = tsv(REG_COLS, [registryRow({ slug: 'riverside-nook', name: 'Riverside Nook', city: 'rishikesh', lat: '30.1210', lng: '78.3300', platform: 'Agoda', url: 'https://www.agoda.com/riverside-nook/hotel/rishikesh-in.html' })]);
  const ota = [{ key: 'riverside-nook', status: 'verified', ota: 'Agoda', url: 'https://www.agoda.com/riverside-nook/hotel/rishikesh-in.html', note: '', checked: '2026-10-01' }];
  withTree({ pages: [page()], registry: reg, otaLinks: ota }, (root) => {
    const r = runImport(root);
    assert.match(r.out, /1 extra links/);
    const row = rows(root, 'scripts/stays/booking-stays.tsv');
    assert.strictEqual(row.length, 1);
    assert.strictEqual(row[0].slug, 'riverside-nook');
    assert.strictEqual(row[0].platform, 'Booking.com');
    assert.strictEqual(row[0].extra_links, 'Agoda|https://www.agoda.com/riverside-nook/hotel/rishikesh-in.html');
    const o = rows(root, 'scripts/stays/ota-links.tsv');
    assert.deepStrictEqual(o.map((x) => [x.key, x.ota]), [['riverside-nook', 'Booking.com']]);
  });
});

test('a second page of the same site for a listed stay is held, never a second stay', () => {
  const reg = tsv(REG_COLS, [registryRow({ slug: 'riverside-nook', name: 'Riverside Nook', city: 'rishikesh', lat: '30.1210', lng: '78.3300', platform: 'Booking.com', url: 'https://www.booking.com/hotel/in/riverside-nook.html' })]);
  const other = page({ url: 'https://www.booking.com/hotel/in/riverside-nook-rishikesh.html' });
  withTree({ pages: [other], registry: reg }, (root) => {
    runImport(root);
    assert.strictEqual(rows(root, 'scripts/stays/booking-stays.tsv').length, 1);
    assert.strictEqual(decisionOf(root, other.url).decision, 'held');
  });
});

test('a second run changes nothing (byte for byte), and a vanished candidate row never touches the registry', () => {
  const pages = [page(), page({ url: 'https://www.booking.com/hotel/in/moon-valley-camp.html', name: 'Moon Valley Camp', lat: '30.1500', lng: '78.3600', ltype: 'Campground' }),
    page({ url: 'https://www.booking.com/hotel/in/best-hotels-haridwar.html', name: 'Best Hotels in Haridwar' })];
  withTree({ pages }, (root) => {
    runImport(root);
    const files = ['scripts/stays/booking-stays.tsv', 'scripts/stays/ota-links.tsv', 'docs/booking-links/new-properties-decisions.tsv'];
    const first = files.map((f) => read(root, f));
    const again = runImport(root);
    assert.match(again.out, /registry unchanged, decisions unchanged/);
    assert.deepStrictEqual(files.map((f) => read(root, f)), first);
    // the inbox empties: the registry and its ota rows stay
    runImportWithEmptyInbox(root);
    assert.strictEqual(read(root, 'scripts/stays/booking-stays.tsv'), first[0]);
    assert.strictEqual(read(root, 'scripts/stays/ota-links.tsv'), first[1]);
    assert.strictEqual(rows(root, 'scripts/stays/booking-stays.tsv').find((r) => r.slug === 'moon-valley-camp').type_word, 'Camp');
  });
});

function runImportWithEmptyInbox(root) {
  const f = join(root, 'docs/booking-links/new-properties.tsv');
  writeFileSync(f, readFileSync(f, 'utf8').split(/\r?\n/)[0] + '\n');
  return runImport(root);
}

test('registry slugs are never recomputed: an old row keeps its slug and its ota row is healed when the file was reverted', () => {
  const reg = tsv(REG_COLS, [registryRow({ slug: 'old-name-slug', name: 'Renamed Place Now', city: 'rishikesh', lat: '30.2', lng: '78.4', platform: 'Booking.com', url: 'https://www.booking.com/hotel/in/renamed-place-now.html' })]);
  withTree({ pages: [], registry: reg }, (root) => {
    runImport(root);
    assert.strictEqual(rows(root, 'scripts/stays/booking-stays.tsv')[0].slug, 'old-name-slug');
    assert.deepStrictEqual(rows(root, 'scripts/stays/ota-links.tsv').map((o) => o.key), ['old-name-slug']);
  });
});

test('slug clashes add the locality, then the city, then a number; never a bare g- prefix', () => {
  const mk = (name, slugword, lat, lng, locality) => page({ url: `https://www.booking.com/hotel/in/${slugword}.html`, name, lat, lng, locality });
  const pages = [
    mk('Green Leaf Stay', 'green-leaf-stay', '30.1200', '78.3300', 'Tapovan'),
    mk('Green Leaf Stay', 'green-leaf-stay-1', '30.1500', '78.3600', 'Laxman Jhula'),
    mk('Green Leaf Stay', 'green-leaf-stay-2', '29.9400', '78.1600', ''),
    mk('Green Leaf Stay', 'green-leaf-stay-3', '29.9500', '78.1800', ''),
    mk('G Nest Inn', 'g-nest-inn', '30.1000', '78.3000', ''),
  ];
  withTree({ pages }, (root) => {
    runImport(root);
    // candidates run in URL order (-1, -2, -3 sort before the plain one), the first to ask gets the plain name
    const slugs = rows(root, 'scripts/stays/booking-stays.tsv').map((r) => r.slug).sort();
    assert.deepStrictEqual(slugs, ['green-leaf-stay', 'green-leaf-stay-haridwar', 'green-leaf-stay-haridwar-2', 'green-leaf-stay-tapovan', 'stay-g-nest-inn']);
  });
});

test('a trailing city word is left out of the slug', () => withTree({ pages: [page({ name: 'Moon Valley Resort Rishikesh', url: 'https://www.booking.com/hotel/in/moon-valley-resort-rishikesh.html' })] }, (root) => {
  runImport(root);
  const r = rows(root, 'scripts/stays/booking-stays.tsv')[0];
  assert.strictEqual(r.slug, 'moon-valley-resort');
  assert.strictEqual(r.type_word, '');
}));

test('--dry prints the counts and writes nothing', () => withTree({ pages: [page()] }, (root) => {
  const r = runImport(root, ['--dry']);
  assert.match(r.out, /1 listed.*dry run/);
  assert.strictEqual(read(root, 'scripts/stays/booking-stays.tsv'), null);
  assert.strictEqual(read(root, 'docs/booking-links/new-properties-decisions.tsv'), null);
  assert.strictEqual(rows(root, 'scripts/stays/ota-links.tsv').length, 0);
}));

test('a stay already in the registry is never listed twice (primary or extra page)', () => {
  const reg = tsv(REG_COLS, [registryRow({ slug: 'riverside-nook', name: 'Riverside Nook', city: 'rishikesh', lat: '30.1210', lng: '78.3300', platform: 'Booking.com',
    url: 'https://www.booking.com/hotel/in/riverside-nook.html', extra_links: 'Agoda|https://www.agoda.com/riverside-nook/hotel/rishikesh-in.html' })]);
  const agoda = page({ platform: 'Agoda', url: 'https://www.agoda.com/en-in/riverside-nook/hotel/rishikesh-in.html' });
  withTree({ pages: [page(), agoda], registry: reg }, (root) => {
    runImport(root);
    assert.strictEqual(rows(root, 'scripts/stays/booking-stays.tsv').length, 1);
    assert.strictEqual(decisionOf(root, page().url).decision, 'listed');
    assert.strictEqual(decisionOf(root, agoda.url).decision, 'extra_link');
  });
});

test('the importer module list matches the data: the TODAY constant of the fixture is a plain date', () => {
  assert.match(TODAY, /^\d{4}-\d{2}-\d{2}$/);
  assert(readFileSync(join(REPO, 'scripts/stays/import_new_stays.py'), 'utf8').includes('FRESH_DAYS = 14'));
});
