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
/** @typedef {import('../lib/types').JurorStatus} JurorStatus */
/** @typedef {import('../lib/types').MotionResult} MotionResult */
/** @typedef {import('../lib/types').SubmissionValidation} SubmissionValidation */
/** @typedef {import('../lib/types').VerdictResult} VerdictResult */

const DOCKET_REFERENCE_PATTERN =
  /\b(fact|facts|evidence|witness|witnesses|juror|jurors|ruling|rulings)\s*#?\s*(\d+)\b/gi;

const normalizeReferenceBucket = (bucket) => [...new Set(bucket)].sort((a, b) => a - b);

const normalizeReferenceEntity = (entity) => {
  if (entity.startsWith('fact')) return 'facts';
  if (entity.startsWith('evidence')) return 'evidence';
  if (entity.startsWith('witness')) return 'witnesses';
  if (entity.startsWith('juror')) return 'jurors';
  return 'rulings';
};

const buildDocketRegistry = (historyState) => {
  const facts = new Map();
  (historyState.case?.facts ?? []).forEach((fact, index) => {
    if (typeof fact === 'string' && fact.trim()) facts.set(index + 1, true);
  });

  const evidence = new Map();
  (historyState.case?.evidence ?? []).forEach((item, index) => {
    const id = typeof item?.id === 'number' ? item.id : index + 1;
    const status = item?.status === 'suppressed' ? 'suppressed' : 'admissible';
    evidence.set(id, status);
  });

  const witnesses = new Map();
  (historyState.case?.witnesses ?? []).forEach((witness, index) => {
    if (witness && typeof witness === 'object') {
      witnesses.set(index + 1, true);
    }
  });

  const jurors = new Map();
  (historyState.case?.jurors ?? []).forEach((juror) => {
    if (typeof juror?.id === 'number') jurors.set(juror.id, true);
  });

  const rulings = new Map();
  if (historyState.motion?.ruling) {
    rulings.set(1, true);
  }

  return { facts, evidence, witnesses, jurors, rulings };
};

const parseDocketReferences = (text) => {
  const references = {
    facts: [],
    evidence: [],
    witnesses: [],
    jurors: [],
    rulings: [],
  };

  if (!text) return references;

  for (const match of text.matchAll(DOCKET_REFERENCE_PATTERN)) {
    const entity = normalizeReferenceEntity(match[1].toLowerCase());
    const id = Number(match[2]);
    if (Number.isNaN(id)) continue;
    references[entity].push(id);
  }

  return {
    facts: normalizeReferenceBucket(references.facts),
    evidence: normalizeReferenceBucket(references.evidence),
    witnesses: normalizeReferenceBucket(references.witnesses),
    jurors: normalizeReferenceBucket(references.jurors),
    rulings: normalizeReferenceBucket(references.rulings),
  };
};

