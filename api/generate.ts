import type { VercelRequest, VercelResponse } from '@vercel/node';

// Schéma pour la génération du contenu de l'épreuve
const testContentSchema = {
    type: "OBJECT",
    properties: {
        text: { type: "STRING" },
        imageDescription: { type: "STRING" },
        analysisQuestions: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    question: { type: "STRING" },
                    type: { type: "STRING" },
                    options: { type: "ARRAY", items: { type: "STRING" } },
                    correctAnswer: { type: "STRING" },
                    points: { type: "NUMBER" }
                },
                required: ["question", "type", "correctAnswer", "points"]
            }
        },
        rewritingTask: {
            type: "OBJECT",
            properties: {
                sourceText: { type: "STRING" },
                instruction: { type: "STRING" },
                correctAnswer: { type: "STRING" }
            },
            required: ["sourceText", "instruction", "correctAnswer"]
        },
        dictationText: { type: "STRING" },
        compositionSubjects: {
            type: "OBJECT",
            properties: {
                imagination: { type: "STRING" },
                reflection: { type: "STRING" }
            },
            required: ["imagination", "reflection"]
        }
    },
    required: ["text", "imageDescription", "analysisQuestions", "rewritingTask", "dictationText", "compositionSubjects"]
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { textType } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY non configurée côté serveur' });
    }

    try {
        let specificContext = "";
        if (textType === 'ANTIGONE') specificContext = "L'extrait DOIT impérativement provenir de la pièce 'Antigone' de Jean Anouilh.";
        if (textType === 'ANIMAL_FARM') specificContext = "L'extrait DOIT impérativement provenir du roman 'La ferme des animaux' de George Orwell.";
        if (textType === 'REUNION') specificContext = "L'extrait DOIT impérativement provenir du livre 'Un ami retrouvé' de Fred Uhlman.";

        const prompt = `Génère une épreuve complète de Français pour le DNB 2026 pour un élève nommé Alexandre.
        Catégorie demandée : ${textType}. ${specificContext}
        La partie image doit être une description précise pour un illustrateur.`;

        // Appel Gemini via REST API
        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: testContentSchema
                    }
                })
            }
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            return res.status(500).json({ error: `Gemini error ${geminiRes.status}: ${errText.slice(0, 300)}` });
        }

        const geminiData = await geminiRes.json();
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) return res.status(500).json({ error: 'Réponse Gemini vide' });

        const testContent = JSON.parse(rawText);

        // Image via Wikipedia REST API — article de l'œuvre exacte, image principale garantie
        try {
            // Articles Wikipedia ciblés par textType — retournent toujours l'image principale de l'article
            const wikiArticles: Record<string, string[]> = {
                ANTIGONE:      ['Antigone_(Anouilh_play)', 'Antigone', 'Greek_tragedy'],
                ANIMAL_FARM:   ['Animal_Farm', 'George_Orwell', 'Soviet_propaganda'],
                REUNION:       ['Reunion_(novel)', 'Fred_Uhlman', 'Nazi_Germany'],
                CLASSIC:       ['Romanticism', 'Victor_Hugo', 'Gustave_Flaubert'],
                MODERN:        ['Albert_Camus', 'Simone_de_Beauvoir', 'French_literature'],
                THEATER:       ['Molière', 'French_theatre', 'Commedia_dell%27arte'],
                POETRY:        ['French_Resistance', 'Paul_Éluard', 'Louis_Aragon'],
                ARGUMENTATIVE: ['Freedom_of_the_press', 'Charlie_Hebdo', 'Political_cartoon'],
                SURPRISE:      ['French_literature', 'Romanticism', 'Victor_Hugo', 'Molière']
            };

            const articles = wikiArticles[textType as string] || wikiArticles['SURPRISE'];
            const article = articles[Math.floor(Math.random() * articles.length)];

            const wikiRes = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${article}`,
                { headers: { 'User-Agent': 'DNB-Francais-App/1.0' } }
            );
            const wikiData = await wikiRes.json();

            // Utiliser l'image originale ou le thumbnail si disponible
            const imageUrl = wikiData?.originalimage?.source || wikiData?.thumbnail?.source;
            if (imageUrl && imageUrl.match(/\.(jpg|jpeg|png|webp)/i)) {
                testContent.imageUrl = imageUrl;
            }
        } catch (_) {
            // Image non disponible — le fallback UI s'affiche
        }

        return res.status(200).json(testContent);

    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Erreur interne' });
    }
}
