import { supabase } from './supabase.js';
import { onboarding } from './modules/onboarding.js';
import { dashboard } from './modules/dashboard.js';

console.log("Signal Flow: main.js initializing...");

// --- State Management ---
const state = {
    user: null,
    currentView: 'auth', // 'auth', 'onboarding', 'dashboard'
    authMode: 'login', // 'login' or 'signup'
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
                        <h1 class="text-3xl font-black font-display text-white tracking-tight">Signal Flow</h1>
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
                        <h3 class="text-3xl font-bold text-white tracking-tight">${state.authMode === 'login' ? 'Bienvenue' : 'Créer un compte'}</h3>
                        <p class="text-secondary">${state.authMode === 'login' ? 'Identifiez-vous pour accéder à votre console.' : 'Rejoignez Signal Flow et commencez l\'orchestration.'}</p>
                    </div>

                    ${state.authMode === 'login' ? `
                        <form id="auth-form" class="space-y-6">
                            <div id="auth-error" class="hidden p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2">
                                Identifiants incorrects
                            </div>
                            
                            <div class="space-y-2 group">
                                <label for="email" class="text-detail ml-1 group-focus-within:text-blue-500 transition-colors">E-mail</label>
                                <input type="email" id="email" placeholder="nom@agence.com" class="input-premium w-full transition-all" required>
                            </div>
                            
                            <div class="space-y-2 group">
                                <div class="flex justify-between items-center">
                                    <label for="password" class="text-detail ml-1 group-focus-within:text-blue-500 transition-colors">Mot de passe</label>
                                    <button type="button" onclick="window.togglePasswordVisibility(event, 'password')" class="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider transition-colors">Afficher</button>
                                </div>
                                <div class="relative">
                                    <input type="password" id="password" placeholder="••••••••" class="input-premium w-full pr-12 transition-all" required>
                                    <div class="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none">
                                        <i data-lucide="lock" class="w-4 h-4"></i>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center justify-between px-1">
                                <label class="flex items-center gap-3 cursor-pointer group">
                                    <div class="relative w-5 h-5">
                                        <input type="checkbox" id="remember-me" class="peer sr-only">
                                        <div class="w-full h-full rounded-md border border-white/10 bg-white/5 peer-checked:bg-blue-600 peer-checked:border-blue-500 transition-all"></div>
                                        <i data-lucide="check" class="absolute inset-0 w-3 h-3 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                                    </div>
                                    <span class="text-[11px] text-zinc-500 group-hover:text-zinc-300 font-bold uppercase tracking-[0.15em] transition-colors">Se souvenir de moi</span>
                                </label>
                                <a href="#" class="text-[11px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-wider transition-colors">Oublié ?</a>
                            </div>
                            
                            <button type="submit" id="auth-submit" class="btn-neon w-full uppercase tracking-widest text-xs font-bold py-4 flex items-center justify-center gap-3">
                                <span id="btn-text">Se connecter</span>
                                <div id="btn-spinner" class="hidden w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            </button>
                        </form>
                    ` : `
                        <form id="signup-form" class="space-y-6">
                            <div id="auth-error" class="hidden p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2">
                                Erreur d'inscription
                            </div>
                            
                            <div class="space-y-2 group">
                                <label for="signup-email" class="text-detail ml-1 group-focus-within:text-blue-500 transition-colors">E-mail</label>
                                <input type="email" id="signup-email" placeholder="nom@agence.com" class="input-premium w-full transition-all" required>
                            </div>
                            
                            <div class="space-y-2 group">
                                <div class="flex justify-between items-center">
                                    <label for="signup-password" class="text-detail ml-1 group-focus-within:text-blue-500 transition-colors">Mot de passe</label>
                                    <button type="button" onclick="window.togglePasswordVisibility(event, 'signup-password')" class="text-[11px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-wider transition-colors">Afficher</button>
                                </div>
                                <input type="password" id="signup-password" placeholder="••••••••" class="input-premium w-full transition-all" required>
                            </div>

                            <div class="space-y-2 group">
                                <label for="signup-confirm" class="text-detail ml-1 group-focus-within:text-blue-500 transition-colors">Confirmer le mot de passe</label>
                                <input type="password" id="signup-confirm" placeholder="••••••••" class="input-premium w-full transition-all" required>
                            </div>
                            
                            <button type="submit" id="signup-submit" class="btn-neon w-full uppercase tracking-widest text-xs font-bold py-4 flex items-center justify-center gap-3">
                                <span id="signup-btn-text">Valider l'inscription</span>
                                <div id="signup-btn-spinner" class="hidden w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                            </button>

                            <button type="button" id="back-to-login" class="w-full text-center text-[11px] text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-widest transition-colors py-2">
                                ← Retour à la connexion
                            </button>
                        </form>
                    `}



                    ${state.authMode === 'login' ? `
                        <p class="text-center text-secondary">
                            Nouveau ici ? <button id="switch-to-signup" class="text-blue-500 hover:text-blue-400 font-bold tracking-wide transition-colors underline underline-offset-4">Créer un compte</button>
                        </p>
                    ` : ''}
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
        console.error("Signal Flow Render Error:", e);
        app.innerHTML = `<div class="p-20 text-center text-red-400 font-bold">Erreur critique : ${e.message}</div>`;
    }
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function attachEventListeners() {
    const authForm = document.getElementById('auth-form');
    const signupForm = document.getElementById('signup-form');
    const switchToSignup = document.getElementById('switch-to-signup');
    const backToLogin = document.getElementById('back-to-login');

    // Helper visibility
    window.togglePasswordVisibility = (e, inputId) => {
        const input = document.getElementById(inputId);
        const btn = e.target;
        if (input.type === 'password') {
            input.type = 'text';
            btn.innerText = 'Masquer';
        } else {
            input.type = 'password';
            btn.innerText = 'Afficher';
        }
    };

    if (switchToSignup) {
        switchToSignup.onclick = () => {
            state.authMode = 'signup';
            render();
        };
    }

    if (backToLogin) {
        backToLogin.onclick = () => {
            state.authMode = 'login';
            render();
        };
    }


    
    // LOGIN FORM HANDLER
    if (authForm) {
        authForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('auth-error');
            const submitBtn = document.getElementById('auth-submit');
            const btnText = document.getElementById('btn-text');
            const btnSpinner = document.getElementById('btn-spinner');
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            // Reset UI
            errorMsg.classList.add('hidden');
            emailInput.classList.remove('border-red-500/50', 'bg-red-500/5');
            passwordInput.classList.remove('border-red-500/50', 'bg-red-500/5');

            // Loading state
            submitBtn.disabled = true;
            btnText.innerText = 'Vérification...';
            btnSpinner.classList.remove('hidden');

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                // Success logic
                state.user = data.user;
                console.log("Signal Flow: Auth success for", data.user.email);
                
                // Relaunch init to check onboarding and navigate
                await init();

            } catch (err) {
                console.error("Signal Flow: Auth error", err.message);
                
                // UI Error state
                errorMsg.innerText = err.message === 'Invalid login credentials' ? 'Identifiants incorrects' : 'Erreur de connexion';
                errorMsg.classList.remove('hidden');
                
                // Field feedback
                emailInput.classList.add('border-red-500/50', 'bg-red-500/5');
                passwordInput.classList.add('border-red-500/50', 'bg-red-500/5');
                
                // Shake effect (optional micro-animation)
                authForm.classList.add('animate-shake');
                setTimeout(() => authForm.classList.remove('animate-shake'), 500);

            } finally {
                submitBtn.disabled = false;
                btnText.innerText = 'Se connecter';
                btnSpinner.classList.add('hidden');
            }
        };
    }

    // SIGNUP FORM HANDLER
    if (signupForm) {
        signupForm.onsubmit = async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirm = document.getElementById('signup-confirm').value;
            const errorMsg = document.getElementById('auth-error');
            const submitBtn = document.getElementById('signup-submit');
            const btnText = document.getElementById('signup-btn-text');
            const btnSpinner = document.getElementById('signup-btn-spinner');

            // Reset UI
            errorMsg.classList.add('hidden');

            // Validation
            if (!email.includes('@') || !email.includes('.')) {
                errorMsg.innerText = "Format d'email invalide";
                errorMsg.classList.remove('hidden');
                return;
            }
            if (password !== confirm) {
                errorMsg.innerText = "Les mots de passe ne correspondent pas";
                errorMsg.classList.remove('hidden');
                return;
            }
            if (password.length < 6) {
                errorMsg.innerText = "Le mot de passe doit faire 6 caractères minimum";
                errorMsg.classList.remove('hidden');
                return;
            }

            // Loading state
            submitBtn.disabled = true;
            btnText.innerText = 'Création du compte...';
            btnSpinner.classList.remove('hidden');

            try {
                // 1. Sign Up Auth
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password
                });

                if (error) throw error;
                if (!data.user) throw new Error("Erreur lors de la création de l'utilisateur");

                console.log("Signal Flow: Auth Sign Up success for", data.user.email);

                // 2. Verification of DB row (Created by Trigger)
                console.log("Signal Flow: Waiting for Trigger to create DB row...");
                
                // Petit délai pour laisser le temps au Trigger SQL de s'exécuter
                await new Promise(resolve => setTimeout(resolve, 1000));

                const { data: dbRow, error: dbError } = await supabase
                    .from('users')
                    .select('id_user')
                    .eq('id_auth_user', data.user.id)
                    .maybeSingle();

                if (dbError || !dbRow) {
                    console.warn("⚠️ Signal Flow: DB row not found yet. The onboarding will handle the creation if missing.");
                } else {
                    console.log("✅ Signal Flow: DB row verified (internal ID:", dbRow.id_user + ")");
                }

                // 3. Success logic
                state.user = data.user;
                state.currentView = 'onboarding';
                render();

            } catch (err) {
                console.error("Signal Flow: Sign Up error", err.message);
                errorMsg.innerText = err.message;
                errorMsg.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                btnText.innerText = 'Valider l\'inscription';
                btnSpinner.classList.add('hidden');
            }
        };
    }
}

