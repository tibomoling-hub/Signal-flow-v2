import { supabase } from '../supabase.js';
import { creation } from './creation.js';

export const signal = {
    trends: [],
    openSources: {},
    loadingTrends: {}, // id_trend -> boolean

    async fetchTrends() {
        this.renderSkeleton();
        try {
            const { data, error } = await supabase
                .from('trends')
                .select(`
                    *,
                    trend_source_items (
                        source_items (
                            title,
                            url,
                            author,
                            published_at,
                            summary,
                            content,
                            sources (
                                name,
                                category
                            )
                        )
                    )
                `)
                .order('score', { ascending: false });

            if (error) throw error;

            this.trends = (data || []).map(function(trend) {
                return Object.assign({}, trend, {
                    sources: (trend.trend_source_items || [])
                        .map(function(si) { return si.source_items; })
                        .filter(Boolean)
                });
            });

            this.render();
        } catch (e) {
            console.error('Signal Flow Error: fetchTrends', e);
            this.render();
        }
    },

    toggleSources(trendId) {
        this.openSources[trendId] = !this.openSources[trendId];
        this.render();
    },

    async handlePublish(trendId) {
        if (this.loadingTrends[trendId]) return;

        // 1. Basculer vers la Création avec le skeleton de chargement
        window.dashboard.setTab('creation');
        window.creation.isAiLoading = true;
        window.creation.render();

        try {
            // 2. Session utilisateur
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session non trouvée');

            // 3. Profil utilisateur
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id_user, tone, goal')
                .eq('id_auth_user', session.user.id)
                .single();

            if (profileError) throw profileError;

            // 4. Appel au Webhook Make
            console.log('📡 [Signal Flow] Appel webhook Make, trend:', trendId);
            const response = await fetch('https://hook.eu1.make.com/4o6kwqi31dmho63dfpycc7gonqhn3wgp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_trend: trendId,
                    id_user: profile.id_user,
                    tone: profile.tone || 'Expert',
                    goal: profile.goal || 'growth'
                })
            });

            if (!response.ok) throw new Error('Erreur HTTP: ' + response.status);

            // 5. Lecture et parsing de la réponse
            const rawText = await response.text();
            console.log('📨 [Signal Flow] Réponse Make brute:', rawText);

            let payload = {};
            try {
                payload = JSON.parse(rawText);
            } catch(e) {
                // Si ce n'est pas du JSON, on traite le texte brut comme contenu
                payload = { content_body: rawText };
            }

            console.log('✅ [Signal Flow] Payload Make:', payload);

            // 6. Extraction de content_body (le champ envoyé par Make)
            const bodyText = payload.content_body || payload.body_content || '';

            if (!bodyText) {
                console.warn('⚠️ [Signal Flow] content_body vide dans la réponse Make');
                throw new Error('Contenu vide reçu de Make');
            }

            // 7. Injection directe dans la Création
            window.creation.content.post.body = bodyText;
            window.creation.currentPostId = payload.id_post || null;
            window.creation.format = 'post';
            window.creation.isAiLoading = false;
            window.creation.render();

            console.log('🎉 [Signal Flow] Contenu injecté dans la Création avec succès !');

        } catch (e) {
            console.error('❌ [Signal Flow] Échec:', e.message);
            window.creation.isAiLoading = false;
            window.creation.render();
        }
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        var date = new Date(dateStr);
        return new Intl.DateTimeFormat('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    },

    getCategoryStyles(category) {
        var cat = (category || 'BLOG').toUpperCase();
        if (cat === 'NEWS') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        if (cat === 'RESEARCH') return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
        if (cat === 'SOCIAL') return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    },

    renderSkeleton() {
        var container = document.getElementById('dashboard-content');
        if (!container) return;

        var html = '';
        for (var i = 0; i < 3; i++) {
            html += '<div class="glass-panel p-10 rounded-3xl space-y-6 animate-skeleton">';
            html += '  <div class="flex items-center gap-4">';
            html += '    <div class="h-4 w-12 bg-white/5 rounded"></div>';
            html += '    <div class="h-4 w-16 bg-white/5 rounded"></div>';
            html += '  </div>';
            html += '  <div class="h-10 w-2/3 bg-white/5 rounded-2xl"></div>';
            html += '  <div class="space-y-2">';
            html += '    <div class="h-4 w-full bg-white/5 rounded"></div>';
            html += '    <div class="h-4 w-4/5 bg-white/5 rounded"></div>';
            html += '  </div>';
            html += '</div>';
        }
        container.innerHTML = '<div class="space-y-10">' + html + '</div>';
    },

    render() {
        var container = document.getElementById('dashboard-content');
        if (!container) return;

        if (this.trends.length === 0) {
            container.innerHTML = [
                '<div class="p-20 text-center glass-panel rounded-3xl">',
                '  <div class="text-zinc-600 mb-4 flex justify-center"><i data-lucide="inbox" class="w-12 h-12 opacity-20"></i></div>',
                '  <p class="text-zinc-500 font-medium tracking-wide">Aucun signal d\u00e9tect\u00e9 pour le moment.</p>',
                '</div>'
            ].join('\n');
            return;
        }

        var cards = '';
        for (var i = 0; i < this.trends.length; i++) {
            cards += this.renderTrendCard(this.trends[i]);
        }
        container.innerHTML = '<div class="space-y-10 pb-20">' + cards + '</div>';
        if (window.lucide) window.lucide.createIcons();
    },

    renderTrendCard(trend) {
        var dateStr = this.formatDate(trend.created_at || trend.updated_at);
        var isOpen = !!this.openSources[trend.id_trend];
        var srcCount = trend.source_number || trend.sources.length;
        var chevron = isOpen ? 'chevron-up' : 'chevron-down';

        var html = '';

        // --- Card Open ---
        html += '<div class="glass-panel p-8 md:p-10 rounded-3xl border-white/10 shadow-2xl hover:shadow-blue-500/5 hover:border-blue-500/30 transition-all duration-500 view-transition group bg-anthracite-900/60">';

        // --- Header ---
        html += '<div class="flex items-center gap-3 mb-6">';
        
        // 1. Score Pill with Analytic Tooltip (Informative area, default cursor)
        html += '  <div class="group/score relative flex items-center gap-2 bg-blue-500/5 px-3 py-1.5 rounded-full border border-blue-500/10 shrink-0 cursor-default">';
        html += '    <span class="text-blue-400 font-black tracking-tighter text-base">' + trend.score + '</span>';
        html += '    <span class="text-[9px] text-blue-500/40 uppercase font-black tracking-[0.2em]">Score</span>';
        
        // Tooltip container (Informative only)
        html += '    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-5 bg-anthracite-900/95 backdrop-blur-xl border border-blue-500/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover/score:opacity-100 group-hover/score:visible pointer-events-none transition-all duration-300 delay-150 translate-y-2 group-hover/score:translate-y-0 z-[100]">';
        html += '        <div class="space-y-4">';
        html += '            <div class="flex justify-between items-center text-[10px]">';
        html += '                <span class="text-zinc-500 font-black uppercase tracking-widest italic">Score de sources</span>';
        html += '                <span class="text-blue-400 font-black">' + (trend.score_sources || 0) + '/100</span>';
        html += '            </div>';
        html += '            <div class="flex justify-between items-center text-[10px]">';
        html += '                <span class="text-zinc-500 font-black uppercase tracking-widest italic">Score de fra\u00eecheur</span>';
        html += '                <span class="text-blue-400 font-black">' + (trend.score_freshness || 0) + '/100</span>';
        html += '            </div>';
        html += '            <div class="flex justify-between items-center text-[10px]">';
        html += '                <span class="text-zinc-500 font-black uppercase tracking-widest italic">Score du moment</span>';
        html += '                <span class="text-blue-400 font-black">' + (trend.score_momentum || 0) + '/100</span>';
        html += '            </div>';
        html += '        </div>';
        // Tooltip Arrow
        html += '        <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1.5 w-3 h-3 bg-anthracite-900 border-r border-b border-blue-500/20 rotate-45"></div>';
        html += '    </div>';
        html += '  </div>';
        
        // 2. Tag Pill
        html += '  <div class="flex items-center bg-zinc-800/30 px-3 py-1.5 rounded-full border border-white/5 shrink-0">';
        html += '    <span class="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">#' + (trend.topic || 'AI') + '</span>';
        html += '  </div>';
        
        // 3. Date Pill
        html += '  <div class="flex items-center gap-2 bg-zinc-800/30 px-3 py-1.5 rounded-full border border-white/5 shrink-0">';
        html += '    <i data-lucide="clock" class="w-2.5 h-2.5 text-zinc-600"></i>';
        html += '    <span class="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">' + dateStr + '</span>';
        html += '  </div>';

        // 4. Feedback Actions removed
        html += '  <div class="ml-auto flex items-center gap-3"></div>';
        
        html += '</div>';

        // --- Title & Summary ---
        html += '<div class="space-y-4 cursor-pointer" onclick="window.signal.handlePublish(\'' + trend.id_trend + '\')">';
        html += '  <h2 class="text-3xl font-black text-white tracking-tight leading-tight group-hover:text-blue-400 transition-colors">' + trend.title + '</h2>';
        html += '  <p class="text-secondary text-base leading-relaxed line-clamp-3 font-light opacity-80">' + trend.summary + '</p>';
        html += '</div>';

        // --- Toggle Sources & Velocity Metric ---
        html += '<div class="flex items-center mt-4">';
        html += '  <div onclick="window.signal.toggleSources(\'' + trend.id_trend + '\')" class="text-sm text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer select-none transition-colors w-fit">';
        html += '    <span>Sources (' + srcCount + ')</span>';
        html += '    <i data-lucide="' + chevron + '" class="w-4 h-4"></i>';
        html += '  </div>';
        html += '  <div class="ml-4 pl-4 border-l border-white/5 text-[11px] text-zinc-500 font-medium tracking-tight">';
        html += '    depuis moins de 24 h : <span class="text-zinc-300 font-bold">' + (trend.sources_last_24h || 0) + '</span>';
        html += '  </div>';
        html += '</div>';

        // --- Conditional Sources Grid ---
        if (isOpen) {
            html += '<div class="border-t border-white/5 pt-0 mt-1 view-transition">';
            html += '  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">';

            for (var i = 0; i < trend.sources.length; i++) {
                var s = trend.sources[i];
                var cat = (s.sources && s.sources.category) ? s.sources.category : 'Blog';
                var catStyle = this.getCategoryStyles(cat);
                var sourceName = (s.sources && s.sources.name) ? s.sources.name : 'Inconnu';
                var excerpt = s.summary || s.content || 'Analyse en cours...';

                html += '<div class="p-3 rounded-2xl bg-anthracite-950/40 border border-white/5 hover:border-blue-500/20 hover:bg-blue-500/[0.03] transition-all duration-300 flex flex-col gap-2 group/source">';
                html += '  <div class="flex items-center justify-between">';
                html += '    <div class="flex items-center gap-2">';
                html += '      <span class="rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-widest uppercase border ' + catStyle + '">' + cat + '</span>';
                html += '      <span class="text-zinc-400 font-bold text-xs truncate max-w-[120px] tracking-tight">' + sourceName + '</span>';
                html += '    </div>';
                html += '    <a href="' + s.url + '" target="_blank" class="p-1.5 rounded-lg bg-white/5 text-zinc-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all">';
                html += '      <i data-lucide="external-link" class="w-3.5 h-3.5"></i>';
                html += '    </a>';
                html += '  </div>';
                html += '  <div class="space-y-1">';
                html += '    <p class="text-xs font-black text-white group-hover/source:text-blue-400 transition-colors leading-tight line-clamp-1">' + s.title + '</p>';
                html += '    <p class="text-[11px] text-zinc-500 font-light leading-snug line-clamp-1 italic">"' + excerpt + '"</p>';
                html += '  </div>';
                html += '</div>';
            }

            html += '  </div>';
            html += '</div>';
        }

        // --- Publish Button ---
        var isLoading = !!this.loadingTrends[trend.id_trend];
        var btnText = isLoading ? 'Génération par l\'IA...' : 'Publier';
        var btnIcon = isLoading ? '<div class="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>' : '';
        var disabled = isLoading ? 'disabled' : '';

        html += '<button onclick="window.signal.handlePublish(\'' + trend.id_trend + '\')" ' + disabled + ' class="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] w-full mt-6 uppercase tracking-[0.1em] text-xs font-black flex items-center justify-center gap-3">';
        html += btnIcon + btnText;
        html += '</button>';

        // --- Card Close ---
        html += '</div>';

        return html;
    }
};

window.signal = signal;
