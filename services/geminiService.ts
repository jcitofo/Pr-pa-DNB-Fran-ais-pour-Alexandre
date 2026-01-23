
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { DNBTestContent, TestResult, Evaluation, TextType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const testContentSchema = {
    type: Type.OBJECT,
    properties: {
        text: { type: Type.STRING, description: "Un texte littéraire de 30-40 lignes adapté au niveau 3ème." },
        imageDescription: { type: Type.STRING, description: "Description d'une image (tableau, photo) liée au texte pour analyse." },
        analysisQuestions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['QCM', 'OPEN'] },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    points: { type: Type.NUMBER, description: "Points attribués (total de la section = 40)" }
                },
                required: ["question", "type", "correctAnswer", "points"]
            }
        },
        rewritingTask: {
            type: Type.OBJECT,
            properties: {
                sourceText: { type: Type.STRING },
                instruction: { type: Type.STRING, description: "Ex: Réécrivez au passé simple en remplaçant 'je' par 'nous'." },
                correctAnswer: { type: Type.STRING }
            },
            required: ["sourceText", "instruction", "correctAnswer"]
        },
        dictationText: { type: Type.STRING, description: "Texte de dictée de 600 signes environ." },
        compositionSubjects: {
            type: Type.OBJECT,
            properties: {
                imagination: { type: Type.STRING, description: "Sujet narratif lié au corpus." },
                reflection: { type: Type.STRING, description: "Sujet argumentatif lié au thème du texte." }
            },
            required: ["imagination", "reflection"]
        }
    },
    required: ["text", "imageDescription", "analysisQuestions", "rewritingTask", "dictationText", "compositionSubjects"]
};

export const generateDNBTest = async (history: TestResult[], textType: TextType): Promise<DNBTestContent> => {
    let specificContext = "";
    if (textType === 'ANTIGONE') specificContext = "L'extrait DOIT impérativement provenir de la pièce 'Antigone' de Jean Anouilh. Les questions doivent porter sur le tragique, la révolte et le conflit de devoirs.";
    if (textType === 'ANIMAL_FARM') specificContext = "L'extrait DOIT impérativement provenir du roman 'La ferme des animaux' de George Orwell. Les questions doivent porter sur l'allégorie, la propagande et la dérive totalitaire.";
    if (textType === 'REUNION') specificContext = "L'extrait DOIT impérativement provenir du livre 'Un ami retrouvé' de Fred Uhlman. Les questions doivent porter sur l'amitié, le contexte historique du nazisme et le récit autobiographique.";

    const prompt = `Génère une épreuve complète de Français pour le DNB 2026.
    Catégorie demandée : ${textType}.
    ${specificContext}
    
    Respecte scrupuleusement la structure officielle :
    1. Analyse (40 pts) : 6-8 questions variées sur le texte et l'image (liée au thème).
    2. Réécriture (10 pts) : Un passage du texte à transformer (grammaire/conjugaison).
    3. Dictée (10 pts) : Un texte de 600 signes lié au thème traité.
    4. Rédaction (40 pts) : Deux sujets (Imagination et Réflexion) cohérents avec l'œuvre ou le thème.
    
    Niveau : 3ème secondaire France. Alexandre doit progresser.
    Historique des derniers scores : ${JSON.stringify(history.slice(-3).map(h => h.evaluation.totalScore))}`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: testContentSchema
        }
    });

    return JSON.parse(response.text) as DNBTestContent;
};

export type DictationMode = 'NORMAL' | 'SLOW';

/**
 * Prétraite le texte pour la dictée lente en injectant les mots de ponctuation
 */
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
    let finalContent = text;
    let instruction = "";

    if (mode === 'NORMAL') {
        instruction = "Lis ce texte de dictée d'une traite, à vitesse normale et posée, comme une lecture de découverte : ";
        finalContent = text;
    } else {
        instruction = "Tu es un professeur de français. Lis ce texte TRÈS LENTEMENT, mot après mot, en faisant des pauses de 2 secondes entre chaque groupe de mots. Prononce bien chaque mot de ponctuation qui est écrit : ";
        finalContent = preprocessForSlowReading(text);
    }

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `${instruction} ${finalContent}` }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio non généré");
    return base64Audio;
};

export const evaluateDNBAnswers = async (test: DNBTestContent, answers: any): Promise<Evaluation> => {
    const prompt = `Évalue cette copie de DNB Français sur 100 points.
    Corpus: ${test.text}
    Réponses Alexandre: ${JSON.stringify(answers)}
    
    Barème strict:
    - Analyse: 40 pts
    - Réécriture: 10 pts
    - Dictée: 10 pts (Pénalité: -0.5 par faute d'usage, -1 par faute de grammaire/accord)
    - Rédaction: 40 pts (Qualité de la langue, structure, respect du sujet, richesse du vocabulaire)
    
    Sois encourageant mais précis. Identifie les lacunes spécifiques d'Alexandre.`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
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
