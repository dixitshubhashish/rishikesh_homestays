import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectTable() {
  try {
    // Try to get OpenAPI schema
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      {
        headers: {
          'Accept': 'application/openapi+json'
        }
      }
    );
    
    const schema = await response.json();
    const enquiriesSchema = schema.paths['/enquiries'];
    
    if (enquiriesSchema) {
      console.log('Enquiries endpoint found!');
      // Get columns from GET response schema
      const getOp = enquiriesSchema.get;
      console.log(JSON.stringify(getOp, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectTable();
