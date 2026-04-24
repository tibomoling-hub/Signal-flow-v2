import { createClient } from '@supabase/supabase-js';
import { config } from '../js/config.js';

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

async function checkSchema() {
    console.log("Checking users table schema...");
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching users:", error);
    } else if (data && data.length > 0) {
        console.log("Columns found:", Object.keys(data[0]));
    } else {
        console.log("No data found in users table.");
        // Try to insert a dummy row to see what happens or just guess
    }
}

checkSchema();
