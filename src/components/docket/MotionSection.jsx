import { useEffect, useState } from 'react';
import ActionFooter from '../layout/ActionFooter';

/** @typedef {import('../../lib/types').MotionResult} MotionResult */

/**
 * Collects and displays the pre-trial motion exchange and the judge's ruling.
 *
 * @param {object} props - Component props.
 * @param {(text: string) => void} props.onSubmitStep - Callback to submit the current text.
 * @param {MotionResult | null} props.ruling - Judge ruling payload.
 * @param {boolean} props.isLocked - Whether the motion phase is finalized.
 * @param {string} props.motionPhase - Current motion exchange phase.
 * @param {string} props.motionText - Motion text stored in the docket history.
 * @param {'defense' | 'prosecution'} props.motionBy - Role that filed the motion.
 * @param {string} props.rebuttalText - Rebuttal text stored in the docket history.
 * @param {'defense' | 'prosecution'} props.rebuttalBy - Role that filed the rebuttal.
 * @param {'defense' | 'prosecution'} props.playerRole - The current player's role.
 * @param {boolean} props.isLoading - Whether a motion-related request is in flight.
 * @returns {JSX.Element} The motion section UI.
 */
const MotionSection = ({
  onSubmitStep,
  ruling,
  isLocked,
  motionPhase,
  motionText = '',
  motionBy,
  rebuttalText = '',
  rebuttalBy,
  playerRole,
  isLoading,
}) => {
  const [text, setText] = useState('');
  const isMotionStep = motionPhase === 'motion_submission';
  const expectedRole = isMotionStep ? motionBy : rebuttalBy;
  const isPlayerTurn = expectedRole === playerRole;
  const roleLabel = (role) => (role === 'defense' ? 'Defense' : 'Prosecution');

  useEffect(() => {
    setText('');
  }, [motionPhase]);

  if (isLocked) {
    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-6 animate-in fade-in">
        <div className="flex-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">
            {roleLabel(motionBy)} Motion
          </h4>
          <p className="font-serif text-slate-700 italic">"{motionText}"</p>
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-1 mt-4">
            {roleLabel(rebuttalBy)} Rebuttal
          </h4>
          <p className="font-serif text-slate-700 italic">"{rebuttalText}"</p>
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
        Draft a pre-trial motion to <strong>Dismiss</strong> or <strong>Suppress Evidence</strong>, then rebut the response.
      </p>
      <div className="space-y-4 mb-4">
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">
            {roleLabel(motionBy)} Motion
          </h4>
          {motionText ? (
            <p className="font-serif text-slate-700 italic">"{motionText}"</p>
          ) : (
            <p className="text-xs text-slate-400 italic">Pending submission.</p>
          )}
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">
            {roleLabel(rebuttalBy)} Rebuttal
          </h4>
          {rebuttalText ? (
            <p className="font-serif text-slate-700 italic">"{rebuttalText}"</p>
          ) : (
            <p className="text-xs text-slate-400 italic">Pending submission.</p>
          )}
        </div>
      </div>
      {isPlayerTurn ? (
        <>
          <textarea
            className="w-full h-32 p-3 border border-slate-300 rounded font-serif text-slate-800 mb-3 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder={
              isMotionStep
                ? 'Your Honor, the defense moves to...'
                : 'The response to the motion is...'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <ActionFooter>
            <button
              onClick={() => onSubmitStep(text)}
              disabled={!text.trim()}
              className="bg-indigo-600 text-white px-6 py-2 rounded font-bold text-sm hover:bg-indigo-700"
            >
              {isMotionStep ? 'File Motion' : 'File Rebuttal'}
            </button>
          </ActionFooter>
        </>
      ) : (
        <div className="text-sm text-slate-500 italic">
          {isLoading
            ? 'Opposing counsel is drafting...'
            : `Awaiting ${roleLabel(expectedRole)} submission.`}
        </div>
      )}
    </div>
  );
};

export default MotionSection;
