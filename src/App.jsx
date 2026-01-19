import { Component, useCallback, useEffect, useRef, useState } from 'react';
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
import MainMenu from './components/shell/MainMenu';
import PostRun from './components/shell/PostRun';
import SetupHub from './components/shell/SetupHub';
import DebugOverlay from './components/DebugOverlay';
import DebugToast from './components/ui/DebugToast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import LoadingView from './components/ui/LoadingView';
import useGameState, { normalizeSanctionsState } from './hooks/useGameState';
import { GAME_STATES } from './lib/constants';
import { debugEnabled } from './lib/debugStore';
import { loadPlayerProfile } from './lib/persistence';

/** @typedef {import('./lib/types').HistoryState} HistoryState */

/* ========================================================================
   MODULE: App.jsx
   Action: Main application logic and state management.
   ======================================================================== */

const appShellState = Object.freeze({
  MainMenu: 'MainMenu',
  SetupHub: 'SetupHub',
  Run: 'Run',
  PostRun: 'PostRun',
});

class DebugOverlayErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (debugEnabled()) {
      console.error('[DebugOverlay] crashed', error);
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const RunShell = ({
  startPayload,
  onExitToMenu,
  onShellEvent,
  onDebugData,
  onRunInitialized,
}) => {
  const debugLogsEnabled = debugEnabled();
  const [docketNumber] = useState(() => Math.floor(Math.random() * 90000) + 10000);
  const scrollRef = useRef(null);
  const didStartRef = useRef(false);
  const startPayloadRef = useRef(startPayload);
  const renderCountRef = useRef(0);
  const gameStateData = useGameState({ onShellEvent });
  const {
    gameState,
    config,
    error,
    loadingMsg,
    copied,
    debugBanner,
    generateCase,
    submitStrikes,
    submitMotionStep,
    triggerAiMotionSubmission,
    requestMotionRuling,
    submitArgument,
    handleCopyFull,
    resetGame,
    toggleStrikeSelection,
  } = gameStateData;
  /** @type {HistoryState} */
  const history = gameStateData.history;
  const notifiedInitRef = useRef(false);

  const handleReset = () => {
    resetGame();
    onExitToMenu();
  };

  const beginRun = useCallback(async (payload) => {
    if (!payload || didStartRef.current) return;
    didStartRef.current = true;
    if (debugLogsEnabled) {
      console.count('RunShell generateCase');
      console.info('[RunShell] generateCase start', {
        timestamp: new Date().toISOString(),
        appMode: payload.difficulty,
        role: payload.role,
        configSnapshot: {
          difficulty: payload.difficulty,
          jurisdiction: payload.jurisdiction,
          courtType: payload.courtType,
        },
      });
    }
    await generateCase(
      payload.role,
      payload.difficulty,
      payload.jurisdiction,
      payload.courtType
    );
  }, [debugLogsEnabled, generateCase]);

  useEffect(() => {
    beginRun(startPayloadRef.current);
  }, [beginRun]);

  useEffect(() => {
    renderCountRef.current += 1;
  });

  useEffect(() => {
    if (!debugLogsEnabled) return undefined;
    console.info('[RunShell] mounted', { timestamp: new Date().toISOString() });
    return () => {
      console.info('[RunShell] unmounted', { timestamp: new Date().toISOString() });
    };
  }, [debugLogsEnabled]);

  useEffect(() => {
    if (!debugLogsEnabled || !startPayload) return undefined;
    renderCountRef.current = 0;
    const intervalId = setInterval(() => {
      const renderCount = renderCountRef.current;
      renderCountRef.current = 0;
      console.info('[RunShell] renders/sec', {
        timestamp: new Date().toISOString(),
        count: renderCount,
        role: startPayload?.role ?? null,
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [debugLogsEnabled, startPayload]);

  useEffect(() => {
    if (gameState === GAME_STATES.PLAYING && !notifiedInitRef.current) {
      notifiedInitRef.current = true;
      onRunInitialized?.();
    }
  }, [gameState, onRunInitialized]);

  useEffect(() => {
    if (!onDebugData) return;
    onDebugData({
      gameState,
      config,
      history,
      sanctionsState: gameStateData.sanctionsState,
    });
  }, [
    config,
    gameState,
    gameStateData.sanctionsState,
    history,
    onDebugData,
  ]);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [history, loadingMsg]);

  useEffect(() => {
    if (!history.motion?.motionPhase || history.motion.motionPhase === 'motion_ruling_locked') return;

    const isMotionStep = history.motion.motionPhase === 'motion_submission';
    const expectedRole = isMotionStep ? history.motion.motionBy : history.motion.rebuttalBy;
    const isPlayerTurn = expectedRole === config.role;
    const missingText = isMotionStep ? !history.motion.motionText : !history.motion.rebuttalText;

    if (!loadingMsg && !isPlayerTurn && missingText) {
      triggerAiMotionSubmission();
    }

    if (
      !loadingMsg &&
      history.motion.motionPhase === 'rebuttal_submission' &&
      history.motion.motionText &&
      history.motion.rebuttalText
    ) {
      requestMotionRuling();
    }
  }, [
    config.role,
    history.motion?.motionBy,
    history.motion?.motionPhase,
    history.motion?.motionText,
    history.motion?.rebuttalBy,
    history.motion?.rebuttalText,
    loadingMsg,
    requestMotionRuling,
    triggerAiMotionSubmission,
  ]);

  if (gameState !== GAME_STATES.PLAYING) {
    return <InitializationScreen role={startPayload?.role ?? null} />;
  }

  // --- MAIN RENDER ---

  const runView = (
    <div className="min-h-screen bg-neutral-100 text-slate-900 font-sans pb-24">
      {/* Navbar */}
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleReset}>
            <Scale className="w-6 h-6 text-amber-500" />
            <span className="font-bold tracking-tight">
              POCKET<span className="text-amber-500">COURT</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleCopyFull(docketNumber)}
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
      <main className="w-full max-w-3xl md:max-w-4xl xl:max-w-5xl mx-auto p-4 md:p-8">
        {/* Paper Container */}
        <PaperContainer>
          {/* Paper Header */}
          <DocketHeader
            title={history.case.title}
            jurisdiction={config.jurisdiction}
            docketNumber={docketNumber}
          />
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-red-600">Action error</p>
              <p className="mt-2">{error}</p>
            </div>
          )}

          {/* 1. Case Info */}
          <PhaseSection title="Case Information" icon={BookOpen}>
            <CaseHeader data={history.case} counselNotes={history.counselNotes} />
          </PhaseSection>

          {/* 2. Jury Section (If Applicable) */}
          {!history.jury.skipped && (
            <PhaseSection title="Jury Selection" icon={Users}>
              <JurySection
                pool={history.jury.pool}
                isLocked={history.jury.locked}
                myStrikes={history.jury.myStrikes || []}
                opponentStrikes={history.jury.opponentStrikes || []}
                judgeComment={history.jury.comment}
                onStrike={toggleStrikeSelection}
                playerRole={config.role}
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
                motionPhase={history.motion.motionPhase}
                motionText={history.motion.motionText}
                motionBy={history.motion.motionBy}
                rebuttalText={history.motion.rebuttalText}
                rebuttalBy={history.motion.rebuttalBy}
                ruling={history.motion.ruling}
                playerRole={config.role}
                isLoading={Boolean(loadingMsg)}
                onSubmitStep={submitMotionStep}
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
                submittedText={history.trial.text}
              />
            </PhaseSection>
          )}

          {/* 5. Verdict Section */}
          {history.trial && history.trial.locked && (
            <PhaseSection title="Final Judgment" icon={Scale} className="border-none mb-0 pb-0">
              <VerdictSection result={history.trial.verdict} />
              <ActionFooter className="mt-12 justify-center pt-8 border-t border-slate-100">
                <button
                  onClick={handleReset}
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
      <DebugToast message={debugBanner} />
    </div>
  );

  return runView;
};

/**
 * Main Pocket Court application component.
 *
 * @returns {JSX.Element} The app shell with game state routing.
 */
export default function PocketCourt() {
  const debugLogsEnabled = debugEnabled();
  const renderCountRef = useRef(0);
  const [shellState, setShellState] = useState(appShellState.MainMenu);
  const [setupError, setSetupError] = useState(null);
  const [sanctionsSnapshot, setSanctionsSnapshot] = useState(() => {
    const stored = loadPlayerProfile()?.sanctions ?? null;
    return stored ? normalizeSanctionsState(stored, Date.now()) : null;
  });
  const [startPayload, setStartPayload] = useState(null);
  const [runStartInProgress, setRunStartInProgress] = useState(false);
  const [runOutcome, setRunOutcome] = useState(null);
  const [debugPayload, setDebugPayload] = useState(null);
  const [debugOverlayMounted, setDebugOverlayMounted] = useState(false);

  const transitionShell = useCallback((nextState) => {
    if (nextState !== appShellState.Run) {
      setDebugPayload(null);
      setDebugOverlayMounted(false);
    }
    setShellState(nextState);
  }, []);

  const profileSnapshot = loadPlayerProfile();

  const handleStart = (role, difficulty, jurisdiction, courtType) => {
    setSetupError(null);
    setRunStartInProgress(true);
    setStartPayload({ role, difficulty, jurisdiction, courtType });
    transitionShell(appShellState.Run);
  };

  const handleRunInitialized = useCallback(() => {
    setRunStartInProgress(false);
  }, []);

  const handleDebugOverlayMounted = useCallback(() => {
    setDebugOverlayMounted(true);
  }, []);

  const handleShellEvent = useCallback(
    (event) => {
      if (event?.type === 'sanctions_sync') {
        setSanctionsSnapshot(event.payload ?? null);
      }
      if (event?.type === 'start_failed') {
        setSetupError(event.message ?? 'Unable to start the case.');
        setRunStartInProgress(false);
        setStartPayload(null);
        transitionShell(appShellState.SetupHub);
      }
      if (event?.type === 'RUN_ENDED') {
        setStartPayload(null);
        setRunOutcome(event.payload ?? null);
        transitionShell(appShellState.PostRun);
      }
    },
    [transitionShell]
  );

  const exitToMenu = useCallback(() => {
    setStartPayload(null);
    setRunOutcome(null);
    transitionShell(appShellState.MainMenu);
  }, [transitionShell]);

  const startNewCase = useCallback(() => {
    setRunOutcome(null);
    transitionShell(appShellState.SetupHub);
  }, [transitionShell]);

  const returnToMenu = useCallback(() => {
    setRunOutcome(null);
    transitionShell(appShellState.MainMenu);
  }, [transitionShell]);

  useEffect(() => {
    renderCountRef.current += 1;
  });

  useEffect(() => {
    if (!debugLogsEnabled || shellState !== appShellState.Run) return undefined;
    renderCountRef.current = 0;
    const intervalId = setInterval(() => {
      const renderCount = renderCountRef.current;
      renderCountRef.current = 0;
      console.info('[App] renders/sec', {
        timestamp: new Date().toISOString(),
        count: renderCount,
        role: startPayload?.role ?? null,
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [debugLogsEnabled, shellState, startPayload?.role]);

  let shellView = null;

  switch (shellState) {
    case appShellState.MainMenu:
      shellView = (
        <MainMenu onPlay={() => transitionShell(appShellState.SetupHub)} />
      );
      break;
    case appShellState.SetupHub:
      shellView = (
        <SetupHub
          onStart={handleStart}
          error={setupError}
          sanctionsState={sanctionsSnapshot}
          profile={profileSnapshot}
          isInitializing={runStartInProgress}
          initializingRole={startPayload?.role ?? null}
        />
      );
      break;
    case appShellState.PostRun:
      shellView = (
        <PostRun
          outcome={runOutcome}
          sanctionsState={sanctionsSnapshot}
          profile={profileSnapshot}
          onNewCase={startNewCase}
          onMainMenu={returnToMenu}
        />
      );
      break;
    case appShellState.Run:
    default:
      shellView = (
        <RunShell
          startPayload={startPayload}
          onExitToMenu={exitToMenu}
          onShellEvent={handleShellEvent}
          onDebugData={setDebugPayload}
          onRunInitialized={handleRunInitialized}
        />
      );
      break;
  }

  return (
    <ErrorBoundary>
      <>
        {shellView}
        {import.meta.env.DEV && shellState === appShellState.Run && debugOverlayMounted && (
          <div className="fixed bottom-2 left-2 z-[90] rounded bg-slate-900/70 px-2 py-1 text-[10px] uppercase tracking-widest text-white shadow">
            debug mounted
          </div>
        )}
        {shellState === appShellState.Run && (
          <DebugOverlayErrorBoundary>
            <DebugOverlay
              gameState={debugPayload?.gameState}
              config={debugPayload?.config}
              history={debugPayload?.history}
              sanctionsState={debugPayload?.sanctionsState}
              onMounted={handleDebugOverlayMounted}
            />
          </DebugOverlayErrorBoundary>
        )}
      </>
    </ErrorBoundary>
  );
}
