import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  try {
    // Query information schema
    const { data, error } = await supabase
      .rpc('get_columns', { 'table_name': 'enquiries' });

    if (error) {
      // If RPC doesn't work, try direct query
      const { data: colData, error: colError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'enquiries');
      
      console.log('Columns:', colData);
      console.log('Error:', colError);
    } else {
      console.log('Columns:', data);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkSchema();
