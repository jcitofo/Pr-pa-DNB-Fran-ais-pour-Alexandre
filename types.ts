
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

export interface SectionCorrection {
  score: number;
  maxScore: number;
  feedback: string;
  details?: any;
}

export interface Evaluation {
  totalScore: number; // sur 100
  analysisScore: number; // sur 40
  rewritingScore: number; // sur 10
  dictationScore: number; // sur 10
  compositionScore: number; // sur 40
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
    analysis: string[];
    rewriting: string;
    dictation: string;
    composition: {
      type: 'imagination' | 'reflection';
      text: string;
    };
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
