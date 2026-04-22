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

        // Image via Met Museum (serverless — pas de CORS)
        try {
            const keywords = (testContent.imageDescription || 'painting france literature')
                .replace(/[^a-zA-ZÀ-ÿ\s]/g, ' ')
                .split(/\s+/)
                .filter((w: string) => w.length > 4)
                .slice(0, 4)
                .join(' ');

            const searchRes = await fetch(
                `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(keywords)}&hasImages=true&medium=Paintings`
            );
            const searchData = await searchRes.json();

            if (searchData.objectIDs?.length > 0) {
                const pool = searchData.objectIDs.slice(0, 30);
                const randomId = pool[Math.floor(Math.random() * pool.length)];
                const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${randomId}`);
                const objData = await objRes.json();
                if (objData.primaryImage) {
                    testContent.imageUrl = objData.primaryImage;
                }
            }
        } catch (_) {
            // Image non disponible — le fallback UI s'affiche
        }

        return res.status(200).json(testContent);

    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Erreur interne' });
    }
}
