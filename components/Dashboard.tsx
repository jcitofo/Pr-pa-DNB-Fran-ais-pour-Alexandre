
import React, { useState } from 'react';
import type { TestResult, TextType } from '../types';
import { textTypeOptions } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  testHistory: TestResult[];
  onStartTest: (textType: TextType) => void;
  onResetHistory: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ testHistory, onStartTest, onResetHistory }) => {
  const [selectedType, setSelectedType] = useState<TextType>('SURPRISE');

  const chartData = testHistory.map((result, index) => ({
    name: `Test ${index + 1}`,
    score: result.evaluation.totalScore,
    date: new Date(result.date).toLocaleDateString('fr-FR'),
  }));

  const averageScore = testHistory.length > 0
    ? (testHistory.reduce((acc, curr) => acc + curr.evaluation.totalScore, 0) / testHistory.length).toFixed(1)
    : 'N/A';

  const obligatoryReadings: TextType[] = ['ANTIGONE', 'ANIMAL_FARM', 'REUNION'];
  const generalThemes: TextType[] = ['SURPRISE', 'CLASSIC', 'MODERN', 'THEATER', 'POETRY', 'ARGUMENTATIVE'];

  const handleResetClick = () => {
    if (window.confirm("Alexandre, es-tu sûr de vouloir effacer toute ta progression ? Tes notes et ton historique seront supprimés.")) {
      onResetHistory();
    }
  };

  return (
    <div className="p-4 sm:p-10 w-full max-w-[1600px] mx-auto">
      <header className="mb-12 text-center">
        <div className="inline-block bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold mb-4 uppercase tracking-widest">Session DNB 2026</div>
        <h1 className="text-6xl font-black text-slate-900 mb-4 tracking-tight">Objectif Brevet, Alexandre !</h1>
        <p className="text-2xl text-slate-500 max-w-2xl mx-auto">Prépare-toi sereinement à l'épreuve de Français avec un simulateur intelligent.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
          <span className="text-5xl font-black text-blue-600">{testHistory.length}</span>
          <p className="text-slate-400 font-bold uppercase text-xs mt-3 tracking-widest">Examens blancs</p>
        </div>
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
          <span className="text-5xl font-black text-green-600">{averageScore}</span>
          <p className="text-slate-400 font-bold uppercase text-xs mt-3 tracking-widest">Moyenne / 100</p>
        </div>
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
          <span className="text-5xl font-black text-orange-500">{testHistory.length > 0 ? (testHistory.length * 2.5).toFixed(1) : 0}h</span>
          <p className="text-slate-400 font-bold uppercase text-xs mt-3 tracking-widest">Heures de travail</p>
        </div>
      </div>
      
      {testHistory.length > 0 && (
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 mb-12">
          <h2 className="text-2xl font-bold mb-8 text-slate-800">Évolution de tes résultats</h2>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'}} />
                <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={5} dot={{r: 8, fill: '#2563eb', strokeWidth: 3, stroke: '#fff'}} activeDot={{ r: 10 }} name="Note / 100" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 mb-12">
        <h2 className="text-3xl font-bold mb-3 text-center text-slate-800">Prêt pour un nouveau test ?</h2>
        <p className="text-center text-slate-500 text-lg mb-10">Sélectionne le type de sujet sur lequel tu souhaites t'exercer aujourd'hui.</p>
        
        <div className="mb-10">
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-6 text-center">📚 Lectures au programme 2026</h3>
            <div className="flex flex-wrap justify-center gap-4">
                {obligatoryReadings.map((key) => (
                <button
                    key={key}
                    onClick={() => setSelectedType(key)}
                    className={`font-bold py-4 px-8 rounded-2xl transition-all text-base border-2 ${
                    selectedType === key
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-200 scale-105'
                        : 'bg-white text-slate-600 border-slate-100 hover:border-blue-200'
                    }`}
                >
                    {textTypeOptions[key]}
                </button>
                ))}
            </div>
        </div>

        <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 text-center">🌐 Thématiques Générales</h3>
            <div className="flex flex-wrap justify-center gap-4">
                {generalThemes.map((key) => (
                <button
                    key={key}
                    onClick={() => setSelectedType(key)}
                    className={`font-bold py-4 px-8 rounded-2xl transition-all text-base ${
                    selectedType === key
                        ? 'bg-slate-800 text-white shadow-xl scale-105'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    {textTypeOptions[key]}
                </button>
                ))}
            </div>
        </div>
      </div>

      <div className="text-center pb-12">
        <button
          onClick={() => onStartTest(selectedType)}
          className="bg-blue-600 text-white font-black py-6 px-16 rounded-3xl shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-2 transition-all duration-300 text-2xl"
        >
          Commencer l'entraînement
        </button>
      </div>

      <div className="text-center border-t pt-10 mt-10">
        <button 
            onClick={handleResetClick}
            className="bg-white text-slate-400 hover:text-red-500 px-6 py-3 rounded-full border border-slate-100 hover:border-red-100 text-sm font-bold transition-all uppercase tracking-widest"
        >
            Réinitialiser ma progression
        </button>
        <p className="mt-4 text-xs text-slate-300 max-w-sm mx-auto">Cette option permet d'effacer tous les résultats d'Alexandre pour repartir de zéro.</p>
      </div>
    </div>
  );
};

export default Dashboard;
