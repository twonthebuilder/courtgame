import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ClipboardCopy, FileText, Gavel, RefreshCw, Scale, Users } from 'lucide-react';
import ArgumentSection from './components/docket/ArgumentSection';
import CaseHeader from './components/docket/CaseHeader';
import JurySection from './components/docket/JurySection';
import MotionSection from './components/docket/MotionSection';
import VerdictSection from './components/docket/VerdictSection';
import InitializationScreen from './components/screens/InitializationScreen';
import StartScreen from './components/screens/StartScreen';
import DocketSection from './components/ui/DocketSection';
import LoadingView from './components/ui/LoadingView';
import { fetchWithRetry } from './lib/api';
import { copyToClipboard } from './lib/clipboard';
import { API_KEY, DEFAULT_GAME_CONFIG } from './lib/config';
import {
  getFinalVerdictPrompt,
  getGeneratorPrompt,
  getJuryStrikePrompt,
  getMotionPrompt,
} from './lib/prompts';

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
  const [gameState, setGameState] = useState('start'); // start, initializing, playing
  const [loadingMsg, setLoadingMsg] = useState(null);
  const [history, setHistory] = useState({});

  const [config, setConfig] = useState({ ...DEFAULT_GAME_CONFIG });
  const [_error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [docketNumber] = useState(() => Math.floor(Math.random() * 90000) + 10000);
  const scrollRef = useRef(null);

  // --- ACTIONS ---

  const generateCase = async (role, difficulty, jurisdiction) => {
    // 1. Move to Initialization Screen immediately
    setGameState('initializing');
    setError(null);
    setConfig({ role, difficulty, jurisdiction });

    try {
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Generate' }] }],
            systemInstruction: { parts: [{ text: getGeneratorPrompt(difficulty, jurisdiction, role) }] },
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      const data = JSON.parse(res.candidates[0].content.parts[0].text);

      setHistory({
        case: data,
        jury: data.is_jury_trial
          ? { pool: data.jurors, myStrikes: [], locked: false }
          : { skipped: true },
        motion: { locked: false }, // If skipped, we move straight to motions. If not skipped, motions waits for jury lock.
        trial: { locked: false },
      });

      // 2. Move to Docket View
      setGameState('playing');
    } catch (e) {
      console.error(e);
      setError('Docket creation failed. Please try again.');
      setGameState('start');
    }
  };

  const submitStrikes = async (strikes) => {
    setLoadingMsg('Judge is ruling on strikes...');
    try {
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Strike' }] }],
            systemInstruction: { parts: [{ text: getJuryStrikePrompt(history.case, strikes, config.role) }] },
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      const data = JSON.parse(res.candidates[0].content.parts[0].text);

      setHistory((prev) => ({
        ...prev,
        jury: {
          ...prev.jury,
          myStrikes: strikes,
          opponentStrikes: data.opponent_strikes,
          seatedIds: data.seated_juror_ids,
          comment: data.judge_comment,
          locked: true,
        },
        motion: { locked: false },
      }));
      setLoadingMsg(null);
    } catch (e) {
      console.error(e);
      setError('Strike failed.');
      setLoadingMsg(null);
    }
  };

  const submitMotion = async (text) => {
    setLoadingMsg('Filing motion...');
    try {
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Motion' }] }],
            systemInstruction: { parts: [{ text: getMotionPrompt(history.case, text, config.difficulty) }] },
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      const data = JSON.parse(res.candidates[0].content.parts[0].text);

      setHistory((prev) => ({
        ...prev,
        motion: { text, ruling: data, locked: true },
        trial: { locked: false },
      }));
      setLoadingMsg(null);
    } catch (e) {
      console.error(e);
      setError('Motion failed.');
      setLoadingMsg(null);
    }
  };

  const submitArgument = async (text) => {
    setLoadingMsg('The Court is deliberating...');
    try {
      const seatedJurors = history.jury.skipped
        ? []
        : history.case.jurors.filter((j) => history.jury.seatedIds.includes(j.id));
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Verdict' }] }],
            systemInstruction: {
              parts: [
                {
                  text: getFinalVerdictPrompt(
                    history.case,
                    history.motion.ruling,
                    seatedJurors,
                    text,
                    config.difficulty
                  ),
                },
              ],
            },
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      const data = JSON.parse(res.candidates[0].content.parts[0].text);

      setHistory((prev) => ({
        ...prev,
        trial: { text, verdict: data, locked: true },
      }));
      setLoadingMsg(null);
    } catch (e) {
      console.error(e);
      setError('Verdict failed.');
      setLoadingMsg(null);
    }
  };

  const handleCopyFull = () => {
    let log = `DOCKET: ${history.case.title}\nJUDGE: ${history.case.judge.name}\n\n`;
    log += `FACTS:\n${history.case.facts.join('\n')}\n\n`;

    if (history.jury && !history.jury.skipped && history.jury.locked) {
      log += `JURY SEATED (${history.jury.seatedIds.length}):\n${history.jury.comment}\n\n`;
    }

    if (history.motion && history.motion.locked) {
      log += `MOTION:\n"${history.motion.text}"\nRULING: ${history.motion.ruling.ruling} - "${history.motion.ruling.outcome_text}"\n\n`;
    }

    if (history.trial && history.trial.locked) {
      log += `ARGUMENT:\n"${history.trial.text}"\n\nVERDICT: ${history.trial.verdict.final_ruling} (Score: ${Math.round(history.trial.verdict.final_weighted_score)})\nOPINION: "${history.trial.verdict.judge_opinion}"`;
    }

    copyToClipboard(log);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setGameState('start')}>
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
        <div className="bg-white shadow-xl min-h-[80vh] p-8 md:p-12 relative animate-in fade-in slide-in-from-bottom-8 duration-700">
          {/* Paper Header */}
          <div className="border-b-4 border-slate-900 pb-4 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-4xl font-black font-serif text-slate-900 uppercase tracking-tighter leading-none">
                {history.case.title}
              </h1>
              <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">
                Official Docket • {config.jurisdiction}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-slate-400 uppercase">Docket No.</div>
              <div className="font-mono text-slate-600">{docketNumber}</div>
            </div>
          </div>

          {/* 1. Case Info */}
          <DocketSection title="Case Information" icon={BookOpen}>
            <CaseHeader data={history.case} />
          </DocketSection>

          {/* 2. Jury Section (If Applicable) */}
          {!history.jury.skipped && (
            <DocketSection title="Jury Selection" icon={Users}>
              <JurySection
                pool={history.case.jurors}
                isLocked={history.jury.locked}
                myStrikes={history.jury.myStrikes || []}
                opponentStrikes={history.jury.opponentStrikes || []}
                seatedIds={history.jury.seatedIds || []}
                judgeComment={history.jury.comment}
                onStrike={(id) => {
                  const current = history.jury.myStrikes || [];
                  if (current.includes(id)) {
                    setHistory((prev) => ({
                      ...prev,
                      jury: { ...prev.jury, myStrikes: current.filter((x) => x !== id) },
                    }));
                  } else if (current.length < 2) {
                    setHistory((prev) => ({
                      ...prev,
                      jury: { ...prev.jury, myStrikes: [...current, id] },
                    }));
                  }
                }}
              />
              {!history.jury.locked && (
                <div className="mt-4 text-right">
                  <button
                    onClick={() => submitStrikes(history.jury.myStrikes)}
                    disabled={!history.jury.myStrikes || history.jury.myStrikes.length !== 2}
                    className="bg-amber-500 text-white font-bold py-2 px-6 rounded hover:bg-amber-600 disabled:opacity-50"
                  >
                    Confirm Strikes
                  </button>
                </div>
              )}
            </DocketSection>
          )}

          {/* 3. Motions Section */}
          {/* Appears if jury skipped OR jury locked */}
          {(history.jury.skipped || history.jury.locked) && (
            <DocketSection title="Pre-Trial Motions" icon={FileText}>
              <MotionSection
                isLocked={history.motion.locked}
                ruling={history.motion.ruling}
                onSubmit={submitMotion}
              />
            </DocketSection>
          )}

          {/* 4. Trial Section */}
          {/* Appears if motion locked */}
          {history.motion && history.motion.locked && (
            <DocketSection title="Trial Phase" icon={Gavel}>
              <ArgumentSection
                isLocked={history.trial.locked}
                isJuryTrial={history.case.is_jury_trial}
                onSubmit={submitArgument}
              />
            </DocketSection>
          )}

          {/* 5. Verdict Section */}
          {history.trial && history.trial.locked && (
            <DocketSection title="Final Judgment" icon={Scale} className="border-none mb-0 pb-0">
              <VerdictSection result={history.trial.verdict} />
              <div className="mt-12 text-center pt-8 border-t border-slate-100">
                <button
                  onClick={() => setGameState('start')}
                  className="text-slate-400 hover:text-slate-800 font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" /> Start New Case
                </button>
              </div>
            </DocketSection>
          )}

          {/* Loading Indicator */}
          {loadingMsg && (
            <div ref={scrollRef}>
              <LoadingView message={loadingMsg} />
            </div>
          )}

          {/* Invisible div for auto-scrolling */}
          <div ref={scrollRef} />
        </div>
      </main>
    </div>
  );
}
