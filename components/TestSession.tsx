
import React, { useState, useEffect, useRef } from 'react';
import type { DNBTestContent, Evaluation, TextType, FileData } from '../types';
import { generateDNBTest, evaluateDNBAnswers, generateDictationAudio, DictationMode } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';

interface TestSessionProps {
  testHistory: any[];
  onTestComplete: (testContent: DNBTestContent, userAnswers: any, evaluation: Evaluation) => void;
  onBack: () => void;
  selectedTextType: TextType;
}

type Step = 'ANALYSE' | 'REECRITURE' | 'DICTEE' | 'REDACTION';

// Utilitaires Audio
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

// Move FilePreview outside to prevent re-creation on every render and fix TS key issues
const FilePreview: React.FC<{ file: FileData }> = ({ file }) => {
  const isPdf = file.mimeType === 'application/pdf';
  return (
    <div className="relative group">
      {isPdf ? (
        <div className="h-32 w-24 flex flex-col items-center justify-center bg-red-50 border-2 border-red-200 rounded-lg shadow-md">
          <span className="text-2xl mb-1">📄</span>
          <span className="text-[10px] font-bold text-red-700 truncate w-full px-2 text-center uppercase">PDF</span>
        </div>
      ) : (
        <img src={file.data} className="h-32 w-24 object-cover rounded-lg border-2 border-blue-500 shadow-md" alt="Aperçu copie" />
      )}
      <div className="absolute top-0 right-0 bg-white rounded-full p-1 shadow opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] font-bold">✓</span>
      </div>
    </div>
  );
};

