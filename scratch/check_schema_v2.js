import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://ytstevgskzzzxxzyeehx.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    console.log(`Schema for table: ${tableName}`);
    if (data && data.length > 0) {
        console.log('Sample row:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('Table is empty, cannot infer types from sample row.');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

const table = process.argv[2] || 'posts';
checkSchema(table);
