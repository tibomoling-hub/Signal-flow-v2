import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkData() {
    const { data, error } = await supabase
        .from('users')
        .select('tone, goal')
        .limit(5);
    
    if (error) {
        console.error(error);
    } else {
        console.log("Current Data in 'users' table:");
        console.table(data);
    }
}

checkData();
