
import React from 'react';
import type { TestResult } from '../types';

interface ResultsViewProps {
  lastResult: TestResult;
  onBackToDashboard: () => void;
  onStartNewTest: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ lastResult, onBackToDashboard, onStartNewTest }) => {
  const { evaluation } = lastResult;
  const scoreColor = evaluation.totalScore >= 50 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="p-4 sm:p-10 w-full max-w-[1400px] mx-auto">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-black text-slate-900 tracking-tight">Rapport d'Examen</h1>
        <p className="text-slate-500 mt-4 text-xl">Analyse détaillée de ta performance du {new Date(lastResult.date).toLocaleDateString()}</p>
      </header>
      
      <div className="bg-white p-12 rounded-3xl shadow-xl mb-12 border-t-[12px] border-blue-600 text-center">
        <p className="text-xl font-bold text-slate-400 uppercase tracking-widest mb-6">Note Finale</p>
        <p className={`text-9xl font-black my-8 ${scoreColor}`}>{evaluation.totalScore}<span className="text-4xl text-slate-300 ml-2">/100</span></p>
        <div className="flex flex-wrap justify-center gap-6 mt-10">
            <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-base font-bold text-slate-600">Analyse: <span className="text-blue-600">{evaluation.analysisScore}/40</span></div>
            <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-base font-bold text-slate-600">Réécriture: <span className="text-blue-600">{evaluation.rewritingScore}/10</span></div>
            <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-base font-bold text-slate-600">Dictée: <span className="text-blue-600">{evaluation.dictationScore}/10</span></div>
            <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-base font-bold text-slate-600">Rédaction: <span className="text-blue-600">{evaluation.compositionScore}/40</span></div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-3xl shadow-md mb-12 border-l-8 border-blue-600">
        <h2 className="text-3xl font-black mb-6 text-slate-800">L'avis du jury pour Alexandre</h2>
        <p className="text-slate-700 leading-relaxed text-xl italic font-serif">"{evaluation.overallFeedback}"</p>
      </div>

      <div className="space-y-12">
        <h2 className="text-4xl font-black text-center text-slate-900">Correction détaillées</h2>
        
        <section className="bg-white p-10 rounded-3xl shadow-md border border-slate-100">
            <h3 className="text-2xl font-black mb-8 border-b pb-6 text-slate-800">Partie 1 : Analyse & Grammaire</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {evaluation.corrections.analysis.map((c, i) => (
                    <div key={i} className={`p-8 rounded-3xl border-2 transition-all ${c.isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <p className="font-black text-lg mb-4 text-slate-800">{i+1}. {c.question}</p>
                        <div className="space-y-3">
                            <p className="text-base"><span className="font-black text-slate-500 uppercase text-xs block mb-1">Ta réponse</span> {c.userAnswer || '(vide)'}</p>
                            {!c.isCorrect && (
                                <p className="text-base text-green-700"><span className="font-black text-green-500 uppercase text-xs block mb-1">Correction</span> {c.correctAnswer}</p>
                            )}
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-200/50">
                            <p className="text-sm text-blue-600 italic font-medium">💡 {c.explanation}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>

        <section className="bg-white p-10 rounded-3xl shadow-md border border-slate-100">
            <h3 className="text-2xl font-black mb-8 border-b pb-6 text-slate-800">Réécriture & Dictée</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-blue-50 p-8 rounded-3xl">
                    <h4 className="font-black text-blue-600 text-xl mb-4">Réécriture ({evaluation.rewritingScore}/10)</h4>
                    <p className="text-slate-700 leading-relaxed text-lg">{evaluation.corrections.rewriting.feedback}</p>
                </div>
                <div className="bg-blue-50 p-8 rounded-3xl">
                    <h4 className="font-black text-blue-600 text-xl mb-4">Dictée ({evaluation.dictationScore}/10)</h4>
                    <p className="text-slate-700 leading-relaxed text-lg">{evaluation.corrections.dictation.feedback}</p>
                </div>
            </div>
        </section>

        <section className="bg-white p-10 rounded-3xl shadow-md border border-slate-100">
            <h3 className="text-2xl font-black mb-8 border-b pb-6 text-slate-800">Rédaction ({evaluation.compositionScore}/40)</h3>
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                <p className="font-black mb-4 text-blue-600 uppercase tracking-widest text-sm">Sujet choisi : {evaluation.corrections.composition.subjectChosen === 'imagination' ? "Imagination" : "Réflexion"}</p>
                <p className="text-slate-800 leading-relaxed text-xl font-serif mb-6 whitespace-pre-wrap">{lastResult.userAnswers.composition.text}</p>
                <div className="mt-8 pt-8 border-t border-slate-200">
                    <h4 className="font-black mb-4 text-slate-800">Commentaire du correcteur :</h4>
                    <p className="text-slate-700 italic text-lg">{evaluation.corrections.composition.feedback}</p>
                </div>
            </div>
        </section>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-6 mt-16 pb-20">
        <button onClick={onBackToDashboard} className="bg-slate-800 text-white px-12 py-5 rounded-2xl font-black text-xl hover:bg-black transition-all shadow-xl">Retour au tableau de bord</button>
        <button onClick={onStartNewTest} className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">S'entraîner à nouveau</button>
      </div>
    </div>
  );
};

export default ResultsView;
