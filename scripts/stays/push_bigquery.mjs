// Step 4 (optional): snapshot the processed stays into BigQuery so the
// market can be queried and tracked over time (new/closed stays, price and
// rating changes). One row per stay per snapshot_date in
// <BIGQUERY_DATASET>.market_properties (default rishikesh_homestays), a
// table partitioned by snapshot_date. Re-running on the same day replaces
// only that day's partition, so it's safe to repeat.
//
// Usage: node scripts/stays/push_bigquery.mjs
// Needs the same credentials as api/bigquery.js (GOOGLE_APPLICATION_CREDENTIALS
// file path locally, or GOOGLE_APPLICATION_CREDENTIALS_JSON in CI). Skips
// with a message when neither is set, so refresh.py never fails because of it.
import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const DATASET_ID = process.env.BIGQUERY_DATASET || 'rishikesh_homestays';
const TABLE_ID = process.env.BIGQUERY_MARKET_TABLE || 'market_properties';
const HERE = new URL('.', import.meta.url).pathname;

function clientOptions() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    return { projectId: credentials.project_id, credentials };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credentials = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    return { projectId: credentials.project_id, keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS };
  }
  return null;
}

const SCHEMA = [
  { name: 'snapshot_date', type: 'DATE', mode: 'REQUIRED' },
  { name: 'id', type: 'STRING', mode: 'REQUIRED' }, // slug (stable text key)
  { name: 'listing_id', type: 'INTEGER' }, // stable numeric primary key (scripts/stays/listing-ids.tsv)
  { name: 'city', type: 'STRING' }, // rishikesh | haridwar | …
  { name: 'name', type: 'STRING', mode: 'REQUIRED' },
  { name: 'is_own', type: 'BOOLEAN', mode: 'REQUIRED' },
  { name: 'area', type: 'STRING' },
  { name: 'primary_type', type: 'STRING' },
  { name: 'types', type: 'STRING', mode: 'REPEATED' },
  { name: 'themes', type: 'STRING', mode: 'REPEATED' },
  { name: 'stars', type: 'INTEGER' },
  { name: 'guest_rating', type: 'FLOAT' },
  { name: 'reviews', type: 'INTEGER' },
  { name: 'price_from_inr', type: 'INTEGER' },
  { name: 'facilities', type: 'STRING', mode: 'REPEATED' },
  { name: 'address', type: 'STRING' },
  { name: 'latitude', type: 'FLOAT' },
  { name: 'longitude', type: 'FLOAT' },
  { name: 'booking_status', type: 'STRING' }, // verified | doubtful | none | unsearched
  { name: 'booking_site', type: 'STRING' },
  { name: 'booking_url', type: 'STRING' },
  { name: 'source_url', type: 'STRING' },
  // Bedrooms from the name (process.py bd): 0 = studio, 9 = 8+, NULL = unknown.
  // Last, so the load's ALLOW_FIELD_ADDITION adds it to the existing table.
  { name: 'bedrooms', type: 'INTEGER' },
  { name: 'agoda_url_unconfirmed', type: 'STRING' }, // exact-name Agoda page (Agoda blocks automated checks; internal only)
];

const OWN_KEYS = ['advaitam-ganga-hill-view-homestay-by-the-ganges-ghat', 'villa-elysium-the-himalayan-ganges-view-yoga-retreat', 'villa-yoga-retreat-at-the-ganges-in'];

async function main() {
  const options = clientOptions();
  if (!options) {
    console.log('BigQuery credentials not set; skipping market_properties snapshot.');
    return;
  }
  // Every city in one load: Rishikesh at .cache/stays.json (legacy layout),
  // others at .cache/<city>/stays.json. Loading all together matters because
  // the load replaces the whole day's partition.
  const cityFiles = [['rishikesh', join(HERE, '.cache/stays.json')],
    ...readdirSync(join(HERE, '.cache'), { withFileTypes: true }).filter((e) => e.isDirectory())
      .map((e) => [e.name, join(HERE, '.cache', e.name, 'stays.json')]).filter(([, f]) => existsSync(f))];
  const stays = cityFiles.flatMap(([city, f]) => JSON.parse(readFileSync(f, 'utf8')).map((s) => ({ ...s, cy: s.cy || city })));
  const links = {};
  for (const line of readFileSync(join(HERE, 'ota-links.tsv'), 'utf8').trim().split('\n').slice(1)) {
    const [key, status, site, url] = line.split('\t');
    links[key] = { status, site: site === '-' ? null : site, url: url && url.startsWith('https://') ? url : null };
  }
  const agodaExact = {};
  const agodaFile = join(HERE, '.cache/places/agoda-exact.tsv');
  if (existsSync(agodaFile)) for (const line of readFileSync(agodaFile, 'utf8').trim().split('\n')) {
    const [key, url] = line.split('\t');
    agodaExact[key] = url;
  }
  const today = new Date().toISOString().slice(0, 10);
  const rows = stays.map((s) => {
    const l = links[s.id];
    return {
      snapshot_date: today, id: s.id, listing_id: s.lid, city: s.cy, name: s.n, is_own: OWN_KEYS.some((k) => s.u.includes(k)),
      area: s.a, primary_type: s.k, types: s.ks, themes: s.t,
      stars: s.s || null, guest_rating: s.g ?? null, reviews: s.c ?? null, price_from_inr: s.p ?? null,
      facilities: s.f, address: s.ad || null, latitude: s.ll?.[0] ?? null, longitude: s.ll?.[1] ?? null,
      booking_status: l ? l.status : 'unsearched', booking_site: l?.site ?? null,
      booking_url: l?.status === 'verified' ? l.url : null, source_url: s.u,
      bedrooms: s.bd ?? null,
      agoda_url_unconfirmed: agodaExact[s.id] ?? null,
    };
  });

  const bigquery = new BigQuery(options);
  const dataset = bigquery.dataset(DATASET_ID);
  const table = dataset.table(TABLE_ID);
  const [exists] = await table.exists();
  if (!exists) {
    await dataset.createTable(TABLE_ID, {
      schema: SCHEMA,
      timePartitioning: { type: 'DAY', field: 'snapshot_date' },
      description: 'Rishikesh market stays, one row per stay per snapshot (scripts/stays/push_bigquery.mjs).',
    });
    console.log(`Created ${DATASET_ID}.${TABLE_ID}`);
  }

  // Load job (free, no streaming buffer) into today's partition only.
  const file = join(mkdtempSync(join(tmpdir(), 'stays-')), 'rows.ndjson');
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n'));
  const partition = `${TABLE_ID}$${today.replaceAll('-', '')}`;
  const [job] = await dataset.table(partition).load(file, {
    sourceFormat: 'NEWLINE_DELIMITED_JSON', writeDisposition: 'WRITE_TRUNCATE', schema: { fields: SCHEMA },
    schemaUpdateOptions: ['ALLOW_FIELD_ADDITION'],
  });
  const errors = job.status?.errors;
  if (errors?.length) throw new Error(JSON.stringify(errors.slice(0, 3)));
  const counts = rows.reduce((m, r) => ((m[r.booking_status] = (m[r.booking_status] || 0) + 1), m), {});
  const byCity = rows.reduce((m, r) => ((m[r.city] = (m[r.city] || 0) + 1), m), {});
  console.log(`Loaded ${rows.length} stays into ${DATASET_ID}.${TABLE_ID} for ${today}:`, byCity, counts);
}

main().catch((err) => { console.error('push_bigquery failed:', err.message); process.exit(1); });
