
import React, { useState, useEffect, useRef } from 'react';
import type { DNBTestContent, Evaluation, TextType } from '../types';
import { generateDNBTest, evaluateDNBAnswers, generateDictationAudio, DictationMode } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';

interface TestSessionProps {
  testHistory: any[];
  onTestComplete: (testContent: DNBTestContent, userAnswers: any, evaluation: Evaluation) => void;
  onBack: () => void;
  selectedTextType: TextType;
}

type Step = 'ANALYSE' | 'REECRITURE' | 'DICTEE' | 'REDACTION';

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createWavBlob(pcmData: Uint8Array, sampleRate: number): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, pcmData.length, true);
  return new Blob([header, pcmData], { type: 'audio/wav' });
}

const TestSession: React.FC<TestSessionProps> = ({ testHistory, onTestComplete, onBack, selectedTextType }) => {
  const [testContent, setTestContent] = useState<DNBTestContent | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('ANALYSE');
  const [userAnswers, setUserAnswers] = useState<any>({
    analysis: [],
    rewriting: '',
    dictation: '',
    composition: { type: 'imagination', text: '' }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [cachedAudio, setCachedAudio] = useState<Partial<Record<DictationMode, string>>>({});
  const [isAudioLoading, setIsAudioLoading] = useState<DictationMode | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const fetchTest = async () => {
      try {
        setIsLoading(true);
        const content = await generateDNBTest(testHistory, selectedTextType);
        setTestContent(content);
        setUserAnswers({
          analysis: new Array(content.analysisQuestions.length).fill(''),
          rewriting: '',
          dictation: '',
          composition: { type: 'imagination', text: '' }
        });
      } catch (err) {
        alert("Erreur lors de la génération. Retour au menu.");
        onBack();
      } finally {
        setIsLoading(false);
      }
    };
    fetchTest();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playDictation = async (mode: DictationMode) => {
    if (!testContent) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      
      if (currentSourceRef.current) {
        try { currentSourceRef.current.stop(); } catch(e) {}
      }

      let audioBase64 = cachedAudio[mode];

      if (!audioBase64) {
        setIsAudioLoading(mode);
        audioBase64 = await generateDictationAudio(testContent.dictationText, mode);
        setCachedAudio(prev => ({ ...prev, [mode]: audioBase64 }));
        setIsAudioLoading(null);
      }

      if (audioBase64) {
        const audioBuffer = await decodeAudioData(
          decode(audioBase64),
          ctx,
          24000,
          1
        );
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
        currentSourceRef.current = source;
      }
    } catch (e) {
      console.error(e);
      alert("Impossible de charger l'audio de la dictée.");
      setIsAudioLoading(null);
    }
  };

  const handleDownload = (mode: DictationMode) => {
    const audioBase64 = cachedAudio[mode];
    if (!audioBase64) return;
    const pcmBytes = decode(audioBase64);
    const wavBlob = createWavBlob(pcmBytes, 24000);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dictee_alexandre_${mode.toLowerCase()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleNext = () => {
    if (currentStep === 'ANALYSE') setCurrentStep('REECRITURE');
    else if (currentStep === 'REECRITURE') setCurrentStep('DICTEE');
    else if (currentStep === 'DICTEE') setCurrentStep('REDACTION');
  };

  const handleSubmit = async () => {
    if (!testContent) return;
    setIsEvaluating(true);
    try {
      const evaluation = await evaluateDNBAnswers(testContent, userAnswers);
      onTestComplete(testContent, userAnswers, evaluation);
    } catch (e) {
      alert("Erreur lors de la correction.");
      setIsEvaluating(false);
    }
  };

  if (isLoading) return <LoadingSpinner message="Génération de ton épreuve DNB..." />;
  if (isEvaluating) return <LoadingSpinner message="Le jury corrige ta copie..." />;
  if (!testContent) return null;

  return (
    <div className="p-4 sm:p-10 w-full max-w-[1800px] mx-auto">
      <div className="flex justify-between items-center mb-10 bg-white p-6 rounded-3xl shadow-sm border">
        <div className="flex gap-4">
            {['ANALYSE', 'REECRITURE', 'DICTEE', 'REDACTION'].map((s) => (
                <div key={s} className={`h-3 w-20 rounded-full transition-all duration-500 ${currentStep === s ? 'bg-blue-600 scale-110' : 'bg-slate-200'}`} />
            ))}
        </div>
        <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-slate-400 font-bold hover:text-slate-600">Quitter</button>
            <span className="font-black text-blue-600 uppercase tracking-tighter text-xl">{currentStep}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white p-10 rounded-3xl shadow-md border overflow-y-auto max-h-[80vh]">
          <h2 className="text-2xl font-black mb-6 border-b pb-4 text-slate-800">📖 Corpus de l'épreuve</h2>
          <div className="prose prose-slate max-w-none">
            <p className="italic text-slate-500 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">Conseil : Lis attentivement ce texte. Tu en auras besoin pour toutes les parties de l'examen.</p>
            <div className="whitespace-pre-wrap leading-relaxed font-serif text-2xl mb-12 text-slate-900">{testContent.text}</div>
            
            <div className="bg-blue-50 p-6 rounded-2xl border-2 border-dashed border-blue-200">
                <h3 className="text-sm font-black uppercase text-blue-600 mb-3 tracking-widest">Document Iconographique</h3>
                <p className="text-slate-700 text-lg italic leading-relaxed">{testContent.imageDescription}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-10 rounded-3xl shadow-md border overflow-y-auto max-h-[80vh]">
          {currentStep === 'ANALYSE' && (
            <div>
              <h2 className="text-3xl font-black mb-8 text-slate-800">Partie 1 : Analyse (40 pts)</h2>
              {testContent.analysisQuestions.map((q, i) => (
                <div key={i} className="mb-10">
                  <p className="font-bold text-xl mb-4 flex items-start gap-3 text-slate-800">
                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-sm">{i + 1}</span>
                    <span>{q.question} <span className="text-blue-500 font-bold text-sm ml-2">({q.points} pts)</span></span>
                  </p>
                  <textarea
                    className="w-full p-5 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-lg"
                    rows={4}
                    value={userAnswers.analysis[i]}
                    onChange={(e) => {
                      const newAnsw = [...userAnswers.analysis];
                      newAnsw[i] = e.target.value;
                      setUserAnswers({...userAnswers, analysis: newAnsw});
                    }}
                    placeholder="Rédige ta réponse ici en soignant ton expression..."
                  />
                </div>
              ))}
              <button onClick={handleNext} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-blue-700 transition shadow-xl shadow-blue-100">Continuer vers la réécriture</button>
            </div>
          )}

          {currentStep === 'REECRITURE' && (
            <div>
              <h2 className="text-3xl font-black mb-8 text-slate-800">Partie 2 : Réécriture (10 pts)</h2>
              <div className="bg-slate-50 p-8 rounded-3xl mb-8 italic text-xl border border-slate-100 text-slate-700">"{testContent.rewritingTask.sourceText}"</div>
              <p className="font-black text-blue-600 mb-6 text-lg uppercase tracking-widest">Consigne : {testContent.rewritingTask.instruction}</p>
              <textarea
                className="w-full p-5 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-xl font-serif"
                rows={5}
                value={userAnswers.rewriting}
                onChange={(e) => setUserAnswers({...userAnswers, rewriting: e.target.value})}
                placeholder="Retape le passage transformé..."
              />
              <button onClick={handleNext} className="w-full mt-10 bg-blue-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-blue-700 transition">Passer à la dictée</button>
            </div>
          )}

          {currentStep === 'DICTEE' && (
            <div className="text-center">
              <h2 className="text-3xl font-black mb-8 text-slate-800">Partie 3 : Dictée (10 pts)</h2>
              <p className="mb-10 text-slate-500 text-lg">Alexandre, prépare ton brouillon. Utilise la <b>Lecture Globale</b> pour comprendre le sens, puis la <b>Lecture Lente</b> pour écrire.</p>
              
              <div className="flex flex-col gap-5 mb-10">
                <div className="flex gap-3">
                    <button 
                      onClick={() => playDictation('NORMAL')}
                      disabled={!!isAudioLoading}
                      className="flex-1 bg-slate-100 text-slate-700 px-6 py-5 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-200 transition border border-slate-200"
                    >
                      {isAudioLoading === 'NORMAL' ? 'Génération...' : '⚡ Lecture Globale'}
                    </button>
                    {cachedAudio['NORMAL'] && (
                        <button 
                            onClick={() => handleDownload('NORMAL')}
                            className="bg-slate-800 text-white px-6 rounded-2xl hover:bg-black transition flex items-center justify-center"
                            title="Télécharger"
                        >
                            💾
                        </button>
                    )}
                </div>

                <div className="flex gap-3">
                    <button 
                      onClick={() => playDictation('SLOW')}
                      disabled={!!isAudioLoading}
                      className="flex-1 bg-blue-600 text-white px-6 py-6 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition shadow-xl shadow-blue-100 border-2 border-blue-600"
                    >
                      {isAudioLoading === 'SLOW' ? 'Préparation...' : '🐢 Lecture Lente + Ponctuation'}
                    </button>
                    {cachedAudio['SLOW'] && (
                        <button 
                            onClick={() => handleDownload('SLOW')}
                            className="bg-slate-800 text-white px-6 rounded-2xl hover:bg-black transition flex items-center justify-center"
                            title="Télécharger"
                        >
                            💾
                        </button>
                    )}
                </div>
              </div>

              <textarea
                className="w-full p-8 border-2 border-slate-100 rounded-3xl focus:ring-4 focus:ring-blue-100 font-serif text-2xl leading-loose bg-slate-50 text-slate-800"
                rows={12}
                value={userAnswers.dictation}
                onChange={(e) => setUserAnswers({...userAnswers, dictation: e.target.value})}
                placeholder="Tape ta dictée ici en respectant bien la ponctuation annoncée..."
              />
              <button onClick={handleNext} className="w-full mt-10 bg-blue-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-blue-700 transition">Passer à la rédaction</button>
            </div>
          )}

          {currentStep === 'REDACTION' && (
            <div>
              <h2 className="text-3xl font-black mb-8 text-slate-800">Partie 4 : Rédaction (40 pts)</h2>
              <div className="space-y-5 mb-10">
                <label className={`block p-6 border-4 rounded-3xl cursor-pointer transition-all ${userAnswers.composition.type === 'imagination' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                    <input type="radio" name="compType" className="hidden" onChange={() => setUserAnswers({...userAnswers, composition: {...userAnswers.composition, type: 'imagination'}})} />
                    <span className="font-black block text-xl mb-2 text-slate-800">Sujet 1 : Imagination</span>
                    <span className="text-slate-600 leading-relaxed text-lg">{testContent.compositionSubjects.imagination}</span>
                </label>
                <label className={`block p-6 border-4 rounded-3xl cursor-pointer transition-all ${userAnswers.composition.type === 'reflection' ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-200'}`}>
                    <input type="radio" name="compType" className="hidden" onChange={() => setUserAnswers({...userAnswers, composition: {...userAnswers.composition, type: 'reflection'}})} />
                    <span className="font-black block text-xl mb-2 text-slate-800">Sujet 2 : Réflexion</span>
                    <span className="text-slate-600 leading-relaxed text-lg">{testContent.compositionSubjects.reflection}</span>
                </label>
              </div>

              <textarea
                className="w-full p-8 border-2 border-slate-100 rounded-3xl focus:ring-4 focus:ring-blue-100 min-h-[500px] text-xl leading-relaxed"
                value={userAnswers.composition.text}
                onChange={(e) => setUserAnswers({...userAnswers, composition: {...userAnswers.composition, text: e.target.value}})}
                placeholder="Rédige ton devoir ici. N'oublie pas de structurer ton texte en paragraphes..."
              />
              <div className="flex gap-5 mt-10">
                 <button onClick={() => setCurrentStep('ANALYSE')} className="flex-1 bg-slate-100 text-slate-700 py-5 rounded-2xl font-black text-lg">Relire ma copie</button>
                 <button onClick={handleSubmit} className="flex-1 bg-green-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-green-700 shadow-xl shadow-green-100">Soumettre ma copie</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestSession;
