
export interface Question {
  question: string;
  type: 'QCM' | 'OPEN';
  options?: string[];
  correctAnswer: string;
  points: number;
}

export interface DNBTestContent {
  id: string;
  text: string;
  imageDescription: string;
  imageUrl?: string; // URL de l'image générée par l'IA
  analysisQuestions: Question[];
  rewritingTask: {
    sourceText: string;
    instruction: string;
    correctAnswer: string;
  };
  dictationText: string;
  compositionSubjects: {
    imagination: string;
    reflection: string;
  };
}

export interface FileData {
  data: string; // base64 string
  mimeType: string;
  name: string;
}

export interface Evaluation {
  totalScore: number;
  analysisScore: number;
  rewritingScore: number;
  dictationScore: number;
  compositionScore: number;
  overallFeedback: string;
  corrections: {
    analysis: { question: string; userAnswer: string; correctAnswer: string; isCorrect: boolean; explanation: string; pointsEarned: number }[];
    rewriting: { userAnswer: string; correctAnswer: string; feedback: string; pointsEarned: number };
    dictation: { userAnswer: string; feedback: string; pointsEarned: number };
    composition: { subjectChosen: 'imagination' | 'reflection'; userAnswer: string; feedback: string; pointsEarned: number };
  };
}

export interface TestResult {
  date: string;
  content: DNBTestContent;
  evaluation: Evaluation;
  userAnswers: {
    analysisFiles: FileData[];
    rewritingFile: FileData | null;
    dictationFile: FileData | null;
    compositionFile: FileData | null;
    compositionType: 'imagination' | 'reflection';
  };
}

export type AppState = 'DASHBOARD' | 'IN_TEST' | 'VIEWING_RESULTS';

export type TextType = 
  | 'SURPRISE' 
  | 'CLASSIC' 
  | 'MODERN' 
  | 'THEATER' 
  | 'POETRY' 
  | 'ARGUMENTATIVE'
  | 'ANTIGONE'
  | 'ANIMAL_FARM'
  | 'REUNION';

export const textTypeOptions: Record<TextType, string> = {
  SURPRISE: "Aléatoire (Mixte)",
  CLASSIC: "Littérature Classique (XIXe/XXe)",
  MODERN: "Littérature Contemporaine",
  THEATER: "Théâtre (Anouilh, Molière...)",
  POETRY: "Poésie et Engagement",
  ARGUMENTATIVE: "Presse et Société",
  ANTIGONE: "Antigone (J. Anouilh)",
  ANIMAL_FARM: "La Ferme des Animaux (G. Orwell)",
  REUNION: "Un Ami Retrouvé (F. Uhlman)",
};
