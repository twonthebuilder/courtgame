/** @typedef {import('../../lib/types').Juror} Juror */

/**
 * Manages jury selection presentation for voir dire and displays seated jurors when locked.
 *
 * @param {object} props - Component props.
 * @param {Juror[]} props.pool - Full juror pool.
 * @param {number[]} props.seatedIds - IDs of seated jurors.
 * @param {number[]} props.opponentStrikes - Opposing counsel strike IDs.
 * @param {(id: number) => void} props.onStrike - Callback to strike/unstrike a juror.
 * @param {number[]} props.myStrikes - Player strike IDs.
 * @param {boolean} props.isLocked - Whether jury selection is finalized.
 * @param {string} props.judgeComment - Judge comment after selection.
 * @returns {JSX.Element} The jury selection UI.
 */
const JurySection = ({
  pool,
  seatedIds,
  opponentStrikes,
  onStrike,
  myStrikes,
  isLocked,
  judgeComment,
}) => {
  if (isLocked) {
    const seated = pool.filter((j) => seatedIds.includes(j.id));
    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-slate-700 text-lg mb-1">Seated Jury</h3>
            <p className="text-sm text-slate-500 italic">"{judgeComment}"</p>
          </div>
          <div className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-400 font-bold uppercase">
            Voir Dire Complete
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {seated.map((j) => (
            <div key={j.id} className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
              <div className="font-bold text-slate-800">{j.name}</div>
              <div className="text-xs text-slate-500 uppercase">{j.job}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex gap-4">
          <span>Defense Strikes: {myStrikes.length}</span>
          <span>Prosecution Strikes: {opponentStrikes.length}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
      <p className="text-sm text-slate-600 mb-4">
        Select <strong>2 jurors</strong> to strike from the pool. Opposing counsel will do the same.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {pool.map((j) => (
          <button
            key={j.id}
            onClick={() => onStrike(j.id)}
            className={`p-3 rounded border-2 text-left transition-all ${
              myStrikes.includes(j.id)
                ? 'border-red-500 bg-red-50 relative'
                : 'border-slate-200 hover:border-amber-400'
            }`}
          >
            {myStrikes.includes(j.id) && (
              <div className="absolute top-1 right-1 text-red-600 font-black text-xs">X</div>
            )}
            <div className="font-bold text-slate-800 text-sm truncate">{j.name}</div>
            <div className="text-xs text-slate-500 uppercase font-bold mb-1 truncate">
              {j.job}, {j.age}
            </div>
            <div className="text-xs text-slate-600 italic leading-tight">"{j.bias_hint}"</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default JurySection;
