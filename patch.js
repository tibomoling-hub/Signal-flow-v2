const fs = require('fs');

const filePath = '/Users/tibomoling/Documents/TIBO/SIGNALFLOW-antigravity/js/modules/creation.js';
let content = fs.readFileSync(filePath, 'utf-8');

const regex = /async handleRegenerate\(\) \{[\s\S]*?this\.showToast\("Erreur lors de la r\u00e9g\u00e9n\u00e9ration", "error"\);\s*\}/;

const newCode = `async handleRegenerate() {
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
            } catch(e) {}

            if (newContent && newContent.trim().length > 0) {
                this.content.post.body = newContent;
                this.initialTone = this.tone; // Reset
                this.initialGoal = this.goal;
                this.showToast("Le contenu a bien été régénéré", 'success');
            } else {
                throw new Error("Réponse vide de Make");
            }
        } catch (error) {
            console.error(">>> Erreur lors de la régénération:", error);
            this.showToast("Erreur lors de la régénération, veuillez réessayer", "error");
        }`;

content = content.replace(regex, newCode);
fs.writeFileSync(filePath, content, 'utf-8');
console.log('Done');
