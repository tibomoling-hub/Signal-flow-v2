const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://yfjvivjztpgriyzwdles.supabase.co';
const supabaseKey = 'sb_publishable_anon_key_...'; // I should get the real key from config.js

async function test() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error) console.error(error);
    else console.log("Success:", data);
}
test();
