import type { VercelRequest, VercelResponse } from '@vercel/node';

const preprocessForSlowReading = (text: string): string => {
    return text
        .replace(/\./g, " point. ")
        .replace(/,/g, " virgule, ")
        .replace(/;/g, " point-virgule, ")
        .replace(/:/g, " deux-points, ")
        .replace(/\?/g, " point d'interrogation? ")
        .replace(/!/g, " point d'exclamation! ")
        .replace(/\n/g, " à la ligne. ");
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { text, mode } = req.body;
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY non configurée' });

    try {
        const finalContent = mode === 'SLOW' ? preprocessForSlowReading(text) : text;
        const instruction = mode === 'SLOW'
            ? "Tu es un professeur. Lis TRÈS LENTEMENT ce texte de dictée avec la ponctuation : "
            : "Lis ce texte de dictée d'une traite : ";

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${instruction} ${finalContent}` }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                        }
                    }
                })
            }
        );

        if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            return res.status(500).json({ error: `TTS error ${geminiRes.status}: ${errText.slice(0, 200)}` });
        }

        const data = await geminiRes.json();
        const audioData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
        return res.status(200).json({ audioData });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Erreur TTS' });
    }
}
