import { useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import { DEFAULT_GAME_CONFIG } from '../lib/config';
import {
  getLlmClientErrorMessage,
  parseCaseResponse,
  parseJuryResponse,
  parseMotionResponse,
  parseVerdictResponse,
  requestLlmJson,
} from '../lib/llmClient';
import {
  getFinalVerdictPrompt,
  getGeneratorPrompt,
  getJuryStrikePrompt,
  getMotionPrompt,
} from '../lib/prompts';

/**
 * Manage the Pocket Court game state and actions in one place.
 *
 * @returns {object} Game state values and action handlers.
 */
const useGameState = () => {
  const [gameState, setGameState] = useState('start');
  const [loadingMsg, setLoadingMsg] = useState(null);
  const [history, setHistory] = useState({});
  const [config, setConfig] = useState({ ...DEFAULT_GAME_CONFIG });
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  /**
   * Return to the start screen and clear transient UI state.
   */
  const resetGame = () => {
    setGameState('start');
    setLoadingMsg(null);
    setError(null);
    setCopied(false);
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
      const data = parseCaseResponse(payload);

      setHistory({
        case: data,
        jury: data.is_jury_trial
          ? { pool: data.jurors, myStrikes: [], locked: false }
          : { skipped: true },
        motion: { locked: false },
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
        motion: { locked: false },
      }));
      setLoadingMsg(null);
    } catch (err) {
      console.error(err);
      setError(getLlmClientErrorMessage(err, 'Strike failed.'));
      setLoadingMsg(null);
    }
  };

  /**
   * Submit a pre-trial motion and store the ruling.
   *
   * @param {string} text - Motion text entered by the player.
   */
  const submitMotion = async (text) => {
    setLoadingMsg('Filing motion...');
    try {
      const payload = await requestLlmJson({
        userPrompt: 'Motion',
        systemPrompt: getMotionPrompt(history.case, text, config.difficulty),
        responseLabel: 'motion',
      });
      const data = parseMotionResponse(payload);

      setHistory((prev) => ({
        ...prev,
        motion: { text, ruling: data, locked: true },
        trial: { locked: false },
      }));
      setLoadingMsg(null);
    } catch (err) {
      console.error(err);
      setError(getLlmClientErrorMessage(err, 'Motion failed.'));
      setLoadingMsg(null);
    }
  };

  /**
   * Submit a closing argument and resolve the final verdict.
   *
   * @param {string} text - Closing argument text.
   */
  const submitArgument = async (text) => {
    setLoadingMsg('The Court is deliberating...');
    try {
      const seatedJurors = history.jury.skipped
        ? []
        : history.case.jurors.filter((j) => history.jury.seatedIds.includes(j.id));
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

    if (history.motion && history.motion.locked) {
      log += `MOTION:\n"${history.motion.text}"\nRULING: ${history.motion.ruling.ruling} - "${history.motion.ruling.outcome_text}"\n\n`;
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
    submitMotion,
    submitArgument,
    handleCopyFull,
    resetGame,
    toggleStrikeSelection,
  };
};

export default useGameState;
