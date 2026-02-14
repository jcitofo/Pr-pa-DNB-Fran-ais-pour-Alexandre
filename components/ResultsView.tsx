
import React from 'react';
import type { TestResult, FileData } from '../types';

interface ResultsViewProps {
  lastResult: TestResult;
  onBackToDashboard: () => void;
  onStartNewTest: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ lastResult, onBackToDashboard, onStartNewTest }) => {
  const { evaluation, userAnswers, content } = lastResult;
  const scoreColor = evaluation.totalScore >= 50 ? 'text-green-600' : 'text-red-600';

  const FileDisplay = ({ file, label }: { file: FileData | null, label: string }) => {
    if (!file) return <div className="text-slate-400 text-xs italic">Document non fourni pour {label}</div>;
    const isPdf = file.mimeType === 'application/pdf';

    return (
      <div className="space-y-2">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{label}</p>
        {isPdf ? (
          <div className="h-48 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
            <span className="text-4xl mb-2">📄</span>
            <span className="text-xs font-bold text-slate-500">Document PDF</span>
            <a href={file.data} target="_blank" rel="noreferrer" className="mt-3 text-[10px] bg-white border px-3 py-1 rounded-full hover:bg-slate-100 transition">Ouvrir le PDF</a>
          </div>
        ) : (
          <img src={file.data} className="w-full rounded-xl border shadow-sm cursor-zoom-in" alt={label} onClick={() => window.open(file.data, '_blank')} />
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-10 w-full max-w-[1500px] mx-auto animate-fadeIn">
      <header className="text-center mb-16">
        <div className="inline-block bg-green-100 text-green-700 px-4 py-1 rounded-full text-xs font-bold mb-6 uppercase tracking-widest border border-green-200">Correction Terminée</div>
        <h1 className="text-6xl font-black text-slate-900 tracking-tight">Verdict du Jury</h1>
        <p className="text-slate-500 mt-4 text-2xl">Bilan de l'épreuve manuscrite du {new Date(lastResult.date).toLocaleDateString()}</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 bg-white p-12 rounded-[40px] shadow-sm border border-slate-100 text-center flex flex-col justify-center items-center">
            <p className="text-xl font-bold text-slate-400 uppercase tracking-widest mb-6">Moyenne DNB calculée</p>
            <div className="flex items-baseline gap-4">
                <span className={`text-[12rem] font-black leading-none tracking-tighter ${scoreColor}`}>{evaluation.totalScore}</span>
                <span className="text-4xl text-slate-200 font-black">/100</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-12">
                <div className="px-4 py-6 bg-blue-50 rounded-2xl">
                    <p className="text-xs font-bold text-blue-400 uppercase mb-1">Analyse</p>
                    <p className="text-2xl font-black text-blue-700">{evaluation.analysisScore}/40</p>
                </div>
                <div className="px-4 py-6 bg-slate-50 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Réécriture</p>
                    <p className="text-2xl font-black text-slate-700">{evaluation.rewritingScore}/10</p>
                </div>
                <div className="px-4 py-6 bg-slate-50 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Dictée</p>
                    <p className="text-2xl font-black text-slate-700">{evaluation.dictationScore}/10</p>
                </div>
                <div className="px-4 py-6 bg-blue-50 rounded-2xl">
                    <p className="text-xs font-bold text-blue-400 uppercase mb-1">Rédaction</p>
                    <p className="text-2xl font-black text-blue-700">{evaluation.compositionScore}/40</p>
                </div>
            </div>
        </div>

        <div className="bg-slate-900 text-white p-12 rounded-[40px] shadow-2xl flex flex-col h-full">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
                <span className="text-blue-400 text-3xl">“</span>
                Appréciation
            </h2>
            <p className="text-xl leading-relaxed italic font-serif flex-grow text-slate-300">
                "{evaluation.overallFeedback}"
            </p>
            <div className="mt-10 pt-10 border-t border-white/10 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center font-black">AI</div>
                <div>
                    <p className="font-bold text-sm">Le Correcteur Intelligent</p>
                    <p className="text-xs text-slate-500">Service correction DNB 2026</p>
                </div>
            </div>
        </div>
      </div>

      <div className="space-y-16 mt-20">
        <h2 className="text-4xl font-black text-center text-slate-900">Analyse détaillée du manuscrit</h2>
        
        <section className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-3xl font-black mb-12 border-b pb-8 flex items-center justify-between">
                Partie 1 : Analyse & Image
                <span className="text-blue-600 text-sm font-bold bg-blue-50 px-4 py-2 rounded-xl">{evaluation.analysisScore}/40</span>
            </h3>
            
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 mb-16">
                <div className="xl:col-span-1 space-y-8">
                    <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest border-b pb-2">Image de l'épreuve</h4>
                    {content.imageUrl && <img src={content.imageUrl} className="w-full rounded-2xl shadow-lg border-2 border-slate-50" />}
                    
                    <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest border-b pb-2 mt-8">Tes copies Analysis</h4>
                    <div className="flex flex-wrap gap-4">
                        {userAnswers.analysisFiles.map((file, i) => (
                            <div key={i} className="w-20">
                                <FileDisplay file={file} label={`Page ${i+1}`} />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {evaluation.corrections.analysis.map((c, i) => (
                        <div key={i} className={`p-8 rounded-3xl border-2 transition-all hover:shadow-lg ${c.isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                            <p className="font-black text-lg mb-4 text-slate-800">{i+1}. {c.question}</p>
                            <div className="bg-white/60 p-4 rounded-xl mb-4 border border-white/80">
                                <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-tighter">Lu par l'IA sur ta copie</p>
                                <p className="text-sm italic text-slate-700">"{c.userAnswer || '(Non détecté)'}"</p>
                            </div>
                            {!c.isCorrect && (
                                <p className="text-sm text-green-700 font-bold mb-4">💡 Attendu : {c.correctAnswer}</p>
                            )}
                            <p className="text-xs text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100/50 leading-relaxed font-medium">
                                EXPLICATION : {c.explanation}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        <section className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-3xl font-black mb-12 border-b pb-8">Réécriture & Dictée</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <FileDisplay file={userAnswers.rewritingFile} label="Copie de Réécriture" />
                    <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-black text-blue-600 text-xl">Analyse Réécriture</h4>
                            <span className="font-black bg-blue-600 text-white px-3 py-1 rounded-lg text-xs">{evaluation.rewritingScore}/10</span>
                        </div>
                        <p className="text-slate-700 text-lg leading-relaxed">{evaluation.corrections.rewriting.feedback}</p>
                    </div>
                </div>
                <div className="space-y-8">
                    <FileDisplay file={userAnswers.dictationFile} label="Copie de Dictée" />
                    <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-black text-blue-400 text-xl">Bilan Dictée</h4>
                            <span className="font-black bg-blue-500 text-white px-3 py-1 rounded-lg text-xs">{evaluation.dictationScore}/10</span>
                        </div>
                        <p className="text-slate-300 text-lg leading-relaxed italic">"{evaluation.corrections.dictation.feedback}"</p>
                    </div>
                </div>
            </div>
        </section>

        <section className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-3xl font-black mb-12 border-b pb-8 flex items-center justify-between">
                Partie Finale : Rédaction
                <span className="text-blue-600 text-sm font-bold bg-blue-50 px-4 py-2 rounded-xl">{evaluation.compositionScore}/40</span>
            </h3>
            <div className="flex flex-col xl:flex-row gap-12">
                <div className="xl:w-1/3">
                    <FileDisplay file={userAnswers.compositionFile} label="Copie de Rédaction" />
                </div>
                <div className="xl:w-2/3 bg-slate-50 p-10 rounded-[40px] border border-slate-100 shadow-inner">
                    <div className="mb-8">
                        <span className="text-xs font-black uppercase text-blue-600 tracking-widest block mb-2">Transcription OCR</span>
                        <p className="text-slate-800 font-serif leading-relaxed text-2xl mb-8 italic bg-white p-8 rounded-3xl border shadow-sm">
                            "{evaluation.corrections.composition.userAnswer || 'Texte non analysable'}"
                        </p>
                    </div>
                    <div className="pt-10 border-t border-slate-200">
                        <h4 className="font-black mb-6 text-slate-800 text-xl flex items-center gap-3">
                            <span className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center text-xs">A</span>
                            Analyse du Jury
                        </h4>
                        <p className="text-slate-700 text-xl leading-loose font-serif whitespace-pre-line">{evaluation.corrections.composition.feedback}</p>
                    </div>
                </div>
            </div>
        </section>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-8 mt-24 pb-32">
        <button onClick={onBackToDashboard} className="bg-slate-800 text-white px-16 py-6 rounded-3xl font-black text-2xl hover:bg-black transition-all shadow-xl hover:-translate-y-1">Quitter l'examen</button>
        <button onClick={onStartNewTest} className="bg-blue-600 text-white px-16 py-6 rounded-3xl font-black text-2xl hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 hover:-translate-y-1 border-4 border-blue-500">Nouvel Entraînement</button>
      </div>
    </div>
  );
};

export default ResultsView;