const validateSubmissionReferences = (text, registry) => {
  const references = parseDocketReferences(text);
  const resolved = {
    facts: { found: [], missing: [] },
    evidence: { found: [], missing: [], inadmissible: [] },
    witnesses: { found: [], missing: [] },
    jurors: { found: [], missing: [] },
    rulings: { found: [], missing: [] },
  };

  references.facts.forEach((id) => {
    if (registry.facts.has(id)) resolved.facts.found.push(id);
    else resolved.facts.missing.push(id);
  });
  references.witnesses.forEach((id) => {
    if (registry.witnesses.has(id)) resolved.witnesses.found.push(id);
    else resolved.witnesses.missing.push(id);
  });
  references.jurors.forEach((id) => {
    if (registry.jurors.has(id)) resolved.jurors.found.push(id);
    else resolved.jurors.missing.push(id);
  });
  references.rulings.forEach((id) => {
    if (registry.rulings.has(id)) resolved.rulings.found.push(id);
    else resolved.rulings.missing.push(id);
  });
  references.evidence.forEach((id) => {
    if (registry.evidence.has(id)) {
      resolved.evidence.found.push(id);
      if (registry.evidence.get(id) === 'suppressed') {
        resolved.evidence.inadmissible.push(id);
      }
    } else {
      resolved.evidence.missing.push(id);
    }
  });

  const totalReferences =
    references.facts.length +
    references.evidence.length +
    references.witnesses.length +
    references.jurors.length +
    references.rulings.length;
  const missingCount =
    resolved.facts.missing.length +
    resolved.evidence.missing.length +
    resolved.witnesses.missing.length +
    resolved.jurors.missing.length +
    resolved.rulings.missing.length;
  const inadmissibleCount = resolved.evidence.inadmissible.length;
  const compliantFoundCount =
    resolved.facts.found.length +
    resolved.witnesses.found.length +
    resolved.jurors.found.length +
    resolved.rulings.found.length +
    (resolved.evidence.found.length - resolved.evidence.inadmissible.length);

  let classification = 'compliant';
  if (totalReferences === 0) {
    classification = 'compliant';
  } else if (missingCount === 0 && inadmissibleCount === 0) {
    classification = 'compliant';
  } else if (compliantFoundCount === 0) {
    classification = 'non_compliant';
  } else {
    classification = 'partially_compliant';
  }

  return {
    references: resolved,
    classification,
  };
};

const redactInvalidReferences = (text, validation) => {
  if (!text) return '';
  const invalidIds = [
    ...validation.references.facts.missing.map((id) => ({ entity: 'fact', id })),
    ...validation.references.evidence.missing.map((id) => ({ entity: 'evidence', id })),
    ...validation.references.evidence.inadmissible.map((id) => ({ entity: 'evidence', id })),
    ...validation.references.witnesses.missing.map((id) => ({ entity: 'witness', id })),
    ...validation.references.jurors.missing.map((id) => ({ entity: 'juror', id })),
    ...validation.references.rulings.missing.map((id) => ({ entity: 'ruling', id })),
  ];

  return invalidIds.reduce((updated, entry) => {
    const pattern = new RegExp(
      `\\b${entry.entity}s?\\s*#?\\s*${entry.id}\\b`,
      'gi'
    );
    return updated.replace(pattern, '[redacted off-docket reference]');
  }, text);
};

const summarizeNonCompliance = (validation) => {
  const missingCount =
    validation.references.facts.missing.length +
    validation.references.evidence.missing.length +
    validation.references.witnesses.missing.length +
    validation.references.jurors.missing.length +
    validation.references.rulings.missing.length;
  const inadmissibleCount = validation.references.evidence.inadmissible.length;
  return {
    classification: validation.classification,
    missing: {
      facts: validation.references.facts.missing,
      evidence: validation.references.evidence.missing,
      witnesses: validation.references.witnesses.missing,
      jurors: validation.references.jurors.missing,
      rulings: validation.references.rulings.missing,
    },
    inadmissible_evidence: validation.references.evidence.inadmissible,
    totals: {
      missing: missingCount,
      inadmissible: inadmissibleCount,
    },
  };
};

const createValidationRecord = (phase, submittedBy, text, registry) => {
  const validation = validateSubmissionReferences(text, registry);
  return {
    id: `${phase}-${submittedBy}-${Date.now()}`,
    phase,
    submitted_by: submittedBy,
    text,
    references: validation.references,
    classification: validation.classification,
    timestamp: new Date().toISOString(),
  };
};

const normalizeEvidenceDocket = (evidence) =>
  (evidence ?? [])
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: index + 1, text: item, status: 'admissible' };
      }
      if (item && typeof item === 'object') {
        return {
          id: typeof item.id === 'number' ? item.id : index + 1,
          text: typeof item.text === 'string' ? item.text : '',
          status: item.status === 'suppressed' ? 'suppressed' : 'admissible',
        };
      }
      return null;
    })
    .filter((item) => item && item.text.trim().length > 0);

