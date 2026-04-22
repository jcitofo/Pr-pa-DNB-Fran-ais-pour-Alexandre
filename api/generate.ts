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

        // Image via Wikimedia Commons — mots-clés ciblés par type d'œuvre
        try {
            // Mots-clés précis par textType pour un document iconographique pertinent
            const wikimediaKeywords: Record<string, string[]> = {
                ANTIGONE:       ['Antigone Anouilh théâtre', 'Antigone tragédie grecque', 'masque théâtre grec antique', 'Sophocle Antigone'],
                ANIMAL_FARM:    ['ferme animaux Orwell', 'soviet propaganda poster animals', 'George Orwell Animal Farm', 'affiche propagande soviétique'],
                REUNION:        ['Fred Uhlman ami retrouvé', 'amitié Allemagne 1930', 'Stuttgart école lycée 1933', 'Allemagne nazie jeunesse portrait'],
                CLASSIC:        ['peinture romantique française littérature', 'Delacroix romantisme', 'Victor Hugo illustration romantique'],
                MODERN:         ['littérature contemporaine française', 'roman moderne portrait', 'illustration livre contemporain'],
                THEATER:        ['théâtre français scène', 'Molière comédie classique', 'affiche théâtre français'],
                POETRY:         ['poésie engagée résistance', 'Aragon Éluard résistance', 'affiche poème guerre'],
                ARGUMENTATIVE:  ['presse française illustration', 'caricature journal satirique', 'liberté presse opinion'],
                SURPRISE:       ['peinture française littérature', 'illustration romantique classique']
            };

            const queries = wikimediaKeywords[textType as string] || wikimediaKeywords['SURPRISE'];
            const query = queries[Math.floor(Math.random() * queries.length)];

            const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&gsrlimit=20`;
            const wikiRes = await fetch(wikiUrl);
            const wikiData = await wikiRes.json();

            const pages = wikiData?.query?.pages;
            if (pages) {
                const items = Object.values(pages) as any[];
                // Filtrer les images valides (JPG/PNG, pas SVG/PDF)
                const valid = items.filter(p => {
                    const url = p?.imageinfo?.[0]?.url || '';
                    return url.match(/\.(jpg|jpeg|png)$/i);
                });
                if (valid.length > 0) {
                    const picked = valid[Math.floor(Math.random() * valid.length)];
                    testContent.imageUrl = picked.imageinfo[0].url;
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
