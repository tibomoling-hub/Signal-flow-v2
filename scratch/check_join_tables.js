import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkSchemas() {
    console.log('--- user_tones ---');
    const { data: tones, error: tonesErr } = await supabase.from('user_tones').select('*').limit(1);
    if (tonesErr) console.error('Error user_tones:', tonesErr.message);
    else if (tones && tones.length > 0) console.log('Columns:', Object.keys(tones[0]));
    else console.log('Table empty, but exists.');

    console.log('\n--- user_goals ---');
    const { data: goals, error: goalsErr } = await supabase.from('user_goals').select('*').limit(1);
    if (goalsErr) console.error('Error user_goals:', goalsErr.message);
    else if (goals && goals.length > 0) console.log('Columns:', Object.keys(goals[0]));
    else console.log('Table empty, but exists.');
}

checkSchemas();
