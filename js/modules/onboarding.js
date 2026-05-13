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
    totalSteps: 5,
    data: {
        firstName: '',
        lastName: '',
        niche: [],
        linkedinUrl: '',
        topicsActive: true,
        availableDBTopics: null,
        topicsLoaded: false,
        audienceSize: '0-1k',
        frequency: 'daily',
        goal: [],
        tone: [],
        formats: [],
        rgpd: false,
        description: '',
        directionLoaded: false,
        availableTones: [],
        availableGoals: [],
        optionsLoaded: false
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
            if (!this.data.firstName.trim()) this.errors.firstName = "Le nom est requis.";
            if (!this.data.lastName.trim()) this.errors.lastName = "Le prénom est requis.";
        } else if (this.step === 3) {
            if (this.data.linkedinUrl && !isValidSocialUrl(this.data.linkedinUrl)) {
                this.errors.linkedin = "URL LinkedIn invalide.";
            }
        } else if (this.step === 4) {
            if (this.data.tone.length < 1) this.errors.tone = "Veuillez ajouter au moins un ton.";
            if (this.data.tone.length > 3) this.errors.tone = "Maximum 3 tons autorisés.";
            if (this.data.goal.length < 1) this.errors.goal = "Veuillez ajouter au moins un objectif.";
            if (this.data.goal.length > 3) this.errors.goal = "Maximum 3 objectifs autorisés.";
        } else if (this.step === 5) {
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
            console.log("🛠️ [Signal Flow] Création du profil utilisateur en base...");
            const { data: inserted, error: insertError } = await supabase
                .from('users')
                .insert({
                    id_auth_user: authId,
                    created_at: new Date().toISOString()
                })
                .select('id_user')
                .maybeSingle();

            if (insertError) {
                console.error("❌ [Signal Flow] Échec de la création du profil :", insertError.message);
                this.fetchError = "ERREUR CRÉATION PROFIL : " + insertError.message;
            } else if (inserted) {
                this.id_user = inserted.id_user;
                console.log("✅ [Signal Flow] Profil créé avec succès. ID Base:", this.id_user);
            }
        } else {
            this.id_user = existing.id_user;
            console.log("👤 [Signal Flow] Profil existant identifié. ID Base:", this.id_user);
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
                    first_name: this.data.firstName,
                    last_name: this.data.lastName
                };
                columns = "first_name, last_name";
                break;
            case 3:
                updateData = {
                    linkedin_link: this.data.linkedinUrl
                };
                columns = "linkedin_link";
                break;
            case 4:
                // Pour les tables de liaison, on gère la logique dans une fonction dédiée ou ici
                await this.saveJoinData('user_tones', 'id_tone', this.data.tone);
                await this.saveJoinData('user_goals', 'id_goal', this.data.goal);
                
                // Les colonnes tone/goal n'existent plus dans la table users (migration vers tables de liaison)
                updateData = {};
                columns = "liaisons tables user_tones/goals";
                break;
            case 5:
                updateData = {
                    onboarding_completed: true,
                    rgpd_accepted: this.data.rgpd,
                    rgpd_accepted_at: new Date().toISOString()
                };
                columns = "onboarding_completed, rgpd_accepted";
                break;
        }

        if (Object.keys(updateData).length > 0) {
            console.log(`[Signal Flow DB] Sauvegarde Step ${stepNumber} :`, updateData);
            
            const { data, error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id_auth_user', this.id_auth_user)
                .select();
            
            if (error) {
                console.error(`[Signal Flow DB] Erreur de mise à jour Step ${stepNumber}:`, error.message);
            } else if (data && data.length > 0) {
                console.log(`✅ [Signal Flow DB] Données vérifiées en base pour Step ${stepNumber} :`, data[0]);
            } else {
                console.warn(`⚠️ [Signal Flow DB] Mise à jour effectuée mais aucune donnée retournée pour Step ${stepNumber}.`);
            }
        }
    },

    async saveJoinData(tableName, idColumn, idList) {
        if (!this.id_user) await this.ensureUserExists();
        
        if (!this.id_user) {
            console.error(`🚫 [Signal Flow DB] Impossible d'enregistrer dans ${tableName} : ID utilisateur manquant.`);
            return;
        }

        console.log(`🔗 [Signal Flow DB] Synchronisation ${tableName} pour id_user: ${this.id_user}`);

        try {
            // 1. Supprimer les anciennes sélections
            const { error: deleteError } = await supabase
                .from(tableName)
                .delete()
                .eq('id_user', this.id_user);

            if (deleteError) throw deleteError;

            // 2. Insérer les nouvelles sélections si la liste n'est pas vide
            if (idList && idList.length > 0) {
                const inserts = idList.map(id => ({
                    id_user: this.id_user,
                    [idColumn]: id
                }));

                const { error: insertError } = await supabase
                    .from(tableName)
                    .insert(inserts);

                if (insertError) throw insertError;
                console.log(`✅ [Signal Flow DB] ${idList.length} entrée(s) ajoutée(s) dans ${tableName}`);
            } else {
                console.log(`ℹ️ [Signal Flow DB] Aucune sélection à enregistrer pour ${tableName}`);
            }
        } catch (err) {
            console.error(`❌ [Signal Flow DB] Erreur sur ${tableName} :`, err.message);
        }
    },

    async save() {
        await this.saveStep(5);
        
        // Validation Finale : Vérification de l'intégralité de la ligne
        const { data: finalProfile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id_auth_user', this.id_auth_user)
            .single();
        
        if (!error && finalProfile) {
            console.log(`[Signal Flow DB] Synchronisation Finale réussie pour id_user: ${this.id_user}`);
            console.log(`[Signal Flow DB] État final :`, {
                identite: !!(finalProfile.first_name && finalProfile.last_name),
                topics: !!finalProfile.topic,
                vecteur: !!finalProfile.linkedin_url,
                complet: finalProfile.onboarding_completed
            });
        }
    },

    addTopic() {
        const input = document.getElementById('topic-input');
        const val = input.value.trim();
        if (val) {
            if (this.data.niche.length >= 3) {
                this.errors.niche = "Limite de 3 thématiques atteinte.";
                this.render();
                return;
            }
            if (!this.data.niche.includes(val)) {
                this.data.niche.push(val);
                input.value = '';
                this.errors.niche = null;
                this.render();
            }
        }
    },

    removeTopic(index) {
        this.data.niche.splice(index, 1);
        this.render();
    },

    toggleTone(toneId) {
        if (this.data.tone.includes(toneId)) {
            this.data.tone = this.data.tone.filter(id => id !== toneId);
            this.errors.tone = null;
        } else {
            if (this.data.tone.length >= 3) {
                this.errors.tone = "Limite de 3 tons atteinte.";
            } else {
                this.data.tone.push(toneId);
                this.errors.tone = null;
            }
        }
        this.render();
    },

    toggleGoal(goalId) {
        if (this.data.goal.includes(goalId)) {
            this.data.goal = this.data.goal.filter(id => id !== goalId);
            this.errors.goal = null;
        } else {
            if (this.data.goal.length >= 3) {
                this.errors.goal = "Limite de 3 objectifs atteinte.";
            } else {
                this.data.goal.push(goalId);
                this.errors.goal = null;
            }
        }
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
            const { data: { session } } = await supabase.auth.getSession();
            authId = session?.user?.id;
            if (!authId) authId = '00000000-0000-0000-0000-000000000000';

            const { data: profile, error } = await supabase
                .from('users')
                .select('topic')
                .eq('id_auth_user', authId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (profile && profile.topic) {
                const rawTopics = Array.isArray(profile.topic) ? profile.topic : (typeof profile.topic === 'string' ? profile.topic.split(',').map(s => s.trim()) : []);
                this.data.niche = rawTopics.filter(t => t);
            }
            this.topicsLoaded = true;
            this.render();
        } catch (e) {
            console.error("Signal Flow: Error loading topics", e.message);
            this.topicsLoaded = true;
            this.render();
        }
    },

    async loadDirectionDataFromDB() {
        if (this.data.directionLoaded) return;
        if (!this.id_user) await this.ensureUserExists();
        if (!this.id_user) return;

        console.log(`[Signal Flow] Chargement direction pour id_user: ${this.id_user}`);

        try {
            // Chargement des tons depuis user_tones
            const { data: tones, error: tonesErr } = await supabase
                .from('user_tones')
                .select('id_tone')
                .eq('id_user', this.id_user);

            if (!tonesErr && tones) {
                this.data.tone = tones.map(t => t.id_tone);
                console.log("DEBUG: Tons chargés depuis user_tones:", this.data.tone);
            }

            // Chargement des objectifs depuis user_goals
            const { data: goals, error: goalsErr } = await supabase
                .from('user_goals')
                .select('id_goal')
                .eq('id_user', this.id_user);

            if (!goalsErr && goals) {
                this.data.goal = goals.map(g => g.id_goal);
                console.log("DEBUG: Objectifs chargés depuis user_goals:", this.data.goal);
            }
            
            this.data.directionLoaded = true;
        } catch (e) {
            console.error("Signal Flow: Error loading direction data", e.message);
            this.data.directionLoaded = true;
        }

        // Charge également les options disponibles depuis les tables tones/goals
        await this.loadTonesAndGoalsOptions();
    },

    async loadTonesAndGoalsOptions() {
        if (this.data.optionsLoaded) return;

        try {
            // Chargement des tons disponibles depuis la table 'tones'
            // 1. Chargement des tons disponibles (Table TONES uniquement)
            const { data: tonesData, error: tonesErr } = await supabase
                .from('tones')
                .select('id_tone, name')
                .order('name', { ascending: true });

            if (!tonesErr && tonesData) {
                this.data.availableTones = tonesData.map(t => ({
                    id: t.id_tone,
                    name: t.name
                }));
                console.log('✅ [Onboarding] Liste des Tons chargée (Table TONES uniquement):', this.data.availableTones.length);
            }

            // 2. Chargement des objectifs disponibles (Table GOALS uniquement)
            const { data: goalsData, error: goalsErr } = await supabase
                .from('goals')
                .select('id_goal, name')
                .order('name', { ascending: true });

            if (!goalsErr && goalsData) {
                this.data.availableGoals = goalsData.map(g => ({
                    id: g.id_goal,
                    name: g.name
                }));
                console.log('✅ [Onboarding] Liste des Objectifs chargée (Table GOALS uniquement):', this.data.availableGoals.length);
            }

            this.data.optionsLoaded = true;
        } catch (e) {
            console.error('❌ [Onboarding] Erreur chargement options:', e.message);
            this.data.optionsLoaded = true;
        }

        this.render();
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
            <div class="flex-1 flex flex-col items-center justify-center p-4 md:p-8 bg-zinc-950 min-h-screen">
                <div class="w-full max-w-6xl bg-zinc-900/50 p-10 lg:p-14 rounded-3xl border border-white/10 flex flex-col justify-between min-h-[600px] max-h-[90vh]">
                    
                    <!-- Header Technique -->
                    <div class="w-full pb-6 flex flex-col gap-3 border-b border-white/5">
                        <div class="flex justify-between items-end">
                            <div class="flex flex-col gap-1">
                                <div class="flex items-center gap-3">
                                    <div class="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    <span class="text-[10px] font-mono text-blue-500 tracking-widest uppercase font-bold">ÉTAPE 0${this.step}</span>
                                </div>
                                <span class="text-[9px] font-mono text-zinc-500 tracking-widest uppercase">${this.step} / ${this.totalSteps}</span>
                            </div>
                            <div class="text-right">
                                <span class="text-[10px] font-mono text-zinc-400 tracking-widest uppercase font-bold">${Math.round((this.step / this.totalSteps) * 100)}% COMPLÉTÉ</span>
                            </div>
                        </div>
                        <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                            <div class="h-full bg-blue-600 transition-all duration-500 ease-out" style="width: ${(this.step / this.totalSteps) * 100}%"></div>
                        </div>
                    </div>

                    <div id="step-content" class="flex-1 flex flex-col justify-center py-8">
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
                        <button id="onb-next" class="btn-neon flex-1 uppercase tracking-widest text-[10px] font-black py-5">
                            ${this.step === this.totalSteps ? 'Terminer' : 'Continuer'}
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
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
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

                        <div class="p-12 rounded-3xl bg-zinc-900 border border-white/5 relative overflow-hidden group">
                            <div class="absolute -right-12 -top-12 w-64 h-64 bg-blue-600/5 rounded-full"></div>
                            
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
                    <div class="flex flex-col items-center max-w-5xl mx-auto w-full">
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
                            
                            <div class="w-full max-w-md ml-auto space-y-8 bg-zinc-900 p-10 rounded-3xl border border-white/5 relative overflow-hidden">
                                <div class="space-y-8 relative z-10">
                                    <div class="space-y-3 group/input">
                                        <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] ml-1 group-focus-within/input:text-blue-400 transition-colors font-bold">Nom</label>
                                        <input type="text" id="onb-firstname" value="${this.data.firstName}" placeholder="Votre nom" 
                                               class="w-full bg-zinc-950 border border-white/10 rounded-2xl px-6 py-5 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-medium text-sm">
                                        ${errorMsg('firstName')}
                                    </div>
                                    <div class="space-y-3 group/input">
                                        <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] ml-1 group-focus-within/input:text-blue-400 transition-colors font-bold">Prénom</label>
                                        <input type="text" id="onb-lastname" value="${this.data.lastName}" placeholder="Votre prénom" 
                                               class="w-full bg-zinc-950 border border-white/10 rounded-2xl px-6 py-5 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-medium text-sm">
                                        ${errorMsg('lastName')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            case 3:
                return `
                    <div class="flex flex-col items-center max-w-5xl mx-auto w-full">
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
                            
                            <div class="w-full max-w-md ml-auto space-y-8 bg-zinc-900 p-12 rounded-3xl border border-white/5 relative overflow-hidden flex flex-col items-center justify-center">
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
            case 4: {
                if (!this.data.directionLoaded) this.loadDirectionDataFromDB();
                if (!this.data.optionsLoaded) this.loadTonesAndGoalsOptions();

                const toneOptions = this.data.availableTones || [];
                const goalOptions = this.data.availableGoals || [];

                return `
                    <div class="flex flex-col items-center max-w-5xl mx-auto w-full">
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
                                <div class="bg-zinc-900 p-8 rounded-3xl border border-white/5">
                                    <div class="space-y-5">
                                        <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] font-bold">Modulation du Ton (1 à 3 max)</label>
                                        ${errorMsg('tone')}
                                        
                                        ${
                                            !this.data.optionsLoaded
                                            ? '<div class="flex gap-2"><div class="h-8 w-20 bg-white/5 rounded-xl animate-pulse"></div><div class="h-8 w-24 bg-white/5 rounded-xl animate-pulse"></div></div>'
                                            : toneOptions.length === 0
                                            ? '<p class="text-zinc-600 text-[10px] italic">Aucun ton disponible en base de données.</p>'
                                            : `<div class="flex flex-wrap gap-2">
                                                ${toneOptions.map(t => {
                                                    const isSelected = this.data.tone.includes(t.id);
                                                    return `<button
                                                        onclick="window.onboarding.toggleTone('${t.id}')"
                                                        class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 border
                                                        ${ isSelected
                                                            ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                                                            : 'bg-white/5 border-white/10 text-zinc-400 hover:border-blue-500/40 hover:text-white'
                                                        }">
                                                        ${t.name}
                                                    </button>`;
                                                }).join('')}
                                            </div>`
                                        }
                                    </div>
                                </div>

                                <!-- Section OBJECTIF -->
                                <div class="bg-zinc-900 p-8 rounded-3xl border border-white/5">
                                    <div class="space-y-5">
                                        <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] font-bold">Objectif Stratégique (1 à 3 max)</label>
                                        ${errorMsg('goal')}

                                        ${
                                            !this.data.optionsLoaded
                                            ? '<div class="flex gap-2"><div class="h-8 w-24 bg-white/5 rounded-xl animate-pulse"></div><div class="h-8 w-20 bg-white/5 rounded-xl animate-pulse"></div></div>'
                                            : goalOptions.length === 0
                                            ? '<p class="text-zinc-600 text-[10px] italic">Aucun objectif disponible en base de données.</p>'
                                            : `<div class="flex flex-wrap gap-2">
                                                ${goalOptions.map(g => {
                                                    const isSelected = this.data.goal.includes(g.id);
                                                    return `<button
                                                        onclick="window.onboarding.toggleGoal('${g.id}')"
                                                        class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 border
                                                        ${ isSelected
                                                            ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                                                            : 'bg-white/5 border-white/10 text-zinc-400 hover:border-blue-500/40 hover:text-white'
                                                         }">
                                                        ${g.name}
                                                    </button>`;
                                                }).join('')}
                                            </div>`
                                        }
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                `;
            }
            case 5:
                return `
                    <div class="flex flex-col items-center max-w-5xl mx-auto w-full">
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
                            <div class="w-full max-w-md ml-auto flex flex-col items-center justify-center space-y-8 bg-zinc-900 p-12 rounded-3xl border border-white/5 relative overflow-hidden">
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
                    this.data.lastName = document.getElementById('onb-lastname').value;
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

        if (window.lucide) window.lucide.createIcons();
    }
};

window.onboarding = onboarding;
