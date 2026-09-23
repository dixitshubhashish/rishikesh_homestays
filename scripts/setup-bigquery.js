// One-time setup: creates the BigQuery dataset + enquiries table used by
// api/contact.js. Safe to re-run — skips creation if either already exists.
import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync } from 'fs';
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

const bigquery = new BigQuery({ projectId: resolveProjectId() });

const schema = [
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
  { name: 'status', type: 'STRING', mode: 'NULLABLE' },
  { name: 'ip_address', type: 'STRING', mode: 'NULLABLE' },
  { name: 'user_agent', type: 'STRING', mode: 'NULLABLE' },
  { name: 'referrer', type: 'STRING', mode: 'NULLABLE' }
];

async function main() {
  const [dataset] = await bigquery.dataset(DATASET_ID).get({ autoCreate: true });
  console.log(`✅ Dataset ready: ${dataset.id}`);

  const table = dataset.table(TABLE_ID);
  const [exists] = await table.exists();
  if (exists) {
    console.log(`ℹ️  Table already exists: ${DATASET_ID}.${TABLE_ID} (schema left untouched)`);
    return;
  }

  await dataset.createTable(TABLE_ID, {
    schema,
    timePartitioning: { type: 'DAY', field: 'created_at' }
  });
  console.log(`✅ Table created: ${DATASET_ID}.${TABLE_ID}`);
}

main().catch((err) => {
  console.error('❌ BigQuery setup failed:', err.message);
  process.exit(1);
});
