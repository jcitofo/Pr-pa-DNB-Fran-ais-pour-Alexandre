
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { DNBTestContent, TestResult, Evaluation, TextType, FileData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

    // 2. Génération du document iconographique via gemini-2.0-flash-exp-image-generation
    try {
        const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp-image-generation',
            contents: `Document iconographique pour un examen de français DNB niveau 3ème. ${testContent.imageDescription}. Style : peinture réaliste, photographie d'époque ou gravure selon le contexte. Qualité élevée, format éducatif.`,
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
            }
        });

        const parts = imageResponse.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
            if (part.inlineData?.data) {
                testContent.imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                break;
            }
        }
    } catch (error) {
        console.error("Erreur génération image:", error);
        // L'image est optionnelle — l'examen continue sans elle
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
