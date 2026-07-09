import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumns() {
  try {
    // Check current schema
    const { data, error } = await supabase
      .rpc('exec', {
        sql: `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'enquiries' 
          ORDER BY ordinal_position
        `
      })
      .catch(() => null);

    console.log('Current schema might be restricted. Attempting direct column additions...\n');

    // Add missing columns if they don't exist
    const columnsToAdd = [
      { name: 'area', type: 'text', nullable: true },
      { name: 'coming_from_city', type: 'text', nullable: true },
      { name: 'pets', type: 'text', nullable: true },
      { name: 'pet_count', type: 'integer', nullable: true, default: 0 }
    ];

    // Try to add each column
    for (const col of columnsToAdd) {
      const sql = `
        ALTER TABLE enquiries 
        ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${col.default ? ` DEFAULT ${col.default}` : ''}
      `;
      
      console.log(`Adding column: ${col.name} (${col.type})...`);
      
      const { error: addError } = await supabase.rpc('exec', { sql }).catch(() => ({ error: { message: 'Schema modification requires dashboard' } }));
      
      if (addError) {
        console.log(`⚠️  Cannot add ${col.name} via API: ${addError.message}`);
        console.log(`   Please add manually via Supabase dashboard: ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${col.default ? ` DEFAULT ${col.default}` : ''}`);
      } else {
        console.log(`✅ Added column: ${col.name}`);
      }
    }

    console.log('\n📋 SQL to run in Supabase dashboard if needed:\n');
    const sqlStatements = columnsToAdd.map(col => 
      `ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${col.default ? ` DEFAULT ${col.default}` : ''};`
    ).join('\n');
    console.log(sqlStatements);

  } catch (err) {
    console.error('Error:', err.message);
  }
}

addColumns();
