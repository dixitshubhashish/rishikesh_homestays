// Setup: creates the BigQuery dataset + enquiries table used by
// api/contact.js. Safe to re-run: an existing table is never recreated, but
// any column in `schema` that it lacks is added (NULLABLE only, so old rows
// stay valid). Add the column here and run this BEFORE deploying code that
// writes it, or the insert fails.
import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const DATASET_ID = process.env.BIGQUERY_DATASET || 'rishikesh_homestays';
const TABLE_ID = process.env.BIGQUERY_ENQUIRIES_TABLE || 'enquiries';

// Resolve projectId the same explicit way api/bigquery.js does — the client's
// default lookup doesn't reliably infer it from GOOGLE_APPLICATION_CREDENTIALS here.
function resolveProjectId() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON).project_id;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')).project_id;
  }
  return process.env.GOOGLE_CLOUD_PROJECT;
}

export const schema = [
  { name: 'id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
  { name: 'name', type: 'STRING', mode: 'REQUIRED' },
  { name: 'email', type: 'STRING', mode: 'NULLABLE' },
  { name: 'email_verified', type: 'BOOLEAN', mode: 'NULLABLE' },
  { name: 'phone', type: 'STRING', mode: 'REQUIRED' },
  { name: 'check_in', type: 'DATE', mode: 'NULLABLE' },
  { name: 'check_out', type: 'DATE', mode: 'NULLABLE' },
  { name: 'adults', type: 'INTEGER', mode: 'NULLABLE' },
  { name: 'children', type: 'INTEGER', mode: 'NULLABLE' },
  { name: 'guests', type: 'STRING', mode: 'NULLABLE' },
  { name: 'property_slug', type: 'STRING', mode: 'NULLABLE' },
  { name: 'area', type: 'STRING', mode: 'NULLABLE' },
  { name: 'coming_from_city', type: 'STRING', mode: 'NULLABLE' },
  { name: 'pets', type: 'STRING', mode: 'NULLABLE' },
  { name: 'pet_count', type: 'INTEGER', mode: 'NULLABLE' },
  { name: 'message', type: 'STRING', mode: 'NULLABLE' },
  // 'website_form' (contact page) or 'whatsapp_widget' (popup), per CLAUDE.md.
  // Kept STRING (not an enum) so new sources can be added without a schema change.
  { name: 'source', type: 'STRING', mode: 'NULLABLE' },
  // Language of the page the enquiry was sent from ('en', 'hi', ...).
  { name: 'page_lang', type: 'STRING', mode: 'NULLABLE' },
  { name: 'status', type: 'STRING', mode: 'NULLABLE' },
  { name: 'ip_address', type: 'STRING', mode: 'NULLABLE' },
  { name: 'user_agent', type: 'STRING', mode: 'NULLABLE' },
  { name: 'referrer', type: 'STRING', mode: 'NULLABLE' }
];

// Adds the columns of `wanted` that `table` lacks. Only NULLABLE columns can
// be added to a table that has rows; anything else is reported, not forced.
// Returns the names added.
export async function addMissingColumns(table, wanted = schema) {
  const [metadata] = await table.getMetadata();
  const fields = (metadata.schema && metadata.schema.fields) || [];
  const have = new Set(fields.map((f) => f.name.toLowerCase()));
  const missing = wanted.filter((f) => !have.has(f.name.toLowerCase()));
  const addable = missing.filter((f) => (f.mode || 'NULLABLE') === 'NULLABLE');
  for (const f of missing) {
    if (!addable.includes(f)) console.warn(`⚠️  Not adding ${f.mode} column ${f.name}: only NULLABLE columns can be added`);
  }
  if (!addable.length) return [];
  // Send back the full existing schema plus the new columns; etag guards
  // against a concurrent schema change.
  await table.setMetadata({ schema: { fields: [...fields, ...addable] }, etag: metadata.etag });
  return addable.map((f) => f.name);
}

async function main() {
  const bigquery = new BigQuery({ projectId: resolveProjectId() });
  const [dataset] = await bigquery.dataset(DATASET_ID).get({ autoCreate: true });
  console.log(`✅ Dataset ready: ${dataset.id}`);

  const table = dataset.table(TABLE_ID);
  const [exists] = await table.exists();
  if (exists) {
    const added = await addMissingColumns(table);
    console.log(added.length
      ? `✅ Added column(s) to ${DATASET_ID}.${TABLE_ID}: ${added.join(', ')}`
      : `ℹ️  Table already exists with every column: ${DATASET_ID}.${TABLE_ID}`);
    return;
  }

  await dataset.createTable(TABLE_ID, {
    schema,
    timePartitioning: { type: 'DAY', field: 'created_at' }
  });
  console.log(`✅ Table created: ${DATASET_ID}.${TABLE_ID}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('❌ BigQuery setup failed:', err.message);
    process.exit(1);
  });
}
