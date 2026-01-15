import { useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import { DEFAULT_GAME_CONFIG } from '../lib/config';
import {
  getLlmClientErrorMessage,
  parseCaseResponse,
  parseJuryResponse,
  parseMotionResponse,
  parseMotionTextResponse,
  parseVerdictResponse,
  requestLlmJson,
} from '../lib/llmClient';
import {
  getFinalVerdictPrompt,
  getGeneratorPrompt,
  getJuryStrikePrompt,
  getMotionPrompt,
  getOpposingCounselPrompt,
} from '../lib/prompts';

/** @typedef {import('../lib/types').CaseData} CaseData */
/** @typedef {import('../lib/types').HistoryState} HistoryState */
/** @typedef {import('../lib/types').Juror} Juror */
/** @typedef {import('../lib/types').MotionResult} MotionResult */
/** @typedef {import('../lib/types').VerdictResult} VerdictResult */

/**
 * Manage the Pocket Court game state and actions in one place.
 *
 * @returns {{
 *   gameState: string,
 *   history: HistoryState,
 *   config: {difficulty: string, jurisdiction: string, role: string},
 *   loadingMsg: string | null,
 *   error: string | null,
 *   copied: boolean,
 *   generateCase: (role: string, difficulty: string, jurisdiction: string) => Promise<void>,
 *   submitStrikes: (strikes: number[]) => Promise<void>,
 *   submitMotionStep: (text: string) => Promise<void>,
 *   triggerAiMotionSubmission: () => Promise<void>,
 *   requestMotionRuling: () => Promise<void>,
 *   submitArgument: (text: string) => Promise<void>,
 *   handleCopyFull: () => void,
 *   resetGame: () => void,
 *   toggleStrikeSelection: (id: number) => void,
 * }} Game state values and action handlers.
 */
const useGameState = () => {
  const [gameState, setGameState] = useState('start');
  const [loadingMsg, setLoadingMsg] = useState(null);
  const [history, setHistory] = useState(/** @type {HistoryState} */ ({ counselNotes: '' }));
  const [config, setConfig] = useState({ ...DEFAULT_GAME_CONFIG });
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  /**
   * Build the initial motion exchange state for the pre-trial phase.
   *
   * The exchange always follows defense motion -> prosecution rebuttal -> judge ruling.
   * Player role only determines whether the player or AI submits each step.
   *
   * @returns {HistoryState['motion']} Initialized motion state payload.
   */
  const createMotionState = () => ({
    motionText: '',
    motionBy: 'defense',
    rebuttalText: '',
    rebuttalBy: 'prosecution',
    ruling: null,
    motionPhase: 'motion_submission',
    locked: false,
  });

  /**
   * Return to the start screen and clear transient UI state.
   */
  const resetGame = () => {
    setGameState('start');
    setLoadingMsg(null);
    setError(null);
    setCopied(false);
    setHistory({ counselNotes: '' });
  };

  /**
   * Toggle a jury strike selection, enforcing the 2-strike limit.
   *
   * @param {number} id - Juror ID to toggle.
   */
  const toggleStrikeSelection = (id) => {
    setHistory((prev) => {
      const current = prev.jury?.myStrikes || [];
      if (current.includes(id)) {
        return { ...prev, jury: { ...prev.jury, myStrikes: current.filter((x) => x !== id) } };
      }
      if (current.length >= 2) return prev;
      return { ...prev, jury: { ...prev.jury, myStrikes: [...current, id] } };
    });
  };

  /**
   * Generate a new case and initialize the living docket.
   *
   * @param {string} role - Player role (defense or prosecution).
   * @param {string} difficulty - Difficulty setting.
   * @param {string} jurisdiction - Selected jurisdiction.
   * @returns {Promise<void>} Resolves once the case is generated.
   */
  const generateCase = async (role, difficulty, jurisdiction) => {
    setGameState('initializing');
    setError(null);
    setConfig({ role, difficulty, jurisdiction });

    try {
      const payload = await requestLlmJson({
        userPrompt: 'Generate',
        systemPrompt: getGeneratorPrompt(difficulty, jurisdiction, role),
        responseLabel: 'case',
      });
      /** @type {CaseData} */
      const data = parseCaseResponse(payload);

      setHistory({
        case: data,
        jury: data.is_jury_trial
          ? { pool: data.jurors, myStrikes: [], locked: false }
          : { skipped: true },
        motion: data.is_jury_trial ? { locked: false } : createMotionState(),
        counselNotes: '',
        trial: { locked: false },
      });

      setGameState('playing');
    } catch (err) {
      console.error(err);
      setError(getLlmClientErrorMessage(err, 'Docket creation failed. Please try again.'));
      setGameState('start');
    }
  };

  /**
   * Submit jury strikes and lock in the seated jurors.
   *
   * @param {number[]} strikes - Juror IDs selected for strikes.
   * @returns {Promise<void>} Resolves once strikes are processed.
   */
  const submitStrikes = async (strikes) => {
    setLoadingMsg('Judge is ruling on strikes...');
    try {
      const payload = await requestLlmJson({
        userPrompt: 'Strike',
        systemPrompt: getJuryStrikePrompt(history.case, strikes, config.role),
        responseLabel: 'jury',
      });
      const data = parseJuryResponse(payload);

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
        motion: createMotionState(),
      }));
      setLoadingMsg(null);
    } catch (err) {
      console.error(err);
      setError(getLlmClientErrorMessage(err, 'Strike failed.'));
      setLoadingMsg(null);
    }
  };

  /**
   * Submit the current motion exchange step for the player.
   *
   * @param {string} text - Motion or rebuttal text entered by the player.
   * @returns {Promise<void>} Resolves once the text is stored.
   */
  const submitMotionStep = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || !history.motion?.motionPhase) return;
    setError(null);

    const isMotionStep = history.motion.motionPhase === 'motion_submission';
    const expectedRole = isMotionStep ? history.motion.motionBy : history.motion.rebuttalBy;
    if (expectedRole !== config.role) {
      setError('It is not your turn to file this submission.');
      return;
    }

    setHistory((prev) => ({
      ...prev,
      motion: {
        ...prev.motion,
        motionText: isMotionStep ? trimmed : prev.motion.motionText,
        rebuttalText: isMotionStep ? prev.motion.rebuttalText : trimmed,
        motionPhase: isMotionStep ? 'rebuttal_submission' : prev.motion.motionPhase,
      },
    }));
  };

  /**
   * Trigger the AI submission for the current motion exchange step.
   *
   * @returns {Promise<void>} Resolves once the AI text is stored.
   */
  const triggerAiMotionSubmission = async () => {
    if (!history.motion?.motionPhase) return;
    setError(null);

    const isMotionStep = history.motion.motionPhase === 'motion_submission';
    const expectedRole = isMotionStep ? history.motion.motionBy : history.motion.rebuttalBy;
    if (expectedRole === config.role) return;

    setLoadingMsg(
      isMotionStep
        ? 'Opposing counsel is drafting a motion...'
        : 'Opposing counsel is drafting a rebuttal...'
    );
    try {
      const payload = await requestLlmJson({
        userPrompt: isMotionStep ? 'Draft motion' : 'Draft rebuttal',
        systemPrompt: getOpposingCounselPrompt(
          history.case,
          config.difficulty,
          history.motion.motionPhase,
          expectedRole,
          history.motion.motionText
        ),
        responseLabel: 'motion_text',
      });
      const data = parseMotionTextResponse(payload);

      setHistory((prev) => ({
        ...prev,
        motion: {
          ...prev.motion,
          motionText: isMotionStep ? data.text : prev.motion.motionText,
          rebuttalText: isMotionStep ? prev.motion.rebuttalText : data.text,
          motionPhase: isMotionStep ? 'rebuttal_submission' : prev.motion.motionPhase,
        },
      }));
      setLoadingMsg(null);
    } catch (err) {
      console.error(err);
      setError(getLlmClientErrorMessage(err, 'Motion drafting failed.'));
      setLoadingMsg(null);
    }
  };

  /**
   * Derive a short internal counsel note based on the motion posture and ruling.
   *
   * @param {HistoryState['motion']} motionState - Motion exchange state.
   * @param {MotionResult} ruling - Judge ruling payload.
   * @returns {string} Internal counsel notes (1-2 sentences).
   */
  const deriveCounselNotes = (motionState, ruling) => {
    if (!motionState || !ruling) return '';
    const motionSide = motionState.motionBy === 'prosecution' ? 'Prosecution' : 'Defense';
    const rebuttalSide = motionState.rebuttalBy === 'prosecution' ? 'Prosecution' : 'Defense';
    const rulingText = ruling.ruling ? ruling.ruling.toLowerCase() : 'ruled on';
    const outcomeSentence = ruling.outcome_text ? ` Outcome: ${ruling.outcome_text}` : '';

    return `Judge ${rulingText} the ${motionSide.toLowerCase()} motion after a ${rebuttalSide.toLowerCase()} rebuttal.${outcomeSentence}`.trim();
  };

  /**
   * Request the judge ruling after both motion texts are available.
   *
   * @returns {Promise<void>} Resolves once the ruling is stored.
   */
  const requestMotionRuling = async () => {
    if (!history.motion?.motionText || !history.motion?.rebuttalText) return;
    if (history.motion.motionPhase === 'motion_ruling_locked') return;
    setError(null);

    setLoadingMsg('Judge is ruling on the motion...');
    try {
      const payload = await requestLlmJson({
        userPrompt: 'Motion ruling',
        systemPrompt: getMotionPrompt(
          history.case,
          history.motion.motionText,
          history.motion.rebuttalText,
          config.difficulty,
          history.motion.motionBy,
          history.motion.rebuttalBy,
          config.role
        ),
        responseLabel: 'motion',
      });
      /** @type {MotionResult} */
      const data = parseMotionResponse(payload);

      setHistory((prev) => ({
        ...prev,
        motion: {
          ...prev.motion,
          ruling: data,
          motionPhase: 'motion_ruling_locked',
          locked: true,
        },
        counselNotes: deriveCounselNotes(prev.motion, data),
        trial: { ...prev.trial, locked: false },
      }));
      setLoadingMsg(null);
    } catch (err) {
      console.error(err);
      setError(getLlmClientErrorMessage(err, 'Motion ruling failed.'));
      setLoadingMsg(null);
    }
  };

  /**
   * Submit a closing argument and resolve the final verdict.
   *
   * @param {string} text - Closing argument text.
   * @returns {Promise<void>} Resolves once the verdict is stored.
   */
  const submitArgument = async (text) => {
    setLoadingMsg('The Court is deliberating...');
    try {
      /** @type {Juror[]} */
      const seatedJurors = history.jury?.skipped
        ? []
        : history.case?.jurors.filter((j) => history.jury?.seatedIds?.includes(j.id));
      const payload = await requestLlmJson({
        userPrompt: 'Verdict',
        systemPrompt: getFinalVerdictPrompt(
          history.case,
          history.motion.ruling,
          seatedJurors,
          text,
          config.difficulty
        ),
        responseLabel: 'verdict',
      });
      /** @type {VerdictResult} */
      const data = parseVerdictResponse(payload);

      setHistory((prev) => ({
        ...prev,
        trial: { text, verdict: data, locked: true },
      }));
      setLoadingMsg(null);
    } catch (err) {
      console.error(err);
      setError(getLlmClientErrorMessage(err, 'Verdict failed.'));
      setLoadingMsg(null);
    }
  };

  /**
   * Copy the full docket history to the clipboard.
   */
  const handleCopyFull = () => {
    let log = `DOCKET: ${history.case.title}\nJUDGE: ${history.case.judge.name}\n\n`;
    log += `FACTS:\n${history.case.facts.join('\n')}\n\n`;

    if (history.jury && !history.jury.skipped && history.jury.locked) {
      log += `JURY SEATED (${history.jury.seatedIds.length}):\n${history.jury.comment}\n\n`;
    }

    if (history.motion) {
      const motionLabel =
        history.motion.motionBy === 'prosecution' ? 'Prosecution Motion' : 'Defense Motion';
      const rebuttalLabel =
        history.motion.rebuttalBy === 'prosecution' ? 'Prosecution Rebuttal' : 'Defense Rebuttal';
      if (history.motion.motionText) {
        log += `${motionLabel}:\n"${history.motion.motionText}"\n\n`;
      }
      if (history.motion.rebuttalText) {
        log += `${rebuttalLabel}:\n"${history.motion.rebuttalText}"\n\n`;
      }
      if (history.motion.ruling) {
        log += `RULING: ${history.motion.ruling.ruling} - "${history.motion.ruling.outcome_text}"\n\n`;
      }
    }

    if (history.counselNotes?.trim()) {
      log += `COUNSEL NOTES:\n${history.counselNotes.trim()}\n\n`;
    }

    if (history.trial && history.trial.locked) {
      log += `ARGUMENT:\n"${history.trial.text}"\n\nVERDICT: ${history.trial.verdict.final_ruling} (Score: ${Math.round(
        history.trial.verdict.final_weighted_score
      )})\nOPINION: "${history.trial.verdict.judge_opinion}"`;
    }

    copyToClipboard(log);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return {
    gameState,
    history,
    config,
    loadingMsg,
    error,
    copied,
    generateCase,
    submitStrikes,
    submitMotionStep,
    triggerAiMotionSubmission,
    requestMotionRuling,
    submitArgument,
    handleCopyFull,
    resetGame,
    toggleStrikeSelection,
  };
};

export default useGameState;
