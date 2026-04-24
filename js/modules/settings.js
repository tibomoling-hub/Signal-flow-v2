import { supabase } from '../supabase.js';
import { onboarding } from './onboarding.js';

export const settings = {
    isSaving: false,
    saveStatus: null, // 'success', 'error'
    hasChanges: false,
    showModal: false,
    initialData: null,

    init() {
        // Clone initial state to track changes
        this.initialData = JSON.parse(JSON.stringify({
            firstName: onboarding.data.firstName,
            brand: onboarding.data.brand,
            description: onboarding.data.description,
            niche: [...onboarding.data.niche],
            linkedinUrl: onboarding.data.linkedinUrl,
            tone: onboarding.data.tone,
            goal: onboarding.data.goal,
            availableTones: [...onboarding.availableTones],
            availableGoals: [...onboarding.availableGoals]
        }));
        this.hasChanges = false;
    },

    checkChanges() {
        const currentData = {
            firstName: onboarding.data.firstName,
            brand: onboarding.data.brand,
            description: onboarding.data.description,
            niche: onboarding.data.niche,
            linkedinUrl: onboarding.data.linkedinUrl,
            tone: onboarding.data.tone,
            goal: onboarding.data.goal,
            availableTones: onboarding.availableTones,
            availableGoals: onboarding.availableGoals
        };
        
        // Deep compare
        this.hasChanges = JSON.stringify(currentData) !== JSON.stringify(this.initialData);
        return this.hasChanges;
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
            window.dashboard.setTab('signal');
        }
    },

    async save() {
        this.isSaving = true;
        this.saveStatus = null;
        this.render();

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("No session");

            const updateData = {
                full_name: onboarding.data.firstName,
                company: onboarding.data.brand,
                description: onboarding.data.description,
                topic: onboarding.data.niche.join(', '), // Ensure string format for consistency
                linkedin_url: onboarding.data.linkedinUrl,
                tone: onboarding.data.tone,
                goal: onboarding.data.goal
            };

            const { error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id_auth_user', session.user.id);

            if (error) throw error;
            
            this.saveStatus = 'success';
            this.hasChanges = false;
            // Update initial data after successful save
            this.init();
            
            setTimeout(() => {
                this.saveStatus = null;
                this.render();
            }, 2000);
        } catch (e) {
            console.error("Settings: Save error", e);
            this.saveStatus = 'error';
        } finally {
            this.isSaving = false;
            this.render();
        }
    },

    addTopic() {
        const input = document.getElementById('settings-topic-input');
        const val = input?.value?.trim();
        if (val && !onboarding.data.niche.includes(val)) {
            onboarding.data.niche.push(val);
            this.checkChanges();
            this.render();
        }
    },

    removeTopic(idx) {
        onboarding.data.niche.splice(idx, 1);
        this.checkChanges();
        this.render();
    },

    addTone() {
        const input = document.getElementById('settings-tone-input');
        const val = input?.value?.trim();
        if (val && !onboarding.availableTones.includes(val)) {
            onboarding.availableTones.push(val);
            this.checkChanges();
            this.render();
        }
    },

    removeTone(idx) {
        const tone = onboarding.availableTones[idx];
        onboarding.availableTones.splice(idx, 1);
        if (onboarding.data.tone === tone) onboarding.data.tone = null;
        this.checkChanges();
        this.render();
    },

    addGoal() {
        const input = document.getElementById('settings-goal-input');
        const val = input?.value?.trim();
        if (val && !onboarding.availableGoals.includes(val)) {
            onboarding.availableGoals.push(val);
            this.checkChanges();
            this.render();
        }
    },

    removeGoal(idx) {
        const goal = onboarding.availableGoals[idx];
        onboarding.availableGoals.splice(idx, 1);
        if (onboarding.data.goal === goal) onboarding.data.goal = null;
        this.checkChanges();
        this.render();
    },

    render() {
        const content = document.getElementById('main-content');
        if (!content) return;
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
                                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Prénom</label>
                                <input type="text" value="${onboarding.data.firstName}" oninput="window.onboarding.data.firstName = this.value; window.settings.checkChanges()" 
                                       class="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-medium text-sm">
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Marque / Compagnie</label>
                                <input type="text" value="${onboarding.data.brand}" oninput="window.onboarding.data.brand = this.value; window.settings.checkChanges()" 
                                       class="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-medium text-sm">
                            </div>
                            <div class="space-y-2">
                                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Descriptif / Mission</label>
                                <textarea oninput="window.onboarding.data.description = this.value; window.settings.checkChanges()" 
                                          class="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-medium text-sm h-24 resize-none">${onboarding.data.description || ''}</textarea>
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
                            <input type="text" value="${onboarding.data.linkedinUrl || ''}" oninput="window.onboarding.data.linkedinUrl = this.value; window.settings.checkChanges()" placeholder="https://linkedin.com/in/..." 
                                   class="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-medium text-sm">
                        </div>
                    </div>

                    <!-- Section 2: Spectre -->
                    <div class="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-8 lg:col-span-2">
                        <div class="flex items-center gap-3">
                            <i data-lucide="radar" class="text-blue-500 w-5 h-5"></i>
                            <h3 class="text-xs font-black uppercase tracking-[0.2em] text-white">Spectre de Détection</h3>
                        </div>
                        <div class="flex flex-wrap gap-2 min-h-[60px] p-4 bg-zinc-950/50 border border-white/5 rounded-2xl">
                            ${onboarding.data.niche.length === 0 ? '<span class="text-zinc-700 text-[10px] uppercase tracking-widest italic p-2">Aucune fréquence active...</span>' : onboarding.data.niche.map((t, idx) => `
                                <div class="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-white/5 rounded-xl text-[11px] font-bold text-zinc-300">
                                    <span>${t}</span>
                                    <button onclick="window.settings.removeTopic(${idx})" class="text-zinc-600 hover:text-red-500 transition-colors">
                                        <i data-lucide="x" class="w-3.5 h-3.5"></i>
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                        <div class="relative max-w-md">
                            <input type="text" id="settings-topic-input" placeholder="Ajouter une fréquence..." 
                                   class="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 pr-14 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all font-medium text-sm"
                                   onkeypress="if(event.key === 'Enter') window.settings.addTopic()">
                            <button onclick="window.settings.addTopic()" class="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-400">
                                <i data-lucide="plus" class="w-5 h-5"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Section 4: Direction -->
                    <div class="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-10 lg:col-span-2">
                        <div class="flex items-center gap-3">
                            <i data-lucide="settings-2" class="text-blue-500 w-5 h-5"></i>
                            <h3 class="text-xs font-black uppercase tracking-[0.2em] text-white">Direction du Signal</h3>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <!-- Tons -->
                            <div class="space-y-6">
                                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Modulation du Ton</label>
                                <div class="flex flex-wrap gap-2">
                                    ${onboarding.availableTones.map((t, idx) => `
                                        <div onclick="window.onboarding.setTone('${t}'); window.settings.checkChanges(); window.settings.render()" 
                                             class="relative flex items-center gap-2 px-4 py-2 rounded-xl border transition-all cursor-pointer text-[10px] font-black uppercase tracking-widest ${onboarding.data.tone === t ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-zinc-950 border-white/5 text-zinc-600 hover:border-white/10'}">
                                            <span>${t}</span>
                                            <button onclick="event.stopPropagation(); window.settings.removeTone(${idx})" class="ml-2 opacity-50 hover:opacity-100 hover:text-red-500 transition-all">
                                                <i data-lucide="x" class="w-3 h-3"></i>
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                                <div class="relative">
                                    <input type="text" id="settings-tone-input" placeholder="Ajouter un ton..." 
                                           class="w-full bg-zinc-950 border border-white/5 rounded-xl px-4 py-3 pr-12 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all text-xs"
                                           onkeypress="if(event.key === 'Enter') window.settings.addTone()">
                                    <button onclick="window.settings.addTone()" class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:text-blue-400">
                                        <i data-lucide="plus" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>

                            <!-- Objectifs -->
                            <div class="space-y-6">
                                <label class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Objectif Stratégique</label>
                                <div class="flex flex-wrap gap-2">
                                    ${onboarding.availableGoals.map((g, idx) => `
                                        <div onclick="window.onboarding.setGoal('${g}'); window.settings.checkChanges(); window.settings.render()" 
                                             class="relative flex items-center gap-2 px-4 py-2 rounded-xl border transition-all cursor-pointer text-[10px] font-black uppercase tracking-widest ${onboarding.data.goal === g ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-zinc-950 border-white/5 text-zinc-600 hover:border-white/10'}">
                                            <span>${g}</span>
                                            <button onclick="event.stopPropagation(); window.settings.removeGoal(${idx})" class="ml-2 opacity-50 hover:opacity-100 hover:text-red-500 transition-all">
                                                <i data-lucide="x" class="w-3 h-3"></i>
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                                <div class="relative">
                                    <input type="text" id="settings-goal-input" placeholder="Ajouter un objectif..." 
                                           class="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-zinc-800 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all text-xs"
                                           onkeypress="if(event.key === 'Enter') window.settings.addGoal()">
                                    <button onclick="window.settings.addGoal()" class="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:text-blue-400">
                                        <i data-lucide="plus" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-center pt-12">
                    <button onclick="window.settings.save()" 
                            class="group relative px-12 py-5 bg-blue-600 rounded-2xl text-white font-black uppercase tracking-[0.2em] text-xs shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_50px_rgba(59,130,246,0.5)] transition-all flex items-center gap-4 ${this.isSaving ? 'opacity-70 cursor-wait' : ''}">
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
                            <p class="text-zinc-400 text-sm leading-relaxed">Vous êtes sur le point de quitter la configuration. Voulez-vous appliquer les nouveaux paramètres à votre profil Signal Flow avant de revenir au Studio ?</p>
                            
                            <div class="space-y-3 pt-6">
                                <button onclick="window.settings.saveAndExit()" class="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-blue-600/20">
                                    Enregistrer et Quitter
                                </button>
                                <button onclick="window.settings.showModal = false; window.dashboard.setTab('signal')" class="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-zinc-300 font-black uppercase tracking-widest text-[10px] transition-all">
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
