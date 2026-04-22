/**
 * Tests Unitaires pour la validation des URLs (Mock)
 */

const isValidSocialUrl = (url) => {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        const validHosts = ['linkedin.com', 'twitter.com', 'x.com', 'instagram.com', 'threads.net', 'substack.com', 'youtube.com'];
        return validHosts.some(host => parsed.hostname.includes(host));
    } catch (e) {
        return false;
    }
};

const runTests = () => {
    const cases = [
        { url: "https://www.linkedin.com/in/tibomoling/", expected: true, desc: "URL LinkedIn valide" },
        { url: "https://x.com/elonmusk", expected: true, desc: "URL X valide" },
        { url: "not-an-url", expected: false, desc: "Chaîne invalide" },
        { url: "https://malicious-site.com", expected: false, desc: "Domaine non autorisé" },
        { url: "ftp://linkedin.com", expected: false, desc: "Protocole invalide" },
        { url: "", expected: false, desc: "URL vide" }
    ];

    console.log("--- Début des tests unitaires (Validation URL) ---");
    let passed = 0;
    cases.forEach(c => {
        const result = isValidSocialUrl(c.url);
        const status = result === c.expected ? "✅ PASSED" : "❌ FAILED";
        console.log(`${status} | ${c.desc} : input="${c.url}"`);
        if (result === c.expected) passed++;
    });
    console.log(`--- Fin des tests : ${passed}/${cases.length} réussis ---`);
};

runTests();