const buildDocketPromptCase = (caseData, options = {}) => {
  if (!caseData) return {};
  const { evidenceMode = 'full' } = options;
  const rawEvidence = Array.isArray(caseData.evidence) ? caseData.evidence : [];
  const normalizedEvidence = rawEvidence
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: index + 1, text: item, status: 'admissible' };
      }
      if (item && typeof item === 'object') {
        return {
          id: typeof item.id === 'number' ? item.id : index + 1,
          text: typeof item.text === 'string' ? item.text : '',
          status: item.status === 'suppressed' ? 'suppressed' : 'admissible',
        };
      }
      return null;
    })
    .filter((item) => item && item.text.trim().length > 0);
  const evidence =
    evidenceMode === 'admissible'
      ? normalizedEvidence.filter((item) => item.status !== 'suppressed').map((item) => item.text)
      : normalizedEvidence;

  return {
    title: caseData.title,
    defendant: caseData.defendant,
    charge: caseData.charge,
    is_jury_trial: caseData.is_jury_trial,
    judge: caseData.judge,
    jurors: caseData.jurors,
    facts: caseData.facts,
    witnesses: caseData.witnesses,
    evidence,
    opposing_counsel: caseData.opposing_counsel,
  };
};

const applyEvidenceStatusUpdates = (evidence, updates) => {
  if (!Array.isArray(evidence)) return [];
  if (!Array.isArray(updates) || updates.length === 0) return evidence;
  const updateMap = new Map(updates.map((update) => [update.id, update.status]));
  return evidence.map((item) => {
    const nextStatus = updateMap.get(item.id);
    if (!nextStatus) return item;
    if (item.status === nextStatus) return item;
    return { ...item, status: nextStatus };
  });
};

const findDuplicateId = (ids) => {
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return null;
};

const validateJurorIdSubset = (docketJurorIds, ids) => {
  const duplicateId = findDuplicateId(ids);
  if (duplicateId !== null) {
    return { valid: false, reason: 'duplicate', id: duplicateId };
  }
  const invalidId = ids.find((id) => !docketJurorIds.has(id));
  if (invalidId !== undefined) {
    return { valid: false, reason: 'unknown', id: invalidId };
  }
  return { valid: true };
};

const buildInitialJurorPool = (jurors) =>
  jurors.map((juror) => {
    const baseStatus = juror.status ?? 'eligible';
    return {
      ...juror,
      status: baseStatus,
      status_history: juror.status_history ?? [baseStatus],
    };
  });

