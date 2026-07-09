import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getTableSchema() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/?apikey=${SERVICE_ROLE_KEY}`,
      {
        method: 'GET',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    // Try direct SQL query via Supabase
    const sqlResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_table_columns`,
      {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ table_name: 'enquiries' })
      }
    );

    const result = await sqlResponse.json();
    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

getTableSchema();
