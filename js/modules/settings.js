import { supabase } from '../supabase.js';

export const settings = {
    isSaving: false,
    saveStatus: null, // 'success', 'error'
    hasChanges: false,
    showModal: false,
    initialData: null,
    isLoaded: false,
    errors: {
        tone: null,
        goal: null
    },
    // État local indépendant
    data: {
        userId: null,
        firstName: '',
        lastName: '',
        linkedinUrl: '',
        tone: [],
        goal: [],
        availableTones: [],
        availableGoals: []
    },

    init() {
        // Clone initial state to track changes
        this.initialData = JSON.parse(JSON.stringify({
            firstName: this.data.firstName,
            lastName: this.data.lastName,
            linkedinUrl: this.data.linkedinUrl,
            tone: [...(this.data.tone || [])],
            goal: [...(this.data.goal || [])],
            availableTones: [...(this.data.availableTones || [])],
            availableGoals: [...(this.data.availableGoals || [])]
        }));
        this.hasChanges = false;
    },

    async loadUserData(force = false) {
        if (force) this.isLoaded = false;
        if (this.isLoaded) return;
        
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const authId = session.user.id;

            // 1. Fetch User Profile
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id_auth_user', authId)
                .single();

            if (profileError || !profile) throw profileError || new Error("Profile not found");

            // 2. Fetch Master Options + User Selections (using id_user)
            const [tonesRes, goalsRes, userTonesRes, userGoalsRes] = await Promise.all([
                supabase.from('tones').select('id_tone, name').order('name'),
                supabase.from('goals').select('id_goal, name').order('name'),
                supabase.from('user_tones').select('id_tone').eq('id_user', profile.id_user),
                supabase.from('user_goals').select('id_goal').eq('id_user', profile.id_user)
            ]);

            // Map profile data
            this.data.userId = profile.id_user;
            this.data.firstName = profile.first_name || '';
            this.data.lastName = profile.last_name || '';
            this.data.linkedinUrl = profile.linkedin_link || profile.linkedin_url || '';

            // Map User Selections
            if (userTonesRes.data) this.data.tone = userTonesRes.data.map(ut => ut.id_tone);
            if (userGoalsRes.data) this.data.goal = userGoalsRes.data.map(ug => ug.id_goal);

            // Map Master Options
            if (tonesRes.data) this.data.availableTones = tonesRes.data.map(t => ({ id: t.id_tone, name: t.name }));
            if (goalsRes.data) this.data.availableGoals = goalsRes.data.map(g => ({ id: g.id_goal, name: g.name }));

            this.isLoaded = true;
            this.init();
            this.render();
        } catch (e) {
            console.error("Settings: Error loading user data", e);
        }
    },

    checkChanges() {
        const currentData = {
            firstName: this.data.firstName,
            lastName: this.data.lastName,
            linkedinUrl: this.data.linkedinUrl,
            tone: this.data.tone,
            goal: this.data.goal,
            availableTones: this.data.availableTones,
            availableGoals: this.data.availableGoals
        };
        
        // Deep compare
        this.hasChanges = JSON.stringify(currentData) !== JSON.stringify(this.initialData);
        return this.hasChanges;
    },

    toggleTone(toneId) {
        this.errors.tone = null;
        if (this.data.tone.includes(toneId)) {
            this.data.tone = this.data.tone.filter(id => id !== toneId);
        } else {
            if (this.data.tone.length < 3) {
                this.data.tone.push(toneId);
            } else {
                this.errors.tone = "Maximum 3 tons autorisés.";
            }
        }
        this.updateSaveButton();
    },

    toggleGoal(goalId) {
        this.errors.goal = null;
        if (this.data.goal.includes(goalId)) {
            this.data.goal = this.data.goal.filter(id => id !== goalId);
        } else {
            if (this.data.goal.length < 3) {
                this.data.goal.push(goalId);
            } else {
                this.errors.goal = "Maximum 3 objectifs autorisés.";
            }
        }
        this.updateSaveButton();
    },

    async saveJoinData(tableName, idColumn, idList) {
        if (!this.data.userId) return;

        try {
            // 1. Supprimer les anciennes sélections
            await supabase
                .from(tableName)
                .delete()
                .eq('id_user', this.data.userId);

            // 2. Insérer les nouvelles sélections
            if (idList && idList.length > 0) {
                const inserts = idList.map(id => ({
                    id_user: this.data.userId,
                    [idColumn]: id
                }));
                await supabase.from(tableName).insert(inserts);
            }
        } catch (err) {
            console.error(`Settings: Error saving ${tableName}`, err);
        }
    },

    handleBack() {
        if (this.checkChanges()) {
            this.showModal = true;
            this.render();
        } else {
            window.dashboard.setTab('signal');
        }
    },

    async saveAndExit() {
        await this.save();
        if (this.saveStatus === 'success') {
            window.dashboard.setTab('signal', true);
        }
    },

    async save() {
        // Validation
        this.errors = { tone: null, goal: null };
        let hasError = false;

        if (this.data.tone.length < 1) {
            this.errors.tone = "Veuillez ajouter au moins un ton.";
            hasError = true;
        }
        if (this.data.goal.length < 1) {
            this.errors.goal = "Veuillez ajouter au moins un objectif.";
            hasError = true;
        }

        if (hasError) {
            this.render();
            return;
        }

        this.isSaving = true;
        this.saveStatus = null;
        this.render();

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No session");

            const updateData = {
                first_name: this.data.firstName,
                last_name: this.data.lastName,
                linkedin_link: this.data.linkedinUrl
            };

            const { error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id_user', this.data.userId);

            if (error) throw error;

            // Save Tones and Goals to Join Tables
            await Promise.all([
                this.saveJoinData('user_tones', 'id_tone', this.data.tone),
                this.saveJoinData('user_goals', 'id_goal', this.data.goal)
            ]);
            
            this.saveStatus = 'success';
            this.hasChanges = false;
            
            // Re-fetch data from DB to ensure local UI is in sync
            this.isLoaded = false; 
            await this.loadUserData();

            // Notify dashboard of update
            if (window.userProfile) {
                await window.userProfile.load();
            }

            if (window.dashboard) {
                window.dashboard.render();
            }
            
            // Auto-reset status after delay
            setTimeout(() => {
                this.saveStatus = null;
                if (document.getElementById('settings-save-btn')) {
                    this.render();
                }
            }, 2000);
        } catch (e) {
            console.error("Settings: Save error", e.message || e);
            if (e.details) console.error("Details:", e.details);
            if (e.hint) console.error("Hint:", e.hint);
            this.saveStatus = 'error';
        } finally {
            this.isSaving = false;
            this.render();
        }
    },

    updateSaveButton() {
        const btn = document.getElementById('settings-save-btn');
        if (!btn) return;
        
        this.checkChanges();
        
        const isInactive = !this.hasChanges || this.isSaving;
        
        if (isInactive) {
            btn.disabled = true;
            btn.className = "group relative px-12 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-4 bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5";
            btn.onclick = null;
            btn.innerHTML = `
                <i data-lucide="${this.isSaving ? 'refresh-cw' : 'save'}" class="w-4 h-4 ${this.isSaving ? 'animate-spin' : ''}"></i>
                <span>${this.isSaving ? 'Synchronisation...' : 'Enregistrer les modifications'}</span>
            `;
        } else {
            btn.disabled = false;
            btn.className = "group relative px-12 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-4 bg-blue-600 text-white shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_50px_rgba(59,130,246,0.5)] active:scale-95 cursor-pointer";
            btn.onclick = () => this.saveAndExit();
            btn.innerHTML = `
                <i data-lucide="save" class="w-4 h-4"></i>
                <span>Enregistrer les modifications</span>
            `;
        }
        if (window.lucide) window.lucide.createIcons();
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;
        
        if (!this.isLoaded) {
            this.loadUserData();
            content.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 animate-pulse">
                    <div class="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                    <p class="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Chargement du profil...</p>
                </div>
            `;
            return;
        }

        if (!this.initialData) this.init();

        content.innerHTML = `
            <div class="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 ${this.showModal ? 'blur-sm pointer-events-none' : ''}">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-3xl font-black text-white tracking-tighter uppercase">Configuration <span class="text-blue-500">Générale</span></h2>
                        <p class="text-zinc-500 text-sm mt-2 font-medium">Ajustez vos paramètres de transmission et votre spectre de détection.</p>
                    </div>
                    <button onclick="window.settings.handleBack()" class="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-widest">
                        <i data-lucide="arrow-left" class="w-4 h-4"></i>
                        Retour au Signal
                    </button>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Section 1: Identité -->
                    <div class="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-8">
                        <div class="flex items-center gap-3">
                            <i data-lucide="user" class="text-blue-500 w-5 h-5"></i>
                            <h3 class="text-xs font-black uppercase tracking-[0.2em] text-white">Identité & Profil</h3>
                        </div>
                        <div class="space-y-6">
                            <div class="space-y-2">
                                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Nom</label>
                                <input type="text" value="${this.data.firstName}" oninput="window.settings.data.firstName = this.value; window.settings.updateSaveButton()" 
                                       class="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-medium text-sm">
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Prénom</label>
                                <input type="text" value="${this.data.lastName}" oninput="window.settings.data.lastName = this.value; window.settings.updateSaveButton()" 
                                       class="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-medium text-sm">
                            </div>
                        </div>
                    </div>

                    <!-- Section 3: Vecteur -->
                    <div class="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-8">
                        <div class="flex items-center gap-3">
                            <i data-lucide="link-2" class="text-blue-500 w-5 h-5"></i>
                            <h3 class="text-xs font-black uppercase tracking-[0.2em] text-white">Écosystème & Vecteur</h3>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Profil LinkedIn</label>
                            <input type="text" value="${this.data.linkedinUrl || ''}" oninput="window.settings.data.linkedinUrl = this.value; window.settings.updateSaveButton()" placeholder="https://linkedin.com/in/..." 
                                   class="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-medium text-sm">
                        </div>
                    </div>

                    <!-- Section 4: Direction -->
                    <div class="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-10 lg:col-span-2">
                        <div class="flex items-center gap-3">
                            <i data-lucide="settings-2" class="text-blue-500 w-5 h-5"></i>
                            <h3 class="text-xs font-black uppercase tracking-[0.2em] text-white">Direction du Signal</h3>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <!-- Modulation du Ton -->
                            <div class="space-y-6">
                                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] font-bold">Modulation du Ton (1 à 3 max)</label>
                                ${this.errors.tone ? `<p class="text-red-400 text-[10px] font-bold uppercase tracking-wider">${this.errors.tone}</p>` : ''}
                                <div class="flex flex-wrap gap-2">
                                    ${this.data.availableTones.map(t => {
                                        const isSelected = this.data.tone.includes(t.id);
                                        return `<button
                                            onclick="window.settings.toggleTone('${t.id}'); window.settings.render()"
                                            class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 border
                                            ${ isSelected
                                                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                                                : 'bg-white/5 border-white/10 text-zinc-400 hover:border-blue-500/40 hover:text-white'
                                            }">
                                            ${t.name}
                                        </button>`;
                                    }).join('')}
                                </div>
                            </div>

                            <!-- Objectif Stratégique -->
                            <div class="space-y-6">
                                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em] font-bold">Objectif Stratégique (1 à 3 max)</label>
                                ${this.errors.goal ? `<p class="text-red-400 text-[10px] font-bold uppercase tracking-wider">${this.errors.goal}</p>` : ''}
                                <div class="flex flex-wrap gap-2">
                                    ${this.data.availableGoals.map(g => {
                                        const isSelected = this.data.goal.includes(g.id);
                                        return `<button
                                            onclick="window.settings.toggleGoal('${g.id}'); window.settings.render()"
                                            class="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 border
                                            ${ isSelected
                                                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                                                : 'bg-white/5 border-white/10 text-zinc-400 hover:border-blue-500/40 hover:text-white'
                                            }">
                                            ${g.name}
                                        </button>`;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-center pt-12">
                    <button id="settings-save-btn"
                            onclick="${this.hasChanges && !this.isSaving ? 'window.settings.saveAndExit()' : ''}" 
                            ${!this.hasChanges || this.isSaving ? 'disabled' : ''}
                            class="group relative px-12 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center gap-4 
                            ${!this.hasChanges || this.isSaving 
                                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5' 
                                : 'bg-blue-600 text-white shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_50_rgba(59,130,246,0.5)] active:scale-95 cursor-pointer'}">
                        ${this.isSaving ? '<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i>' : '<i data-lucide="save" class="w-4 h-4"></i>'}
                        <span>${this.isSaving ? 'Synchronisation...' : 'Enregistrer les modifications'}</span>
                    </button>
                </div>
            </div>

            <!-- Validation Modal -->
            ${this.showModal ? `
                <div class="fixed inset-0 flex items-center justify-center z-[100] animate-in fade-in duration-300">
                    <div class="absolute inset-0 bg-anthracite-950/60 backdrop-blur-md"></div>
                    <div class="bg-zinc-900 border border-white/10 p-10 rounded-[2.5rem] max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10 animate-in zoom-in-95 duration-300">
                        <div class="space-y-6 text-center">
                            <div class="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
                                <i data-lucide="save" class="text-blue-500 w-8 h-8"></i>
                            </div>
                            <h3 class="text-2xl font-black text-white tracking-tighter uppercase">Enregistrer les modifications ?</h3>
                            <p class="text-zinc-400 text-sm leading-relaxed">Vous êtes sur le point de quitter la configuration. Voulez-vous appliquer les nouveaux paramètres à votre profil Signal Flow avant de revenir à la Création ?</p>
                            
                            <div class="space-y-3 pt-6">
                                <button onclick="window.settings.saveAndExit()" class="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-blue-600/20">
                                    Enregistrer et Quitter
                                </button>
                                <button onclick="window.settings.showModal = false; window.dashboard.setTab('signal', true)" class="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-zinc-300 font-black uppercase tracking-widest text-[10px] transition-all">
                                    Quitter sans enregistrer
                                </button>
                                <button onclick="window.settings.showModal = false; window.settings.render()" class="w-full py-3 text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-widest text-[9px] transition-all">
                                    Annuler
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
        
        if (window.lucide) window.lucide.createIcons();
    }
};

window.settings = settings;