const updateJurorStatus = (juror, nextStatus) => {
  if (juror.status === nextStatus) return juror;
  const history = juror.status_history ?? [];
  const updatedHistory =
    history[history.length - 1] === nextStatus ? history : [...history, nextStatus];
  return {
    ...juror,
    status: nextStatus,
    status_history: updatedHistory,
  };
};

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

      const juryPool = data.is_jury_trial ? buildInitialJurorPool(data.jurors ?? []) : [];
      const evidenceDocket = normalizeEvidenceDocket(data.evidence);

      setHistory({
        case: { ...data, evidence: evidenceDocket },
        jury: data.is_jury_trial
          ? { pool: juryPool, myStrikes: [], locked: false, invalidStrike: false }
          : { skipped: true },
        motion: data.is_jury_trial ? { locked: false } : createMotionState(),
        counselNotes: '',
        trial: { locked: false, rejectedVerdicts: [] },
        validationHistory: [],
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
        systemPrompt: getJuryStrikePrompt(
          buildDocketPromptCase(history.case),
          strikes,
          config.role
        ),
        responseLabel: 'jury',
      });
      const data = parseJuryResponse(payload);
      // The docket is the single source of truth for juror IDs; reject unknown or duplicate IDs.
      const docketJurorIds = new Set((history.case?.jurors ?? []).map((juror) => juror.id));
      const opponentValidation = validateJurorIdSubset(docketJurorIds, data.opponent_strikes);
      const seatedValidation = validateJurorIdSubset(docketJurorIds, data.seated_juror_ids);

      if (!opponentValidation.valid || !seatedValidation.valid) {
        setHistory((prev) => ({
          ...prev,
          jury: {
            ...prev.jury,
            myStrikes: strikes,
            invalidStrike: true,
          },
        }));
        setError('Strike results referenced jurors outside the docket. Please retry.');
        setLoadingMsg(null);
        return;
      }

      setHistory((prev) => {
        const playerStrikeIds = new Set(strikes);
        const opponentStrikeIds = new Set(data.opponent_strikes);
        const seatedIds = new Set(data.seated_juror_ids);
        const updatedPool =
          prev.jury?.pool?.map((juror) => {
            let nextStatus = /** @type {JurorStatus} */ ('eligible');
            if (seatedIds.has(juror.id)) {
              nextStatus = 'seated';
            } else if (playerStrikeIds.has(juror.id)) {
              nextStatus = 'struck_by_player';
            } else if (opponentStrikeIds.has(juror.id)) {
              nextStatus = 'struck_by_opponent';
            }
            return updateJurorStatus(juror, nextStatus);
          }) ?? [];
        const seatedJurors = updatedPool.filter((juror) => juror.status === 'seated');
        return {
          ...prev,
          jury: {
            ...prev.jury,
            myStrikes: strikes,
            opponentStrikes: data.opponent_strikes,
            seatedIds: data.seated_juror_ids,
            comment: data.judge_comment,
            invalidStrike: false,
            pool: updatedPool,
            locked: true,
          },
          motion: createMotionState(),
          counselNotes: deriveJuryCounselNotes(seatedJurors, config.role),
        };
      });
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

    setHistory((prev) => {
      const registry = buildDocketRegistry(prev);
      const validationRecord = createValidationRecord(
        isMotionStep ? 'motion' : 'rebuttal',
        expectedRole,
        trimmed,
        registry
      );
      return {
        ...prev,
        motion: {
          ...prev.motion,
          motionText: isMotionStep ? trimmed : prev.motion.motionText,
          rebuttalText: isMotionStep ? prev.motion.rebuttalText : trimmed,
          motionPhase: isMotionStep ? 'rebuttal_submission' : prev.motion.motionPhase,
        },
        validationHistory: [...(prev.validationHistory ?? []), validationRecord],
      };
    });
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
          buildDocketPromptCase(history.case),
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
        validationHistory: [
          ...(prev.validationHistory ?? []),
          createValidationRecord(
            isMotionStep ? 'motion' : 'rebuttal',
            expectedRole,
            data.text,
            buildDocketRegistry(prev)
          ),
        ],
      }));
      setLoadingMsg(null);
    } catch (err) {
      console.error(err);
      setError(getLlmClientErrorMessage(err, 'Motion drafting failed.'));
      setLoadingMsg(null);
    }
  };

  const MAX_COUNSEL_NOTES_LENGTH = 160;

  /**
   * Normalize counsel notes to 1-2 sentences within the max character budget.
   *
   * @param {string} text - Proposed counsel note text.
   * @returns {string} Normalized counsel note.
   */
  const normalizeCounselNotes = (text) => {
    if (!text) return '';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    const sentences = cleaned.split(/(?<=[.!?])\s+/);
    const limitedSentences = sentences.slice(0, 2).join(' ').trim();
    if (limitedSentences.length <= MAX_COUNSEL_NOTES_LENGTH) return limitedSentences;
    return `${limitedSentences.slice(0, MAX_COUNSEL_NOTES_LENGTH - 3).trimEnd()}...`;
  };

  /**
   * Create a fallback counsel note when no richer context is available.
   *
   * @param {string} role - Player role.
   * @param {string} [motionOutcome] - Motion outcome label.
   * @param {string} [verdictOutcome] - Verdict outcome label.
   * @returns {string} Minimal counsel note.
   */
  const getFallbackCounselNotes = (role, motionOutcome, verdictOutcome) =>
    normalizeCounselNotes(
      `We are the ${role}; motion ${motionOutcome || 'pending'}, verdict ${verdictOutcome || 'pending'}.`
    );

  /**
   * Build a counsel note reacting to the seated jury composition.
   *
   * @param {Juror[]} seatedJurors - Jurors seated for trial.
   * @param {string} role - Player role.
   * @returns {string} Counsel note derived from juror traits.
   */
  const deriveJuryCounselNotes = (seatedJurors, role) => {
    const hints = seatedJurors
      .map((juror) => juror.bias_hint)
      .filter(Boolean)
      .map((hint) => hint.replace(/[.]+$/g, '').trim())
      .filter(Boolean);
    const uniqueHints = [...new Set(hints)].slice(0, 2);
    if (uniqueHints.length) {
      return normalizeCounselNotes(
        `We are reading a jury: ${uniqueHints.join('; ')}.`
      );
    }
    return normalizeCounselNotes(`We are the ${role} and calibrating to this panel.`);
  };

  /**
   * Build a counsel note after the pre-trial motion ruling.
   *
   * @param {HistoryState['motion']} motionState - Motion exchange state.
   * @param {MotionResult} ruling - Judge ruling payload.
   * @param {string} role - Player role.
   * @returns {string} Counsel note derived from ruling context.
   */
  const deriveMotionCounselNotes = (motionState, ruling, role) => {
    if (!motionState || !ruling?.ruling) {
      return getFallbackCounselNotes(role, 'pending');
    }
    const outcome = ruling.ruling.toLowerCase();
    const isOurMotion = motionState.motionBy === role;
    const reactions = {
      granted: isOurMotion
        ? 'We got the motion; we can press the advantage.'
        : 'We need to blunt their granted motion and keep our theme steady.',
      denied: isOurMotion
        ? 'We lost the motion; we need to sharpen the story.'
        : 'We dodged their motion; momentum feels steadier now.',
      'partially granted': isOurMotion
        ? 'We got a split ruling; we adjust around the gaps.'
        : 'We split the motion; we adjust around the edges.',
    };
    return normalizeCounselNotes(reactions[outcome] || getFallbackCounselNotes(role, outcome));
  };

  /**
   * Build a counsel note after the final verdict.
   *
   * @param {VerdictResult} verdict - Final verdict payload.
   * @param {string} role - Player role.
   * @returns {string} Counsel note derived from verdict context.
   */
  const deriveVerdictCounselNotes = (verdict, role) => {
    if (!verdict?.final_ruling) {
      return getFallbackCounselNotes(role, undefined, 'pending');
    }
    const ruling = verdict.final_ruling.toLowerCase();
    const defenseWins =
      ruling.includes('acquitt') || ruling.includes('not guilty') || ruling.includes('dismiss');
    const prosecutionWins =
      ruling.includes('guilty') || ruling.includes('liable') || ruling.includes('convict');

    if (role === 'defense' && defenseWins) {
      return normalizeCounselNotes('We can breathe after that verdict; the room heard our themes.');
    }
    if (role === 'prosecution' && prosecutionWins) {
      return normalizeCounselNotes('We feel the verdict land our way; the narrative held.');
    }
    if (role === 'defense' && prosecutionWins) {
      return normalizeCounselNotes('We absorb the verdict and take notes for the next fight.');
    }
    if (role === 'prosecution' && defenseWins) {
      return normalizeCounselNotes('We take the verdict in stride and log the gaps to fix.');
    }
    return getFallbackCounselNotes(role, undefined, verdict.final_ruling);
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
      const docketRegistry = buildDocketRegistry(history);
      const motionValidation = validateSubmissionReferences(
        history.motion.motionText,
        docketRegistry
      );
      const rebuttalValidation = validateSubmissionReferences(
        history.motion.rebuttalText,
        docketRegistry
      );
      const compliantMotionText = redactInvalidReferences(
        history.motion.motionText,
        motionValidation
      );
      const compliantRebuttalText = redactInvalidReferences(
        history.motion.rebuttalText,
        rebuttalValidation
      );
      const payload = await requestLlmJson({
        userPrompt: 'Motion ruling',
        systemPrompt: getMotionPrompt(
          buildDocketPromptCase(history.case),
          compliantMotionText,
          compliantRebuttalText,
          config.difficulty,
          history.motion.motionBy,
          history.motion.rebuttalBy,
          config.role,
          {
            motion: summarizeNonCompliance(motionValidation),
            rebuttal: summarizeNonCompliance(rebuttalValidation),
          }
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
        case: {
          ...prev.case,
          evidence: applyEvidenceStatusUpdates(prev.case?.evidence, data.evidence_status_updates),
        },
        counselNotes: deriveMotionCounselNotes(prev.motion, data, config.role),
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
      const docketRegistry = buildDocketRegistry(history);
      const argumentRecord = createValidationRecord('argument', config.role, text, docketRegistry);
      const compliantArgument = redactInvalidReferences(text, argumentRecord);

      setHistory((prev) => ({
        ...prev,
        trial: { ...prev.trial, text },
        validationHistory: [...(prev.validationHistory ?? []), argumentRecord],
      }));
      /** @type {Juror[]} */
      const seatedJurors = history.jury?.skipped
        ? []
        : history.jury?.pool?.filter((juror) => juror.status === 'seated') ?? [];
      const caseForVerdict = buildDocketPromptCase(history.case, {
        evidenceMode: 'admissible',
      });
      const payload = await requestLlmJson({
        userPrompt: 'Verdict',
        systemPrompt: getFinalVerdictPrompt(
          caseForVerdict,
          history.motion.ruling,
          seatedJurors,
          compliantArgument,
          config.difficulty,
          summarizeNonCompliance(argumentRecord)
        ),
        responseLabel: 'verdict',
      });
      /** @type {VerdictResult} */
      const data = parseVerdictResponse(payload, {
        isJuryTrial: history.case?.is_jury_trial,
        seatedJurorIds: seatedJurors.map((juror) => juror.id),
        docketJurorIds: (history.case?.jurors ?? []).map((juror) => juror.id),
      });
      const verdictText = [
        data.final_ruling,
        data.judge_opinion,
        data.jury_reasoning,
      ]
        .filter(Boolean)
        .join(' ');
      const verdictValidation = validateSubmissionReferences(verdictText, docketRegistry);
      const verdictRecord = createValidationRecord(
        'verdict',
        'judge',
        verdictText,
        docketRegistry
      );
      const isVerdictCompliant = verdictValidation.classification === 'compliant';

      setHistory((prev) => {
        if (!isVerdictCompliant) {
          return {
            ...prev,
            trial: {
              ...prev.trial,
              text,
              verdict: prev.trial?.verdict,
              locked: false,
              rejectedVerdicts: [
                ...(prev.trial?.rejectedVerdicts ?? []),
                {
                  payload,
                  reason: 'Verdict referenced off-docket or inadmissible material.',
                  validation: verdictRecord,
                  timestamp: new Date().toISOString(),
                },
              ],
            },
            validationHistory: [...(prev.validationHistory ?? []), verdictRecord],
          };
        }

        return {
          ...prev,
          trial: { text, verdict: data, locked: true },
          counselNotes: deriveVerdictCounselNotes(data, config.role),
          validationHistory: [...(prev.validationHistory ?? []), verdictRecord],
        };
      });
      if (!isVerdictCompliant) {
        setError('Verdict rejected for off-docket or inadmissible references.');
        setLoadingMsg(null);
        return;
      }
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
      const seatedJurors = history.jury.pool.filter((juror) => juror.status === 'seated');
      log += `JURY SEATED (${seatedJurors.length}):\n${history.jury.comment}\n\n`;
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
