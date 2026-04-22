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
    totalSteps: 7,
    data: {
        firstName: '',
        brand: '',
        niche: [],
        socials: {},
        audienceSize: '0-1k',
        frequency: 'daily',
        goal: 'grow',
        tone: 'Expert',
        formats: [],
        rgpd: false
    },
    errors: {},

    updateData(newData) {
        this.data = { ...this.data, ...newData };
    },

    next() {
        if (this.validateCurrentStep()) {
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
            for (const [social, url] of Object.entries(this.data.socials)) {
                if (!isValidSocialUrl(url)) {
                    this.errors[social] = `URL invalide pour ${social}.`;
                }
            }
        } else if (this.step === 7) {
            if (!this.data.rgpd) this.errors.rgpd = "Acceptation requise.";
        }
        if (Object.keys(this.errors).length > 0) {
            this.render();
            return false;
        }
        return true;
    },

    async save() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        await supabase
            .from('users')
            .update({
                first_name: this.data.firstName,
                topic: this.data.niche.join(', '),
                audience_size: this.data.audienceSize,
                posting_frequence: this.data.frequency,
                goal: this.data.goal,
                tone: this.data.tone,
                content_format: this.data.formats.join(', '),
                onboarding_completed: true,
                rgpd_accepted: this.data.rgpd,
                rgpd_accepted_at: new Date().toISOString()
            })
            .eq('id_auth_user', session.user.id);
    },

    render() {
        const container = document.getElementById('app');
        if (!container) return;
        
        container.innerHTML = `
            <div class="flex-1 flex flex-col items-center justify-center p-6 md:p-12 view-transition bg-anthracite-950 min-h-screen">
                <div class="max-w-xl w-full glass-panel p-8 md:p-12 rounded-[2rem] space-y-10 relative overflow-hidden shadow-2xl">
                    <!-- Progress -->
                    <div class="absolute top-0 left-0 w-full h-1.5 bg-white/5">
                        <div class="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-700" style="width: ${(this.step / this.totalSteps) * 100}%"></div>
                    </div>

                    <div class="flex justify-between items-center text-detail">
                        <span>Étape ${this.step} / ${this.totalSteps}</span>
                        <span class="text-blue-400 font-bold">${Math.round((this.step / this.totalSteps) * 100)}%</span>
                    </div>

                    <div id="step-content" class="min-h-[300px]">
                        ${this.getStepContent()}
                    </div>

                    <div class="flex gap-4 pt-6">
                        ${this.step > 1 ? `<button id="onb-prev" class="btn-secondary px-8">Retour</button>` : ''}
                        <button id="onb-next" class="btn-neon flex-1 uppercase tracking-widest text-xs">
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
                    <div class="space-y-6">
                        <h2 class="text-4xl font-bold text-white tracking-tight leading-tight">L'aventure <span class="text-blue-500">SignalFlow</span> commence ici.</h2>
                        <p class="text-secondary">Configurons votre environnement d'orchestration en quelques secondes.</p>
                        <div class="grid grid-cols-2 gap-4 pt-4">
                            <div class="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                                <div class="text-blue-400"><i data-lucide="compass" class="w-6 h-6"></i></div>
                                <h3 class="text-sm font-bold">Découverte</h3>
                                <p class="text-xs text-zinc-500 font-light">Signaux à fort impact.</p>
                            </div>
                            <div class="p-5 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                                <div class="text-blue-400"><i data-lucide="zap" class="w-6 h-6"></i></div>
                                <h3 class="text-sm font-bold">Génération</h3>
                                <p class="text-xs text-zinc-500 font-light">Contenu viral optimisé.</p>
                            </div>
                        </div>
                    </div>
                `;
            case 2:
                return `
                    <div class="space-y-8">
                        <div class="space-y-2">
                            <h2 class="text-3xl font-bold text-white tracking-tight">Identité</h2>
                            <p class="text-secondary">Comment devons-nous vous appeler ?</p>
                        </div>
                        <div class="space-y-6">
                            <div class="space-y-2">
                                <label class="text-detail ml-1">Prénom</label>
                                <input type="text" id="onb-firstname" value="${this.data.firstName}" placeholder="Nom d'utilisateur" class="input-premium w-full">
                                ${errorMsg('firstName')}
                            </div>
                            <div class="space-y-2">
                                <label class="text-detail ml-1">Nom du média / Marque</label>
                                <input type="text" id="onb-brand" value="${this.data.brand}" placeholder="Ex: TechInsights" class="input-premium w-full">
                                ${errorMsg('brand')}
                            </div>
                        </div>
                    </div>
                `;
            case 3:
                const niches = ['IA', 'SaaS', 'Web3', 'Growth', 'No-code', 'Design'];
                return `
                    <div class="space-y-8">
                        <div class="space-y-2">
                            <h2 class="text-3xl font-bold text-white tracking-tight">Sujets</h2>
                            <p class="text-secondary">Sélectionnez les domaines que vous souhaitez surveiller.</p>
                        </div>
                        <div class="flex flex-wrap gap-3">
                            ${niches.map(n => `
                                <button class="niche-tag px-5 py-2.5 rounded-xl border-2 transition-all font-medium text-sm ${this.data.niche.includes(n) ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-white/5 border-transparent text-zinc-500 hover:text-zinc-300'}" data-niche="${n}">
                                    ${n}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
            case 4:
                return `
                    <div class="space-y-8">
                        <div class="space-y-2">
                            <h2 class="text-3xl font-bold text-white tracking-tight">Écosystème</h2>
                            <p class="text-secondary">Sur quelles plateformes êtes-vous actif ?</p>
                        </div>
                        <div class="space-y-3">
                            ${['LinkedIn', 'Twitter', 'Instagram'].map(s => `
                                <div class="p-4 rounded-2xl bg-white/5 border ${this.data.socials[s] !== undefined ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/5'} transition-all">
                                    <div class="flex items-center gap-4">
                                        <input type="checkbox" id="check-${s}" class="w-5 h-5 rounded border-white/10 bg-anthracite-950 text-blue-600 focus:ring-blue-500" ${this.data.socials[s] !== undefined ? 'checked' : ''} data-social-check="${s}">
                                        <label for="check-${s}" class="flex-1 font-bold text-sm cursor-pointer">${s}</label>
                                    </div>
                                    ${this.data.socials[s] !== undefined ? `
                                        <input type="url" placeholder="URL du profil" class="social-url-input w-full mt-3 input-premium text-xs py-2" value="${this.data.socials[s] || ''}" data-social-input="${s}">
                                        ${errorMsg(s)}
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            case 5:
                return `
                    <div class="space-y-8">
                        <div class="space-y-2">
                            <h2 class="text-3xl font-bold text-white tracking-tight">Métriques</h2>
                            <p class="text-secondary">Évaluons vos besoins actuels.</p>
                        </div>
                        <div class="space-y-6">
                            <div class="space-y-2">
                                <label class="text-detail ml-1">Audience</label>
                                <select id="onb-audience" class="input-premium w-full bg-anthracite-950">
                                    <option value="0-1k" ${this.data.audienceSize === '0-1k' ? 'selected' : ''}>0 - 1,000</option>
                                    <option value="1k-10k" ${this.data.audienceSize === '1k-10k' ? 'selected' : ''}>1k - 10k</option>
                                    <option value="10k+" ${this.data.audienceSize === '10k+' ? 'selected' : ''}>10k+</option>
                                </select>
                            </div>
                            <div class="space-y-2">
                                <label class="text-detail ml-1">Fréquence de publication</label>
                                <select id="onb-frequency" class="input-premium w-full bg-anthracite-950">
                                    <option value="daily" ${this.data.frequency === 'daily' ? 'selected' : ''}>Quotidien</option>
                                    <option value="weekly" ${this.data.frequency === 'weekly' ? 'selected' : ''}>Hebdomadaire</option>
                                </select>
                            </div>
                        </div>
                    </div>
                `;
            case 6:
                return `
                    <div class="space-y-8">
                        <div class="space-y-2">
                            <h2 class="text-3xl font-bold text-white tracking-tight">Direction</h2>
                            <p class="text-secondary">Quel est votre objectif et votre style ?</p>
                        </div>
                        <div class="space-y-6">
                            <select id="onb-goal" class="input-premium w-full bg-anthracite-950">
                                <option value="grow" ${this.data.goal === 'grow' ? 'selected' : ''}>Visibilité / Croissance</option>
                                <option value="authority" ${this.data.goal === 'authority' ? 'selected' : ''}>Autorité / Expertise</option>
                            </select>
                            <div class="grid grid-cols-2 gap-3">
                                ${['Expert', 'Punchy', 'Éducatif', 'Personnel'].map(t => `
                                    <button class="tone-tag p-4 rounded-xl border transition-all text-xs font-bold uppercase tracking-widest ${this.data.tone === t ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-transparent text-zinc-500'}" data-tone="${t}">${t}</button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            case 7:
                return `
                    <div class="space-y-8">
                        <div class="space-y-2">
                            <h2 class="text-3xl font-bold text-white tracking-tight">Validation</h2>
                            <p class="text-secondary">Prêt à activer le moteur SignalFlow.</p>
                        </div>
                        <div class="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-4">
                            <h3 class="text-sm font-bold flex items-center gap-3">
                                <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                Protection & IA
                            </h3>
                            <p class="text-xs text-zinc-400 font-light leading-relaxed">
                                En continuant, vous autorisez l'utilisation de vos préférences pour calibrer nos modèles de détection et de génération.
                            </p>
                            <label class="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" id="onb-rgpd" class="w-5 h-5 rounded border-white/10 bg-anthracite-950 text-blue-600 focus:ring-blue-500" ${this.data.rgpd ? 'checked' : ''}>
                                <span class="text-xs font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors uppercase tracking-widest">Accepter les conditions</span>
                            </label>
                            ${errorMsg('rgpd')}
                        </div>
                    </div>
                `;
            default: return '';
        }
    },

    attachListeners() {
        const nextBtn = document.getElementById('onb-next');
        const prevBtn = document.getElementById('onb-prev');
        
        if (nextBtn) {
            nextBtn.onclick = async () => {
                // Capture data based on step
                if (this.step === 2) {
                    this.data.firstName = document.getElementById('onb-firstname').value;
                    this.data.brand = document.getElementById('onb-brand').value;
                } else if (this.step === 4) {
                    document.querySelectorAll('[data-social-input]').forEach(input => {
                        this.data.socials[input.dataset.socialInput] = input.value;
                    });
                } else if (this.step === 5) {
                    this.data.audienceSize = document.getElementById('onb-audience').value;
                    this.data.frequency = document.getElementById('onb-frequency').value;
                } else if (this.step === 6) {
                    this.data.goal = document.getElementById('onb-goal').value;
                } else if (this.step === 7) {
                    this.data.rgpd = document.getElementById('onb-rgpd').checked;
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

        document.querySelectorAll('.niche-tag').forEach(tag => {
            tag.onclick = () => {
                const n = tag.dataset.niche;
                if (this.data.niche.includes(n)) this.data.niche = this.data.niche.filter(x => x !== n);
                else this.data.niche.push(n);
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
