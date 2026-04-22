
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { DNBTestContent, TestResult, Evaluation, TextType, FileData } from '../types';

const API_KEY = process.env.API_KEY;
console.log("[geminiService] API_KEY présente:", API_KEY ? `oui (${API_KEY.slice(0,8)}...)` : "NON — UNDEFINED");
const ai = new GoogleGenAI({ apiKey: API_KEY });

const testContentSchema = {
    type: Type.OBJECT,
    properties: {
        text: { type: Type.STRING, description: "Un texte littéraire de 30-40 lignes adapté au niveau 3ème." },
        imageDescription: { type: Type.STRING, description: "Description d'une image (tableau, photo, affiche) liée au thème du texte pour l'analyse iconographique." },
        analysisQuestions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['QCM', 'OPEN'] },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    points: { type: Type.NUMBER }
                },
                required: ["question", "type", "correctAnswer", "points"]
            }
        },
        rewritingTask: {
            type: Type.OBJECT,
            properties: {
                sourceText: { type: Type.STRING },
                instruction: { type: Type.STRING },
                correctAnswer: { type: Type.STRING }
            },
            required: ["sourceText", "instruction", "correctAnswer"]
        },
        dictationText: { type: Type.STRING },
        compositionSubjects: {
            type: Type.OBJECT,
            properties: {
                imagination: { type: Type.STRING },
                reflection: { type: Type.STRING }
            },
            required: ["imagination", "reflection"]
        }
    },
    required: ["text", "imageDescription", "analysisQuestions", "rewritingTask", "dictationText", "compositionSubjects"]
};

export const generateDNBTest = async (history: TestResult[], textType: TextType): Promise<DNBTestContent> => {
    let specificContext = "";
    if (textType === 'ANTIGONE') specificContext = "L'extrait DOIT impérativement provenir de la pièce 'Antigone' de Jean Anouilh.";
    if (textType === 'ANIMAL_FARM') specificContext = "L'extrait DOIT impérativement provenir du roman 'La ferme des animaux' de George Orwell.";
    if (textType === 'REUNION') specificContext = "L'extrait DOIT impérativement provenir du livre 'Un ami retrouvé' de Fred Uhlman.";

    const prompt = `Génère une épreuve complète de Français pour le DNB 2026 pour un élève nommé Alexandre.
    Catégorie demandée : ${textType}. ${specificContext}
    La partie image doit être une description précise pour un illustrateur.`;

    // 1. Génération du contenu textuel - Using gemini-2.5-flash for high-quality exam generation
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: testContentSchema
        }
    });

    const testContent = JSON.parse(response.text) as DNBTestContent;

    // 2. Document iconographique — Metropolitan Museum of Art (gratuit, sans clé, domaine public)
    // Extraction de mots-clés depuis la description pour trouver une œuvre pertinente
    try {
        const keywords = (testContent.imageDescription || 'painting france literature')
            .replace(/[^a-zA-ZÀ-ÿ\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 4)
            .slice(0, 4)
            .join(' ');

        const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(keywords)}&hasImages=true&medium=Paintings`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();

        if (searchData.objectIDs && searchData.objectIDs.length > 0) {
            // Prendre un ID aléatoire parmi les 30 premiers résultats
            const pool = searchData.objectIDs.slice(0, 30);
            const randomId = pool[Math.floor(Math.random() * pool.length)];
            const objRes = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${randomId}`);
            const objData = await objRes.json();
            if (objData.primaryImage) {
                testContent.imageUrl = objData.primaryImage;
            }
        }
    } catch (_) {
        // Rien — l'image reste undefined, le fallback UI s'affiche
    }

    return testContent;
};

export type DictationMode = 'NORMAL' | 'SLOW';

