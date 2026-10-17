// Structured data for one third-party stay on /hotels/stay?s=<id>: a lodging node plus the
// breadcrumb, built from the stay record in stays-index-data*.js. Pure data in, objects out;
// stay-page.js writes them into <head>. No aggregateRating or review on purpose: the guest
// score is the booking site's, and Google forbids marking up another site's ratings.
const SITE = 'https://rishikeshhomestays.com';

const TYPE_BY_CATEGORY = {
  Hotels: 'Hotel', 'Boutique Hotels': 'Hotel', 'Business Hotels': 'Hotel', Aparthotels: 'Hotel',
  Hostels: 'Hostel', 'Backpacker Hostels': 'Hostel',
  Resorts: 'Resort',
  'Bed & Breakfasts': 'BedAndBreakfast',
  Camps: 'Campground',
};
const MAX_AMENITIES = 40;

export function schemaType(categories) {
  for (const k of categories || []) if (TYPE_BY_CATEGORY[k]) return TYPE_BY_CATEGORY[k];
  return 'LodgingBusiness';
}

export function stayUrl(id, city) {
  return `${SITE}/hotels/stay?s=${encodeURIComponent(id)}${city === 'rishikesh' ? '' : `&c=${city}`}`;
}

// d: a stay record (id, n, a, ad, ll, gm, s, p, f, ks, lid); page: { city, cityName, categorySlug, categoryTitle }.
export function stayJsonLd(d, page) {
  const url = stayUrl(d.id, page.city);
  const place = {
    '@context': 'https://schema.org',
    '@type': schemaType(d.ks),
    '@id': `${url}#stay`,
    name: d.n,
    url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: d.ad && d.ad.length > 6 ? d.ad : d.a,
      addressLocality: page.cityName,
      addressRegion: 'Uttarakhand',
      addressCountry: 'IN',
    },
  };
  if (d.lid) place.identifier = `RH-${d.lid}`;
  if (d.ll) place.geo = { '@type': 'GeoCoordinates', latitude: d.ll[0], longitude: d.ll[1] };
  if (d.gm) place.hasMap = d.gm;
  else if (d.ll) place.hasMap = `https://www.google.com/maps?q=${d.ll[0]},${d.ll[1]}`;
  if (d.s) place.starRating = { '@type': 'Rating', ratingValue: d.s };
  if (d.p) place.priceRange = `From ₹${Number(d.p).toLocaleString('en-IN')} a night`;
  if (d.f && d.f.length) {
    place.amenityFeature = d.f.slice(0, MAX_AMENITIES).map((name) => ({ '@type': 'LocationFeatureSpecification', name, value: true }));
  }
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: page.categoryTitle, item: `${SITE}/hotels/best-${page.categorySlug}-in-${page.city}` },
      { '@type': 'ListItem', position: 3, name: d.n, item: url },
    ],
  };
  return [place, crumbs];
}

// Serialised for a <script type="application/ld+json">: "<" is escaped so a name can never close the tag.
export function jsonLdText(node) {
  return JSON.stringify(node).replace(/</g, '\\u003c');
}
