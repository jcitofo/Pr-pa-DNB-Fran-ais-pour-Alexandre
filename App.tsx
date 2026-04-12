
import React, { useState, useEffect, useCallback } from 'react';
import type { TestResult, AppState, DNBTestContent, Evaluation, TextType } from './types';
import Dashboard from './components/Dashboard';
import TestSession from './components/TestSession';
import ResultsView from './components/ResultsView';

// ─────────────────────────────────────────────
// PAYWALL CONFIG
// ─────────────────────────────────────────────
const FREE_EXAM_LIMIT = 2; // examens gratuits par semaine
const PAYWALL_KEY = 'dnb_francais_paywall';

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function loadExamPaywall(): { examCount: number; weekStart: string } {
  try {
    const stored = localStorage.getItem(PAYWALL_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const currentWeek = getMonday(new Date());
      if (data.weekStart === currentWeek) return { examCount: data.examCount, weekStart: currentWeek };
    }
  } catch {}
  return { examCount: 0, weekStart: getMonday(new Date()) };
}

function saveExamPaywall(examCount: number, weekStart: string): void {
  try { localStorage.setItem(PAYWALL_KEY, JSON.stringify({ examCount, weekStart })); } catch {}
}

// ─────────────────────────────────────────────
// PAYWALL MODAL
// ─────────────────────────────────────────────
const PaywallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
      <div className="text-5xl mb-4">📖</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Limite hebdomadaire atteinte</h2>
      <p className="text-gray-500 mb-6 leading-relaxed">
        Tu as utilisé tes <strong>{FREE_EXAM_LIMIT} examens blancs gratuits</strong> de la semaine.{' '}
        Passe au Premium pour t'entraîner sans limite avant le DNB.
      </p>
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <div className="text-3xl font-extrabold" style={{color:'#1a6b3c'}}>
          9,99€<span className="text-lg font-normal text-gray-500">/mois</span>
        </div>
        <ul className="text-sm text-gray-600 mt-3 space-y-1 text-left">
          <li>✅ Examens illimités chaque semaine</li>
          <li>✅ Les 3 œuvres au programme 2026</li>
          <li>✅ Correction IA détaillée section par section</li>
          <li>✅ Suivi de progression et historique complet</li>
        </ul>
      </div>
      <button
        className="w-full text-white font-bold py-3 px-6 rounded-xl transition-colors mb-3"
        style={{backgroundColor:'#1a6b3c'}}
        onMouseOver={e => (e.currentTarget.style.backgroundColor='#155a32')}
        onMouseOut={e => (e.currentTarget.style.backgroundColor='#1a6b3c')}
        onClick={() => window.open('https://pr-pa-dnb-fran-ais-pour-alexandre.vercel.app/#pricing', '_blank')}
      >
        🚀 Passer au Premium — 9,99€/mois
      </button>
      <button className="text-sm text-gray-400 hover:text-gray-600 transition-colors" onClick={onClose}>
        Continuer avec le plan gratuit
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────
const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('DASHBOARD');
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);
  const [selectedTextType, setSelectedTextType] = useState<TextType>('SURPRISE');
  const [examPaywall, setExamPaywall] = useState(() => ({ ...loadExamPaywall(), showModal: false }));

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('dnbTestHistory');
      if (storedHistory) {
        setTestHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error("Impossible de charger l'historique :", error);
      localStorage.removeItem('dnbTestHistory');
    }
  }, []);

  const saveHistory = useCallback((newHistory: TestResult[]) => {
    try {
      setTestHistory(newHistory);
      localStorage.setItem('dnbTestHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error("Impossible de sauvegarder l'historique :", error);
    }
  }, []);

  const handleResetHistory = () => {
    setTestHistory([]);
    localStorage.removeItem('dnbTestHistory');
    setLastResult(null);
  };

  const handleStartTest = (textType: TextType) => {
    const currentWeek = getMonday(new Date());
    const count = examPaywall.weekStart === currentWeek ? examPaywall.examCount : 0;
    if (count >= FREE_EXAM_LIMIT) {
      setExamPaywall(prev => ({ ...prev, showModal: true }));
      return;
    }
    const newCount = count + 1;
    saveExamPaywall(newCount, currentWeek);
    setExamPaywall({ examCount: newCount, weekStart: currentWeek, showModal: false });
    setSelectedTextType(textType);
    setAppState('IN_TEST');
  };

  const handleBackToDashboard = () => {
    setAppState('DASHBOARD');
  };

  const handleTestComplete = (
    testContent: DNBTestContent,
    userAnswers: any,
    evaluation: Evaluation
  ) => {
    const newResult: TestResult = {
      date: new Date().toISOString(),
      content: testContent,
      userAnswers: userAnswers,
      evaluation: evaluation,
    };
    saveHistory([...testHistory, newResult]);
    setLastResult(newResult);
    setAppState('VIEWING_RESULTS');
  };

  const handleStartNewTest = () => {
    setAppState('DASHBOARD');
  };

  const renderContent = () => {
    switch (appState) {
      case 'IN_TEST':
        return (
          <TestSession
            testHistory={testHistory}
            onTestComplete={handleTestComplete}
            onBack={handleBackToDashboard}
            selectedTextType={selectedTextType}
          />
        );
      case 'VIEWING_RESULTS':
        if (!lastResult) {
          setAppState('DASHBOARD');
          return null;
        }
        return (
          <ResultsView
            lastResult={lastResult}
            onBackToDashboard={handleBackToDashboard}
            onStartNewTest={handleStartNewTest}
          />
        );
      case 'DASHBOARD':
      default:
        return (
          <Dashboard
            testHistory={testHistory}
            onStartTest={handleStartTest}
            onResetHistory={handleResetHistory}
          />
        );
    }
  };

  return (
    <main className="min-h-screen bg-white font-sans w-full">
      <div className="w-full">
        {renderContent()}
        {examPaywall.showModal && (
          <PaywallModal onClose={() => setExamPaywall(prev => ({ ...prev, showModal: false }))} />
        )}
      </div>
    </main>
  );
};

export default App;
