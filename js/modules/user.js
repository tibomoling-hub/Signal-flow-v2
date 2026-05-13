import { supabase } from '../supabase.js';

export const userProfile = {
    data: {
        idUser: null,
        firstName: '',
        lastName: '',
        brand: '',
        description: '',
        linkedinUrl: '',
        niche: [],
        tone: [],
        goal: []
    },
    isLoaded: false,

    async load() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return null;

            const authId = session.user.id;

            const { data: profile, error } = await supabase
                .from('users')
                .select('*')
                .eq('id_auth_user', authId)
                .single();

            if (error || !profile) throw error || new Error("Profile not found");

            this.data.idUser = profile.id_user;

            this.data.firstName = profile.first_name || profile.full_name || '';
            this.data.lastName = profile.last_name || '';
            this.data.brand = profile.company || profile.last_name || 'Free Plan';
            this.data.description = profile.description || '';
            this.data.linkedinUrl = profile.linkedin_link || profile.linkedin_url || '';
            
            if (profile.topic) {
                this.data.niche = typeof profile.topic === 'string' 
                    ? profile.topic.split(',').map(s => s.trim()).filter(Boolean) 
                    : (Array.isArray(profile.topic) ? profile.topic : []);
            }

            this.isLoaded = true;
            return this.data;
        } catch (e) {
            console.error("User Profile: Error loading", e);
            return null;
        }
    },

    updateLocal(newData) {
        this.data = { ...this.data, ...newData };
    }
};

window.userProfile = userProfile;
