// Loads the Google Maps lodging list (places_sweep.mjs → .cache/places/places.json)
// into BigQuery <BIGQUERY_DATASET>.places_lodging, matched to our directory
// stays and their booking links. INTERNAL ONLY: it holds phone numbers for our
// own outreach and is never read by the website.
//
// A place matches a directory stay when they are within 300 m and share most
// of their distinctive name words (or have the same name within 1.5 km). Each
// row then carries that stay's listing_id/slug and its verified booking link
// (Booking.com with our affiliate id). A place whose own website is a booking
// site (booking.com, airbnb, makemytrip, goibibo, agoda…) records that too.
// The table holds the latest sweep only (replaced on every load): re-sweep
// monthly so Google content isn't kept longer than its terms allow.
//
// Also writes .cache/places/need-phones.json: open places that are new to us
// (not in the directory) or in it without a booking link, the only ones worth
// paying for a phone lookup (places_sweep.mjs --phase phones --ids …).
//
// Usage: node scripts/stays/push_places.mjs [--dry-run]
import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { words, distinctive } from './booking-match.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const DATASET_ID = process.env.BIGQUERY_DATASET || 'rishikesh_homestays';
const TABLE_ID = 'places_lodging';
const BOOKING_AID = '7854081';
const DRY = process.argv.includes('--dry-run');

const SCHEMA = [
  { name: 'place_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'city', type: 'STRING' },
  { name: 'km_from_centre', type: 'FLOAT' },
  { name: 'name', type: 'STRING' },
  { name: 'address', type: 'STRING' },
  { name: 'latitude', type: 'FLOAT' },
  { name: 'longitude', type: 'FLOAT' },
  { name: 'google_type', type: 'STRING' },
  { name: 'google_types', type: 'STRING', mode: 'REPEATED' },
  { name: 'business_status', type: 'STRING' }, // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
  { name: 'phone', type: 'STRING' }, // internal outreach only, never on the site
  { name: 'website', type: 'STRING' },
  { name: 'website_ota', type: 'STRING' }, // the website itself is a booking-site page
  { name: 'google_maps_url', type: 'STRING' },
  { name: 'in_directory', type: 'BOOLEAN', mode: 'REQUIRED' },
  { name: 'listing_id', type: 'INTEGER' },
  { name: 'slug', type: 'STRING' },
  { name: 'match_m', type: 'INTEGER' }, // distance to the matched directory stay
  { name: 'booking_site', type: 'STRING' },
  { name: 'booking_url', type: 'STRING' },
  { name: 'our_page', type: 'STRING' },
  { name: 'fetched_date', type: 'DATE' },
];
const OTA_HOSTS = [['booking.com', 'Booking.com'], ['airbnb.', 'Airbnb'], ['makemytrip.com', 'MakeMyTrip'], ['goibibo.com', 'Goibibo'],
  ['agoda.com', 'Agoda'], ['easemytrip.com', 'EaseMyTrip'], ['hotels.com', 'Hotels.com'], ['expedia.', 'Expedia'], ['trip.com', 'Trip.com'],
  ['tripadvisor.', 'Tripadvisor'], ['oyorooms.com', 'OYO'], ['treebo.com', 'Treebo'], ['fabhotels.com', 'FabHotels'], ['zostel.com', 'Zostel']];

const metres = (a, b) => {
  const r = Math.PI / 180, x = Math.sin(((b[0] - a[0]) * r) / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(x));
};
const nameScore = (a, b) => {
  const x = new Set(distinctive(a)), y = new Set(distinctive(b));
  if (!x.size || !y.size) return words(a).join(' ') === words(b).join(' ') ? 1 : 0;
  return [...x].filter((w) => y.has(w)).length / Math.max(x.size, y.size);
};

const places = JSON.parse(readFileSync(join(HERE, '.cache/places/places.json'), 'utf8'));
// booking links found for Google places themselves (key g-<place_id>), by the
// same sitemap/browser matching as the directory (see README "Google Maps places")
const placeLinks = {};
const placeOta = join(HERE, '.cache/places/ota-links.tsv');
if (existsSync(placeOta)) for (const line of readFileSync(placeOta, 'utf8').trim().split('\n')) {
  const [key, status, site, url] = line.split('\t');
  if (status === 'verified') placeLinks[key.slice(2)] = { site, url: site === 'Booking.com' ? `${url.split('?')[0]}?aid=${BOOKING_AID}` : url };
}
const phonesFile = join(HERE, '.cache/places/phones.json');
const phones = existsSync(phonesFile) ? JSON.parse(readFileSync(phonesFile, 'utf8')) : {};
const stays = [['rishikesh', join(HERE, '.cache/stays.json')],
  ...readdirSync(join(HERE, '.cache'), { withFileTypes: true }).filter((e) => e.isDirectory())
    .map((e) => [e.name, join(HERE, '.cache', e.name, 'stays.json')]).filter(([, f]) => existsSync(f))]
  .flatMap(([city, f]) => JSON.parse(readFileSync(f, 'utf8')).map((s) => ({ ...s, cy: s.cy || city })))
  .filter((s) => s.ll);
const links = {};
for (const line of readFileSync(join(HERE, 'ota-links.tsv'), 'utf8').trim().split('\n').slice(1)) {
  const [key, status, site, url] = line.split('\t');
  if (status === 'verified') links[key] = { site, url: site === 'Booking.com' ? `${url}?aid=${BOOKING_AID}` : url };
}

const rows = places.map((p) => {
  let best = null;
  for (const s of stays) {
    const m = metres([p.lat, p.lng], s.ll);
    if (m > 1500) continue;
    const score = nameScore(p.name || '', s.n);
    const ok = (m <= 300 && score >= 0.5) || score === 1;
    if (ok && (!best || score > best.score || (score === best.score && m < best.m))) best = { s, m, score };
  }
  const l = (best && links[best.s.id]) || placeLinks[p.id];
  const ph = phones[p.id] || {};
  const web = (ph.website || '').toLowerCase();
  return {
    place_id: p.id, city: p.city, km_from_centre: p.km, name: p.name, address: p.address, latitude: p.lat, longitude: p.lng,
    google_type: p.type, google_types: p.types || [], business_status: p.status, phone: ph.phone ?? null, website: ph.website ?? null,
    website_ota: (OTA_HOSTS.find(([h]) => web.includes(h)) || [])[1] || null, google_maps_url: p.maps,
    in_directory: !!best, listing_id: best?.s.lid ?? null, slug: best?.s.id ?? null, match_m: best ? Math.round(best.m) : null,
    booking_site: l?.site ?? null, booking_url: l?.url ?? null,
    our_page: best ? `https://rishikeshhomestays.com/hotels/stay?s=${best.s.id}${best.s.cy !== 'rishikesh' ? `&c=${best.s.cy}` : ''}` : null,
    fetched_date: p.fetched,
  };
});

const count = (f) => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] || 0) + 1), m), {});
console.log(`${rows.length} Google Maps places:`, count((r) => r.city));
console.log('  in our directory:', count((r) => `${r.city} ${r.in_directory ? 'yes' : 'no'}`));
console.log('  with phone:', rows.filter((r) => r.phone).length, '| website is a booking site:', rows.filter((r) => r.website_ota).length,
  '| booking link via directory:', rows.filter((r) => r.booking_url).length, '| closed:', rows.filter((r) => /CLOSED/.test(r.business_status || '')).length);
