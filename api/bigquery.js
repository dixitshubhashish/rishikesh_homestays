// Load .env before reading any process.env values below. ES module imports
// are all evaluated before an importing file's own top-level code runs, so
// relying on a caller's later `dotenv.config()` call (e.g. contact.js's) is
// too late — this module's env-dependent code below would already have run.
import 'dotenv/config';
import { BigQuery } from '@google-cloud/bigquery';
import { readFileSync } from 'fs';

const DATASET_ID = process.env.BIGQUERY_DATASET || 'rishikesh_homestays';
const TABLE_ID = process.env.BIGQUERY_ENQUIRIES_TABLE || 'enquiries';

// Vercel: paste the full service-account JSON into GOOGLE_APPLICATION_CREDENTIALS_JSON.
// Local dev: GOOGLE_APPLICATION_CREDENTIALS points at credentials/bigquery-service-account.json (see .env.example).
// projectId is always resolved explicitly (from the key itself) rather than
// left to the client's default lookup, which doesn't reliably infer it from
// either credential source in this project's runtime.
function buildClientOptions() {
  const inlineCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (inlineCredentials) {
    const credentials = JSON.parse(inlineCredentials);
    return { projectId: credentials.project_id, credentials };
  }

  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFilePath) {
    const credentials = JSON.parse(readFileSync(keyFilePath, 'utf8'));
    return { projectId: credentials.project_id, keyFilename: keyFilePath };
  }

  return {};
}

const bigquery = new BigQuery(buildClientOptions());

export async function insertEnquiry(row) {
  await bigquery.dataset(DATASET_ID).table(TABLE_ID).insert([row]);
}
