import { signal } from './signal.js';
import { onboarding } from './onboarding.js';
import { supabase } from '../supabase.js';

export const creation = {
    format: 'post', // 'post' or 'carousel'
    tone: 'Expert',
    goal: 'Engagement',
    isAiLoading: false,
    currentPostId: null,
    currentPostTitle: null,
    isModalOpen: false,
    isPreviewExpanded: false,
    isRegenerating: false,
    initialTone: "Expert",
    initialGoal: "Engagement",
    tone: "Expert",
    goal: "Engagement",
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
        this.format = f;
        this.render();
    },

    updatePost(field, value) {
        this.content.post[field] = value;
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
        this.renderPreview();
    },

    loadGeneratedContent(data) {
        // Gestion flexible : Make peut renvoyer un objet ou un tableau [Bundle]
        const payload = Array.isArray(data) ? data[0] : data;

        // Validation stricte du payload
        if (!payload || !payload.id_post) {
            console.warn("SCHtroumf : Payload Make invalide ou ID_post manquant.", data);
            this.clearContent();
            this.setAiLoading(false);
            return;
        }

        // Si on a un ID, on va chercher dans la DB
        this.fetchPostById(payload.id_post);
    },

    async fetchPostById(postId) {
        this.setAiLoading(true);
        console.log("DEBUG: Tentative de chargement du post:", postId);
        try {
            const { data, error } = await supabase
                .from('posts')
                .select('*')
                .eq('id_post', postId)
                .maybeSingle();

            console.log("DEBUG: Réponse Supabase:", { data, error });

            if (error) throw new Error("Erreur Supabase: " + error.message);
            if (!data) throw new Error("Post non trouvé pour l'ID: " + postId);

            this.currentPostId = data.id_post;
            this.currentPostTitle = data.title;
            this.content.post = {
                hook: "",
                body: data.content_body || "",
                cta: "",
                hashtags: data.hashtag || ""
            };
            this.format = 'post';
            this.initialTone = this.tone;
            this.initialGoal = this.goal;
        } catch (e) {
            console.error("SCHtroumf : Erreur lors de la récupération du post", e);
            this.currentPostId = null;
            this.currentPostTitle = null;
            this.clearContent();
        } finally {
            this.setAiLoading(false);
        }
    },

    clearContent() {
        this.content.post = { hook: "", body: "", cta: "", hashtags: "" };
        this.render();
    },

    render() {
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

        const regenOverlay = this.isRegenerating ? `
            <div class="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-anthracite-950/40 backdrop-blur-[4px] animate-in fade-in duration-300">
                <div class="bg-white px-12 py-10 rounded-[2.5rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] border border-zinc-100 flex flex-col items-center gap-8 animate-in zoom-in-95 duration-500">
                    <div class="relative">
                        <div class="w-16 h-16 border-4 border-blue-600/10 rounded-full"></div>
                        <div class="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                    <div class="flex flex-col items-center gap-2">
                        <p class="text-2xl font-black text-zinc-900 tracking-tighter animate-pulse text-center">Création de votre post personnalisé</p>
                        <p class="text-sm text-zinc-500 font-medium tracking-tight">Signal Flow IA génère la meilleure version...</p>
                    </div>
                </div>
            </div>
        ` : '';

        const hasChanged = this.tone !== this.initialTone || this.goal !== this.initialGoal;

        container.innerHTML = `
            ${modalHtml}
            ${regenOverlay}
            <div id="toast-container" class="fixed top-8 right-8 z-[200] flex flex-col gap-3 pointer-events-none"></div>
            
            <div class="container mx-auto px-4 py-8 space-y-10 animate-in fade-in duration-700">
                <!-- TOP SECTION: Header & Post Meta -->
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <header class="view-transition space-y-2">
                        <p class="text-detail">Atelier de Contenu</p>
                        <h1 class="text-5xl font-black text-white tracking-tighter">Studio</h1>
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
                        <select class="w-full bg-transparent text-sm text-zinc-300 font-bold outline-none py-2 cursor-pointer" onchange="window.creation.tone = this.value">
                            <option value="Expert" ${this.tone === 'Expert' ? 'selected' : ''}>Expert</option>
                            <option value="Bold" ${this.tone === 'Bold' ? 'selected' : ''}>Bold / Direct</option>
                            <option value="\u00c9ducatif" ${this.tone === '\u00c9ducatif' ? 'selected' : ''}>\u00c9ducatif</option>
                        </select>
                    </div>
                    <!-- Goal Selection -->
                    <div class="w-full md:w-1/4 flex items-center gap-4 bg-anthracite-950/50 px-4 py-1.5 rounded-2xl border border-white/5">
                        <span class="text-detail !text-[9px] whitespace-nowrap">Objectif</span>
                        <select class="w-full bg-transparent text-sm text-zinc-300 font-bold outline-none py-2 cursor-pointer" onchange="window.creation.updateSettings('goal', this.value)">
                            <option value="Engagement" ${this.goal === 'Engagement' ? 'selected' : ''}>Engagement</option>
                            <option value="Autorit\u00e9" ${this.goal === 'Autorit\u00e9' ? 'selected' : ''}>Autorit\u00e9</option>
                            <option value="Leads" ${this.goal === 'Leads' ? 'selected' : ''}>G\u00e9n\u00e9ration de leads</option>
                        </select>
                    </div>
                    <!-- Regenerate Button -->
                    <button 
                        onclick="${!this.isRegenerating ? 'window.creation.handleRegenerate()' : ''}"
                        ${this.isRegenerating ? 'disabled' : ''}
                        class="w-full md:w-auto px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 shadow-sm
                        ${this.isRegenerating ? 'bg-blue-600/50 cursor-wait text-white/50' : 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700 shadow-md hover:-translate-y-0.5 active:translate-y-0'}"
                    >
                        <i data-lucide="refresh-cw" class="w-4 h-4 ${this.isRegenerating ? 'animate-spin' : (hasChanged ? 'animate-in spin-in duration-500' : '')}"></i>
                        ${this.isRegenerating ? 'G\u00e9n\u00e9ration...' : 'Reg\u00e9n\u00e9rer'}
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
                                onclick="window.creation.handleSave()"
                                ${this.isSaving || this.isRegenerating ? 'disabled' : ''}
                                class="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2 shadow-sm ${this.isRegenerating ? 'opacity-50 cursor-not-allowed' : ''}"
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
                                <div class="text-[10px] font-black uppercase tracking-widest opacity-60">Signal Flow Studio</div>
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

    copyToClipboard() {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = this.content.post.body;
        const text = tempDiv.innerText;
        
        navigator.clipboard.writeText(text).then(() => {
            this.showToast("Contenu copi\u00e9 !");
        });
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

    async handleSave() {
        if (this.isSaving) return;

        if (!this.currentPostId) {
            this.showToast("Le post n'a pas pu être enregistré", 'error');
            return;
        }

        this.isSaving = true;
        this.render();

        try {
            console.log(">>> Sauvegarde via RPC pour ID:", this.currentPostId);
            
            const { error } = await supabase.rpc('update_post_content', {
                p_id_post: this.currentPostId,
                p_body: this.content.post.body
            });

            if (error) throw error;
            
            this.showToast("Le contenu a bien été enregistré", 'success');
        } catch (err) {
            console.error(">>> Erreur RPC:", err);
            this.showToast("Le post n'a pas pu être enregistré", 'error');
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
        this.content.post.body = el.innerHTML; // On stocke l'HTML pour pr\u00e9server gras/italique
        this.renderPreview();
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
        this[key] = value;
        this.render();
    },

    async handleRegenerate() {
        if (this.isRegenerating) return;
        
        this.isRegenerating = true;
        this.render();

        try {
            console.log(">>> Appel Edge Function 'regenerate-content'");

            const { data, error } = await supabase.functions.invoke('regenerate-content', {
                body: {
                    content_body: this.content.post.body,
                    tone: this.tone,
                    goal: this.goal
                }
            });

            if (error) throw error;

            const newContent = data.result;

            if (newContent && newContent.trim().length > 0) {
                this.content.post.body = newContent;
                this.initialTone = this.tone;
                this.initialGoal = this.goal;
                this.showToast("Le contenu a bien été régénéré", 'success');
            } else {
                throw new Error("Réponse vide de l'IA");
            }
        } catch (error) {
            console.error(">>> Erreur de régénération via Edge Function:", error);
            this.showToast("Erreur lors de la régénération, veuillez réessayer", "error");
        } finally {
            this.isRegenerating = false;
            this.render();
            
            const editor = document.getElementById('rich-editor');
            if (editor) {
                editor.innerText = this.content.post.body;
                this.handleEditorInput(editor);
            }
        }
    }
};
