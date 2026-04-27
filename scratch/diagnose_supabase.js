import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = "https://ytstevgskzzzxxzyeehx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0c3Rldmdza3p6enh4enllZWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzY5MDgsImV4cCI6MjA5MDQ1MjkwOH0.S7SYhso2r-t4__2idgvGgl1qZ162pZhOtJnc8T0Vbps";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
    console.log("--- Supabase Diagnosis Start ---");
    
    // 1. Check if we can talk to the API
    const { data: health, error: healthError } = await supabase.from('users').select('id_user').limit(1);
    
    if (healthError) {
        console.error("Health Check Error:", healthError.message);
        if (healthError.message.includes("relation \"users\" does not exist")) {
            console.error("CRITICAL: The 'users' table does not exist in your new project!");
        } else if (healthError.message.includes("row-level security")) {
            console.error("RLS: The 'users' table exists but is locked by RLS.");
        }
    } else {
        console.log("Success: 'users' table exists and is readable.");
    }
    
    console.log("--- Supabase Diagnosis End ---");
}

diagnose();
