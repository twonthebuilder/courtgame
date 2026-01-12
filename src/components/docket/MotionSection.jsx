import { useState } from 'react';
import ActionFooter from '../layout/ActionFooter';

/** @typedef {import('../../lib/types').MotionResult} MotionResult */

/**
 * Collects and displays the player's pre-trial motion and the judge's ruling.
 *
 * @param {object} props - Component props.
 * @param {(text: string) => void} props.onSubmit - Callback to submit the motion text.
 * @param {MotionResult} props.ruling - Judge ruling payload.
 * @param {boolean} props.isLocked - Whether the motion phase is finalized.
 * @returns {JSX.Element} The motion section UI.
 */
const MotionSection = ({ onSubmit, ruling, isLocked }) => {
  const [text, setText] = useState('');

  if (isLocked) {
    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-6 animate-in fade-in">
        <div className="flex-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Your Motion</h4>
          <p className="font-serif text-slate-700 italic">"{text}"</p>
        </div>
        <div className="w-full md:w-1/3 bg-slate-50 p-4 rounded border border-slate-200 relative overflow-hidden">
          <div
            className={`absolute top-2 right-2 border-2 px-2 py-1 rounded text-xs font-black uppercase tracking-widest -rotate-12 ${
              ruling.ruling === 'GRANTED'
                ? 'border-green-600 text-green-600'
                : ruling.ruling === 'DENIED'
                  ? 'border-red-600 text-red-600'
                  : 'border-amber-600 text-amber-600'
            }`}
          >
            {ruling.ruling}
          </div>
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Judge's Ruling</h4>
          <p className="text-sm text-slate-800 font-medium mt-6">"{ruling.outcome_text}"</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
      <p className="text-sm text-slate-600 mb-3">
        Draft a pre-trial motion to <strong>Dismiss</strong> or <strong>Suppress Evidence</strong>.
      </p>
      <textarea
        className="w-full h-32 p-3 border border-slate-300 rounded font-serif text-slate-800 mb-3 focus:ring-2 focus:ring-indigo-500 outline-none"
        placeholder="Your Honor, the defense moves to..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <ActionFooter>
        <button
          onClick={() => onSubmit(text)}
          disabled={!text.trim()}
          className="bg-indigo-600 text-white px-6 py-2 rounded font-bold text-sm hover:bg-indigo-700"
        >
          File Motion
        </button>
      </ActionFooter>
    </div>
  );
};

export default MotionSection;
