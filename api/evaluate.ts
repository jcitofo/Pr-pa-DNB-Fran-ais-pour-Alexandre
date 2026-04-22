import type { VercelRequest, VercelResponse } from '@vercel/node';

const evaluationSchema = {
    type: "OBJECT",
    properties: {
        totalScore: { type: "NUMBER" },
        analysisScore: { type: "NUMBER" },
        rewritingScore: { type: "NUMBER" },
        dictationScore: { type: "NUMBER" },
        compositionScore: { type: "NUMBER" },
        overallFeedback: { type: "STRING" },
        corrections: {
            type: "OBJECT",
            properties: {
                analysis: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, userAnswer: { type: "STRING" }, correctAnswer: { type: "STRING" }, isCorrect: { type: "BOOLEAN" }, explanation: { type: "STRING" }, pointsEarned: { type: "NUMBER" } } } },
                rewriting: { type: "OBJECT", properties: { userAnswer: { type: "STRING" }, correctAnswer: { type: "STRING" }, feedback: { type: "STRING" }, pointsEarned: { type: "NUMBER" } } },
                dictation: { type: "OBJECT", properties: { userAnswer: { type: "STRING" }, feedback: { type: "STRING" }, pointsEarned: { type: "NUMBER" } } },
                composition: { type: "OBJECT", properties: { subjectChosen: { type: "STRING" }, userAnswer: { type: "STRING" }, feedback: { type: "STRING" }, pointsEarned: { type: "NUMBER" } } }
            }
        }
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { test, answers } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY non configurée' });

    try {
        const parts: any[] = [{
            text: `Tu es un correcteur officiel du DNB Français 2026.
            Tu évalues les COPIES MANUSCRITES d'Alexandre (fichiers JPEG ou PDF).
            TEXTE CORPUS: ${test.text}
            IMAGE ANALYSÉE: ${test.imageDescription}
            TEXTE DICTÉE: ${test.dictationText}
            Évalue sur 100 points : Analyse(40), Réécriture(10), Dictée(10), Rédaction(40).
            Réponds UNIQUEMENT en JSON selon le schéma.`
        }];

        const addFile = (file: any, label: string) => {
            if (!file) return;
            parts.push({ inline_data: { mime_type: file.mimeType, data: file.data.split(',')[1] } });
            parts.push({ text: `Ceci est la copie pour : ${label}` });
        };

        answers.analysisFiles?.forEach((f: any, i: number) => addFile(f, `Analyse page ${i + 1}`));
        if (answers.rewritingFile) addFile(answers.rewritingFile, "Réécriture");
        if (answers.dictationFile) addFile(answers.dictationFile, "Dictée");
        if (answers.compositionFile) addFile(answers.compositionFile, `Rédaction (${answers.compositionType})`);

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: evaluationSchema
                    }
                })
            }
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            return res.status(500).json({ error: `Gemini error ${geminiRes.status}: ${errText.slice(0, 300)}` });
        }

        const data = await geminiRes.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) return res.status(500).json({ error: 'Réponse vide' });

        return res.status(200).json(JSON.parse(rawText));
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Erreur interne' });
    }
}
