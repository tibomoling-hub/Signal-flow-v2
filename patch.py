import re

with open('/Users/tibomoling/Documents/TIBO/SIGNALFLOW-antigravity/js/modules/creation.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add regenOverlay in render()
overlay_html = """        ` : '';

        const regenOverlay = this.isRegenerating ? `
            <div class="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-anthracite-950/40 backdrop-blur-[4px] animate-in fade-in duration-300">
                <div class="glass-panel p-10 border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300 text-center">
                    <div class="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                        <i data-lucide="loader-2" class="w-8 h-8 text-blue-500 animate-spin"></i>
                    </div>
                    <div class="space-y-2">
                        <h3 class="text-2xl font-black text-white tracking-tighter">Génération en cours</h3>
                        <p class="text-zinc-400 text-sm">Le système est en train de régénérer votre contenu...</p>
                    </div>
                </div>
            </div>
        ` : '';"""

content = content.replace("        ` : '';\n\n        const hasChanged = this.tone !== this.initialTone || this.goal !== this.initialGoal;", overlay_html + "\n\n        const hasChanged = this.tone !== this.initialTone || this.goal !== this.initialGoal;")

content = content.replace("${modalHtml}", "${modalHtml}\n            ${regenOverlay}")

# Replace handleRegenerate
old_func_start = "    async handleRegenerate() {"
old_func_end = "        }\n    },"

new_func = """    async handleRegenerate() {
        if (this.isRegenerating) return;

        const REGENERATE_WEBHOOK_URL = 'https://hook.eu1.make.com/njj9og03bvurjkv268yt9wjld0q2vs7m';
        
        this.isRegenerating = true;
        this.render();

        try {
            const payload = {
                content_body: this.content.post.body,
                tone: this.tone,
                objective: this.goal
            };

            console.log(">>> Appel Webhook Make Régénération:", payload);

            const response = await fetch(REGENERATE_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Erreur HTTP: " + response.status);

            const textResponse = await response.text();
            let newContent = textResponse;
            try {
                const json = JSON.parse(textResponse);
                if (json.content_body) newContent = json.content_body;
                else if (json.new_content) newContent = json.new_content;
                else if (json.text) newContent = json.text;
            } catch(e) {
                // Not JSON
            }

            if (newContent && newContent.trim().length > 0) {
                this.content.post.body = newContent;
                this.initialTone = this.tone;
                this.initialGoal = this.goal;
            } else {
                throw new Error("Réponse vide de Make");
            }
        } catch (error) {
            console.error(">>> Erreur lors de la régénération:", error);
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
    },"""

import re
content = re.sub(r'    async handleRegenerate\(\) \{.*?(?=\n    \},|\n    [A-Za-z]+)', new_func, content, flags=re.DOTALL)

with open('/Users/tibomoling/Documents/TIBO/SIGNALFLOW-antigravity/js/modules/creation.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched successfully")
