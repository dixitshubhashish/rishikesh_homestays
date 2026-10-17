import test from 'node:test';
import assert from 'node:assert';
import { stayJsonLd, schemaType, stayUrl, jsonLdText } from '../../assets/js/modules/stay-jsonld.js';

const stay = {
  id: 'treebo-trend-mj-inn', lid: 1481, n: 'Treebo Trend Mj Inn', a: 'Triveni Ghat', ad: '19/4/5, Dehradun Rd, Adarsh Gram',
  ll: [30.1101, 78.29531], s: 3, p: 5553, g: 8.4, c: 120, ks: ['Hotels'], t: [], f: ['Wi-Fi', 'Electric kettle'], o: [],
};
const page = { city: 'rishikesh', cityName: 'Rishikesh', categorySlug: 'hotels', categoryTitle: 'Best Hotels in Rishikesh' };

test('stay JSON-LD (RH-FEAT-10)', async (t) => {
  await t.test('builds a lodging node and a breadcrumb that both serialise and parse', () => {
    const nodes = stayJsonLd(stay, page);
    assert.strictEqual(nodes.length, 2);
    for (const n of nodes) assert.deepStrictEqual(JSON.parse(jsonLdText(n)), JSON.parse(JSON.stringify(n)));
    const [place, crumbs] = nodes;
    assert.strictEqual(place['@type'], 'Hotel');
    assert.strictEqual(place.name, stay.n);
    assert.strictEqual(place.url, 'https://rishikeshhomestays.com/hotels/stay?s=treebo-trend-mj-inn');
    assert.strictEqual(place.identifier, 'RH-1481');
    assert.strictEqual(place.address.streetAddress, stay.ad);
    assert.strictEqual(place.address.addressLocality, 'Rishikesh');
    assert.strictEqual(place.address.addressCountry, 'IN');
    assert.deepStrictEqual(place.geo, { '@type': 'GeoCoordinates', latitude: 30.1101, longitude: 78.29531 });
    assert.strictEqual(place.starRating.ratingValue, 3);
    assert.match(place.priceRange, /5,553/);
    assert.strictEqual(place.amenityFeature.length, 2);
    assert.strictEqual(crumbs['@type'], 'BreadcrumbList');
    assert.strictEqual(crumbs.itemListElement.length, 3);
    assert.strictEqual(crumbs.itemListElement[1].item, 'https://rishikeshhomestays.com/hotels/best-hotels-in-rishikesh');
    assert.strictEqual(crumbs.itemListElement[2].item, place.url);
  });

  await t.test('never marks up the booking site\'s guest rating', () => {
    const [place] = stayJsonLd(stay, page);
    assert.strictEqual(place.aggregateRating, undefined);
    assert.strictEqual(place.review, undefined);
    assert.ok(!jsonLdText(place).includes('8.4'));
  });

  await t.test('other cities carry &c=, and sparse records leave fields out instead of writing nulls', () => {
    const sparse = { id: 'x', n: 'X Guest House', a: 'Kankhal', ad: '', ll: null, s: null, p: null, ks: ['Guest Houses'], f: [] };
    const [place] = stayJsonLd(sparse, { city: 'haridwar', cityName: 'Haridwar', categorySlug: 'guest-houses', categoryTitle: 'Best Guest Houses in Haridwar' });
    assert.strictEqual(place['@type'], 'LodgingBusiness');
    assert.strictEqual(place.url, 'https://rishikeshhomestays.com/hotels/stay?s=x&c=haridwar');
    assert.strictEqual(place.address.streetAddress, 'Kankhal');
    for (const k of ['geo', 'hasMap', 'starRating', 'priceRange', 'amenityFeature', 'identifier']) assert.ok(!(k in place), `${k} should be absent`);
  });

  await t.test('Google Maps stays point hasMap at their Google Maps page', () => {
    const [place] = stayJsonLd({ ...stay, gm: 'https://maps.google.com/?cid=1' }, page);
    assert.strictEqual(place.hasMap, 'https://maps.google.com/?cid=1');
  });

  await t.test('category to schema type', () => {
    assert.strictEqual(schemaType(['Backpacker Hostels', 'Hostels']), 'Hostel');
    assert.strictEqual(schemaType(['Resorts']), 'Resort');
    assert.strictEqual(schemaType(['Bed & Breakfasts']), 'BedAndBreakfast');
    assert.strictEqual(schemaType(['Camps']), 'Campground');
    assert.strictEqual(schemaType(['Homestays']), 'LodgingBusiness');
    assert.strictEqual(schemaType([]), 'LodgingBusiness');
    assert.strictEqual(schemaType(undefined), 'LodgingBusiness');
  });

  await t.test('serialisation escapes "<" so a name cannot close the script tag', () => {
    const text = jsonLdText({ name: '</script><b>' });
    assert.ok(!text.includes('</script>'));
    assert.strictEqual(JSON.parse(text).name, '</script><b>');
    assert.strictEqual(stayUrl('a b', 'rishikesh'), 'https://rishikeshhomestays.com/hotels/stay?s=a%20b');
  });
});
