import { config } from './config.js';

// Initialisation différée pour s'assurer que le CDN est chargé
let instance = null;

export const getSupabase = () => {
    if (instance) return instance;
    
    if (window.supabase) {
        instance = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        return instance;
    }
    
    console.error("Supabase CDN non détecté sur window.supabase");
    return null;
};

export const supabase = {
    get auth() {
        const s = getSupabase();
        return s ? s.auth : { getSession: async () => ({ data: { session: null } }) };
    },
    from(table) {
        const s = getSupabase();
        return s ? s.from(table) : { select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) };
    },
    rpc(name, params) {
        const s = getSupabase();
        return s ? s.rpc(name, params) : Promise.reject("Supabase non initialisé");
    },
    get functions() {
        const s = getSupabase();
        return s ? s.functions : { invoke: async () => ({ error: "Supabase non initialisé" }) };
    }
};
