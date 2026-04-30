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

        // -----------------------------------------------------------------------
        // Images curatorées — scènes de production ou stills de film
        // Sélection aléatoire dans un pool pour chaque œuvre.
        // Ces images sont des SCÈNES riches à décrire (personnages, décors,
        // atmosphère), jamais des affiches ou couvertures de livre.
        // -----------------------------------------------------------------------

        // Pool d'images curatorées par type de texte
        // ANTIGONE : photos de la création 1944 (Barsacq) — scènes de groupe,
        //   face-à-face, arrestation — richesse descriptive maximale
        // ANIMAL_FARM : photos de la production théâtrale Compagnie Spectabilis
        //   2024 (marionnettes, théâtre d'objets, vidéo mapping)
        // REUNION : stills du film Jerry Schatzberg 1989 (Cannes) — personnages
        //   en situation, décors Stuttgart années 30
        const curatedImages: Record<string, string[]> = {
            ANTIGONE: [
                // Distribution complète sur scène — ouverture, Le Prologue
                'https://maremurex.net/antigone2.JPG',
                // Face-à-face Antigone / Créon — scène centrale
                'https://maremurex.net/antigone4.JPG',
                // Antigone arrêtée par les gardes — Barsacq 1944
                'https://static.wixstatic.com/media/3b25df_536cbf9ce056407bbbfe18d1ccbd9023~mv2.jpg',
                // Antigone dicte sa lettre au Garde — avant l'exécution
                'https://static.wixstatic.com/media/3b25df_fd9045e006e341b89d405c8d07810b35~mv2.jpg',
                // Face-à-face HD Barsacq 1944
                'https://static.wixstatic.com/media/3b25df_0002b979e57446baa7f689a380d15c6b~mv2.jpg',
            ],
            ANIMAL_FARM: [
                // Vue scénique principale — marionnettes, objets, décors (1070×857)
                'https://image.jimcdn.com/app/cms/image/transf/dimension=1920x10000:format=jpg/path/s21d4a8186066356f/image/ieef83710c2cc4428/version/1681376157/image.jpg',
                // Scènes carrousel de la production Spectabilis 2024
                'https://image.jimcdn.com/app/cms/image/transf/dimension=1920x10000:format=jpg/path/s21d4a8186066356f/image/i19bb459e59e22acf/version/1705583645/image.jpg',
                'https://image.jimcdn.com/app/cms/image/transf/dimension=1920x10000:format=jpg/path/s21d4a8186066356f/image/icd8205909ec263b9/version/1705583656/image.jpg',
                'https://image.jimcdn.com/app/cms/image/transf/dimension=1920x10000:format=jpg/path/s21d4a8186066356f/image/i8e203e0f37b5ccc9/version/1705583656/image.jpg',
                'https://image.jimcdn.com/app/cms/image/transf/dimension=1920x10000:format=jpg/path/s21d4a8186066356f/image/i5246c4e8ae69b4ca/version/1705583656/image.jpg',
                'https://image.jimcdn.com/app/cms/image/transf/dimension=1920x10000:format=jpg/path/s21d4a8186066356f/image/i5fff802325b6f1b4/version/1705583642/image.jpg',
            ],
            REUNION: [
                // Hans, Lise et Konradin — scène à trois, richesse descriptive max (1511×1117)
                'https://m.media-amazon.com/images/M/MV5BNTg3ZTUzNzEtMGQ1Zi00NzkzLTk0YzYtYjk3NzRkMWU0NjIxXkEyXkFqcGc@._V1_.jpg',
                // Variante scène à trois — décors Stuttgart 1932
                'https://m.media-amazon.com/images/M/MV5BNzMzNDVkNDYtMTY5NC00MjhmLWIwZWEtYjQ1YWZlYTBlYTY0XkEyXkFqcGc@._V1_.jpg',
                // Hans et Konradin — confrontation / échange (1511×1177)
                'https://m.media-amazon.com/images/M/MV5BNDBkN2JiNjQtYTYzNi00NDRiLTkzZjItYjFhNDE0YTc2MGU4XkEyXkFqcGc@._V1_.jpg',
                // Hans et Konradin — intimité / conversation (1512×1168)
                'https://m.media-amazon.com/images/M/MV5BNTUxZDE5ZTMtOTRhMi00YmMzLWFlM2ItZjYxOTNhYjE4MDFlXkEyXkFqcGc@._V1_.jpg',
                // Hans et Konradin — tension / distance, montée du nazisme (1512×1174)
                'https://m.media-amazon.com/images/M/MV5BMmJkYjE0ZDgtMGVlZS00OTdjLTg4NmItZmVhYjFlNWJmM2FiXkEyXkFqcGc@._V1_.jpg',
            ],
        };

        // Fallbacks SVG locaux (hébergés sur Vercel) — jamais de page blanche
        const localFallbacks: Record<string, string> = {
            ANTIGONE:      '/fallback/antigone.svg',
            ANIMAL_FARM:   '/fallback/animal-farm.svg',
            REUNION:       '/fallback/reunion.svg',
            CLASSIC:       '/fallback/classic.svg',
            MODERN:        '/fallback/modern.svg',
            THEATER:       '/fallback/theater.svg',
            POETRY:        '/fallback/poetry.svg',
            ARGUMENTATIVE: '/fallback/argumentative.svg',
            SURPRISE:      '/fallback/classic.svg'
        };

        try {
            const pool = curatedImages[textType as string];

            if (pool && pool.length > 0) {
                // Œuvre avec pool curatoriée : sélection aléatoire dans le pool
                // → variété entre les exercices, toujours une scène à décrire
                const randomIndex = Math.floor(Math.random() * pool.length);
                testContent.imageUrl = pool[randomIndex];
            } else {
                // Autres catégories (CLASSIC, MODERN, THEATER, POETRY…) : Wikipedia
                const wikiArticles: Record<string, string[]> = {
                    CLASSIC:       ['Romanticism', 'Realism_(art)', 'French_literature'],
                    MODERN:        ['Absurdism', 'Existentialism', 'French_literature'],
                    THEATER:       ['Commedia_dell%27arte', 'French_theatre', 'Comedy'],
                    POETRY:        ['French_Resistance', 'Surrealism', 'Dadaism'],
                    ARGUMENTATIVE: ['Freedom_of_the_press', 'Political_cartoon', 'Journalism'],
                    SURPRISE:      ['French_literature', 'Romanticism', 'Absurdism', 'Greek_tragedy']
                };

                const articles = wikiArticles[textType as string] || wikiArticles['SURPRISE'];
                let foundImage = false;

                for (const article of articles) {
                    try {
                        const wikiRes = await fetch(
                            `https://en.wikipedia.org/api/rest_v1/page/summary/${article}`,
                            { headers: { 'User-Agent': 'DNB-Francais-App/1.0 (alexandre@dnb2026.fr)' } }
                        );
                        if (!wikiRes.ok) continue;
                        const wikiData = await wikiRes.json();
                        const imageUrl = wikiData?.originalimage?.source || wikiData?.thumbnail?.source;
                        if (imageUrl && imageUrl.match(/\.(jpg|jpeg|png|webp)/i)) {
                            testContent.imageUrl = imageUrl;
                            foundImage = true;
                            break;
                        }
                    } catch (_) { /* essayer le suivant */ }
                }

                if (!foundImage) {
                    testContent.imageUrl = localFallbacks[textType as string] || '/fallback/classic.svg';
                }
            }
        } catch (_) {
            // Erreur globale — fallback local
            testContent.imageUrl = localFallbacks[textType as string] || '/fallback/classic.svg';
        }

        return res.status(200).json(testContent);

    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Erreur interne' });
    }
}
