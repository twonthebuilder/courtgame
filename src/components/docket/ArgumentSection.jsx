import { useState } from 'react';
import { Gavel as GavelIcon } from 'lucide-react';

/**
 * Collects the closing argument and displays it once the trial phase is locked.
 *
 * @param {object} props - Component props.
 * @param {(text: string) => void} props.onSubmit - Callback to submit the argument text.
 * @param {boolean} props.isLocked - Whether the trial phase is finalized.
 * @param {boolean} props.isJuryTrial - Whether the case is a jury trial.
 * @returns {JSX.Element} The argument section UI.
 */
const ArgumentSection = ({ onSubmit, isLocked, isJuryTrial }) => {
  const [text, setText] = useState('');

  if (isLocked) {
    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200 animate-in fade-in">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Closing Argument</h4>
        <p className="font-serif text-slate-800 whitespace-pre-wrap">{text}</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
      <p className="text-sm text-slate-600 mb-3">
        {isJuryTrial ? 'Address the Jury (Facts) and Judge (Law).' : 'Address the Judge (Law & Facts).'}
      </p>
      <textarea
        className="w-full h-48 p-4 border border-slate-300 rounded font-serif text-lg text-slate-800 mb-4 focus:ring-2 focus:ring-amber-500 outline-none"
        placeholder="Ladies and Gentlemen..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex justify-end">
        <button
          onClick={() => onSubmit(text)}
          disabled={!text.trim()}
          className="bg-amber-500 text-white px-8 py-3 rounded font-bold hover:bg-amber-600 flex items-center gap-2"
        >
          Rest Case <GavelIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ArgumentSection;
