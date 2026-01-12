import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ClipboardCopy, FileText, Gavel, RefreshCw, Scale, Users } from 'lucide-react';
import ArgumentSection from './components/docket/ArgumentSection';
import CaseHeader from './components/docket/CaseHeader';
import JurySection from './components/docket/JurySection';
import MotionSection from './components/docket/MotionSection';
import VerdictSection from './components/docket/VerdictSection';
import ActionFooter from './components/layout/ActionFooter';
import DocketHeader from './components/layout/DocketHeader';
import PaperContainer from './components/layout/PaperContainer';
import PhaseSection from './components/layout/PhaseSection';
import InitializationScreen from './components/screens/InitializationScreen';
import StartScreen from './components/screens/StartScreen';
import LoadingView from './components/ui/LoadingView';
import useGameState from './hooks/useGameState';

/** @typedef {import('./lib/types').HistoryState} HistoryState */

/* ========================================================================
   MODULE: App.jsx
   Action: Main application logic and state management.
   ======================================================================== */

/**
 * Main Pocket Court application component.
 *
 * @returns {JSX.Element} The app shell with game state routing.
 */
export default function PocketCourt() {
  const [docketNumber] = useState(() => Math.floor(Math.random() * 90000) + 10000);
  const scrollRef = useRef(null);
  const gameStateData = useGameState();
  const {
    gameState,
    config,
    loadingMsg,
    copied,
    generateCase,
    submitStrikes,
    submitMotion,
    submitArgument,
    handleCopyFull,
    resetGame,
    toggleStrikeSelection,
  } = gameStateData;
  /** @type {HistoryState} */
  const history = gameStateData.history;

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [history, loadingMsg]);

  // --- MAIN RENDER ---

  if (gameState === 'start') return <StartScreen onStart={generateCase} />;
  if (gameState === 'initializing') return <InitializationScreen role={config.role} />;

  return (
    <div className="min-h-screen bg-neutral-100 text-slate-900 font-sans pb-24">
      {/* Navbar */}
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetGame}>
            <Scale className="w-6 h-6 text-amber-500" />
            <span className="font-bold tracking-tight">
              POCKET<span className="text-amber-500">COURT</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyFull}
              className="flex items-center gap-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded transition-colors border border-slate-700"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <ClipboardCopy className="w-4 h-4 text-slate-400" />
              )}
              {copied ? 'COPIED' : 'COPY DOCKET'}
            </button>
          </div>
        </div>
      </header>

      {/* THE LIVING DOCKET */}
      <main className="max-w-3xl mx-auto p-4 md:p-8">
        {/* Paper Container */}
        <PaperContainer>
          {/* Paper Header */}
          <DocketHeader
            title={history.case.title}
            jurisdiction={config.jurisdiction}
            docketNumber={docketNumber}
          />

          {/* 1. Case Info */}
          <PhaseSection title="Case Information" icon={BookOpen}>
            <CaseHeader data={history.case} />
          </PhaseSection>

          {/* 2. Jury Section (If Applicable) */}
          {!history.jury.skipped && (
            <PhaseSection title="Jury Selection" icon={Users}>
              <JurySection
                pool={history.case.jurors}
                isLocked={history.jury.locked}
                myStrikes={history.jury.myStrikes || []}
                opponentStrikes={history.jury.opponentStrikes || []}
                seatedIds={history.jury.seatedIds || []}
                judgeComment={history.jury.comment}
                onStrike={toggleStrikeSelection}
              />
              {!history.jury.locked && (
                <ActionFooter>
                  <button
                    onClick={() => submitStrikes(history.jury.myStrikes)}
                    disabled={!history.jury.myStrikes || history.jury.myStrikes.length !== 2}
                    className="bg-amber-500 text-white font-bold py-2 px-6 rounded hover:bg-amber-600 disabled:opacity-50"
                  >
                    Confirm Strikes
                  </button>
                </ActionFooter>
              )}
            </PhaseSection>
          )}

          {/* 3. Motions Section */}
          {/* Appears if jury skipped OR jury locked */}
          {(history.jury.skipped || history.jury.locked) && (
            <PhaseSection title="Pre-Trial Motions" icon={FileText}>
              <MotionSection
                isLocked={history.motion.locked}
                ruling={history.motion.ruling}
                onSubmit={submitMotion}
              />
            </PhaseSection>
          )}

          {/* 4. Trial Section */}
          {/* Appears if motion locked */}
          {history.motion && history.motion.locked && (
            <PhaseSection title="Trial Phase" icon={Gavel}>
              <ArgumentSection
                isLocked={history.trial.locked}
                isJuryTrial={history.case.is_jury_trial}
                onSubmit={submitArgument}
              />
            </PhaseSection>
          )}

          {/* 5. Verdict Section */}
          {history.trial && history.trial.locked && (
            <PhaseSection title="Final Judgment" icon={Scale} className="border-none mb-0 pb-0">
              <VerdictSection result={history.trial.verdict} />
              <ActionFooter className="mt-12 justify-center pt-8 border-t border-slate-100">
                <button
                  onClick={resetGame}
                  className="text-slate-400 hover:text-slate-800 font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" /> Start New Case
                </button>
              </ActionFooter>
            </PhaseSection>
          )}

          {/* Loading Indicator */}
          {loadingMsg && (
            <div ref={scrollRef}>
              <LoadingView message={loadingMsg} />
            </div>
          )}

          {/* Invisible div for auto-scrolling */}
          <div ref={scrollRef} />
        </PaperContainer>
      </main>
    </div>
  );
}
