import { supabase } from './supabase.js';
import { onboarding } from './modules/onboarding.js';
import { dashboard } from './modules/dashboard.js';

console.log("SignalFlow: main.js initializing...");

// --- State Management ---
const state = {
    user: null,
    currentView: 'auth', // 'auth', 'onboarding', 'dashboard'
};

// --- View Definitions ---
const views = {
    auth: () => `
        <div class="flex flex-col md:flex-row min-h-screen view-transition bg-anthracite-950 overflow-hidden">
            <!-- Left Side: Branding -->
            <div class="md:w-1/2 flex flex-col justify-center p-12 md:p-24 relative overflow-hidden border-r border-white/5">
                <div class="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent opacity-50"></div>
                
                <div class="relative z-10 space-y-12">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]">S</div>
                        <h1 class="text-3xl font-black font-display text-white tracking-tight">SignalFlow</h1>
                    </div>
                    
                    <div class="space-y-8 max-w-lg">
                        <h2 class="text-5xl md:text-6xl font-light leading-[1.1] text-white">
                            L'IA pour <span class="text-blue-500 font-medium">orchestrer</span> vos flux complexes.
                        </h2>
                        <p class="text-lg text-zinc-400 font-light leading-relaxed tracking-wide">
                            Découvrez les signaux faibles, générez du contenu haute performance et automatisez votre présence digitale avec une interface conçue pour la précision.
                        </p>
                    </div>

                    <div class="flex items-center gap-8 pt-8">
                        <div class="text-center">
                            <p class="text-2xl font-bold text-white">99.9%</p>
                            <p class="text-detail">Uptime</p>
                        </div>
                        <div class="w-[1px] h-10 bg-white/10"></div>
                        <div class="text-center">
                            <p class="text-2xl font-bold text-white">2.4s</p>
                            <p class="text-detail">Latency</p>
                        </div>
                    </div>
                </div>
                
                <!-- Decorative element -->
                <div class="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full"></div>
            </div>

            <!-- Right Side: Authentification -->
            <div class="md:w-1/2 flex flex-col justify-center items-center p-12 md:p-24 bg-[#0a0a0c]">
                <div class="max-w-md w-full space-y-10">
                    <div class="space-y-3">
                        <h3 class="text-3xl font-bold text-white tracking-tight">Bienvenue</h3>
                        <p class="text-secondary">Identifiez-vous pour accéder à votre console.</p>
                    </div>

                    <form id="auth-form" class="space-y-6">
                        <div class="space-y-2">
                            <label for="email" class="text-detail ml-1">E-mail</label>
                            <input type="email" id="email" placeholder="nom@agence.com" class="input-premium w-full" required>
                        </div>
                        <div class="space-y-2">
                            <div class="flex justify-between items-center">
                                <label for="password" class="text-detail ml-1">Mot de passe</label>
                                <a href="#" class="text-[11px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-wider transition-colors">Oublié ?</a>
                            </div>
                            <input type="password" id="password" placeholder="••••••••" class="input-premium w-full" required>
                        </div>
                        
                        <button type="submit" class="btn-neon w-full uppercase tracking-widest text-xs font-bold py-4">
                            Se connecter
                        </button>
                    </form>

                    <div class="relative py-4 flex items-center justify-center">
                        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-white/5"></div></div>
                        <span class="relative px-6 bg-anthracite-950 text-detail">Ou continuer avec</span>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <button id="login-google" class="flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white font-medium py-3 rounded-xl hover:bg-white/10 transition-all">
                            <svg class="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            Google
                        </button>
                        <button id="login-linkedin" class="flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white font-medium py-3 rounded-xl hover:bg-white/10 transition-all">
                            <svg class="w-5 h-5 fill-[#3b82f6]" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                            LinkedIn
                        </button>
                    </div>

                    <p class="text-center text-secondary">
                        Nouveau ici ? <a href="#" class="text-blue-500 hover:text-blue-400 font-bold tracking-wide transition-colors underline underline-offset-4">Créer un compte</a>
                    </p>
                </div>
            </div>
        </div>
    `,
    onboarding: () => {
        setTimeout(() => onboarding.render(), 0);
        return `<div id="onboarding-placeholder"></div>`;
    },
    dashboard: () => {
        setTimeout(() => dashboard.render(), 0);
        return `<div id="dashboard-placeholder"></div>`;
    }
};

// --- Core Functions ---
function render() {
    const app = document.getElementById('app');
    if (!app) return;

    try {
        if (state.currentView === 'onboarding') {
            app.innerHTML = views.onboarding();
        } else if (state.currentView === 'dashboard') {
            app.innerHTML = views.dashboard();
        } else {
            app.innerHTML = views[state.currentView]();
            attachEventListeners();
        }
    } catch (e) {
        console.error("SignalFlow Render Error:", e);
        app.innerHTML = `<div class="p-20 text-center text-red-400 font-bold">Erreur critique : ${e.message}</div>`;
    }
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function attachEventListeners() {
    const googleBtn = document.getElementById('login-google');
    const linkedinBtn = document.getElementById('login-linkedin');
    const authForm = document.getElementById('auth-form');

    const navigateToOnboarding = () => {
        state.currentView = 'onboarding';
        render();
    };

    if (googleBtn) googleBtn.onclick = navigateToOnboarding;
    if (linkedinBtn) linkedinBtn.onclick = navigateToOnboarding;
    if (authForm) {
        authForm.onsubmit = (e) => {
            e.preventDefault();
            navigateToOnboarding();
        };
    }
}

// --- Initialization ---
async function init() {
    window.addEventListener('onboarding-finished', () => {
        state.currentView = 'dashboard';
        render();
    });

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.user = session.user;
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id_auth_user', session.user.id)
                .single();

            if (profile?.onboarding_completed) {
                onboarding.updateData({
                    firstName: profile.first_name,
                    brand: profile.brand,
                    tone: profile.tone,
                    goal: profile.goal
                });
                state.currentView = 'dashboard';
            } else {
                state.currentView = 'onboarding';
            }
        } else {
            state.currentView = 'auth';
        }
    } catch (e) {
        console.warn("SignalFlow Auth: Offline or unconfigured.", e);
        state.currentView = 'auth';
    }

    render();
}

window.addEventListener('DOMContentLoaded', init);
