import { supabase } from '../supabase.js';

export const isValidSocialUrl = (url) => {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        const validHosts = ['linkedin.com', 'twitter.com', 'x.com', 'instagram.com', 'threads.net', 'substack.com', 'youtube.com'];
        return validHosts.some(host => parsed.hostname.includes(host));
    } catch (e) {
        return false;
    }
};

export const onboarding = {
    step: 1,
    totalSteps: 6,
    data: {
        firstName: '',
        brand: '',
        niche: [],
        linkedinUrl: '',
        topicsActive: true,
        availableDBTopics: null,
        topicsLoaded: false,
        audienceSize: '0-1k',
        frequency: 'daily',
        goal: 'grow',
        tone: 'Expert',
        formats: [],
        rgpd: false,
        description: '' // Added for Step 02
    },
    id_user: null, // Primary key from DB
    id_auth_user: null, // UUID from Auth provider
    errors: {},

    updateData(newData) {
        this.data = { ...this.data, ...newData };
    },

    async next() {
        if (this.validateCurrentStep()) {
            // Save current step data to DB
            await this.saveStep(this.step);
            
            if (this.step < this.totalSteps) {
                this.step++;
                this.render();
            }
        }
    },

    prev() {
        if (this.step > 1) {
            this.step--;
            this.render();
        }
    },

    validateCurrentStep() {
        this.errors = {};
        if (this.step === 2) {
            if (!this.data.firstName.trim()) this.errors.firstName = "Le prénom est requis.";
            if (!this.data.brand.trim()) this.errors.brand = "Le nom de marque est requis.";
        } else if (this.step === 4) {
            if (this.data.linkedinUrl && !isValidSocialUrl(this.data.linkedinUrl)) {
                this.errors.linkedin = "URL LinkedIn invalide.";
            }
        } else if (this.step === 6) {
            if (!this.data.rgpd) this.errors.rgpd = "Acceptation requise.";
        }
        if (Object.keys(this.errors).length > 0) {
            this.render();
            return false;
        }
        return true;
    },

    async ensureUserExists() {
        const { data: { session } } = await supabase.auth.getSession();
        let authId = session?.user?.id;
        
        // DEV FALLBACK
        if (!authId && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            console.warn("DEBUG: Aucun ID session. Utilisation de l'ID de test.");
            authId = '00000000-0000-0000-0000-000000000000';
        }

        if (!authId) {
            console.error("Erreur de synchronisation du signal : ID utilisateur introuvable. Veuillez vous reconnecter.");
            this.fetchError = "ERREUR SESSION : Utilisateur non identifié";
            return;
        }

        this.id_auth_user = authId;

        // Check if exists
        const { data: existing, error: checkError } = await supabase
            .from('users')
            .select('id_user')
            .eq('id_auth_user', authId)
            .maybeSingle();

        if (checkError) {
            console.error("Error checking user existence:", checkError);
            return;
        }

        if (!existing) {
            console.log("[Signal Flow DB] Création d'une nouvelle ligne utilisateur...");
            const { data: inserted, error: insertError } = await supabase
                .from('users')
                .insert({
                    id_auth_user: authId,
                    created_at: new Date().toISOString()
                })
                .select('id_user')
                .single();

            if (insertError) {
                console.error("Error creating user row:", insertError);
            } else {
                this.id_user = inserted.id_user;
                console.log("[Signal Flow DB] Ligne créée avec id_user:", this.id_user);
            }
        } else {
            this.id_user = existing.id_user;
            console.log("[Signal Flow DB] Utilisateur existant trouvé, id_user:", this.id_user);
        }
    },

    async saveStep(stepNumber) {
        if (!this.id_auth_user) await this.ensureUserExists();
        if (!this.id_auth_user) return;

        let updateData = {};
        let columns = "";

        switch(stepNumber) {
            case 2:
                updateData = {
                    full_name: this.data.firstName,
                    company: this.data.brand,
                    description: this.data.description || ''
                };
                columns = "full_name, company, description";
                break;
            case 3:
                updateData = {
                    topic: this.data.niche.join(', ')
                };
                columns = "topic";
                break;
            case 4:
                updateData = {
                    linkedin_url: this.data.linkedinUrl
                };
                columns = "linkedin_url";
                break;
            case 5:
                updateData = {
                    tone: this.data.tone,
                    goal: this.data.goal
                };
                columns = "tone, goal";
                break;
            case 6:
                updateData = {
                    onboarding_completed: true,
                    rgpd_accepted: this.data.rgpd,
                    rgpd_accepted_at: new Date().toISOString()
                };
                columns = "onboarding_completed, rgpd_accepted";
                break;
        }

        if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id_auth_user', this.id_auth_user);
            
            if (error) {
                console.error(`[Signal Flow DB] Erreur de mise à jour Step ${stepNumber}:`, error.message);
            } else {
                console.log(`[Signal Flow DB] Mise à jour réussie pour id_user: ${this.id_user || 'N/A'} | Colonne(s) modifiée(s) : ${columns}`);
            }
        }
    },

    async save() {
        await this.saveStep(6);
        
        // Validation Finale : Vérification de l'intégralité de la ligne
        const { data: finalProfile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id_auth_user', this.id_auth_user)
            .single();
        
        if (!error && finalProfile) {
            console.log(`[Signal Flow DB] Synchronisation Finale réussie pour id_user: ${this.id_user}`);
            console.log(`[Signal Flow DB] État final :`, {
                identite: !!(finalProfile.full_name && finalProfile.company),
                topics: !!finalProfile.topic,
                vecteur: !!finalProfile.linkedin_url,
                direction: !!(finalProfile.tone && finalProfile.goal),
                complet: finalProfile.onboarding_completed
            });
        }
    },

    addTopic() {
        const input = document.getElementById('topic-input');
        const val = input.value.trim();
        if (val && !this.data.niche.includes(val)) {
            this.data.niche.push(val);
            input.value = '';
            this.render();
        }
    },

    removeTopic(index) {
        this.data.niche.splice(index, 1);
        this.render();
    },

    setTone(tone) {
        this.data.tone = tone;
        this.render();
    },

    addTone() {
        const input = document.getElementById('new-tone-input');
        const val = input.value.trim();
        if (val && !this.availableTones.includes(val)) {
            this.availableTones.push(val);
            this.data.tone = val;
            this.render();
        }
    },

    setGoal(goal) {
        this.data.goal = goal;
        this.render();
    },

    addGoal() {
        const input = document.getElementById('new-goal-input');
        const val = input.value.trim();
        if (val && !this.availableGoals.includes(val)) {
            this.availableGoals.push(val);
            this.data.goal = val;
            this.render();
        }
    },

    removeGoal(index) {
        this.availableGoals.splice(index, 1);
        if (this.data.goal === this.availableGoals[index]) this.data.goal = this.availableGoals[0] || '';
        this.render();
    },

    removeAvailableTone(index) {
        this.availableTones.splice(index, 1);
        if (this.data.tone === this.availableTones[index]) this.data.tone = this.availableTones[0] || '';
        this.render();
    },

    toggleTopicsActive() {
        this.data.topicsActive = !this.data.topicsActive;
        this.render();
    },

    async loadTopicsFromDB() {
        if (this.topicsLoaded) return;
        this.fetchError = null;
        let authId = null;
        
        try {
            // LOG A: Auth Check
            const { data: { session } } = await supabase.auth.getSession();
            console.log("LOG A (Auth Check):", session ? "Session active" : "Aucune session");

            authId = session?.user?.id;
            
            // LOG B: ID Verification
            console.log("LOG B (ID Verification): id_auth_user =", authId);

            // Fallback for Dev if no session (must be a valid UUID format)
            if (!authId) {
                console.warn("DEBUG: Aucun ID session. Utilisation de l'ID de test (UUID blanc).");
                authId = '00000000-0000-0000-0000-000000000000';
            }

            // LOG C: Query Trace
            console.log(`LOG C (Query Trace): SELECT topic FROM users WHERE id_auth_user = '${authId}'`);

            const { data: profile, error } = await supabase
                .from('users')
                .select('topic')
                .eq('id_auth_user', authId)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "No rows found"

            if (profile && profile.topic) {
                const rawTopics = Array.isArray(profile.topic) ? profile.topic : (typeof profile.topic === 'string' ? profile.topic.split(',').map(s => s.trim()) : []);
                const cleanTopics = rawTopics.filter(t => t);
                this.data.niche = cleanTopics;
                console.log("DEBUG: Données récupérées avec succès:", cleanTopics);
            } else {
                console.log("DEBUG: Connexion établie mais colonne topic vide");
                this.data.niche = [];
            }
            this.topicsLoaded = true;
            this.render();
        } catch (e) {
            console.error("Signal Flow: Error loading topics", e.message);
            this.fetchError = "ERREUR SESSION : Utilisateur non identifié";
            this.topicsLoaded = true;
            this.render();
        }
    },

    toggleLinkedIn() {
        if (this.data.linkedinUrl && this.data.linkedinUrl.length > 0) {
            this.data.linkedinUrl = '';
        } else {
            this.data.linkedinUrl = 'https://www.linkedin.com/in/';
        }
        this.render();
    },

    render() {
        const container = document.getElementById('app');
        if (!container) return;
        
        container.innerHTML = `
            <div class="flex-1 flex flex-col items-center justify-center p-4 md:p-8 view-transition bg-black/80 backdrop-blur-xl min-h-screen overflow-hidden">
                <div class="w-full max-w-6xl bg-zinc-950 p-10 lg:p-14 rounded-[1.5rem] relative overflow-hidden shadow-[0_0_60px_rgba(0,0,0,1)] border border-white/20 animate-in zoom-in-95 duration-700 flex flex-col justify-between min-h-[600px] max-h-[90vh]">
                    
                    <!-- Header Technique Haute-Fidélité -->
                    <div class="absolute top-0 left-0 w-full p-6 flex flex-col gap-3 bg-zinc-900/40 border-b border-white/5">
                        <div class="flex justify-between items-end px-2">
                            <div class="flex flex-col gap-1">
                                <div class="flex items-center gap-3">
                                    <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(59,130,246,1)]"></div>
                                    <span class="text-[10px] font-mono text-blue-500 tracking-[0.3em] uppercase font-bold">ÉTAT : ANALYSE DU SIGNAL_0${this.step}</span>
                                </div>
                                <span class="text-[9px] font-mono text-zinc-600 tracking-widest uppercase">SÉQUENCE : 0${this.step} / 0${this.totalSteps}</span>
                            </div>
                            <div class="text-right">
                                <span class="text-[10px] font-mono text-blue-400 tracking-widest uppercase font-bold">${Math.round((this.step / this.totalSteps) * 100)}% SYNCHRONISÉ</span>
                            </div>
                        </div>
                        <div class="flex flex-col gap-4 flex-1">
                            <div class="flex gap-1">
                                ${[1, 2, 3, 4, 5, 6].map(i => {
                                    const progress = (this.step / this.totalSteps) * 6;
                                    const isFilled = progress >= i;
                                    const isCurrent = Math.ceil(progress) === i;
                                    const labels = ["INITIALISATION", "STRATÉGIE", "CALIBRATION", "VECTEUR", "DIRECTION", "DÉPLOIEMENT"];
                                    return `
                                        <div class="relative group">
                                            <div class="absolute -top-4 left-0 text-[7px] font-mono text-zinc-700 tracking-widest uppercase">${labels[i-1]}</div>
                                            <div class="h-1.5 w-full rounded-full bg-white/[0.03] border border-white/[0.05] overflow-hidden">
                                                <div class="h-full bg-blue-500 transition-all duration-1000 ease-out ${isFilled ? 'w-full' : 'w-0'} ${isCurrent ? 'shadow-[0_0_20px_rgba(59,130,246,0.9)]' : ''}"></div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>

                    <div id="step-content" class="flex-1 flex flex-col justify-center mt-12 py-8 overflow-hidden">
                        ${this.fetchError ? `
                            <div class="flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500 py-12">
                                <div class="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.1)]">
                                    <i data-lucide="shield-alert" class="text-red-500 w-12 h-12"></i>
                                </div>
                                <div class="text-center space-y-3">
                                    <h3 class="text-2xl font-black text-white uppercase tracking-tighter">Erreur de synchronisation du signal</h3>
                                    <p class="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">ID utilisateur introuvable. La connexion avec la base de données a été interrompue ou votre session a expiré.</p>
                                </div>
                                <button onclick="location.reload()" class="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all flex items-center gap-3">
                                    <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                                    Réinitialiser la connexion
                                </button>
                            </div>
                        ` : this.getStepContent()}
                    </div>

                    <div class="flex gap-8 pt-8 border-t border-white/5 items-center">
                        ${this.step > 1 ? `<button id="onb-prev" class="btn-secondary px-12 py-4 font-mono text-[10px] uppercase tracking-widest">Retour</button>` : ''}
                        <button id="onb-next" class="btn-neon btn-scan flex-1 uppercase tracking-[0.4em] text-[10px] font-black py-5 shadow-[0_0_40px_rgba(59,130,246,0.25)]">
                            ${this.step === this.totalSteps ? 'Finaliser la Synchronisation' : 'Séquence Suivante'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        this.attachListeners();
    },

    getStepContent() {
        const errorMsg = (key) => this.errors[key] ? `<p class="text-red-400 text-[10px] mt-2 font-bold uppercase tracking-wider">${this.errors[key]}</p>` : '';

        switch(this.step) {
            case 1:
                return `
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div class="space-y-10">
                            <div class="space-y-4">
                                <h2 class="text-7xl font-black text-white tracking-tighter leading-[0.85] uppercase">
                                    Captez le Signal.<br/>
                                    <span class="text-blue-500">Dominez le Flux.</span>
                                </h2>
                                <div class="flex gap-1.5">
                                    <div class="w-16 h-1 bg-blue-600"></div>
                                    <div class="w-6 h-1 bg-white/10"></div>
                                    <div class="w-3 h-1 bg-white/10"></div>
                                </div>
                            </div>
                            
                            <div class="space-y-8">
                                <p class="text-2xl text-zinc-300 font-light leading-relaxed tracking-wide">
                                    Dans l'océan de données de LinkedIn, 99% n'est que du bruit. <span class="text-white font-bold">Signal Flow</span> est votre filtre haute fidélité.
                                </p>
                            </div>
                        </div>

                        <div class="p-12 rounded-[2.5rem] bg-zinc-900/50 border border-white/5 relative overflow-hidden group shadow-inner">
                            <div class="absolute -right-12 -top-12 w-64 h-64 bg-blue-600/5 blur-[80px] rounded-full group-hover:bg-blue-600/10 transition-all duration-1000"></div>
                            
                            <div class="space-y-8 relative z-10">
                                <div class="flex items-center gap-4 text-blue-500">
                                    <i data-lucide="activity" class="w-6 h-6"></i>
                                    <span class="text-[11px] font-mono uppercase tracking-[0.4em] font-bold">CALIBRATION_REQUISE</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 2:
                return `
                    <div class="flex flex-col items-center max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full min-h-[400px]">
                            <!-- Left: Storytelling -->
                            <div class="space-y-8">
                                <div class="space-y-4">
                                    <h2 class="text-5xl font-black text-white tracking-tighter leading-tight uppercase">
                                        Calibration <br/>
                                        <span class="text-blue-500">de l'Identité</span>
                                    </h2>
                                    <div class="w-16 h-1 bg-blue-600"></div>
                                </div>
                                <p class="text-xl text-zinc-400 font-light leading-relaxed tracking-wide">
                                    Pour que le signal soit pur, l'émetteur doit être parfaitement calibré. Votre identité est la fréquence sur laquelle nous allons aligner les tendances. 
                                </p>
                                <p class="text-base text-zinc-500 font-light leading-relaxed">
                                    Définissons les paramètres de votre profil pour que chaque post généré porte votre ADN unique. Ces informations sont les balises de votre future influence.
                                </p>
                            </div>
                            
                            <div class="w-full max-w-md ml-auto space-y-10 bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                                <div class="space-y-8 relative z-10">
                                    <div class="space-y-3 group/input">
                                        <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] ml-1 group-focus-within/input:text-blue-400 transition-colors font-bold">Prénom de l'émetteur</label>
                                        <input type="text" id="onb-firstname" value="${this.data.firstName}" placeholder="Votre prénom" 
                                               class="w-full bg-zinc-950 border border-white/10 rounded-2xl px-6 py-5 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-medium text-sm">
                                        ${errorMsg('firstName')}
                                    </div>
                                    <div class="space-y-3 group/input">
                                        <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] ml-1 group-focus-within/input:text-blue-400 transition-colors font-bold">Nom du média / Marque</label>
                                        <input type="text" id="onb-brand" value="${this.data.brand}" placeholder="Ex: EchoTech" 
                                               class="w-full bg-zinc-950 border border-white/10 rounded-2xl px-6 py-5 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-medium text-sm">
                                        ${errorMsg('brand')}
                                    </div>
                                    <div class="space-y-3 group/input">
                                        <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] ml-1 group-focus-within/input:text-blue-400 transition-colors font-bold">Descriptif / Mission</label>
                                        <textarea id="onb-description" placeholder="Décrivez votre vision..." 
                                                  class="w-full bg-zinc-950 border border-white/10 rounded-2xl px-6 py-5 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-medium text-sm h-32 resize-none">${this.data.description}</textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 3:
                if (!this.topicsLoaded) this.loadTopicsFromDB();
                
                return `
                    <div class="flex flex-col items-center max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full min-h-[400px]">
                            <!-- Left: Storytelling -->
                            <div class="space-y-8">
                                <div class="space-y-4">
                                    <h2 class="text-5xl font-black text-white tracking-tighter leading-tight uppercase">
                                        Cartographie <br/>
                                        <span class="text-blue-500">des Intérêts</span>
                                    </h2>
                                    <div class="w-16 h-1 bg-blue-600"></div>
                                </div>
                                <p class="text-xl text-zinc-400 font-light leading-relaxed tracking-wide">
                                    L'émetteur est calibré, définissons maintenant votre spectre de détection. Pour isoler les signaux qui comptent, nous devons connaître vos centres d'intérêt.
                                </p>
                                <p class="text-base text-zinc-500 font-light leading-relaxed">
                                    Veuillez saisir vos thématiques sous forme de briques de contenu. Plus vos fréquences sont précises, plus l'analyse du flux sera chirurgicale.
                                </p>
                            </div>
                            
                            <div class="w-full max-w-md ml-auto space-y-10 bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                                <div class="relative z-10 space-y-8">
                                    <div class="space-y-4">
                                        <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] ml-1 font-bold">Spectre de détection</label>
                                        <div id="topic-container" class="flex flex-wrap gap-2 min-h-[140px] p-4 bg-zinc-950/50 border border-white/10 rounded-2xl items-start">
                                            ${!this.topicsLoaded ? '<div class="flex items-center gap-3 text-zinc-700 p-2 animate-pulse"><i data-lucide="refresh-cw" class="w-3.5 h-3.5 animate-spin"></i><span class="text-[10px] uppercase tracking-widest font-mono">Synchronisation...</span></div>' : ''}
                                            ${this.topicsLoaded && this.data.niche.length === 0 ? '<span class="text-zinc-700 text-[10px] italic p-2 uppercase tracking-widest">Prêt pour la synchronisation (aucun sujet détecté)</span>' : this.data.niche.map((t, idx) => `
                                                <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 border border-white/10 rounded-lg text-[11px] text-zinc-300 group/token hover:border-blue-500/50 transition-all animate-in zoom-in-95">
                                                    <span>${t}</span>
                                                    <button onclick="window.onboarding.removeTopic(${idx})" class="text-zinc-500 hover:text-red-400 transition-colors">
                                                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                                                    </button>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>

                                    ${this.fetchError ? `<div class="text-center"><p class="text-xs font-mono text-red-500 opacity-50 uppercase tracking-tighter">${this.fetchError}</p></div>` : ''}

                                    <div class="space-y-3 relative group/input">
                                        <div class="relative">
                                            <input type="text" id="topic-input" placeholder="Ajouter une fréquence..." 
                                                   class="w-full bg-zinc-950 border border-white/10 rounded-2xl px-6 py-5 pr-14 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all font-medium text-sm"
                                                   onkeypress="if(event.key === 'Enter') window.onboarding.addTopic()">
                                            <button onclick="window.onboarding.addTopic()" class="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-400">
                                                <i data-lucide="plus" class="w-5 h-5"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 4:
                return `
                    <div class="flex flex-col items-center max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full min-h-[400px]">
                            <div class="space-y-8">
                                <div class="space-y-4">
                                    <h2 class="text-5xl font-black text-white tracking-tighter leading-tight uppercase">
                                        Vecteur <br/>
                                        <span class="text-blue-500">de Transmission</span>
                                    </h2>
                                    <div class="w-16 h-1 bg-blue-600"></div>
                                </div>
                            </div>
                            
                            <div class="w-full max-w-md ml-auto space-y-10 bg-zinc-900/40 p-12 rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden group flex flex-col items-center justify-center">
                                <div class="relative z-10 flex flex-col items-center w-full">
                                    <h3 class="text-2xl font-black text-white tracking-tighter uppercase mb-8">LinkedIn</h3>
                                    <div class="w-full space-y-4 group/input">
                                        <input type="text" id="onb-linkedin" value="${this.data.linkedinUrl || ''}" placeholder="https://www.linkedin.com/in/votre-profil" 
                                               class="w-full bg-zinc-950 border border-white/10 rounded-2xl px-6 py-5 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all font-medium text-sm text-center">
                                        ${this.errors.linkedin ? `<p class="text-[10px] text-red-500 font-bold uppercase tracking-widest text-center mt-2">${this.errors.linkedin}</p>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 5:
                if (!this.availableTones) this.availableTones = ['Expert', 'Punchy', 'Éducatif', 'Personnel'];
                if (!this.availableGoals) this.availableGoals = ['Visibilité', 'Expertise', 'Conversion', 'Engagement'];

                return `
                    <div class="flex flex-col items-center max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full min-h-[450px]">
                            <!-- Left: Storytelling -->
                            <div class="space-y-8">
                                <div class="space-y-4">
                                    <h2 class="text-5xl font-black text-white tracking-tighter leading-tight uppercase">
                                        Direction <br/>
                                        <span class="text-blue-500">du Signal</span>
                                    </h2>
                                    <div class="w-16 h-1 bg-blue-600"></div>
                                </div>
                                <p class="text-xl text-zinc-400 font-light leading-relaxed tracking-wide">
                                    L'infrastructure est prête, le vecteur est choisi. Il ne reste plus qu'à définir l'intention. 
                                </p>
                                <p class="text-base text-zinc-500 font-light leading-relaxed">
                                    Le ton donne la couleur à votre expertise, tandis que l'objectif aligne chaque mot sur le résultat attendu. Calibrez ces deux variables pour une résonance parfaite.
                                </p>
                            </div>
                            
                            <!-- Right: Panneau de Contrôle -->
                            <div class="w-full max-w-md ml-auto flex flex-col gap-6">
                                <!-- Section TON -->
                                <div class="bg-zinc-900/40 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                                    <div class="relative z-10 space-y-6">
                                        <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] font-bold">Modulation du Ton</label>
                                        <div class="flex flex-wrap gap-2">
                                            ${this.availableTones.map((t, idx) => `
                                                <div onclick="window.onboarding.setTone('${t}')" 
                                                     class="relative flex items-center gap-2 px-4 py-2 rounded-xl border transition-all cursor-pointer text-[10px] font-black uppercase tracking-widest group/toggle ${this.data.tone === t ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/10'}">
                                                    <span>${t}</span>
                                                    <button onclick="event.stopPropagation(); window.onboarding.removeAvailableTone(${idx})" 
                                                            class="ml-2 opacity-50 hover:opacity-100 hover:scale-110 hover:text-red-500 transition-all">
                                                        <i data-lucide="x" class="w-3 h-3"></i>
                                                    </button>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <div class="relative">
                                            <input type="text" id="new-tone-input" placeholder="Ajouter un ton personnalisé..." 
                                                   class="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-xs"
                                                   onkeypress="if(event.key === 'Enter') window.onboarding.addTone()">
                                            <button onclick="window.onboarding.addTone()" class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:text-blue-400">
                                                <i data-lucide="plus" class="w-4 h-4"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Section OBJECTIF -->
                                <div class="bg-zinc-900/40 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                                    <div class="relative z-10 space-y-6">
                                        <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] font-bold">Objectif Stratégique</label>
                                        <div class="flex flex-wrap gap-2">
                                            ${this.availableGoals.map((g, idx) => `
                                                <div onclick="window.onboarding.setGoal('${g}')" 
                                                     class="relative flex items-center gap-2 px-4 py-2 rounded-xl border transition-all cursor-pointer text-[10px] font-black uppercase tracking-widest group/toggle ${this.data.goal === g ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/10'}">
                                                    <span>${g}</span>
                                                    <button onclick="event.stopPropagation(); window.onboarding.removeGoal(${idx})" 
                                                            class="ml-2 opacity-50 hover:opacity-100 hover:scale-110 hover:text-red-500 transition-all">
                                                        <i data-lucide="x" class="w-3 h-3"></i>
                                                    </button>
                                                </div>
                                            `).join('')}
                                        </div>
                                        <div class="relative">
                                            <input type="text" id="new-goal-input" placeholder="Ajouter un objectif..." 
                                                   class="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all text-xs"
                                                   onkeypress="if(event.key === 'Enter') window.onboarding.addGoal()">
                                            <button onclick="window.onboarding.addGoal()" class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:text-blue-400">
                                                <i data-lucide="plus" class="w-4 h-4"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 6:
                return `
                    <div class="flex flex-col items-center max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center w-full min-h-[400px]">
                            <!-- Left: Storytelling -->
                            <div class="space-y-8">
                                <div class="space-y-4">
                                    <h2 class="text-5xl font-black text-white tracking-tighter leading-tight uppercase">
                                        Déploiement <br/>
                                        <span class="text-blue-500">Final</span>
                                    </h2>
                                    <div class="w-16 h-1 bg-blue-600"></div>
                                </div>
                                <p class="text-xl text-zinc-400 font-light leading-relaxed tracking-wide">
                                    Tous les paramètres sont synchronisés. Votre console de pilotage est prête à être activée. 
                                </p>
                                <p class="text-base text-zinc-500 font-light leading-relaxed">
                                    En validant cette étape, vous autorisez Signal Flow à traiter vos données pour orchestrer votre présence digitale.
                                </p>
                            </div>
                            
                            <!-- Right: Configuration -->
                            <div class="w-full max-w-md ml-auto flex flex-col items-center justify-center space-y-10 bg-zinc-900/40 p-12 rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden group">
                                <div class="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent"></div>
                                
                                <div class="relative z-10 w-full space-y-8">
                                    <div class="flex flex-col items-center gap-6 text-center">
                                        <div class="w-20 h-20 bg-blue-600/10 border border-blue-500/20 rounded-[2rem] flex items-center justify-center shadow-2xl">
                                            <i data-lucide="shield-check" class="w-10 h-10 text-blue-500"></i>
                                        </div>
                                        <p class="text-sm text-zinc-400 leading-relaxed italic">
                                            "Le signal est maintenant sous votre contrôle."
                                        </p>
                                    </div>

                                    <label class="flex items-start gap-4 p-6 rounded-2xl bg-zinc-950/50 border border-white/5 cursor-pointer group/rgpd hover:border-blue-500/30 transition-all">
                                        <div class="relative w-6 h-6 mt-1 shrink-0">
                                            <input type="checkbox" id="onb-rgpd" class="peer sr-only" ${this.data.rgpd ? 'checked' : ''} onchange="window.onboarding.data.rgpd = this.checked">
                                            <div class="w-full h-full rounded-md border border-white/10 bg-white/5 peer-checked:bg-blue-600 peer-checked:border-blue-500 transition-all"></div>
                                            <i data-lucide="check" class="absolute inset-0 w-4 h-4 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-sm font-bold text-white uppercase tracking-tight">Protocole RGPD</p>
                                            <p class="text-[11px] text-zinc-500 leading-snug">J'accepte le traitement de mes données personnelles conformément à la politique de confidentialité de Signal Flow.</p>
                                        </div>
                                    </label>
                                    ${this.errors.rgpd ? `<p class="text-xs text-red-500 font-bold uppercase tracking-widest text-center">${this.errors.rgpd}</p>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            default: return '';
        }
    },

    attachListeners() {
        window.onboarding = this;
        const nextBtn = document.getElementById('onb-next');
        const prevBtn = document.getElementById('onb-prev');
        
        if (nextBtn) {
            nextBtn.onclick = async () => {
                if (this.step === 2) {
                    this.data.firstName = document.getElementById('onb-firstname').value;
                    this.data.brand = document.getElementById('onb-brand').value;
                    this.data.description = document.getElementById('onb-description').value;
                } else if (this.step === 4) {
                    const linkedInInput = document.getElementById('onb-linkedin');
                    if (linkedInInput) this.data.linkedinUrl = linkedInInput.value;
                } else if (this.step === 6) {
                    const rgpdCheck = document.getElementById('onb-rgpd');
                    if (rgpdCheck) this.data.rgpd = rgpdCheck.checked;
                }
                
                if (this.step === this.totalSteps) {
                    if (this.validateCurrentStep()) {
                        await this.save();
                        window.dispatchEvent(new CustomEvent('onboarding-finished'));
                    }
                } else {
                    this.next();
                }
            };
        }
        
        if (prevBtn) prevBtn.onclick = () => this.prev();

        document.querySelectorAll('.tone-tag').forEach(tag => {
            tag.onclick = () => {
                this.data.tone = tag.dataset.tone;
                this.render();
            };
        });

        document.querySelectorAll('[data-social-check]').forEach(check => {
            check.onchange = (e) => {
                const s = check.dataset.socialCheck;
                if (e.target.checked) this.data.socials[s] = "";
                else delete this.data.socials[s];
                this.render();
            };
        });

        document.querySelectorAll('.tone-tag').forEach(tag => {
            tag.onclick = () => {
                this.data.tone = tag.dataset.tone;
                this.render();
            };
        });

        if (window.lucide) window.lucide.createIcons();
    }
};
