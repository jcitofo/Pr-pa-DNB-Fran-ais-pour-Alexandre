
import type { DNBTestContent, TestResult, Evaluation, TextType } from '../types';

// Toutes les appels Gemini passent par les routes serverless /api/*
// La clé GEMINI_API_KEY est lue côté serveur à l'exécution — jamais exposée dans le bundle client

export const generateDNBTest = async (_history: TestResult[], textType: TextType): Promise<DNBTestContent> => {
    const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textType })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Erreur serveur ${res.status}`);
    }
    return res.json();
};

export type DictationMode = 'NORMAL' | 'SLOW';

export const generateDictationAudio = async (text: string, mode: DictationMode): Promise<string> => {
    const res = await fetch('/api/dictation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Erreur TTS ${res.status}`);
    }
    const data = await res.json();
    return data.audioData || "";
};

export const evaluateDNBAnswers = async (test: DNBTestContent, answers: any): Promise<Evaluation> => {
    const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test, answers })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Erreur correction ${res.status}`);
    }
    return res.json();
};
