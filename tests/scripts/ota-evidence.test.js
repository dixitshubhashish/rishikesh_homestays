import test from 'node:test';
import assert from 'node:assert';
import { fuzzyName, addressMatch, kmBetween } from '../../scripts/stays/ota-evidence.mjs';

// The cases behind the rules (owner, 2026-10-05): renamed or misspelt listings are fine when the
// place itself confirms them; a similar name somewhere else is not.
test('fuzzyName: spelling slips and renamed listings share the distinctive words', () => {
  assert(fuzzyName('Krishn Kunj home Stay', 'Krishna Kunj Homestay Rishikesh').ok);
  assert(fuzzyName('MUSKAN RIVER RESORT', 'The Muskan Camp & Resort muskan fantasy beach camp').ok);
  assert(!fuzzyName('Ganga View Homestay', 'Ganga Kinare Hotel').ok, 'only common words in common');
  assert(!fuzzyName('Hotel Shivay Residency', 'Hotel Pandey Residency').ok);
});

test('addressMatch: the page shows the stay\'s PIN code and one of its own address words', () => {
  const ours = 'Vijni Bari, Uttarakhand 249304, India';
  assert(addressMatch(ours, 'The Muskan Camp & Resort, Vijni Bari, MUSKAN RIVER RESORT, Sinduri, Rishikesh, India, 249304').ok);
  assert(!addressMatch(ours, 'Muskan Mount View Retreat, Mukteshwar, 263138').ok, 'other PIN');
  assert(!addressMatch(ours, 'Some Hotel, Laxman Jhula, Rishikesh 249304').ok, 'same PIN, none of its own words');
});

test('map distances behind today\'s cases', () => {
  // Krishna Kunj: Booking's pin vs "Krishn Kunj home Stay" on Google Maps: 2.6 km, a different place
  assert(kmBetween([30.111736, 78.30626], [30.1313496, 78.321194]) > 2);
  // Aranyam: Booking's "Aranyam" at Mohanchatti vs "Aranyam In the Village Homestay" at Dadwa Jaspur: ~24 km
  assert(kmBetween([30.059565, 78.3919811], [30.279747, 78.3822327]) > 20);
});

test('judge: the place decides, the town alone only backs an exact name', async () => {
  const { judge } = await import('../../scripts/stays/ota-evidence.mjs');
  const v = (o) => judge({ key: 'none', city: 'rishikesh', nameOk: false, ...o }).verdict;
  assert.strictEqual(v({ name: 'Mirana House – Tasteful, 4BHK Condo near Ram Jhula', title: 'Mirana House - Tasteful, 4BHK Condo near Ram Jhula', pageText: 'Rishikesh' }), 'verified');
  assert.strictEqual(v({ name: 'Krishn Kunj home Stay', title: 'Krishna Kunj Homestay Rishikesh' }), 'review', 'a misspelt name needs more than the town');
  assert.strictEqual(v({ name: 'Amigos Homestay', title: 'Amigo Rooms Hotel in Rishikesh' }), 'reject');
});

test('judge: different OYO numbers or another town are never this stay', async () => {
  const { judge } = await import('../../scripts/stays/ota-evidence.mjs');
  const v = (o) => judge({ key: 'none', city: 'haridwar', nameOk: false, ...o }).verdict;
  assert.strictEqual(v({ name: 'OYO 35366 Hotel Shiv Murti', title: 'OYO 11858 Hotel Shiv Murti Grand in Haridwar' }), 'reject');
  assert.strictEqual(v({ name: 'Treebo Royal Mirage, Bhoopatwala Hotel', title: 'Hotel Royal Mirage', urlPath: '/treebo-trend-tropical-roots/hotel/mussoorie-in.html' }), 'reject');
});

test('lessons from 186 hand checks: operators, add-ons and taglines are not required name words', async () => {
  const { coreWords } = await import('../../scripts/stays/ota-match.mjs');
  assert.deepStrictEqual(coreWords('Bhagirathi by Reet'), ['bhagirathi']);
  assert.deepStrictEqual(coreWords('Hostel Serendipity & Cats Cafe'), ['serendipity']);
  assert.deepStrictEqual(coreWords('Khushi Wedding Banquet Garden'), ['khushi']);
  assert.deepStrictEqual(coreWords('Ganga River Cozy Stay by the Nirvanaa Blues'), ['nirvanaa', 'blues'], 'not a known operator: kept');
  assert.deepStrictEqual(coreWords('Around Stays – Shanti Villas, Tapovan'), ['around', 'shanti'], 'a chain unit keeps its own word');
  assert.deepStrictEqual(coreWords('Rose Garden Hotel'), ['rose', 'garden'], 'a name that is only garden words keeps them');
});

test('lessons from the last 33 hand checks: home stay, years, landmark tails', async () => {
  const { matchReason, coreWords } = await import('../../scripts/stays/ota-match.mjs');
  assert(matchReason('Jaiswal Homestay, Rishikesh - Double Room with Terrace', 'rishikesh', 'Jaiswal Home Stay, Rishikesh, India').ok);
  assert.deepStrictEqual(coreWords('1997 homestay'), ['1997']);
  assert(matchReason('Hotel Rah Inn', 'rishikesh', 'HOTEL RAH INN - Yog Nagari Rishikesh Railway Station, Rishikesh (updated prices 2027)').ok);
});
