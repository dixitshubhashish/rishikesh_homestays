// Rebuilds the gitignored Google Maps cache (.cache/places/places.json, all-stays.json, ota-links.tsv, phones.json) from BigQuery
// places_lodging, for a machine that doesn't have the originals. READ-ONLY (SELECT only, no Places API calls). phones.json is the
// sweep's own file ({id: {phone, website}}, push_places.mjs derives google_website links from it): internal, gitignored, never on the site.
// Usage: node scripts/stays/rebuild_places_cache.mjs [--dry-run] [--force]   (README "Google Maps places"; --force overwrites a cache that exists)
import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DIR = join(HERE, '.cache', 'places');
const DATASET = process.env.BIGQUERY_DATASET || 'rishikesh_homestays';
const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const TARGETS = ['places.json', 'all-stays.json', 'ota-links.tsv', 'phones.json'];
// merge_found.sh appends to ota-links.tsv and the sweep wrote the originals: never replace them silently
if (!DRY && !FORCE && TARGETS.some((n) => existsSync(join(DIR, n)))) throw new Error(`cache already in ${DIR}: --dry-run to compare, --force to overwrite`);

const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
  : JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || join(HERE, '../../credentials/bigquery-service-account.json'), 'utf8').replace(/^﻿/, ''));
const bigquery = new BigQuery({ projectId: credentials.project_id, credentials });

// the only way this script talks to BigQuery: a single SELECT, nothing else
async function select(sql) {
  if (!/^\s*SELECT\b/i.test(sql) || /;\s*\S/.test(sql)) throw new Error('read-only: SELECT statements only');
  const timer = setTimeout(() => { console.error('BigQuery did not answer in 5 minutes'); process.exit(2); }, 300000);
  try { return (await bigquery.query({ query: sql }))[0]; } finally { clearTimeout(timer); }
}

const rows = await select(`SELECT place_id, city, km_from_centre, name, address, latitude, longitude, google_type, google_types, phone, website,
  business_status, google_maps_url, in_directory, booking_site, booking_page, booking_source, fetched_date
  FROM \`${credentials.project_id}.${DATASET}.places_lodging\` ORDER BY place_id`);
if (rows.length < 1000) throw new Error(`only ${rows.length} rows in places_lodging: refusing to write a partial cache`);
const date = (d) => (d && typeof d === 'object' ? d.value : d) || null;

// 1. places.json: what places_sweep.mjs --phase details wrote (id, city, km, name, address, lat, lng, type, types, status, maps, fetched)
const places = rows.map((r) => ({ id: r.place_id, city: r.city, km: r.km_from_centre, name: r.name, address: r.address,
  lat: r.latitude, lng: r.longitude, type: r.google_type, types: r.google_types || [], status: r.business_status,
  maps: r.google_maps_url, fetched: date(r.fetched_date) }));

// 2. all-stays.json: the stays-file shape the matchers and map_seen_pages/organise_found/prune_unfound read (id g-<place_id>, n, cy, ll)
const allStays = rows.filter((r) => r.name && r.latitude != null && r.longitude != null)
  .map((r) => ({ id: `g-${r.place_id}`, n: r.name, cy: r.city, ll: [r.latitude, r.longitude] }));

// 3. ota-links.tsv: the links found for Google places themselves (push_places.mjs placeLinks: verified rows, key g-<place_id>, the
// booking site's own page without the affiliate wrapper). Those are the places whose link push_places recorded as 'matched'
// (booking_source 'directory' comes from the directory's ota-links.tsv, 'google_website' from the place's own website).
const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const links = rows.filter((r) => r.booking_source === 'matched' && r.booking_page)
  .map((r) => [`g-${r.place_id}`, 'verified', clean(r.booking_site), clean(r.booking_page).split('?')[0], 'Google Maps place, browser-confirmed match', ''])
  .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
const tsv = ['key\tstatus\tota\turl\tnote\tchecked', ...links.map((l) => l.join('\t'))].join('\n') + '\n';

// 4. phones.json: only the places the sweep looked up (a phone or a website), as places_sweep.mjs --phase phones wrote them
const phones = Object.fromEntries(rows.filter((r) => r.phone || r.website).map((r) => [r.place_id, { phone: r.phone || null, website: r.website || null }]));

const count = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
console.log(`places.json: ${places.length}`, count(places, (p) => p.city));
console.log(`all-stays.json: ${allStays.length}`, count(allStays, (p) => p.cy));
console.log(`ota-links.tsv: ${links.length} verified rows`, count(links, (l) => l[2]));
console.log(`phones.json: ${Object.keys(phones).length} places (${Object.values(phones).filter((p) => p.phone).length} phones, ${Object.values(phones).filter((p) => p.website).length} websites)`);
console.log('rows with a booking link in BigQuery (any source):', rows.filter((r) => r.booking_page).length, count(rows.filter((r) => r.booking_page), (r) => r.booking_source));
if (DRY) process.exit(0);

// all files are written next to their targets first, then renamed over them (LF, UTF-8); a rename another process blocks (Windows keeps
// open files locked) is retried
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function rename(from, to) {
  for (let i = 0; ; i++) {
    try { return renameSync(from, to); } catch (e) { if (i >= 20 || !/^(EPERM|EBUSY|EACCES)$/.test(e.code)) throw e; sleep(250); }
  }
}
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
const out = { 'places.json': JSON.stringify(places, null, 1), 'all-stays.json': JSON.stringify(allStays), 'ota-links.tsv': tsv, 'phones.json': JSON.stringify(phones, null, 1) };
for (const [name, text] of Object.entries(out)) writeFileSync(join(DIR, `${name}.tmp`), text, { encoding: 'utf8' });
for (const name of Object.keys(out)) rename(join(DIR, `${name}.tmp`), join(DIR, name));
console.log(`written to ${DIR}`);