// directory stays that Google also lists (each counted once)
const matchedStays = new Set(rows.filter((r) => r.slug).map((r) => r.slug));
console.log(`  directory stays also on Google Maps: ${matchedStays.size} of ${stays.length}`);
const open = (r) => r.business_status !== 'CLOSED_PERMANENTLY';
const need = rows.filter((r) => open(r) && (!r.in_directory || !r.booking_url)).map((r) => r.place_id);
writeFileSync(join(HERE, '.cache/places/need-phones.json'), JSON.stringify(need));
// open places without a booking link yet, as a stays file the matchers can read (STAYS_FILE=…)
const unlinked = rows.filter((r) => open(r) && !r.booking_url && r.name && r.latitude)
  .map((r) => ({ id: `g-${r.place_id}`, n: r.name, cy: r.city, ll: [r.latitude, r.longitude] }));
writeFileSync(join(HERE, '.cache/places/unlinked-stays.json'), JSON.stringify(unlinked));
console.log(`  open places without a booking link (for the matchers): ${unlinked.length}`);
console.log(`  open places new to us or without a booking link (phone worth fetching): ${need.length}`
  + ` (new: ${rows.filter((r) => open(r) && !r.in_directory).length}, in directory without link: ${rows.filter((r) => open(r) && r.in_directory && !r.booking_url).length})`);
if (DRY) process.exit(0);

const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
  : JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || join(HERE, '../../credentials/bigquery-service-account.json'), 'utf8'));
const bigquery = new BigQuery({ projectId: credentials.project_id, credentials });
const file = join(mkdtempSync(join(tmpdir(), 'places-')), 'rows.ndjson');
writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n'));
const [job] = await bigquery.dataset(DATASET_ID).table(TABLE_ID).load(file, {
  sourceFormat: 'NEWLINE_DELIMITED_JSON', writeDisposition: 'WRITE_TRUNCATE', schema: { fields: SCHEMA }, createDisposition: 'CREATE_IF_NEEDED',
});
if (job.status?.errors?.length) throw new Error(JSON.stringify(job.status.errors.slice(0, 3)));
console.log(`Loaded ${rows.length} rows into ${DATASET_ID}.${TABLE_ID} (internal only)`);