// --- Initialization ---
async function init() {
    // Écouteur de changement d'état d'auth (Redirection automatique)
    supabase.auth.onAuthStateChange((event, session) => {
        console.log("🔔 [Signal Flow] Auth Event:", event);
        if (event === 'SIGNED_OUT' || !session) {
            state.user = null;
            state.currentView = 'auth';
            render();
        }
    });

    window.addEventListener('onboarding-finished', () => {
        state.currentView = 'dashboard';
        render();
    });

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            state.user = session.user;
            
            // On s'assure que l'utilisateur existe en base et on récupère ses données
            await onboarding.ensureUserExists();
            
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id_auth_user', session.user.id)
                .single();

            if (profile) {
                // Populate onboarding data with existing values to allow resuming
                onboarding.updateData({
                    firstName: profile.first_name || '',
                    lastName: profile.last_name || '',
                    linkedinUrl: profile.linkedin_link || '',
                    niche: profile.topic ? (typeof profile.topic === 'string' ? profile.topic.split(',').map(s => s.trim()) : profile.topic) : [],
                    tone: profile.tone ? profile.tone.split(',').map(s => s.trim()) : [],
                    goal: profile.goal ? profile.goal.split(',').map(s => s.trim()) : [],
                    rgpd: profile.rgpd_accepted || false
                });

                if (profile.onboarding_completed) {
                    state.currentView = 'dashboard';
                } else {
                    // Optionnel : on pourrait aussi essayer de deviner l'étape actuelle
                    state.currentView = 'onboarding';
                }
            } else {
                state.currentView = 'onboarding';
            }
        } else {
            state.currentView = 'auth';
        }
    } catch (e) {
        console.warn("Signal Flow Auth: Offline or unconfigured.", e);
        state.currentView = 'auth';
    }

    render();
}

window.addEventListener('DOMContentLoaded', init);
