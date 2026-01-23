
import React, { useState, useEffect, useCallback } from 'react';
import type { TestResult, AppState, DNBTestContent, Evaluation, TextType } from './types';
import Dashboard from './components/Dashboard';
import TestSession from './components/TestSession';
import ResultsView from './components/ResultsView';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('DASHBOARD');
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);
  const [selectedTextType, setSelectedTextType] = useState<TextType>('SURPRISE');

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
  }

  const renderContent = () => {
    switch (appState) {
      case 'IN_TEST':
        return <TestSession 
                  testHistory={testHistory} 
                  onTestComplete={handleTestComplete} 
                  onBack={handleBackToDashboard} 
                  selectedTextType={selectedTextType} 
                />;
      case 'VIEWING_RESULTS':
        if (!lastResult) {
            setAppState('DASHBOARD');
            return null;
        }
        return <ResultsView lastResult={lastResult} onBackToDashboard={handleBackToDashboard} onStartNewTest={handleStartNewTest} />;
      case 'DASHBOARD':
      default:
        return <Dashboard testHistory={testHistory} onStartTest={handleStartTest} onResetHistory={handleResetHistory} />;
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 font-sans w-full">
      <div className="w-full">
        {renderContent()}
      </div>
    </main>
  );
};

export default App;