const TestSession: React.FC<TestSessionProps> = ({ testHistory, onTestComplete, onBack, selectedTextType }) => {
  const [testContent, setTestContent] = useState<DNBTestContent | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('ANALYSE');
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState<DictationMode | null>(null);
  
  const [userAnswers, setUserAnswers] = useState<any>({
    analysisFiles: [],
    rewritingFile: null,
    dictationFile: null,
    compositionFile: null,
    compositionType: 'imagination'
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        setIsLoading(true);
        const content = await generateDNBTest(testHistory, selectedTextType);
        setTestContent(content);
      } catch (err) {
        alert("Erreur de génération.");
        onBack();
      } finally {
        setIsLoading(false);
      }
    };
    fetchTest();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const fileData: FileData = {
        data: reader.result as string,
        mimeType: file.type || 'image/jpeg',
        name: file.name
      };
      if (field === 'analysisFiles') {
        setUserAnswers((prev: any) => ({ ...prev, analysisFiles: [...prev.analysisFiles, fileData] }));
      } else {
        setUserAnswers((prev: any) => ({ ...prev, [field]: fileData }));
      }
    };
    reader.readAsDataURL(file);
  };

  const playDictation = async (mode: DictationMode) => {
    if (!testContent) return;
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      if (currentSourceRef.current) currentSourceRef.current.stop();
      setIsAudioLoading(mode);
      const audioBase64 = await generateDictationAudio(testContent.dictationText, mode);
      setIsAudioLoading(null);
      if (audioBase64) {
        const audioBuffer = await decodeAudioData(decode(audioBase64), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
        currentSourceRef.current = source;
      }
    } catch (e) {
      alert("Erreur audio.");
      setIsAudioLoading(null);
    }
  };

  const handleSubmit = async () => {
    if (!testContent) return;
    if (!userAnswers.analysisFiles.length && !userAnswers.dictationFile && !userAnswers.compositionFile) {
        alert("Alexandre, n'oublie pas de scanner ou photographier tes copies !");
        return;
    }
    setIsEvaluating(true);
    try {
      const evaluation = await evaluateDNBAnswers(testContent, userAnswers);
      onTestComplete(testContent, userAnswers, evaluation);
    } catch (e) {
      alert("Erreur de correction IA.");
      setIsEvaluating(false);
    }
  };

  const FileUploadZone = ({ title, field, multiple = false }: { title: string, field: string, multiple?: boolean }) => (
    <div className="mt-8 border-4 border-dashed border-slate-200 rounded-3xl p-8 text-center bg-slate-50 hover:bg-white transition-all shadow-inner">
      <h3 className="text-xl font-bold text-slate-700 mb-4">{title}</h3>
      <p className="text-slate-500 mb-6 italic">Formats acceptés : JPEG, PNG ou PDF.</p>
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        {field === 'analysisFiles' ? (
          userAnswers.analysisFiles.map((file: FileData, i: number) => <FilePreview key={i} file={file} />)
        ) : (
          userAnswers[field] && <FilePreview file={userAnswers[field]} />
        )}
      </div>
      <label className="bg-slate-800 text-white px-8 py-4 rounded-2xl font-black cursor-pointer hover:bg-black transition shadow-lg inline-flex items-center gap-3">
        <span>📸 Scanner / Upload</span>
        <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => handleFileUpload(e, field)} />
      </label>
    </div>
  );

  if (isLoading) return <LoadingSpinner message="Préparation de l'examen et génération des documents iconographiques..." />;
  if (isEvaluating) return <LoadingSpinner message="Le jury DNB analyse tes copies manuscrites..." />;
  if (!testContent) return null;

  return (
    <div className="p-4 sm:p-10 w-full max-w-[1800px] mx-auto animate-fadeIn">
      <div className="flex justify-between items-center mb-10 bg-white p-6 rounded-3xl shadow-sm border">
        <div className="flex gap-4">
            {['ANALYSE', 'REECRITURE', 'DICTEE', 'REDACTION'].map((s) => (
                <div key={s} className={`h-3 w-28 rounded-full transition-all duration-500 ${currentStep === s ? 'bg-blue-600 scale-110 shadow-lg shadow-blue-100' : 'bg-slate-200'}`} />
            ))}
        </div>
        <div className="flex items-center gap-4">
            <button onClick={() => window.print()} className="bg-slate-100 text-slate-700 px-6 py-2 rounded-xl text-sm font-bold border hover:bg-white transition">🖨️ Imprimer Sujet</button>
            <button onClick={onBack} className="text-red-500 font-bold hover:underline ml-4">Quitter</button>
            <span className="font-black text-blue-600 uppercase text-2xl ml-8 tracking-tighter">{currentStep}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-100 overflow-y-auto max-h-[85vh] custom-scrollbar">
          <h2 className="text-3xl font-black mb-10 text-slate-900 flex items-center gap-4">
              <span className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center text-xl">1</span>
              Énoncé Officiel
          </h2>
          <div className="prose prose-slate max-w-none">
            <div className="whitespace-pre-wrap leading-relaxed font-serif text-2xl mb-12 text-slate-800 border-l-8 border-blue-50 pl-8">{testContent.text}</div>
            
            <div className="bg-slate-50 p-10 rounded-3xl border-2 border-slate-100 mb-10 shadow-inner">
                <h3 className="text-xs font-black uppercase text-blue-600 mb-6 tracking-[0.2em] text-center italic">Document Iconographique à analyser</h3>
                {testContent.imageUrl ? (
                    <div className="mb-6 relative group">
                        <img src={testContent.imageUrl} className="w-full h-auto rounded-2xl shadow-2xl border-4 border-white transform transition hover:scale-[1.01]" alt="Document iconographique" />
                        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg text-xs font-bold text-slate-600 shadow-lg border">Document iconographique</div>
                    </div>
                ) : (
                    <div className="h-64 bg-slate-100 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 border-2 border-dashed border-slate-200">
                        <span className="text-4xl">🖼️</span>
                        <p className="text-sm font-medium">Document iconographique non disponible</p>
                        <p className="text-xs text-slate-400">Réponds aux questions à partir du texte</p>
                    </div>
                )}
                {/* Aide méthodologique — sans décrire l'image */}
                <div className="mt-5 bg-blue-50 border border-blue-100 rounded-xl px-5 py-3 text-sm text-blue-700">
                    <span className="font-bold">💡 Méthode :</span> Observe attentivement ce document. Pour chaque question, appuie-toi sur ce que tu vois (personnages, cadre, atmosphère, symboles) et sur le texte du corpus.
                </div>
            </div>

            {currentStep === 'REECRITURE' && (
              <div className="bg-blue-50 p-10 rounded-3xl border-2 border-blue-100 mb-10">
                <h3 className="font-black text-blue-600 text-sm uppercase tracking-widest mb-4">Exercice de Réécriture</h3>
                <p className="text-2xl italic font-serif text-slate-800 mb-6">"{testContent.rewritingTask.sourceText}"</p>
                <div className="bg-white p-6 rounded-2xl border border-blue-200">
                    <p className="font-bold text-blue-600">Consigne : {testContent.rewritingTask.instruction}</p>
                </div>
              </div>
            )}

            {currentStep === 'REDACTION' && (
              <div className="space-y-8">
                <div className="p-8 bg-white border-2 border-blue-50 rounded-3xl shadow-sm">
                  <h3 className="font-black text-blue-600 mb-4 text-xl">Sujet d'imagination</h3>
                  <p className="text-xl leading-relaxed text-slate-800">{testContent.compositionSubjects.imagination}</p>
                </div>
                <div className="p-8 bg-white border-2 border-slate-50 rounded-3xl shadow-sm">
                  <h3 className="font-black text-slate-700 mb-4 text-xl">Sujet de réflexion</h3>
                  <p className="text-xl leading-relaxed text-slate-800">{testContent.compositionSubjects.reflection}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-100 overflow-y-auto max-h-[85vh] custom-scrollbar">
          <div className="mb-10 bg-blue-600 p-8 rounded-3xl text-white shadow-xl shadow-blue-100">
            <h3 className="text-xl font-black mb-2">Instructions pour Alexandre</h3>
            <p className="opacity-90 leading-relaxed">Travaille sur des feuilles de lignes. Prends une photo bien cadrée ou scanne tes feuilles en PDF pour chaque étape.</p>
          </div>

          {currentStep === 'ANALYSE' && (
            <div>
              <h2 className="text-3xl font-black mb-8">Questions d'Analyse (40 pts)</h2>
              <div className="space-y-6 mb-10">
                {testContent.analysisQuestions.map((q, i) => (
                  <div key={i} className="flex gap-4 items-start bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <span className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold">{i+1}</span>
                    <p className="text-xl font-bold text-slate-800 leading-tight">{q.question} <span className="text-blue-500 font-bold ml-2">({q.points} pts)</span></p>
                  </div>
                ))}
              </div>
              <FileUploadZone title="Tes copies d'Analyse (JPEG/PDF)" field="analysisFiles" multiple />
              <button onClick={() => setCurrentStep('REECRITURE')} className="w-full mt-10 bg-blue-600 text-white py-6 rounded-3xl font-black text-2xl hover:bg-blue-700 transition shadow-2xl shadow-blue-100">Étape suivante : Réécriture</button>
            </div>
          )}

          {currentStep === 'REECRITURE' && (
            <div>
              <h2 className="text-3xl font-black mb-8">Réécriture (10 pts)</h2>
              <p className="text-xl mb-10 text-slate-600">Fais l'exercice sur ta feuille manuscrite, puis télécharge-le ici.</p>
              <FileUploadZone title="Ta copie de Réécriture" field="rewritingFile" />
              <button onClick={() => setCurrentStep('DICTEE')} className="w-full mt-10 bg-blue-600 text-white py-6 rounded-3xl font-black text-2xl hover:bg-blue-700 transition">Étape suivante : Dictée</button>
            </div>
          )}

          {currentStep === 'DICTEE' && (
            <div className="text-center">
              <h2 className="text-3xl font-black mb-10">Dictée Officielle (10 pts)</h2>
              <div className="grid grid-cols-1 gap-4 mb-12">
                <button onClick={() => playDictation('NORMAL')} disabled={!!isAudioLoading} className="bg-slate-100 py-5 rounded-2xl font-black hover:bg-slate-200 transition border-2 border-slate-200 flex items-center justify-center gap-4 text-xl">
                    <span>{isAudioLoading === 'NORMAL' ? '⏳' : '⚡'}</span>
                    Lecture Globale
                </button>
                <button onClick={() => playDictation('SLOW')} disabled={!!isAudioLoading} className="bg-blue-600 text-white py-8 rounded-3xl font-black text-2xl shadow-2xl shadow-blue-100 hover:bg-blue-700 transition border-4 border-blue-500 flex items-center justify-center gap-4">
                    <span>{isAudioLoading === 'SLOW' ? '⏳' : '🐢'}</span>
                    Lecture Lente + Ponctuation
                </button>
              </div>
              <FileUploadZone title="Ta copie de Dictée" field="dictationFile" />
              <button onClick={() => setCurrentStep('REDACTION')} className="w-full mt-10 bg-blue-600 text-white py-6 rounded-3xl font-black text-2xl">Dernière étape : Rédaction</button>
            </div>
          )}

          {currentStep === 'REDACTION' && (
            <div>
              <h2 className="text-3xl font-black mb-8">Rédaction (40 pts)</h2>
              <div className="mb-10 flex gap-4">
                 <button onClick={() => setUserAnswers({...userAnswers, compositionType: 'imagination'})} className={`flex-1 py-6 rounded-2xl font-black text-lg transition-all border-4 ${userAnswers.compositionType === 'imagination' ? 'border-blue-600 bg-blue-50 text-blue-600 scale-105 shadow-xl shadow-blue-50' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>Sujet Imagination</button>
                 <button onClick={() => setUserAnswers({...userAnswers, compositionType: 'reflection'})} className={`flex-1 py-6 rounded-2xl font-black text-lg transition-all border-4 ${userAnswers.compositionType === 'reflection' ? 'border-blue-600 bg-blue-50 text-blue-600 scale-105 shadow-xl shadow-blue-50' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>Sujet Réflexion</button>
              </div>
              <FileUploadZone title="Ta copie de Rédaction" field="compositionFile" />
              <div className="flex flex-col gap-4 mt-12">
                 <button onClick={handleSubmit} className="w-full bg-green-600 text-white py-8 rounded-3xl font-black text-2xl hover:bg-green-700 shadow-2xl shadow-green-100 transition-all hover:-translate-y-1">Terminer et Soumettre au Jury</button>
                 <button onClick={() => setCurrentStep('ANALYSE')} className="text-slate-400 font-bold hover:text-slate-600 transition underline">Relire mes documents</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestSession;
