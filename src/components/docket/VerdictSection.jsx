import { Trophy } from 'lucide-react';

/**
 * Presents the final verdict, scores, and judge/jury reasoning once the trial concludes.
 *
 * @param {object} props - Component props.
 * @param {object} props.result - Final verdict payload with scores and reasoning.
 * @returns {JSX.Element} The verdict presentation.
 */
const VerdictSection = ({ result }) => {
  const isLegendary = result.final_weighted_score > 100;
  const isGuilty =
    result.final_ruling.toLowerCase().includes('guilty') &&
    !result.final_ruling.toLowerCase().includes('not');

  return (
    <div
      className={`p-8 rounded-xl border-4 text-center relative overflow-hidden animate-in zoom-in ${
        isLegendary ? 'bg-amber-50 border-amber-400' : 'bg-slate-50 border-slate-300'
      }`}
    >
      {isLegendary && (
        <div className="absolute top-0 left-0 w-full bg-amber-400 text-amber-900 text-xs font-black uppercase tracking-widest py-1">
          Legendary Outcome
        </div>
      )}

      <h2 className={`text-4xl font-black uppercase mb-2 mt-4 ${isGuilty ? 'text-red-700' : 'text-green-700'}`}>
        {result.final_ruling}
      </h2>
      <div className="text-6xl font-black text-slate-800 mb-6">
        {Math.round(result.final_weighted_score)}
        <span className="text-lg text-slate-400 font-normal">/100</span>
      </div>

      {result.achievement_title && (
        <div className="inline-block bg-white px-4 py-2 rounded-full border border-amber-300 text-amber-600 font-bold text-sm mb-6 shadow-sm">
          <Trophy className="w-4 h-4 inline mr-2" /> {result.achievement_title}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        <div className="bg-white p-4 rounded border border-slate-200">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Judge's Opinion</h4>
          <p className="font-serif text-slate-700 text-sm">"{result.judge_opinion}"</p>
        </div>
        {result.jury_verdict !== 'N/A' && (
          <div className="bg-white p-4 rounded border border-slate-200">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Jury Reasoning</h4>
            <p className="font-serif text-slate-700 text-sm">"{result.jury_reasoning}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerdictSection;
