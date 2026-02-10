import { useEffect, useState } from 'react';
import ActionFooter from '../layout/ActionFooter';
import ExpandableMarkdown from '../shared/ExpandableMarkdown';
import ResultCard from '../shared/ResultCard';

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
  const hasRuling = Boolean(ruling);
  const isPhaseLocked = isLocked || hasRuling;
  const expectedRole = isMotionStep ? motionBy : rebuttalBy;
  const isPlayerTurn = expectedRole === playerRole;
  const roleLabel = (role) => (role === 'defense' ? 'Defense' : 'Prosecution');
  const submissionLabel = isMotionStep ? 'Motion' : 'Rebuttal';
  const playerSubmissionLabel = `${roleLabel(playerRole)} ${submissionLabel}`;
  const playerPlaceholder = isMotionStep
    ? playerRole === 'defense'
      ? 'Your Honor, the defense moves to...'
      : 'Your Honor, the prosecution moves to...'
    : playerRole === 'defense'
      ? 'The defense rebuts the motion by...'
      : 'The prosecution rebuts the motion by...';

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText('');
  }, [motionPhase, isPhaseLocked]);

  if (isPhaseLocked) {
    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-6 animate-in fade-in">
        <div className="flex-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">
            {roleLabel(motionBy)} Motion
          </h4>
          <ExpandableMarkdown
            text={motionText}
            className="font-serif text-slate-700 italic before:content-['“'] before:mr-1 after:content-['”'] after:ml-1"
          />
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-1 mt-4">
            {roleLabel(rebuttalBy)} Rebuttal
          </h4>
          <ExpandableMarkdown
            text={rebuttalText}
            className="font-serif text-slate-700 italic before:content-['“'] before:mr-1 after:content-['”'] after:ml-1"
          />
        </div>
        <ResultCard title="Judge's Ruling" className="w-full md:w-1/3 bg-slate-50 relative overflow-hidden">
          {hasRuling ? (
            <>
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
              <ExpandableMarkdown
                text={ruling.outcome_text}
                className="text-sm text-slate-800 font-medium mt-6 break-words before:content-['“'] before:mr-1 after:content-['”'] after:ml-1"
              />
            </>
          ) : (
            <p className="text-sm text-slate-500 italic mt-6">
              Awaiting the court's decision.
            </p>
          )}
        </ResultCard>
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
            <ExpandableMarkdown
              text={motionText}
              className="font-serif text-slate-700 italic before:content-['“'] before:mr-1 after:content-['”'] after:ml-1"
            />
          ) : (
            <p className="text-xs text-slate-400 italic">Pending submission.</p>
          )}
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">
            {roleLabel(rebuttalBy)} Rebuttal
          </h4>
          {rebuttalText ? (
            <ExpandableMarkdown
              text={rebuttalText}
              className="font-serif text-slate-700 italic before:content-['“'] before:mr-1 after:content-['”'] after:ml-1"
            />
          ) : (
            <p className="text-xs text-slate-400 italic">Pending submission.</p>
          )}
        </div>
      </div>
      {isPlayerTurn ? (
        <>
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">
            Your {playerSubmissionLabel}
          </p>
          <textarea
            className="w-full h-32 p-3 border border-slate-300 rounded font-serif text-slate-800 mb-3 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder={playerPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <ActionFooter>
            <button
              onClick={() => onSubmitStep(text)}
              disabled={!text.trim()}
              className="bg-indigo-600 text-white px-6 py-2 rounded font-bold text-sm hover:bg-indigo-700"
            >
              {isMotionStep
                ? `File ${roleLabel(playerRole)} Motion`
                : `File ${roleLabel(playerRole)} Rebuttal`}
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
