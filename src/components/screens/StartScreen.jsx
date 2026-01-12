import { useState } from 'react';
import { Gavel, Scale, Shield } from 'lucide-react';

/**
 * Entry screen for selecting a game mode, jurisdiction, and side.
 *
 * @param {object} props - Component props.
 * @param {(role: string, difficulty: string, jurisdiction: string) => void} props.onStart - Callback to start the game.
 * @returns {JSX.Element} The start screen layout.
 */
const StartScreen = ({ onStart }) => {
  const [difficulty, setDifficulty] = useState('regular');
  const [jurisdiction, setJurisdiction] = useState('USA');

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6 animate-in fade-in zoom-in duration-500">
      <div className="bg-slate-800 p-6 rounded-full mb-6 shadow-xl border-4 border-amber-500">
        <Scale className="w-16 h-16 text-amber-500" />
      </div>
      <h1 className="text-4xl md:text-6xl font-black text-slate-800 mb-2 tracking-tighter">
        POCKET<span className="text-amber-600">COURT</span>
      </h1>
      <p className="text-slate-500 mb-8 text-lg font-medium max-w-md">v15.0: GitHub Ready Edition</p>
      <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 w-full max-w-md mb-8 space-y-6">
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Game Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {['silly', 'regular', 'nuance'].map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`p-2 rounded-lg text-sm font-bold capitalize transition-all border-2 ${
                  difficulty === d
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Jurisdiction</label>
          <div className="grid grid-cols-3 gap-2">
            {['USA', 'Canada', 'Fictional'].map((j) => (
              <button
                key={j}
                onClick={() => setJurisdiction(j)}
                className={`p-2 rounded-lg text-sm font-bold capitalize transition-all border-2 ${
                  jurisdiction === j
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'
                }`}
              >
                {j}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
        <button
          onClick={() => onStart('prosecution', difficulty, jurisdiction)}
          className="p-4 bg-red-100 hover:bg-red-200 border-2 border-red-300 rounded-xl font-bold text-red-900 flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <Gavel className="w-5 h-5" /> PROSECUTION
        </button>
        <button
          onClick={() => onStart('defense', difficulty, jurisdiction)}
          className="p-4 bg-blue-100 hover:bg-blue-200 border-2 border-blue-300 rounded-xl font-bold text-blue-900 flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <Shield className="w-5 h-5" /> DEFENSE
        </button>
      </div>
    </div>
  );
};

export default StartScreen;