const preprocessForSlowReading = (text: string): string => {
    return text
        .replace(/\./g, " point. ")
        .replace(/,/g, " virgule, ")
        .replace(/;/g, " point-virgule, ")
        .replace(/:/g, " deux-points, ")
        .replace(/\?/g, " point d'interrogation? ")
        .replace(/!/g, " point d'exclamation! ")
        .replace(/\(/g, " ouvrez la parenthèse, ")
        .replace(/\)/g, " fermez la parenthèse, ")
        .replace(/«/g, " ouvrez les guillemets, ")
        .replace(/»/g, " fermez les guillemets, ")
        .replace(/-/g, " tiret, ")
        .replace(/\n/g, " à la ligne. ");
};

export const generateDictationAudio = async (text: string, mode: DictationMode): Promise<string> => {
    let finalContent = mode === 'SLOW' ? preprocessForSlowReading(text) : text;
    let instruction = mode === 'SLOW' 
        ? "Tu es un professeur. Lis TRÈS LENTEMENT ce texte de dictée avec la ponctuation : " 
        : "Lis ce texte de dictée d'une traite : ";

    // Using gemini-2.5-flash-preview-tts for audio generation
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `${instruction} ${finalContent}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
        },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const evaluateDNBAnswers = async (test: DNBTestContent, answers: any): Promise<Evaluation> => {
    const parts: any[] = [
        { text: `Tu es un correcteur officiel du DNB Français 2026. 
        Tu évalues les COPIES MANUSCRITES d'Alexandre (fichiers JPEG ou PDF).
        Effectue une analyse OCR du contenu manuscrit.
        
        TEXTE CORPUS: ${test.text}
        IMAGE ANALYSÉE: ${test.imageDescription}
        TEXTE DICTÉE: ${test.dictationText}
        
        Évalue sur 100 points : Analyse(40), Réécriture(10), Dictée(10), Rédaction(40).
        Sois exigeant sur l'orthographe manuscrite.
        Réponds UNIQUEMENT en JSON selon le schéma.` }
    ];

    const addFilePart = (file: FileData, label: string) => {
        if (!file) return;
        parts.push({ 
            inlineData: { 
                data: file.data.split(',')[1], 
                mimeType: file.mimeType 
            } 
        });
        parts.push({ text: `Ceci est la copie pour : ${label}` });
    };

    answers.analysisFiles.forEach((file: FileData, i: number) => addFilePart(file, `Analyse page ${i+1}`));
    if (answers.rewritingFile) addFilePart(answers.rewritingFile, "Réécriture");
    if (answers.dictationFile) addFilePart(answers.dictationFile, "Dictée");
    if (answers.compositionFile) addFilePart(answers.compositionFile, `Rédaction (${answers.compositionType})`);

    // Using gemini-2.5-flash for grading and OCR reasoning
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ parts }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    totalScore: { type: Type.NUMBER },
                    analysisScore: { type: Type.NUMBER },
                    rewritingScore: { type: Type.NUMBER },
                    dictationScore: { type: Type.NUMBER },
                    compositionScore: { type: Type.NUMBER },
                    overallFeedback: { type: Type.STRING },
                    corrections: {
                        type: Type.OBJECT,
                        properties: {
                            analysis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, userAnswer: { type: Type.STRING }, correctAnswer: { type: Type.STRING }, isCorrect: { type: Type.BOOLEAN }, explanation: { type: Type.STRING }, pointsEarned: { type: Type.NUMBER } } } },
                            rewriting: { type: Type.OBJECT, properties: { userAnswer: { type: Type.STRING }, correctAnswer: { type: Type.STRING }, feedback: { type: Type.STRING }, pointsEarned: { type: Type.NUMBER } } },
                            dictation: { type: Type.OBJECT, properties: { userAnswer: { type: Type.STRING }, feedback: { type: Type.STRING }, pointsEarned: { type: Type.NUMBER } } },
                            composition: { type: Type.OBJECT, properties: { subjectChosen: { type: Type.STRING }, userAnswer: { type: Type.STRING }, feedback: { type: Type.STRING }, pointsEarned: { type: Type.NUMBER } } }
                        }
                    }
                }
            }
        }
    });

    return JSON.parse(response.text) as Evaluation;
};
