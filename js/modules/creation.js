import { signal } from './signal.js';
import { onboarding } from './onboarding.js';
import { supabase } from '../supabase.js';

export const creation = {
    format: 'post', // 'post' or 'carousel'
    isAiLoading: false,
    currentPostId: null,
    currentPostTitle: null,
    isModalOpen: false,
    isPreviewExpanded: false,
    isRegenerating: false,
    isModified: false,
    initialTone: "Expert",
    initialGoal: "Engagement",
    availableTones: [],
    availableGoals: [],
    optionsLoaded: false,
    tone: null,
    goal: null,
    content: {
        post: {
            hook: "🚀 L'IA ne remplacera pas les créateurs, mais ceux qui l'utilisent le feront.",
            body: "J'ai passé les 48 dernières heures à analyser les dernières tendances...\n\nVoici ce que j'ai découvert :\n1. L'automatisation devient accessible.\n2. La personnalisation est la clé.\n3. La qualité prime sur la quantité.",
            cta: "Et vous, comment utilisez-vous l'IA ?",
            hashtags: "#IA #Productivité #SaaS"
        },
        carousel: [
            { title: "L'IA pour les créateurs", content: "Guide complet 2024" },
            { title: "Étape 1 : Veille", content: "Utilisez Signal Flow pour trouver les signaux." },
            { title: "Étape 2 : Analyse", content: "Décortiquez les sources." },
            { title: "Étape 3 : Création", content: "Générez votre post." },
            { title: "Étape 4 : Publication", content: "Optimisez votre reach." },
            { title: "Prêt à commencer ?", content: "Le lien est en bio !" }
        ]
    },

    setFormat(f) {
        if (this.format !== f) {
            this.format = f;
            this.isModified = true;
            this.render();
        }
    },

    updatePost(field, value) {
        this.content.post[field] = value;
        this.isModified = true;
        this.renderPreview();
    },

    setAiLoading(loading) {
        this.isAiLoading = loading;
        if (loading) {
            this.clearContent();
        }
        this.render();
    },

    updateCarousel(index, field, value) {
        this.content.carousel[index][field] = value;
        this.isModified = true;
        this.renderPreview();
    },

    async loadOptions() {
        if (this.optionsLoaded) return;
        
        try {
            // 1. Obtenir la session et l'id_user
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: profile } = await supabase
                .from('users')
                .select('id_user')
                .eq('id_auth_user', session.user.id)
                .single();

            if (!profile) return;

            // 2. Charger uniquement les tons et objectifs du user (via tables de liaison)
            const [tonesRes, goalsRes] = await Promise.all([
                supabase
                    .from('user_tones')
                    .select('tones(id_tone, name)')
                    .eq('id_user', profile.id_user),
                supabase
                    .from('user_goals')
                    .select('goals(id_goal, name)')
                    .eq('id_user', profile.id_user)
            ]);
            
            if (tonesRes.data) {
                // On aplatit le résultat de la jointure
                this.availableTones = tonesRes.data.map(t => t.tones).filter(Boolean);
                if (!this.tone && this.availableTones.length > 0) {
                    this.tone = this.availableTones[0].id_tone;
                }
            }

            if (goalsRes.data) {
                // On aplatit le résultat de la jointure
                this.availableGoals = goalsRes.data.map(g => g.goals).filter(Boolean);
                if (!this.goal && this.availableGoals.length > 0) {
                    this.goal = this.availableGoals[0].id_goal;
                }
            }
            
            console.log("🎯 [Studio] Options personnalisées chargées :", {
                tones: this.availableTones.length,
                goals: this.availableGoals.length
            });

            this.optionsLoaded = true;
            this.render();
        } catch (e) {
            console.error("Studio: Erreur chargement options personnalisées", e);
        }
    },

    loadGeneratedContent(data) {
        // On s'assure de garder le skeleton loader actif au début du traitement
        this.isAiLoading = true;
        
        // Make peut renvoyer un tableau [Bundle] ou un objet direct
        const payload = Array.isArray(data) ? data[0] : data;

        console.log("🛠️ [Signal Flow] Réception payload:", payload);

        // 1. Cas prioritaire : Make renvoie directement body_content + tone_post + goal_post
        if (payload && (payload.body_content || payload.content_body)) {
            console.log("✅ [Signal Flow] Format direct détecté — chargement du contenu...");
            
            this.content.post = {
                hook: "",
                body: payload.body_content || payload.content_body,
                cta: "",
                hashtags: payload.hashtag || ""
            };
            
             if (payload.id_user_tone || payload.id_tone) this.tone = payload.id_user_tone || payload.id_tone;
             if (payload.id_user_goal || payload.id_goal) this.goal = payload.id_user_goal || payload.id_goal;
             
             this.initialTone = this.tone;
             this.initialGoal = this.goal;
            
            this.currentPostId = payload.id_post || null;
            this.format = 'post';
            this.isModified = false;
            this.setAiLoading(false);
            this.render();
            return;
        }

        // 2. Cas : Make renvoie un id_post → on fetch en base
        if (payload && payload.id_post) {
            console.log("📡 [Signal Flow] ID reçu — récupération en base...", payload.id_post);
            this.fetchPostById(payload.id_post);
            return;
        }

        // 3. Cas legacy : champ 'content' direct
        if (payload && payload.content) {
            this.content.post.body = payload.content;
            this.currentPostId = payload.id_post || null;
            this.setAiLoading(false);
            this.render();
            return;
        }

        console.warn("⚠️ [Signal Flow] Payload Make inconnu ou vide.", payload);
        this.setAiLoading(false);
        this.render();
    },

    async fetchPostById(postId) {
        this.setAiLoading(true);
        console.log("🛠️ [Signal Flow] Récupération du post:", postId);
        
        let attempts = 0;
        const maxAttempts = 5;
        const delay = 2000;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, attempts === 0 ? 2000 : delay));
            attempts++;
            console.log(`📡 [Signal Flow] Tentative ${attempts}/${maxAttempts}...`);

            try {
                const { data, error } = await supabase
                    .from('posts')
                    .select('id_post, title, body_content, content_body, id_tone, id_goal, tone_post, goal_post, tone, goal, hashtag')
                    .eq('id_post', postId)
                    .maybeSingle();

                if (error) {
                    console.error("❌ [Signal Flow] Erreur Supabase:", error.message, error.code);
                    continue;
                }

                if (data) {
                    console.log("✅ [Signal Flow] Post trouvé !", data);
                    this.currentPostId = data.id_post;
                    this.currentPostTitle = data.title || null;
                    
                    // Priorité à body_content comme demandé par l'utilisateur
                    const body = data.body_content || data.content_body || "";
                    
                    this.content.post = {
                        hook: "",
                        body: body,
                        cta: "",
                        hashtags: data.hashtag || ""
                    };
                    
                    // Mise à jour du ton et de l'objectif
                    this.tone = data.id_tone || data.tone_post || data.tone || this.tone;
                    this.goal = data.id_goal || data.goal_post || data.goal || this.goal;
                    
                    this.initialTone = this.tone;
                    this.initialGoal = this.goal;
                    this.format = 'post';
                    this.isModified = false;
                    this.setAiLoading(false);
                    this.render();
                    return;
                }

                console.warn(`⚠️ [Signal Flow] Post non visible à la tentative ${attempts}.`);

            } catch (e) {
                console.error(`❌ [Signal Flow] Exception tentative ${attempts}:`, e.message);
            }
        }

        console.error("🚫 [Signal Flow] Post introuvable après 5 tentatives.");
        this.showToast("Le post généré n'est pas encore visible. Vérifiez les RLS Supabase.", "error");
        this.currentPostId = null;
        this.clearContent();
        this.setAiLoading(false);
    },

    clearContent() {
        this.content.post = { hook: "", body: "", cta: "", hashtags: "" };
        this.render();
    },

    render() {
        if (!this.optionsLoaded) {
            this.loadOptions();
            return; // On attend que les options soient là pour le premier render complet
        }
        
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        if (this.isAiLoading) {
            container.innerHTML = this.renderSkeleton();
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const postMeta = this.currentPostTitle ? `
            <div class="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-5 py-2.5 rounded-2xl">
                <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span class="text-xs font-black uppercase tracking-widest text-blue-400">Post actuel : ${this.currentPostTitle}</span>
                <button onclick="window.creation.toggleModal(true)" class="ml-4 text-[10px] font-black uppercase tracking-widest text-blue-500/60 hover:text-blue-500 underline transition-colors decoration-blue-500/30">Changer de trend</button>
            </div>
        ` : '';

        const modalHtml = this.isModalOpen ? `
            <div class="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-anthracite-950/80 backdrop-blur-md animate-in fade-in duration-300">
                <div class="glass-panel max-w-md w-full p-10 border border-white/10 rounded-[2.5rem] shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
                    <div class="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20">
                        <i data-lucide="alert-triangle" class="w-8 h-8 text-red-500"></i>
                    </div>
                    <div class="text-center space-y-3">
                        <h3 class="text-2xl font-black text-white tracking-tighter">Abandonner le post ?</h3>
                        <p class="text-zinc-400 text-sm leading-relaxed">Votre post en cours va \u00eatre supprim\u00e9. Voulez-vous vraiment changer de tendance ?</p>
                    </div>
                    <div class="flex gap-4">
                        <button onclick="window.creation.toggleModal(false)" class="flex-1 py-4 px-6 rounded-2xl bg-white/5 text-zinc-300 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5">Non, garder</button>
                        <button onclick="window.creation.confirmReset()" class="flex-1 py-4 px-6 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20">Oui, changer</button>
                    </div>
                </div>
            </div>
        ` : '';

        const hasChanged = this.tone !== this.initialTone || this.goal !== this.initialGoal;

        container.innerHTML = `
            ${modalHtml}
            <div id="toast-container" class="fixed top-8 right-8 z-[200] flex flex-col gap-3 pointer-events-none"></div>
            
            <div class="container mx-auto px-4 py-8 space-y-10 animate-in fade-in duration-700">
                <!-- TOP SECTION: Header & Post Meta -->
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <header class="view-transition space-y-2">
                        <p class="text-detail">Atelier de Contenu</p>
                        <h1 class="text-5xl font-black text-white tracking-tighter">Création</h1>
                    </header>
                    ${postMeta}
                </div>

                <!-- SETTINGS BAR: Type, Tone, Goal -->
                <div class="glass-panel p-4 rounded-3xl border border-white/5 shadow-xl flex flex-col md:flex-row items-center gap-6">
                    <!-- Format selection -->
                    <div class="w-full md:w-1/3 p-1.5 bg-anthracite-950 rounded-2xl border border-white/5 shadow-inner flex">
                        <button onclick="window.creation.setFormat('post')" class="flex-1 py-3 px-6 rounded-xl text-[10px] uppercase tracking-[0.2em] font-black transition-all ${this.format === 'post' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'text-zinc-600 hover:text-zinc-400'}">Post LinkedIn</button>
                        <button onclick="window.creation.setFormat('carousel')" class="flex-1 py-3 px-6 rounded-xl text-[10px] uppercase tracking-[0.2em] font-black transition-all ${this.format === 'carousel' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'text-zinc-600 hover:text-zinc-400'}">Carrousel</button>
                    </div>
                    <!-- Tone Selection -->
                    <div class="w-full md:w-1/3 flex items-center gap-4 bg-anthracite-950/50 px-4 py-1.5 rounded-2xl border border-white/5">
                        <span class="text-detail !text-[9px] whitespace-nowrap">Ton</span>
                        <select class="w-full bg-transparent text-sm text-zinc-300 font-bold outline-none py-2 cursor-pointer" onchange="window.creation.updateSettings('tone', this.value)">
                            ${this.availableTones.length > 0 
                                ? this.availableTones.map(t => `<option value="${t.id_tone}" ${this.tone === t.id_tone ? 'selected' : ''}>${t.name}</option>`).join('')
                                : `<option value="${this.tone}">${this.tone}</option>`
                            }
                        </select>
                    </div>
                    <!-- Goal Selection -->
                    <div class="w-full md:w-1/4 flex items-center gap-4 bg-anthracite-950/50 px-4 py-1.5 rounded-2xl border border-white/5">
                        <span class="text-detail !text-[9px] whitespace-nowrap">Objectif</span>
                        <select class="w-full bg-transparent text-sm text-zinc-300 font-bold outline-none py-2 cursor-pointer" onchange="window.creation.updateSettings('goal', this.value)">
                            ${this.availableGoals.length > 0 
                                ? this.availableGoals.map(g => `<option value="${g.id_goal}" ${this.goal === g.id_goal ? 'selected' : ''}>${g.name}</option>`).join('')
                                : `<option value="${this.goal}">${this.goal}</option>`
                            }
                        </select>
                    </div>
                    <!-- Regenerate Button -->
                    <button 
                        id="regen-btn"
                        onclick="${(this.isModified && !this.isAiLoading) ? 'window.creation.handleRegenerate()' : ''}"
                        ${(!this.isModified || this.isAiLoading) ? 'disabled' : ''}
                        class="w-full md:w-auto px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 shadow-sm
                        ${(!this.isModified || this.isAiLoading) ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5' : 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700 shadow-md hover:-translate-y-0.5 active:translate-y-0'}"
                    >
                        <i data-lucide="refresh-cw" class="w-4 h-4 ${this.isAiLoading ? 'animate-spin' : ''}"></i>
                        ${this.isAiLoading ? 'G\u00e9n\u00e9ration...' : 'Reg\u00e9n\u00e9rer'}
                    </button>
                </div>

                <!-- MAIN WORKSPACE: Twin Panels 50/50 -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4 items-start">
                    
                    <!-- LEFT COLUMN: Editor (50%) -->
                    <div class="w-full">
                        <div id="editor-fields" class="animate-in slide-in-from-bottom-4 duration-500">
                            ${this.renderEditorFields()}
                        </div>
                    </div>

                    <!-- RIGHT COLUMN: Preview (50%) -->
                    <div class="w-full bg-slate-300 rounded-[2.5rem] p-4 pt-3 shadow-2xl border border-white/10 sticky top-8 animate-in slide-in-from-right-4 duration-700">
                        <div class="mb-3 flex items-center justify-between px-2">
                            <div class="flex items-center gap-4">
                                <span class="text-[10px] font-black uppercase tracking-[.2em] text-zinc-600">Aper\u00e7u Temps R\u00e9el</span>
                                <div class="flex gap-1.5 opacity-20">
                                    <div class="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
                                    <div class="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
                                </div>
                            </div>
                            
                            <button onclick="window.creation.copyToClipboard()" title="Copier le contenu" class="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-500 hover:text-blue-600 hover:border-blue-400 transition-all shadow-sm group">
                                <i data-lucide="copy" class="w-3 h-3 transition-transform group-hover:scale-110"></i>
                            </button>
                        </div>
                        
                        <div class="flex items-center justify-center">
                            <!-- White Canvas Window -->
                            <div id="linkedin-preview" class="w-full max-w-[480px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.15)] rounded-2xl border border-zinc-200 overflow-hidden view-transition">
                                ${this.getPreviewHtml()}
                            </div>
                        </div>

                        <!-- Footer Actions (Right aligned) -->
                        <div class="mt-6 flex justify-end items-center gap-4 px-2">
                            <button 
                                id="save-btn"
                                onclick="${this.isModified ? 'window.creation.handleSave()' : ''}"
                                ${!this.isModified || this.isSaving || this.isAiLoading ? 'disabled' : ''}
                                class="px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 shadow-sm 
                                ${!this.isModified || this.isSaving || this.isAiLoading ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}"
                            >
                                ${this.isSaving ? '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Enregistrement...' : 'Enregistrer'}
                            </button>
                            <button 
                                ${this.isRegenerating ? 'disabled' : ''}
                                class="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 active:scale-95 transition-all shadow-sm ${this.isRegenerating ? 'opacity-50 cursor-not-allowed' : ''}"
                            >
                                Publier
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        `;
        
        window.creation = this;
        if (window.lucide) window.lucide.createIcons();
    },

    renderSkeleton() {
        return `
            <div class="relative min-h-[70vh]">
                <!-- LOADING OVERLAY -->
                <div class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                    <div class="bg-white px-12 py-10 rounded-[2.5rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] border border-zinc-100 flex flex-col items-center gap-8 animate-in zoom-in-95 duration-500 pointer-events-auto">
                        <div class="relative">
                            <div class="w-16 h-16 border-4 border-blue-600/10 rounded-full"></div>
                            <div class="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                        <div class="flex flex-col items-center gap-2">
                            <p class="text-2xl font-black text-zinc-900 tracking-tighter animate-pulse text-center">Cr\u00e9ation de votre post personnalis\u00e9</p>
                            <p class="text-sm text-zinc-500 font-medium tracking-tight">Signal Flow IA g\u00e9n\u00e8re la meilleure version...</p>
                        </div>
                    </div>
                </div>

                <!-- BLURRED SKELETONS -->
                <div class="space-y-10 blur-sm opacity-30 select-none pointer-events-none">
                    <!-- SKELETON HEADER -->
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div class="space-y-3">
                            <div class="h-4 w-24 bg-white/5 rounded animate-pulse"></div>
                            <div class="h-10 w-48 bg-white/5 rounded-xl animate-pulse"></div>
                        </div>
                        <div class="h-14 w-64 bg-white/5 rounded-2xl animate-pulse"></div>
                    </div>

                    <!-- SKELETON SETTINGS BAR -->
                    <div class="glass-panel p-4 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center gap-6">
                        <div class="h-12 w-full md:w-1/3 bg-white/5 rounded-2xl animate-pulse"></div>
                        <div class="h-12 w-full md:w-1/3 bg-white/5 rounded-2xl animate-pulse"></div>
                        <div class="h-12 w-full md:w-1/4 bg-white/5 rounded-2xl animate-pulse"></div>
                        <div class="h-12 w-32 bg-white/5 rounded-2xl animate-pulse ml-auto"></div>
                    </div>

                    <!-- SKELETON MAIN WORKSPACE -->
                    <div class="flex flex-col lg:flex-row items-start gap-12 pt-4">
                        <!-- LEFT COLUMN -->
                        <div class="flex-1 w-full space-y-10">
                            <div class="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
                                <div class="h-10 w-full bg-white/5 rounded-xl animate-pulse"></div>
                                <div class="space-y-3">
                                    <div class="h-4 w-full bg-white/5 rounded animate-pulse"></div>
                                    <div class="h-4 w-5/6 bg-white/5 rounded animate-pulse"></div>
                                    <div class="h-4 w-4/6 bg-white/5 rounded animate-pulse"></div>
                                    <div class="h-40 w-full bg-white/5 rounded-2xl animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                        <!-- RIGHT COLUMN (PREVIEW) -->
                        <div class="flex-1 w-full bg-slate-300 rounded-[2.5rem] p-10">
                            <div class="flex justify-between mb-8">
                                <div class="h-4 w-32 bg-black/5 rounded animate-pulse"></div>
                                <div class="h-10 w-10 bg-black/5 rounded animate-pulse"></div>
                            </div>
                            <div class="flex items-center justify-center">
                                <div class="w-full max-w-[480px] bg-white rounded-2xl shadow-xl h-[400px] flex flex-col p-6 space-y-6">
                                    <div class="flex items-center gap-3">
                                        <div class="w-12 h-12 rounded-full bg-gray-100 animate-pulse"></div>
                                        <div class="space-y-2">
                                            <div class="h-3 w-24 bg-gray-100 rounded animate-pulse"></div>
                                            <div class="h-2 w-16 bg-gray-100 rounded animate-pulse"></div>
                                        </div>
                                    </div>
                                    <div class="space-y-3 pt-4">
                                        <div class="h-4 w-full bg-gray-100 rounded animate-pulse"></div>
                                        <div class="h-4 w-full bg-gray-100 rounded animate-pulse"></div>
                                        <div class="h-4 w-2/3 bg-gray-100 rounded animate-pulse"></div>
                                    </div>
                                    <div class="h-48 w-full bg-gray-50 rounded-xl animate-pulse mt-auto"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderAiSkeleton(container) {
        container.innerHTML = `
            <div class="flex flex-col xl:flex-row gap-12 animate-skeleton">
                <div class="flex-1 space-y-8">
                    <div class="glass-panel p-8 rounded-[2.5rem] space-y-10">
                        <div class="h-12 bg-white/5 rounded-2xl w-full"></div>
                        <div class="grid grid-cols-2 gap-6">
                            <div class="h-10 bg-white/5 rounded-xl"></div>
                            <div class="h-10 bg-white/5 rounded-xl"></div>
                        </div>
                        <div class="space-y-6 pt-10">
                            <div class="space-y-3">
                                <div class="h-4 w-20 bg-white/5 rounded"></div>
                                <div class="h-32 bg-white/5 rounded-2xl"></div>
                            </div>
                            <div class="space-y-3">
                                <div class="h-4 w-32 bg-white/5 rounded"></div>
                                <div class="h-48 bg-white/5 rounded-2xl"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="w-full xl:w-[420px] space-y-6 opacity-50">
                    <div class="h-4 w-32 bg-white/5 rounded mb-4"></div>
                    <div class="h-[500px] bg-white/5 rounded-2xl"></div>
                </div>
            </div>
                </div>
            </div>
        `;
    },

    renderEditorFields() {
        const inputClass = "w-full bg-anthracite-950 border border-white/5 rounded-xl px-5 py-3 text-sm text-white focus:border-blue-500/40 outline-none transition-all";
        
        if (this.format === 'post') {
            if (this.isRegenerating) {
                return `
                    <div class="space-y-6">
                        <div class="space-y-2">
                            <label class="text-detail ml-1">Corps du contenu</label>
                            <div class="rounded-2xl border border-white/10 p-8 bg-white/5 space-y-4">
                                <div class="h-4 w-full bg-white/10 rounded animate-pulse"></div>
                                <div class="h-4 w-5/6 bg-white/10 rounded animate-pulse"></div>
                                <div class="h-4 w-4/6 bg-white/10 rounded animate-pulse"></div>
                                <div class="h-4 w-full bg-white/10 rounded animate-pulse pt-4"></div>
                                <div class="h-4 w-2/3 bg-white/10 rounded animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="space-y-6">
                    <div class="space-y-2">
                        <label class="text-detail ml-1">Corps du contenu</label>
                        <div class="rounded-2xl border border-white/20 overflow-hidden bg-white/10 shadow-inner focus-within:border-blue-500/40 transition-all">
                            <!-- Toolbar -->
                            <div class="flex items-center gap-1 p-2 bg-anthracite-900 border-b border-white/5 sticky top-0 z-10">
                                <button onclick="document.execCommand('bold', false, null); window.creation.handleEditorInput(document.getElementById('rich-editor'))" class="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Gras"><i data-lucide="bold" class="w-4 h-4"></i></button>
                                <button onclick="document.execCommand('italic', false, null); window.creation.handleEditorInput(document.getElementById('rich-editor'))" class="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Italique"><i data-lucide="italic" class="w-4 h-4"></i></button>
                                <button onclick="document.execCommand('underline', false, null); window.creation.handleEditorInput(document.getElementById('rich-editor'))" class="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Soulign\u00e9"><i data-lucide="underline" class="w-4 h-4"></i></button>
                                <div class="w-px h-4 bg-white/10 mx-1"></div>
                                <div class="relative inline-block">
                                    <button onclick="window.creation.toggleEmojiPicker(event)" class="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="\u00c9mojis"><i data-lucide="smile" class="w-4 h-4"></i></button>
                                    <div id="emoji-picker" class="hidden absolute bottom-full left-0 mb-2 p-3 bg-anthracite-900 border border-white/10 rounded-xl shadow-2xl z-50 grid grid-cols-6 gap-2 w-48">
                                        ${['🚀', '✨', '💡', '📈', '🤝', '🔥', '💎', '🎯', '✅', '📣', '🧠', '🛠️'].map(e => `<button onclick="window.creation.insertEmoji('${e}')" class="p-1 hover:bg-white/10 rounded-md transition-all">${e}</button>`).join('')}
                                    </div>
                                </div>
                            </div>
                            <!-- Editable Area -->
                            <div 
                                id="rich-editor"
                                contenteditable="true" 
                                class="w-full min-h-[350px] p-6 text-sm text-zinc-300 outline-none leading-relaxed whitespace-pre-wrap custom-scrollbar"
                                oninput="window.creation.handleEditorInput(this)"
                            >${this.content.post.body}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    ${this.content.carousel.map((slide, i) => `
                        <div class="p-5 rounded-2xl bg-anthracite-950 border border-white/5 space-y-4">
                            <div class="flex justify-between items-center text-detail opacity-50">
                                <span>Slide ${i + 1}</span>
                                <button class="hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                            </div>
                            <input type="text" oninput="window.creation.updateCarousel(${i}, 'title', this.value)" value="${slide.title}" class="w-full bg-transparent border-none p-0 text-base font-bold text-white focus:ring-0 placeholder-zinc-800" placeholder="Titre d'impact">
                            <textarea oninput="window.creation.updateCarousel(${i}, 'content', this.value)" class="w-full bg-transparent border-none p-0 text-sm text-zinc-400 focus:ring-0 resize-none h-16 placeholder-zinc-800" placeholder="Détails de la slide">${slide.content}</textarea>
                        </div>
                    `).join('')}
                    <button class="w-full py-5 border-2 border-dashed border-white/5 rounded-2xl text-zinc-600 hover:text-blue-500 hover:border-blue-500/20 hover:bg-blue-500/5 transition-all text-xs font-black uppercase tracking-widest">
                        + Ajouter une slide
                    </button>
                </div>
            `;
        }
    },

    renderPreview() {
        const preview = document.getElementById('linkedin-preview');
        if (preview) {
            preview.innerHTML = this.getPreviewHtml();
            if (window.lucide) window.lucide.createIcons();
        }
    },

    getPreviewHtml() {
        const userName = onboarding.data.firstName || 'Créateur';
        const brand = onboarding.data.brand || 'Studio Signal Flow';
        
        if (this.format === 'post') {
            if (this.isRegenerating) {
                return `
                    <div class="bg-white p-6 space-y-6 rounded-2xl">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-full bg-zinc-100 animate-pulse"></div>
                            <div class="space-y-2">
                                <div class="h-3 w-24 bg-zinc-100 rounded animate-pulse"></div>
                                <div class="h-2 w-16 bg-zinc-100 rounded animate-pulse"></div>
                            </div>
                        </div>
                        <div class="space-y-3 pt-4">
                            <div class="h-4 w-full bg-zinc-100 rounded animate-pulse"></div>
                            <div class="h-4 w-full bg-zinc-100 rounded animate-pulse"></div>
                            <div class="h-4 w-2/3 bg-zinc-100 rounded animate-pulse"></div>
                        </div>
                    </div>
                `;
            }
            return `
                <div class="bg-white text-zinc-900 rounded-2xl overflow-hidden shadow-2xl font-sans">
                    <div class="p-4 flex items-center gap-3">
                        <div class="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center font-black text-blue-600 border border-zinc-200">${userName[0]}</div>
                        <div>
                            <p class="text-[13px] font-bold">${userName} <span class="text-zinc-400 font-normal ml-1">• 1er</span></p>
                            <p class="text-[11px] text-zinc-500 leading-tight">${brand}</p>
                            <p class="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">À l'instant • <i data-lucide="globe" class="w-3 h-3"></i></p>
                        </div>
                    </div>
                    <div class="px-4 pb-4 space-y-4 text-[14px] leading-[1.428]">
                        <div class="relative ${this.isPreviewExpanded ? '' : 'max-h-[60px] overflow-hidden'}">
                            <p class="font-normal text-[#1d1d1d] whitespace-pre-wrap">${this.content.post.body}</p>
                            ${!this.isPreviewExpanded && (this.content.post.body.split('\n').length > 3 || this.content.post.body.length > 160) ? `
                                <div class="absolute bottom-0 right-0 bg-white pl-10 bg-gradient-to-l from-white via-white 60% to-transparent flex items-center h-[20px]">
                                    <button onclick="window.creation.togglePreviewExpansion()" class="text-zinc-500 font-bold hover:underline cursor-pointer">
                                        <span class="text-zinc-400 font-normal">...</span>plus
                                    </button>
                                </div>
                            ` : ''}
                            ${this.isPreviewExpanded ? `
                                <button onclick="window.creation.togglePreviewExpansion()" class="text-zinc-500 font-bold hover:underline cursor-pointer mt-1 block w-fit">voir moins</button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="px-4 py-2.5 border-t border-zinc-100 flex justify-between text-zinc-500 text-xs font-bold bg-zinc-50/50">
                        <span class="flex items-center gap-2 hover:bg-zinc-200/50 px-2 py-1.5 rounded-lg cursor-pointer transition-all"><i data-lucide="thumbs-up" class="w-4 h-4"></i> J'aime</span>
                        <span class="flex items-center gap-2 hover:bg-zinc-200/50 px-2 py-1.5 rounded-lg cursor-pointer transition-all"><i data-lucide="message-square" class="w-4 h-4"></i> Commenter</span>
                        <span class="flex items-center gap-2 hover:bg-zinc-200/50 px-2 py-1.5 rounded-lg cursor-pointer transition-all"><i data-lucide="repeat" class="w-4 h-4"></i> Partager</span>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="space-y-4">
                    <div class="bg-[#f3f6f8] rounded-2xl overflow-hidden shadow-2xl border border-zinc-200">
                        <div class="aspect-square bg-gradient-to-br from-blue-600 to-blue-900 p-10 flex flex-col justify-between text-white relative">
                            <div class="flex items-center gap-2 opacity-60">
                                <div class="w-5 h-5 bg-white rounded-md flex items-center justify-center text-[10px] text-blue-900 font-black">S</div>
                                <span class="text-[10px] font-bold uppercase tracking-widest">${brand}</span>
                            </div>
                            <div class="space-y-6">
                                <h2 class="text-4xl font-black leading-[1.1] tracking-tighter">${this.content.carousel[0].title}</h2>
                                <p class="text-lg font-light opacity-80 leading-relaxed">${this.content.carousel[0].content}</p>
                            </div>
                            <div class="flex justify-between items-end">
                                <div class="text-[10px] font-black uppercase tracking-widest opacity-60">Signal Flow Création</div>
                                <div class="text-[10px] bg-white/10 px-3 py-1.5 rounded-full font-bold">1 / ${this.content.carousel.length}</div>
                            </div>
                        </div>
                    </div>
                    <p class="text-center text-detail opacity-50">Visualisation du Carrousel</p>
                </div>
            `;
        }
    },

    toggleModal(show) {
        this.isModalOpen = show;
        this.render();
    },

    confirmReset() {
        this.isModalOpen = false;
        this.currentPostId = null;
        this.currentPostTitle = null;
        this.clearContent();
        window.dashboard.setTab('signal');
    },

    async copyToClipboard() {
        const bodyHtml = this.content.post.body;
        // On ajoute un wrapper avec du style inline pour aider le destinataire à interpréter le formatage
        const fullHtml = `<div style="font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; white-space: pre-wrap;">${bodyHtml}</div>`;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = bodyHtml;
        const text = tempDiv.innerText;
        
        try {
            const blobHtml = new Blob([fullHtml], { type: 'text/html' });
            const blobText = new Blob([text], { type: 'text/plain' });
            const data = [new ClipboardItem({
                'text/html': blobHtml,
                'text/plain': blobText
            })];

            await navigator.clipboard.write(data);
            this.showToast("Contenu stylisé copié !");
        } catch (err) {
            console.warn("⚠️ [Signal Flow] Échec de la copie riche, repli sur texte brut", err);
            // Fallback to simple text if ClipboardItem fails
            try {
                await navigator.clipboard.writeText(text);
                this.showToast("Texte brut copié (formatage non supporté)");
            } catch (e) {
                console.error("❌ [Signal Flow] Erreur de copie:", e);
            }
        }
    },

    showToast(msg, type = 'success') {
        const toast = document.createElement('div');
        
        // D\u00e9finition des styles en fonction du type
        const baseClasses = "fixed top-6 left-1/2 -translate-x-1/2 z-[100] p-4 rounded-xl shadow-lg flex items-center gap-3 animate-in slide-in-from-top fade-in duration-300 pointer-events-auto min-w-[320px] justify-between";
        const typeClasses = type === 'success' 
            ? "bg-green-50 border border-green-200 text-green-800" 
            : "bg-red-50 border border-red-200 text-red-800";
        
        toast.className = `${baseClasses} ${typeClasses}`;
        
        const icon = type === 'success' ? 'check-circle' : 'alert-triangle';
        toast.innerHTML = `
            <div class="flex items-center gap-3 font-medium text-sm">
                <i data-lucide="${icon}" class="w-5 h-5"></i> 
                <span>${msg}</span>
            </div>
            <button class="hover:opacity-70 transition-opacity ml-4" onclick="this.parentElement.remove()">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        `;
        
        // On utilise document.body s'il n'y a pas de conteneur d\u00e9di\u00e9, pour \u00eatre s\u00fbr que le fixed fonctionne parfaitement
        document.body.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();
        
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.classList.add('animate-out', 'fade-out', 'slide-out-to-top', 'duration-500');
                setTimeout(() => toast.remove(), 500);
            }
        }, 4000);
    },

    isUuid(str) {
        if (!str || typeof str !== 'string') return false;
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(str);
    },

    async resolveMetadataId(type, value) {
        if (!value) return null;
        if (this.isUuid(value)) return value;

        console.log(`🔍 [Signal Flow] Résolution du nom "${value}" en UUID pour ${type}...`);

        // 1. Chercher dans les options déjà chargées
        const list = type === 'tone' ? this.availableTones : this.availableGoals;
        const found = list.find(item => item.name.toLowerCase() === value.toLowerCase());
        if (found) {
            const id = type === 'tone' ? found.id_tone : found.id_goal;
            console.log(`✅ [Signal Flow] Trouvé en local: ${id}`);
            return id;
        }

        // 2. Chercher en base si pas trouvé en local
        try {
            const table = type === 'tone' ? 'tones' : 'goals';
            const idCol = type === 'tone' ? 'id_tone' : 'id_goal';
            const { data, error } = await supabase
                .from(table)
                .select(idCol)
                .ilike('name', value)
                .single();

            if (data) {
                console.log(`✅ [Signal Flow] Trouvé en base (${table}): ${data[idCol]}`);
                return data[idCol];
            }
        } catch (e) {
            console.warn(`⚠️ [Signal Flow] Impossible de résoudre "${value}" via la base`, e);
        }

        return value; // Retourne l'original si rien n'est trouvé (échouera au save si pas UUID)
    },

    async handleSave() {
        if (this.isSaving) return;

        if (!this.currentPostId) {
            console.error("🚫 [Signal Flow] Erreur: Pas d'id_post trouvé.");
            this.showToast("Impossible d'enregistrer : post non identifié.", 'error');
            return;
        }

        this.isSaving = true;
        this.renderButtons();

        try {
            // Résolution des IDs avant sauvegarde
            const resolvedTone = await this.resolveMetadataId('tone', this.tone);
            const resolvedGoal = await this.resolveMetadataId('goal', this.goal);

            console.log("💾 [Signal Flow] Tentative de sauvegarde :");
            console.log("   - ID Post:", this.currentPostId);
            console.log("   - Ton (résolu):", resolvedTone);
            console.log("   - Objectif (résolu):", resolvedGoal);
            
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id;

            console.log("💾 [Signal Flow] Tentative de sauvegarde :");
            console.log("   - ID Post:", this.currentPostId, `(${typeof this.currentPostId})`);
            console.log("   - User ID (Auth):", currentUserId);
            
            // 1. Optionnel : Vérifier si le post existe avant l'update (pour le débug)
            const { data: checkData } = await supabase
                .from('posts')
                .select('id_post, id_user')
                .eq('id_post', this.currentPostId)
                .maybeSingle();

            if (!checkData) {
                console.warn("⚠️ [Signal Flow] Le post n'a pas été trouvé en base AVANT l'update. ID inexistant ?");
            } else {
                console.log("🔍 [Signal Flow] Post trouvé en base avant update:", checkData);
            }

            const { data, error } = await supabase
                .from('posts')
                .update({
                    content_body: this.content.post.body,
                    id_tone: resolvedTone,
                    id_goal: resolvedGoal
                })
                .eq('id_post', this.currentPostId)
                .select(); 

            if (error) {
                console.error("❌ [Signal Flow] Erreur API Supabase:", error);
                throw error;
            }
            
            if (!data || data.length === 0) {
                console.error("❌ [Signal Flow] Échec Update: Aucune ligne n'a été modifiée. RLS ? ID incorrect ?");
                throw new Error("Aucune ligne n'a été mise à jour.");
            }

            console.log("✅ [Signal Flow] Données vérifiées en base:", data[0]);
            
            this.isModified = false;
            this.showToast("Le contenu a bien été enregistré et vérifié", 'success');
        } catch (err) {
            console.error("❌ [Signal Flow] Erreur sauvegarde:", err.message || err);
            if (err.details) console.error("   Details:", err.details);
            if (err.hint) console.error("   Hint:", err.hint);
            
            this.showToast("Erreur lors de l'enregistrement : " + (err.message || "Erreur inconnue"), 'error');
        } finally {
            this.isSaving = false;
            this.render();
        }
    },

    togglePreviewExpansion() {
        this.isPreviewExpanded = !this.isPreviewExpanded;
        this.render();
    },

    handleEditorInput(el) {
        if (this.content.post.body !== el.innerHTML) {
            this.content.post.body = el.innerHTML;
            this.isModified = true;
            this.renderPreview();
            this.renderButtons(); 
        }
    },

    renderButtons() {
        const regenBtn = document.getElementById('regen-btn');
        const saveBtn = document.getElementById('save-btn');
        
        if (regenBtn) {
            regenBtn.disabled = !this.isModified || this.isAiLoading;
            regenBtn.className = `w-full md:w-auto px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 shadow-sm ${(!this.isModified || this.isAiLoading) ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5' : 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700 shadow-md hover:-translate-y-0.5 active:translate-y-0'}`;
            regenBtn.onclick = (this.isModified && !this.isAiLoading) ? () => this.handleRegenerate() : null;
        }
        
        if (saveBtn) {
            saveBtn.disabled = !this.isModified || this.isSaving || this.isAiLoading;
            saveBtn.className = `px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 shadow-sm ${(!this.isModified || this.isSaving || this.isAiLoading) ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}`;
            saveBtn.onclick = this.isModified ? () => this.handleSave() : null;
        }
    },

    toggleEmojiPicker(e) {
        e.stopPropagation();
        const picker = document.getElementById('emoji-picker');
        picker.classList.toggle('hidden');
    },

    insertEmoji(emoji) {
        const editor = document.getElementById('rich-editor');
        editor.focus();
        document.execCommand('insertText', false, emoji);
        document.getElementById('emoji-picker').classList.add('hidden');
        this.handleEditorInput(editor);
    },

    updateSettings(key, value) {
        if (this[key] !== value) {
            this[key] = value;
            this.isModified = true;
            this.render();
        }
    },

    async handleRegenerate() {
        if (this.isAiLoading) return;
        
        // On capture le contenu AVANT de passer en chargement car setAiLoading(true) vide le contenu
        const contentToSend = this.content.post.body;
        
        this.setAiLoading(true);
        this.render();

        try {
            // 1. Session utilisateur
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session non trouvée');

            // 2. Profil utilisateur pour id_user
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id_user')
                .eq('id_auth_user', session.user.id)
                .single();

            if (profileError) throw profileError;

            // 3. Appel au Webhook n8n
            console.log('📡 [Signal Flow] Appel webhook modification-post');
            const response = await fetch('https://oreegami.app.n8n.cloud/webhook/modification-post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_post: this.currentPostId,
                    id_user: profile.id_user,
                    id_user_goal: this.goal,
                    id_user_tone: this.tone,
                    body_content: contentToSend
                })
            });

            if (!response.ok) throw new Error('Erreur HTTP: ' + response.status);

            const rawText = await response.text();
            console.log('📨 [Signal Flow] Réponse brute:', rawText);

            let payload = {};
            try {
                payload = JSON.parse(rawText);
            } catch(e) {
                payload = { content_body: rawText };
            }

            const newContent = payload.content_body || payload.body_content || (typeof payload === 'string' ? payload : '');

            if (newContent && newContent.trim().length > 0) {
                this.content.post.body = newContent;
                this.isModified = false;
                this.initialTone = this.tone;
                this.initialGoal = this.goal;
                this.showToast("Le contenu a bien été régénéré", 'success');
            } else {
                throw new Error("Réponse vide de l'IA");
            }
        } catch (error) {
            console.error(">>> Erreur régénération:", error);
            this.showToast("Erreur lors de la régénération", 'error');
        } finally {
            this.setAiLoading(false);
            this.render();
            
            const editor = document.getElementById('rich-editor');
            if (editor) {
                editor.innerText = this.content.post.body;
                this.handleEditorInput(editor);
            }
        }
    },


};
