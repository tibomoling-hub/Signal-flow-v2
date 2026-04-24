import { onboarding } from './onboarding.js';
import { signal } from './signal.js';
import { creation } from './creation.js';
import { settings } from './settings.js';

export const dashboard = {
    currentTab: 'signal',
    isMobileMenuOpen: false,
    selectedTrendId: null,

    tabs: {
        signal: { label: 'Signal', icon: 'radio' },
        creation: { label: 'Studio', icon: 'zap' },
        analytics: { label: 'Insight', icon: 'bar-chart-3' }
    },

    setTab(tabId) {
        this.currentTab = tabId;
        this.isMobileMenuOpen = false;
        this.render();
        
        if (tabId === 'signal') signal.fetchTrends();
        else if (tabId === 'creation') creation.render();
        else if (tabId === 'settings') settings.render();
    },

    startCreation(trendId) {
        this.selectedTrendId = trendId;
        this.setTab('creation');
    },

    toggleMobileMenu() {
        this.isMobileMenuOpen = !this.isMobileMenuOpen;
        this.render();
    },

    render() {
        const container = document.getElementById('app');
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col md:flex-row min-h-screen bg-anthracite-950 text-zinc-300 font-sans selection:bg-blue-500/30">
                
                <!-- Mobile Header -->
                <header class="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-anthracite-900/80 backdrop-blur-xl sticky top-0 z-50">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20 text-xs">S</div>
                        <span class="font-bold text-lg tracking-tight font-display text-white">Signal Flow</span>
                    </div>
                    <button id="mobile-menu-toggle" class="p-2 hover:bg-white/5 rounded-lg transition-colors">
                        <i data-lucide="${this.isMobileMenuOpen ? 'x' : 'menu'}" class="text-white w-5 h-5"></i>
                    </button>
                </header>

                <!-- Sidebar -->
                <aside id="sidebar" class="${this.isMobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-64 border-r border-white/5 bg-anthracite-950 h-screen sticky top-0 z-40 transition-all duration-300">
                    <div class="p-8 hidden md:flex items-center gap-3">
                        <div class="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] text-sm">S</div>
                        <span class="font-extrabold text-xl tracking-tight font-display text-white">Signal Flow</span>
                    </div>

                    <nav class="flex-1 px-4 py-6 space-y-2">
                        ${Object.entries(this.tabs).map(([id, tab]) => `
                            <button 
                                onclick="window.dashboard.setTab('${id}')"
                                class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all duration-300 group ${this.currentTab === id ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300 border border-transparent'}"
                            >
                                <i data-lucide="${tab.icon}" class="w-4 h-4 ${this.currentTab === id ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'}"></i>
                                <span class="text-xs uppercase tracking-[0.15em] font-black">${tab.label}</span>
                                ${id === 'analytics' ? '<span class="ml-auto text-[8px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 font-black uppercase tracking-widest border border-white/5">Soon</span>' : ''}
                            </button>
                        `).join('')}
                    </nav>

                    <div class="p-6 border-t border-white/5">
                        <div onclick="window.dashboard.setTab('settings')" 
                             class="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border transition-all cursor-pointer group ${this.currentTab === 'settings' ? 'border-blue-500/50 bg-blue-600/5' : 'border-white/5 hover:border-white/10'}">
                            <div class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-black text-white shadow-lg text-xs">
                                ${(onboarding.data.firstName || 'C')[0]}
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold text-white truncate">${onboarding.data.firstName || 'Créateur'}</p>
                                <p class="text-[10px] uppercase tracking-widest text-zinc-600 truncate font-black">${onboarding.data.brand || 'Free Plan'}</p>
                            </div>
                            <i data-lucide="settings" class="w-4 h-4 ${this.currentTab === 'settings' ? 'text-blue-400' : 'text-zinc-700 group-hover:text-zinc-400'}"></i>
                        </div>
                    </div>
                </aside>

                <!-- Content Area -->
                <main class="flex-1 flex flex-col min-h-0 bg-[#0a0a0c] relative overflow-y-auto custom-scrollbar">
                    <div class="p-6 md:p-12 max-w-[1400px] mx-auto w-full" id="main-content">
                        ${this.renderLayout()}
                    </div>
                </main>
            </div>
        `;
        this.attachListeners();
        
        if (this.currentTab === 'signal') {
            // Si aucune trend n'est chargée ou si on force le refresh initial
            if (signal.trends.length === 0) {
                signal.fetchTrends();
            } else {
                signal.render();
            }
        } else if (this.currentTab === 'creation') {
            creation.render();
        } else if (this.currentTab === 'settings') {
            settings.render();
        }
    },

    renderLayout() {
        switch(this.currentTab) {
            case 'signal':
                return `
                    <header class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 view-transition">
                        <div class="space-y-2">
                            <p class="text-detail">Plateforme de Veille</p>
                            <h1 class="text-5xl font-black text-white tracking-tighter">Signal</h1>
                        </div>
                        <div class="flex items-center gap-3">
                            <button class="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-all">
                                <i data-lucide="sliders-horizontal" class="w-4 h-4"></i> Filtres Avancés
                            </button>
                        </div>
                    </header>
                    <div id="dashboard-content" class="view-transition"></div>
                `;
            case 'creation':
                return `
                    <div id="dashboard-content" class="view-transition"></div>
                `;
            case 'analytics':
                return `
                    <div class="flex-1 flex flex-col items-center justify-center py-32 text-center view-transition">
                        <div class="w-20 h-20 bg-blue-600/10 border border-blue-500/20 rounded-[2rem] flex items-center justify-center shadow-2xl mb-8">
                            <i data-lucide="bar-chart-3" class="w-8 h-8 text-blue-500"></i>
                        </div>
                        <h1 class="text-4xl font-black text-white mb-4 tracking-tighter uppercase">Insights</h1>
                        <p class="text-secondary max-w-sm mx-auto mb-10 text-base leading-relaxed">
                            Nous calibrons les moteurs d'analyse. Vos métriques de performance seront disponibles prochainement.
                        </p>
                        <div class="px-6 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
                            Accès Restreint
                        </div>
                    </div>
                `;
            case 'settings':
                return `
                    <div id="dashboard-content" class="view-transition"></div>
                `;
        }
    },

    attachListeners() {
        window.dashboard = this;
        const menuToggle = document.getElementById('mobile-menu-toggle');
        if (menuToggle) {
            menuToggle.onclick = () => this.toggleMobileMenu();
        }
        if (window.lucide) window.lucide.createIcons();
    }
};
