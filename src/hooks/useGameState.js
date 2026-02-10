import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '../lib/clipboard';
import { DEFAULT_GAME_CONFIG, normalizeCourtType, normalizeDifficulty } from '../lib/config';
import {
  CASE_TYPES,
  COURT_TYPES,
  GAME_STATES,
  JURISDICTIONS,
  SANCTION_ENTRY_STATES,
  SANCTION_LEVELS,
  SANCTION_REASON_CODES,
  SANCTION_STATES,
  SANCTIONS_TIMERS_MS,
  SANCTION_VISIBILITY,
  normalizeCaseType,
  normalizeJurisdiction,
  normalizeSanctionState,
} from '../lib/constants';
import {
  deriveDispositionFromMotion,
  deriveDispositionFromVerdict,
  guardDisposition,
  isMeritReleaseDisposition,
  isTerminalDisposition,
} from '../lib/disposition';
import {
  getLlmClientErrorMessage,
  LlmClientError,
  parseCaseResponse,
  parseJuryResponse,
  parseMotionResponse,
  parseMotionTextResponse,
  parseVerdictResponse,
  requestLlmJson,
} from '../lib/llmClient';
import {
  loadPlayerProfile,
  loadRunHistory,
  savePlayerProfile,
  saveRunHistory,
} from '../lib/persistence';
import {
  getAutoSubmissionPrompt,
  getFinalVerdictPrompt,
  getGeneratorPrompt,
  getJuryStrikePrompt,
  getMotionPrompt,
  getOpposingCounselPrompt,
} from '../lib/prompts';
import {
  canonicalizeJurorPool,
  normalizeJurorId,
  normalizeStrikeIds,
  validateStrikeIds,
} from '../lib/juryIds';
import {
  debugEnabled,
  getDebugState,
  logEvent,
  setLastAction,
} from '../lib/debugStore';

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

const stripMarkdown = (text = '') => {
  if (!text) return '';
  let output = text.replace(/\r\n/g, '\n');

  output = output.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```[^\n]*\n?/g, '').replace(/```/g, '')
  );
  output = output.replace(/`([^`]+)`/g, '$1');
  output = output.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  output = output.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  output = output.replace(/^\s{0,3}>\s?/gm, '');
  output = output.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  output = output.replace(/^\s*([-*+])\s+/gm, '');
  output = output.replace(/^\s*\d+\.\s+/gm, '');
  output = output.replace(/(\*\*|__)(.*?)\1/g, '$2');
  output = output.replace(/(\*|_)(.*?)\1/g, '$2');
  output = output.replace(/~~(.*?)~~/g, '$1');

  return output;
};

// Real-time windows to allow recidivism escalation and cooldown resets across sessions.
const RECIDIVISM_WINDOW_MS = SANCTIONS_TIMERS_MS.RECIDIVISM_WINDOW;
const COOLDOWN_RESET_MS = SANCTIONS_TIMERS_MS.COOLDOWN_RESET;
const WARNING_DURATION_MS = SANCTIONS_TIMERS_MS.WARNING_DURATION;
const SANCTION_DURATION_MS = SANCTIONS_TIMERS_MS.SANCTION_DURATION;
const PUBLIC_DEFENDER_DURATION_MS = SANCTIONS_TIMERS_MS.PUBLIC_DEFENDER_DURATION;
const REINSTATEMENT_GRACE_MS = SANCTIONS_TIMERS_MS.REINSTATEMENT_GRACE;
const RUN_HISTORY_LIMIT = 20;

const NON_TRIGGER_PATTERNS = [
  /losing on the merits/i,
  /loss on the merits/i,
  /poor reasoning/i,
  /silly but admissible/i,
];

const MISCONDUCT_PATTERNS = {
  mistrial: /\bmistrial\b/i,
  dismissal: /\bdismiss(?:ed|al)?\b/i,
  misconduct: /\bmisconduct\b/i,
  procedural: /\bprocedural\b/i,
};

const capRunHistoryEntries = (runs) => runs.slice(-RUN_HISTORY_LIMIT);

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

const toTimestampMs = (isoString) => {
  if (!isoString) return null;
  const parsed = Date.parse(isoString);
  return Number.isNaN(parsed) ? null : parsed;
};

const buildDefaultSanctionsState = (nowMs = Date.now()) => ({
  state: SANCTION_STATES.CLEAN,
  level: SANCTION_LEVELS[SANCTION_STATES.CLEAN],
  startedAt: new Date(nowMs).toISOString(),
  expiresAt: null,
  lastMisconductAt: null,
  recidivismCount: 0,
  recentlyReinstatedUntil: null,
});

const buildPdStatusSnapshot = (sanctionsState) => {
  if (!sanctionsState || sanctionsState.state !== SANCTION_STATES.PUBLIC_DEFENDER) return null;
  return {
    startedAt: sanctionsState.startedAt,
    expiresAt: sanctionsState.expiresAt,
  };
};

const buildReinstatementSnapshot = (sanctionsState) => {
  if (!sanctionsState?.recentlyReinstatedUntil) return null;
  return { until: sanctionsState.recentlyReinstatedUntil };
};

const updatePlayerProfile = (updater) => {
  const currentProfile = loadPlayerProfile();
  const nextProfile = updater(currentProfile);
  return savePlayerProfile(nextProfile);
};

const buildDefaultStats = () => ({
  runsCompleted: 0,
  verdictsFinalized: 0,
  sanctionsIncurred: 0,
});

const ACCOUNTABILITY_SEVERITY_LABELS = {
  warning: 'warning',
  sanction: 'sanction',
  disbarment: 'disbarment',
};

const buildAccountabilityTrigger = (reason) => {
  if (!reason) return SANCTION_REASON_CODES.OTHER;
  const normalized = reason.toLowerCase();
  if (normalized.includes('contempt')) return SANCTION_REASON_CODES.CONTEMPT;
  if (normalized.includes('decorum')) return SANCTION_REASON_CODES.DECORUM_VIOLATION;
  if (normalized.includes('evidence')) return SANCTION_REASON_CODES.EVIDENCE_VIOLATION;
  if (normalized.includes('misrepresent')) return SANCTION_REASON_CODES.MISREPRESENTATION;
  if (normalized.includes('discovery')) return SANCTION_REASON_CODES.DISCOVERY_VIOLATION;
  if (normalized.includes('deadline')) return SANCTION_REASON_CODES.DEADLINE_VIOLATION;
  return SANCTION_REASON_CODES.OTHER;
};

const buildAccountabilityEntry = (accountability) => {
  if (!accountability?.sanction_recommended) return null;
  const severity = accountability.severity ?? 'sanction';
  const target = accountability.target ?? 'defense';
  const reason = accountability.reason ?? 'unspecified conduct';
  const severityLabel = ACCOUNTABILITY_SEVERITY_LABELS[severity] ?? 'sanction';
  return {
    id: `sanction-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    state:
      severity === 'warning'
        ? SANCTION_ENTRY_STATES.WARNED
        : SANCTION_ENTRY_STATES.SANCTIONED,
    trigger: buildAccountabilityTrigger(reason),
    docket_text: `The court issues a ${severityLabel} to the ${target} for ${reason}.`,
    visibility: SANCTION_VISIBILITY.PUBLIC,
    timestamp: new Date().toISOString(),
    accountability,
  };
};

const persistSanctionsState = (state) => {
  updatePlayerProfile((profile) => ({
    ...profile,
    sanctions: state,
    pdStatus: buildPdStatusSnapshot(state),
    reinstatement: buildReinstatementSnapshot(state),
  }));
};

const buildSanctionEntryKey = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.id) return `id:${entry.id}`;
  if (entry.timestamp) return `timestamp:${entry.timestamp}`;
  return null;
};

const countNewSanctionEntries = (sanctionsLog, countedEntries) => {
  if (!Array.isArray(sanctionsLog)) return 0;
  let total = 0;
  sanctionsLog.forEach((entry) => {
    const key = buildSanctionEntryKey(entry);
    if (!key || countedEntries.has(key)) return;
    countedEntries.add(key);
    if (evaluateConductTrigger(entry, sanctionsLog, RECIDIVISM_WINDOW_MS).triggered) {
      total += 1;
    }
  });
  return total;
};

const isJudicialAcknowledgment = (entry) =>
  Boolean(entry?.docket_text?.trim()) && Boolean(entry?.timestamp);

const isNonTriggerDocketText = (text) =>
  NON_TRIGGER_PATTERNS.some((pattern) => pattern.test(text ?? ''));

const parseSanctionLevelFromText = (text) => {
  const match = text?.match(/\b(?:level|tier)\s*(\d+)\b/i);
  if (!match) return null;
  const level = Number(match[1]);
  return Number.isNaN(level) ? null : level;
};

const isProceduralViolation = (entry) => {
  if (!entry) return false;
  const proceduralTriggers = new Set([
    SANCTION_REASON_CODES.DEADLINE_VIOLATION,
    SANCTION_REASON_CODES.DISCOVERY_VIOLATION,
    SANCTION_REASON_CODES.EVIDENCE_VIOLATION,
  ]);
  if (proceduralTriggers.has(entry.trigger)) return true;
  return MISCONDUCT_PATTERNS.procedural.test(entry.docket_text ?? '');
};

const getEntryTimestampMs = (entry) => toTimestampMs(entry?.timestamp);

const evaluateConductTrigger = (entry, entries, recidivismWindowMs) => {
  if (!isJudicialAcknowledgment(entry)) {
    return { triggered: false, severe: false, timestampMs: null, forcedState: null };
  }
  const timestampMs = getEntryTimestampMs(entry);
  if (timestampMs === null) {
    return { triggered: false, severe: false, timestampMs: null, forcedState: null };
  }

  if (entry?.accountability && typeof entry.accountability === 'object') {
    if (!entry.accountability.sanction_recommended) {
      return { triggered: false, severe: false, timestampMs, forcedState: null };
    }
    const severity = entry.accountability.severity;
    const severe = severity === 'sanction' || severity === 'disbarment';
    return {
      triggered: true,
      severe,
      timestampMs,
      forcedState: severity === 'disbarment' ? SANCTION_STATES.PUBLIC_DEFENDER : null,
    };
  }

  if (isNonTriggerDocketText(entry.docket_text)) {
    return { triggered: false, severe: false, timestampMs, forcedState: null };
  }

  const docketText = entry.docket_text ?? '';
  const hasMisconductMistrial =
    MISCONDUCT_PATTERNS.mistrial.test(docketText) && MISCONDUCT_PATTERNS.misconduct.test(docketText);
  const hasMisconductDismissal =
    MISCONDUCT_PATTERNS.dismissal.test(docketText) &&
    MISCONDUCT_PATTERNS.misconduct.test(docketText);
  const sanctionLevel = parseSanctionLevelFromText(docketText);
  const hasJudgeSanctionLevel = sanctionLevel !== null && sanctionLevel >= 2;
  const proceduralViolationsInWindow = entries.filter((logEntry) => {
    if (!isProceduralViolation(logEntry)) return false;
    const entryMs = getEntryTimestampMs(logEntry);
    if (entryMs === null) return false;
    return Math.abs(timestampMs - entryMs) <= recidivismWindowMs;
  });
  const hasRepeatedProceduralViolations =
    isProceduralViolation(entry) && proceduralViolationsInWindow.length >= 2;
  const severeTrigger =
    hasMisconductMistrial ||
    hasMisconductDismissal ||
    hasJudgeSanctionLevel ||
    hasRepeatedProceduralViolations;
  const triggered =
    entry.state === SANCTION_ENTRY_STATES.WARNED ||
    entry.state === SANCTION_ENTRY_STATES.SANCTIONED ||
    entry.state === SANCTION_ENTRY_STATES.NOTICED;

  return {
    triggered,
    severe: severeTrigger,
    timestampMs,
    forcedState: null,
  };
};

const isSanctionsStateEqual = (left, right) => {
  if (!left || !right) return false;
  return (
    left.state === right.state &&
    left.level === right.level &&
    left.startedAt === right.startedAt &&
    left.expiresAt === right.expiresAt &&
    left.lastMisconductAt === right.lastMisconductAt &&
    left.recidivismCount === right.recidivismCount &&
    left.recentlyReinstatedUntil === right.recentlyReinstatedUntil
  );
};

const getStateExpiryMs = (state, nowMs) => {
  if (state === SANCTION_STATES.WARNED) return nowMs + WARNING_DURATION_MS;
  if (state === SANCTION_STATES.SANCTIONED) return nowMs + SANCTION_DURATION_MS;
  if (state === SANCTION_STATES.PUBLIC_DEFENDER) return nowMs + PUBLIC_DEFENDER_DURATION_MS;
  if (state === SANCTION_STATES.RECENTLY_REINSTATED) return nowMs + REINSTATEMENT_GRACE_MS;
  return null;
};

const buildSanctionsState = (state, nowMs, overrides = {}) => {
  const normalizedState = normalizeSanctionState(state);
  return {
    ...overrides,
    state: normalizedState,
    level: SANCTION_LEVELS[normalizedState] ?? 0,
    startedAt: new Date(nowMs).toISOString(),
    expiresAt:
      normalizedState === SANCTION_STATES.CLEAN
        ? null
        : new Date(getStateExpiryMs(normalizedState, nowMs)).toISOString(),
    recentlyReinstatedUntil:
      normalizedState === SANCTION_STATES.RECENTLY_REINSTATED
        ? new Date(nowMs + REINSTATEMENT_GRACE_MS).toISOString()
        : null,
  };
};

const cloneSanctionsSnapshot = (state) => (state ? { ...state } : null);
const buildSanctionsDelta = (before, after) => ({
  before: cloneSanctionsSnapshot(before),
  after: cloneSanctionsSnapshot(after),
});

const buildVisibilityContext = (sanctionsState, nowMs = Date.now()) => {
  const reinstatedUntilMs = toTimestampMs(sanctionsState?.recentlyReinstatedUntil);
  if (!reinstatedUntilMs || nowMs >= reinstatedUntilMs) return {};
  return { recentlyReinstatedUntil: sanctionsState.recentlyReinstatedUntil };
};

export const normalizeSanctionsState = (state, nowMs) => {
  if (!state) return buildDefaultSanctionsState(nowMs);

  const hydratedState = {
    ...buildDefaultSanctionsState(nowMs),
    ...state,
  };
  hydratedState.state = normalizeSanctionState(hydratedState.state);

  const expiresAtMs = toTimestampMs(hydratedState.expiresAt);
  const reinstatedUntilMs = toTimestampMs(hydratedState.recentlyReinstatedUntil);
  const lastMisconductMs = toTimestampMs(hydratedState.lastMisconductAt);
  const shouldResetCooldown =
    lastMisconductMs !== null && nowMs - lastMisconductMs > COOLDOWN_RESET_MS;

  if (
    hydratedState.state === SANCTION_STATES.PUBLIC_DEFENDER &&
    expiresAtMs &&
    nowMs >= expiresAtMs
  ) {
    return buildSanctionsState(SANCTION_STATES.RECENTLY_REINSTATED, nowMs, {
      lastMisconductAt: hydratedState.lastMisconductAt,
      recidivismCount: hydratedState.recidivismCount,
    });
  }

  if (
    hydratedState.state === SANCTION_STATES.RECENTLY_REINSTATED &&
    reinstatedUntilMs &&
    nowMs >= reinstatedUntilMs
  ) {
    return buildSanctionsState(SANCTION_STATES.CLEAN, nowMs, {
      lastMisconductAt: hydratedState.lastMisconductAt,
      recidivismCount: 0,
    });
  }

  if (
    (hydratedState.state === SANCTION_STATES.WARNED ||
      hydratedState.state === SANCTION_STATES.SANCTIONED) &&
    expiresAtMs &&
    nowMs >= expiresAtMs
  ) {
    return buildSanctionsState(SANCTION_STATES.CLEAN, nowMs, {
      lastMisconductAt: hydratedState.lastMisconductAt,
      recidivismCount: 0,
    });
  }

  if (shouldResetCooldown) {
    return {
      ...hydratedState,
      recidivismCount: 0,
    };
  }

  return hydratedState;
};

const buildSanctionPromptContext = (sanctionsState, overrides = {}) => ({
  state: sanctionsState?.state,
  caseType: overrides.caseType,
  lockedJurisdiction: overrides.lockedJurisdiction,
  expiresAt: sanctionsState?.expiresAt,
  recentlyReinstatedUntil: sanctionsState?.recentlyReinstatedUntil,
});

const getNextSanctionsState = ({ currentState, entryState, recidivismCount, severe }) => {
  if (currentState === SANCTION_STATES.RECENTLY_REINSTATED) {
    return SANCTION_STATES.PUBLIC_DEFENDER;
  }
  if (currentState === SANCTION_STATES.CLEAN) {
    return entryState === SANCTION_ENTRY_STATES.SANCTIONED
      ? SANCTION_STATES.SANCTIONED
      : SANCTION_STATES.WARNED;
  }
  if (currentState === SANCTION_STATES.WARNED) {
    if (entryState === SANCTION_ENTRY_STATES.SANCTIONED || severe || recidivismCount > 1) {
      return SANCTION_STATES.SANCTIONED;
    }
    return SANCTION_STATES.WARNED;
  }
  if (currentState === SANCTION_STATES.SANCTIONED) {
    if (severe || recidivismCount > 1) {
      return SANCTION_STATES.PUBLIC_DEFENDER;
    }
    return SANCTION_STATES.SANCTIONED;
  }
  return SANCTION_STATES.PUBLIC_DEFENDER;
};

const deriveSanctionsState = (prevState, sanctionsLog = [], nowMs = Date.now()) => {
  let nextState = normalizeSanctionsState(prevState, nowMs);
  const lastMisconductMs = toTimestampMs(nextState.lastMisconductAt);

  const docketedEntries = (sanctionsLog ?? [])
    .filter(isJudicialAcknowledgment)
    .map((entry) => ({
      ...entry,
      timestampMs: getEntryTimestampMs(entry),
    }))
    .filter((entry) => entry.timestampMs !== null)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const newEntries = docketedEntries.filter((entry) =>
    lastMisconductMs ? entry.timestampMs > lastMisconductMs : true
  );

  let currentState = nextState;
  for (const entry of newEntries) {
    const evaluation = evaluateConductTrigger(entry, docketedEntries, RECIDIVISM_WINDOW_MS);
    if (!evaluation.triggered) continue;

    const entryTimeMs = evaluation.timestampMs ?? nowMs;
    const recidivismCount =
      currentState.lastMisconductAt &&
      entryTimeMs - toTimestampMs(currentState.lastMisconductAt) <= RECIDIVISM_WINDOW_MS
        ? currentState.recidivismCount + 1
        : 1;

    const nextSanctionsState = getNextSanctionsState({
      currentState: currentState.state,
      entryState: entry.state,
      recidivismCount,
      severe: evaluation.severe,
    });
    const resolvedNextState = evaluation.forcedState ?? nextSanctionsState;

    if (resolvedNextState !== currentState.state) {
      currentState = buildSanctionsState(resolvedNextState, entryTimeMs, {
        lastMisconductAt: new Date(entryTimeMs).toISOString(),
        recidivismCount,
      });
    } else {
      currentState = {
        ...currentState,
        lastMisconductAt: new Date(entryTimeMs).toISOString(),
        recidivismCount,
        expiresAt:
          currentState.state === SANCTION_STATES.CLEAN
            ? null
            : new Date(getStateExpiryMs(currentState.state, entryTimeMs)).toISOString(),
      };
    }
  }

  if (isSanctionsStateEqual(prevState, currentState)) {
    return prevState;
  }
  return currentState;
};

const getCanonicalJurorIds = (jurors) =>
  normalizeStrikeIds((jurors ?? []).map((juror) => juror?.id));

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
  getCanonicalJurorIds(historyState.case?.jurors ?? []).forEach((id) => {
    jurors.set(id, true);
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

const buildEvidenceIdSet = (evidence) => {
  const evidenceIds = new Set();
  (evidence ?? []).forEach((item, index) => {
    const id = typeof item?.id === 'number' ? item.id : index + 1;
    evidenceIds.add(id);
  });
  return evidenceIds;
};

const createMotionRulingError = (message, { userMessage, context } = {}) =>
  new LlmClientError(message, {
    code: 'INVALID_MOTION_RULING',
    userMessage: userMessage ?? 'Motion ruling could not be applied. Please retry.',
    context,
  });

const normalizeEvidenceStatusUpdates = (updates) => {
  if (!Array.isArray(updates)) {
    throw createMotionRulingError('Motion ruling evidence updates are missing.', {
      userMessage: 'Motion ruling is missing evidence updates. Please retry.',
      context: { updates },
    });
  }
  const normalized = updates.map((update, index) => {
    if (!update || typeof update !== 'object') {
      throw createMotionRulingError('Motion ruling evidence update is invalid.', {
        userMessage: 'Motion ruling includes invalid evidence updates. Please retry.',
        context: { update, index },
      });
    }
    if (typeof update.id !== 'number') {
      throw createMotionRulingError('Motion ruling evidence update missing id.', {
        userMessage: 'Motion ruling includes invalid evidence updates. Please retry.',
        context: { update, index },
      });
    }
    if (update.status !== 'admissible' && update.status !== 'suppressed') {
      throw createMotionRulingError('Motion ruling evidence update has invalid status.', {
        userMessage: 'Motion ruling includes invalid evidence updates. Please retry.',
        context: { update, index },
      });
    }
    return { ...update, index };
  });
  return normalized
    .slice()
    .sort((a, b) => a.id - b.id || a.index - b.index)
    .map(({ id, status }) => ({ id, status }));
};

const buildMotionDocketEntries = (ruling) => {
  const breakdownEntries = ruling?.breakdown?.docket_entries;
  if (!Array.isArray(breakdownEntries)) {
    throw createMotionRulingError('Motion ruling is missing docket entries.', {
      userMessage: 'Motion ruling is missing docket entries. Please retry.',
      context: { docketEntries: breakdownEntries },
    });
  }
  const normalizedEntries = breakdownEntries
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
  const outcomeText =
    typeof ruling?.outcome_text === 'string' ? ruling.outcome_text.trim() : '';
  const rulingLabel =
    typeof ruling?.ruling === 'string' ? ruling.ruling.trim() : '';
  const summaryEntry =
    outcomeText && rulingLabel ? `RULING: ${rulingLabel} - "${outcomeText}"` : null;
  const docketEntries = summaryEntry ? [summaryEntry, ...normalizedEntries] : normalizedEntries;
  if (docketEntries.length === 0) {
    throw createMotionRulingError('Motion ruling docket entries are empty.', {
      userMessage: 'Motion ruling is missing docket entries. Please retry.',
      context: { docketEntries: breakdownEntries },
    });
  }
  return docketEntries;
};

const applyMotionRulingDiff = (historyState, ruling) => {
  const evidence = historyState?.case?.evidence;
  if (!Array.isArray(evidence)) {
    throw createMotionRulingError('Motion ruling missing case evidence.', {
      userMessage: 'Motion ruling is missing evidence context. Please retry.',
      context: { evidence },
    });
  }
  if (!ruling || typeof ruling !== 'object') {
    throw createMotionRulingError('Motion ruling payload is missing.', {
      userMessage: 'Motion ruling is missing required fields. Please retry.',
      context: { ruling },
    });
  }
  if (!Array.isArray(ruling.breakdown?.issues)) {
    throw createMotionRulingError('Motion ruling breakdown is missing issues.', {
      userMessage: 'Motion ruling is missing required fields. Please retry.',
      context: { breakdown: ruling.breakdown },
    });
  }
  const normalizedUpdates = normalizeEvidenceStatusUpdates(ruling.evidence_status_updates);
  const docketEntries = buildMotionDocketEntries(ruling);
  const evidenceIds = buildEvidenceIdSet(evidence);
  const referencedIds = new Set();
  normalizedUpdates.forEach((update) => referencedIds.add(update.id));
  ruling.breakdown.issues.forEach((issue, index) => {
    if (issue?.affectedEvidenceIds) {
      issue.affectedEvidenceIds.forEach((id) => {
        if (typeof id !== 'number') {
          throw createMotionRulingError('Motion ruling issue has invalid evidence id.', {
            userMessage: 'Motion ruling includes invalid evidence references. Please retry.',
            context: { issue, index, id },
          });
        }
        referencedIds.add(id);
      });
    }
  });
  const missingEvidenceIds = [...referencedIds].filter((id) => !evidenceIds.has(id));
  if (missingEvidenceIds.length) {
    throw createMotionRulingError('Motion ruling referenced unknown evidence ids.', {
      userMessage: 'Motion ruling referenced evidence outside the docket. Please retry.',
      context: {
        missingEvidenceIds,
        referencedIds: [...referencedIds],
        docketEvidenceIds: [...evidenceIds],
      },
    });
  }
  return {
    evidence: applyEvidenceStatusUpdates(evidence, normalizedUpdates),
    docketEntries,
    normalizedUpdates,
  };
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

const createRunId = () =>
  `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Manage the Pocket Court game state and actions in one place.
 *
 * @param {object} [options] - Optional shell callbacks.
 * @param {(event: {type: string, message?: string, payload?: object}) => void} [options.onShellEvent]
 * @returns {{
 *   gameState: string,
 *   history: HistoryState,
 *   config: {difficulty: string, jurisdiction: string, courtType: string, role: string, caseType: string},
 *   loadingMsg: string | null,
 *   error: string | null,
 *   copied: boolean,
 *   runOutcome: {
 *     disposition: import('../lib/types').DispositionRecord | null,
 *     sanctions: { before: import('../lib/types').PlayerSanctionsState | null, after: import('../lib/types').PlayerSanctionsState | null },
 *   } | null,
 *   generateCase: (role: string, difficulty: string, jurisdiction: string, courtType: string) => Promise<boolean>,
 *   submitStrikes: (strikes: number[]) => Promise<void>,
 *   submitMotionStep: (text: string) => Promise<void>,
 *   triggerAiMotionSubmission: () => Promise<void>,
 *   requestMotionRuling: () => Promise<void>,
 *   submitArgument: (text: string) => Promise<void>,
 *   generateAutoSubmission: (mode: 'legit' | 'absurd', stage: 'motion' | 'argument') => Promise<string>,
 *   handleCopyFull: (docketNumber?: number) => Promise<void>,
 *   resetGame: () => void,
 *   toggleStrikeSelection: (id: number) => void,
 * }} Game state values and action handlers.
 */
const useGameState = (options = {}) => {
  const { onShellEvent } = options;
  const [gameState, setGameState] = useState(GAME_STATES.START);
  const [loadingMsg, setLoadingMsg] = useState(null);
  const [history, setHistory] = useState(
    /** @type {HistoryState} */ ({ counselNotes: '', disposition: null })
  );
  const [config, setConfig] = useState({ ...DEFAULT_GAME_CONFIG });
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [debugBanner, setDebugBanner] = useState(null);
  const debugBannerTimeoutRef = useRef(null);
  const runStartSanctionsRef = useRef(null);
  const countedSanctionsRef = useRef(new Set());
  const [sanctionsState, setSanctionsState] = useState(() => {
    const storedState = loadPlayerProfile()?.sanctions ?? null;
    return normalizeSanctionsState(
      storedState ?? buildDefaultSanctionsState(),
      Date.now()
    );
  });
  const [runMeta, setRunMeta] = useState(null);
  const [runOutcome, setRunOutcome] = useState(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSanctionsState((prev) => deriveSanctionsState(prev, history.sanctions ?? []));
  }, [history.sanctions]);

  useEffect(() => {
    const sanctionsLog = history.sanctions ?? [];
    const newSanctionsCount = countNewSanctionEntries(
      sanctionsLog,
      countedSanctionsRef.current
    );
    if (newSanctionsCount > 0) {
      updatePlayerProfile((profile) => {
        const stats = profile.stats ?? buildDefaultStats();
        return {
          ...profile,
          stats: {
            ...stats,
            sanctionsIncurred: (stats.sanctionsIncurred ?? 0) + newSanctionsCount,
          },
        };
      });
    }
  }, [history.sanctions]);

  const emitShellEvent = useCallback(
    (event) => {
      if (typeof onShellEvent === 'function') {
        onShellEvent(event);
      }
    },
    [onShellEvent]
  );

  const buildRunOutcome = useCallback(
    (disposition, sanctionsAfter) => ({
      disposition: disposition ?? null,
      sanctions: {
        before: runStartSanctionsRef.current ?? cloneSanctionsSnapshot(sanctionsState),
        after: cloneSanctionsSnapshot(sanctionsAfter),
      },
    }),
    [sanctionsState]
  );

  useEffect(() => {
    persistSanctionsState(sanctionsState);
    emitShellEvent({ type: 'sanctions_sync', payload: sanctionsState });
  }, [emitShellEvent, sanctionsState]);

  const appendAchievement = (title) => {
    if (!title) return;
    updatePlayerProfile((profile) => {
      const achievements = Array.isArray(profile.achievements) ? profile.achievements : [];
      return {
        ...profile,
        achievements: [
          ...achievements,
          {
            title,
            awardedAt: new Date().toISOString(),
            runId: runMeta?.id ?? null,
          },
        ],
      };
    });
  };

  const updateRunStats = (hasVerdict) => {
    updatePlayerProfile((profile) => {
      const stats = profile.stats ?? buildDefaultStats();
      return {
        ...profile,
        stats: {
          runsCompleted: stats.runsCompleted + 1,
          verdictsFinalized: stats.verdictsFinalized + (hasVerdict ? 1 : 0),
          sanctionsIncurred: stats.sanctionsIncurred ?? 0,
        },
      };
    });
  };

  const appendCaseHistoryEntry = useCallback(
    ({ disposition, endedAt, sanctionsAfter, docketSnapshot }) => {
      if (!isTerminalDisposition(disposition)) return;
      const finalSanctionsCount = Array.isArray(docketSnapshot?.sections?.sanctions)
        ? docketSnapshot.sections.sanctions.length
        : 0;
      updatePlayerProfile((profile) => {
        const existingHistory = Array.isArray(profile.caseHistory) ? profile.caseHistory : [];
        const nextEntry = {
          id: `case-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          caseName: history.case?.title ?? runMeta?.caseTitle ?? 'Untitled case',
          outcome: disposition?.type ?? null,
          date: endedAt,
          finalSanctionsCount,
          docketSnapshot,
          sanctionsState: cloneSanctionsSnapshot(sanctionsAfter),
        };
        return {
          ...profile,
          caseHistory: [nextEntry, ...existingHistory].slice(0, 30),
        };
      });
    },
    [history.case?.title, runMeta?.caseTitle]
  );

  const recordRunHistoryEntry = useCallback((entry) => {
    const historySnapshot = loadRunHistory();
    const runs = historySnapshot.runs ?? [];
    saveRunHistory({
      ...historySnapshot,
      runs: capRunHistoryEntries([...runs, entry]),
    });
  }, []);

  const finalizeRunHistoryEntry = (verdict, disposition, achievementId) => {
    if (!runMeta || runMeta.endedAt) return;
    const endedAt = new Date().toISOString();
    const runId = runMeta.id ?? createRunId();
    const sanctionsBefore =
      runStartSanctionsRef.current ?? cloneSanctionsSnapshot(sanctionsState);
    const sanctionDelta = buildSanctionsDelta(sanctionsBefore, sanctionsState);
    const baseEntry = {
      id: runId,
      startedAt: runMeta.startedAt ?? endedAt,
      jurisdiction: runMeta.jurisdiction ?? config.jurisdiction,
      difficulty: runMeta.difficulty ?? config.difficulty,
      courtType: runMeta.courtType ?? config.courtType,
      playerRole: runMeta.playerRole ?? config.role,
      caseTitle: runMeta.caseTitle ?? history.case?.title ?? null,
      judgeName: runMeta.judgeName ?? history.case?.judge?.name ?? null,
    };
    const entry = {
      ...baseEntry,
      endedAt,
      outcome: disposition?.type ?? null,
      score:
        typeof verdict?.final_weighted_score === 'number' ? verdict.final_weighted_score : null,
      achievementId: achievementId ?? null,
      sanctionDelta,
    };
    const historySnapshot = loadRunHistory();
    const runs = historySnapshot.runs ?? [];
    const hasExisting = runs.some((run) => run.id === runId);
    const updatedRuns = hasExisting
      ? runs.map((run) => (run.id === runId ? { ...run, ...entry } : run))
      : [...runs, entry];
    saveRunHistory({
      ...historySnapshot,
      runs: capRunHistoryEntries(updatedRuns),
    });
    updateRunStats(Boolean(verdict));
    setRunMeta({ ...runMeta, endedAt });
  };

  const completeRun = ({
    verdict = null,
    disposition,
    achievementId = null,
    nextHistory,
    sanctionsAfter,
    endedAt,
  }) => {
    if (!isTerminalDisposition(disposition)) return;
    const resolvedEndedAt = endedAt ?? new Date().toISOString();
    const resolvedSanctionsState = sanctionsAfter ?? sanctionsState;
    finalizeRunHistoryEntry(verdict, disposition, achievementId);
    appendCaseHistoryEntry({
      disposition,
      endedAt: resolvedEndedAt,
      sanctionsAfter: resolvedSanctionsState,
      docketSnapshot: buildDocketSnapshot(nextHistory),
    });
    const outcomePayload = buildRunOutcome(disposition, resolvedSanctionsState);
    setRunOutcome(outcomePayload);
    emitShellEvent({ type: 'RUN_ENDED', payload: outcomePayload });
  };

  useEffect(() => {
    const expiryCandidates = [
      toTimestampMs(sanctionsState.expiresAt),
      toTimestampMs(sanctionsState.recentlyReinstatedUntil),
    ].filter((timestamp) => timestamp && timestamp > Date.now());
    if (expiryCandidates.length === 0) return undefined;
    const nextExpiryMs = Math.min(...expiryCandidates);
    const timeoutId = window.setTimeout(() => {
      setSanctionsState((prev) => normalizeSanctionsState(prev, Date.now()));
    }, Math.max(nextExpiryMs - Date.now(), 0));
    return () => window.clearTimeout(timeoutId);
  }, [sanctionsState.expiresAt, sanctionsState.recentlyReinstatedUntil, sanctionsState.state]);

  const showDebugBanner = (reason) => {
    if (!debugEnabled()) return;
    const message = `Strikes not applied: ${reason}`;
    setDebugBanner(message);
    if (debugBannerTimeoutRef.current) {
      window.clearTimeout(debugBannerTimeoutRef.current);
    }
    debugBannerTimeoutRef.current = window.setTimeout(() => {
      setDebugBanner(null);
    }, 4000);
  };

  const resetRunState = useCallback(() => {
    setLoadingMsg(null);
    setError(null);
    setCopied(false);
    setDebugBanner(null);
    setRunOutcome(null);
    runStartSanctionsRef.current = null;
    countedSanctionsRef.current = new Set();
    if (debugBannerTimeoutRef.current) {
      window.clearTimeout(debugBannerTimeoutRef.current);
      debugBannerTimeoutRef.current = null;
    }
    setHistory({ counselNotes: '', disposition: null });
    setRunMeta(null);
  }, []);

  /**
   * End the current run and surface the outcome to the app shell.
   */
  const resetGame = () => {
    const outcomePayload =
      runOutcome ?? buildRunOutcome(history.disposition ?? null, sanctionsState);
    emitShellEvent({ type: 'RUN_ENDED', payload: outcomePayload });
    resetRunState();
  };

  /**
   * Toggle a jury strike selection, enforcing the 2-strike limit.
   *
   * @param {number} id - Juror ID to toggle.
   */
  const toggleStrikeSelection = (id) => {
    setHistory((prev) => {
      if (!prev.jury) {
        logEvent('Jury strike selection ignored (jury state missing).');
        return prev;
      }
      const current = normalizeStrikeIds(prev.jury?.myStrikes || []);
      const normalizedId = normalizeJurorId(id);
      if (debugEnabled()) {
        console.debug('toggleStrikeSelection', {
          id,
          idType: typeof id,
          normalizedId,
          myStrikes: current,
        });
      }
      if (normalizedId === null) {
        logEvent('Jury strike selection ignored (invalid id).', { verbose: true });
        return prev;
      }
      if (current.includes(normalizedId)) {
        const updated = current.filter((x) => x !== normalizedId);
        logEvent(`Jury strike selection updated: [${updated.join(', ')}]`);
        return { ...prev, jury: { ...prev.jury, myStrikes: updated } };
      }
      if (current.length >= 2) return prev;
      const updated = [...current, normalizedId];
      logEvent(`Jury strike selection updated: [${updated.join(', ')}]`);
      return { ...prev, jury: { ...prev.jury, myStrikes: updated } };
    });
  };

  /**
   * Generate a new case and initialize the living docket.
   *
   * @param {string} role - Player role (defense or prosecution).
   * @param {string} difficulty - Difficulty setting.
   * @param {string} jurisdiction - Selected jurisdiction.
   * @param {string} courtType - Selected court type.
   * @returns {Promise<boolean>} Resolves with true when the case is generated successfully.
   */
  const generateCase = useCallback(async (role, difficulty, jurisdiction, courtType) => {
    resetRunState();
    setGameState(GAME_STATES.INITIALIZING);
    const normalizedDifficulty = normalizeDifficulty(difficulty);
    const resolvedCaseType = normalizeCaseType(DEFAULT_GAME_CONFIG.caseType);
    const resolvedJurisdiction = normalizeJurisdiction(
      jurisdiction ?? DEFAULT_GAME_CONFIG.jurisdiction
    );
    const resolvedCourtType = normalizeCourtType(courtType ?? DEFAULT_GAME_CONFIG.courtType);
    const isPublicDefenderMode = sanctionsState.state === SANCTION_STATES.PUBLIC_DEFENDER;
    const legacyNightCourt =
      resolvedJurisdiction === JURISDICTIONS.MUNICIPAL_NIGHT_COURT
        ? COURT_TYPES.NIGHT_COURT
        : null;
    const lockedJurisdiction = resolvedJurisdiction;
    const lockedCaseType = isPublicDefenderMode
      ? CASE_TYPES.PUBLIC_DEFENDER
      : resolvedCaseType;
    const lockedCourtType = isPublicDefenderMode
      ? COURT_TYPES.NIGHT_COURT
      : legacyNightCourt ?? resolvedCourtType;
    const lockedRole = isPublicDefenderMode ? 'defense' : role;
    setConfig({
      role: lockedRole,
      difficulty: normalizedDifficulty,
      jurisdiction: lockedJurisdiction,
      courtType: lockedCourtType,
      caseType: lockedCaseType,
    });

    try {
      const { parsed } = await requestLlmJson({
        userPrompt: 'Generate',
        systemPrompt: getGeneratorPrompt(
          normalizedDifficulty,
          lockedJurisdiction,
          lockedCourtType,
          lockedRole,
          {
            ...buildSanctionPromptContext(sanctionsState, {
              caseType: lockedCaseType,
              lockedJurisdiction,
            }),
          }
        ),
        responseLabel: 'case',
      });
      /** @type {CaseData} */
      const data = parseCaseResponse(parsed);

      const canonicalJurors = data.is_jury_trial
        ? canonicalizeJurorPool(data.jurors ?? [])
        : [];
      const juryPool = data.is_jury_trial ? buildInitialJurorPool(canonicalJurors) : [];
      const evidenceDocket = normalizeEvidenceDocket(data.evidence);

      const startedAt = new Date().toISOString();
      const runId = createRunId();
      runStartSanctionsRef.current = cloneSanctionsSnapshot(sanctionsState);
      setRunOutcome(null);
      setHistory({
        case: { ...data, evidence: evidenceDocket, jurors: canonicalJurors },
        jury: data.is_jury_trial
          ? { pool: juryPool, myStrikes: [], locked: false, invalidStrike: false }
          : { skipped: true },
        motion: data.is_jury_trial ? { locked: false } : createMotionState(),
        counselNotes: '',
        disposition: null,
        trial: { locked: false, rejectedVerdicts: [] },
        sanctions: [],
        validationHistory: [],
      });
      recordRunHistoryEntry({
        id: runId,
        startedAt,
        endedAt: null,
        jurisdiction: lockedJurisdiction,
        difficulty: normalizedDifficulty,
        courtType: lockedCourtType,
        playerRole: lockedRole,
        caseTitle: data.title,
        judgeName: data.judge?.name ?? null,
        outcome: null,
        score: null,
        achievementId: null,
        sanctionDelta: buildSanctionsDelta(runStartSanctionsRef.current, null),
      });
      setRunMeta({
        id: runId,
        startedAt,
        playerRole: lockedRole,
        difficulty: normalizedDifficulty,
        jurisdiction: lockedJurisdiction,
        courtType: lockedCourtType,
        caseTitle: data.title,
        judgeName: data.judge?.name ?? null,
      });

      setGameState(GAME_STATES.PLAYING);
      return true;
    } catch (err) {
      console.error(err);
      const message = getLlmClientErrorMessage(err, 'Docket creation failed. Please try again.');
      setError(message);
      emitShellEvent({ type: 'start_failed', message });
      return false;
    }
  }, [emitShellEvent, recordRunHistoryEntry, resetRunState, sanctionsState]);

  /**
   * Submit jury strikes and lock in the seated jurors.
   *
   * @param {number[]} strikes - Juror IDs selected for strikes.
   * @returns {Promise<void>} Resolves once strikes are processed.
   */
  const submitStrikes = async (strikes) => {
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.parse(startedAt);
    setError(null);
    setLoadingMsg('Judge is ruling on strikes...');
    const canonicalStrikes = normalizeStrikeIds(strikes);
    const hasInvalidStrikeIds =
      Array.isArray(strikes) && canonicalStrikes.length !== strikes.length;
    setLastAction({
      name: 'submitJuryStrikes',
      startedAt,
      endedAt: null,
      durationMs: null,
      payload: { selectedJurorIds: canonicalStrikes },
      result: null,
      rejectReason: null,
      rawModelText: null,
      parsed: null,
    });
    logEvent(`Jury strikes submit attempt: [${canonicalStrikes.join(', ')}]`);

    if (debugEnabled()) {
      const poolIds = getCanonicalJurorIds(history.jury?.pool ?? []);
      const docketIds = getCanonicalJurorIds(history.case?.jurors ?? []);
      const strikeTypes = Array.isArray(strikes) ? strikes.map((id) => typeof id) : [];
      const normalizationMap = {
        stringToNumber: {},
        numberToString: {},
      };
      [...(Array.isArray(strikes) ? strikes : []), ...poolIds, ...docketIds].forEach((id) => {
        if (typeof id === 'string') {
          const numeric = Number(id);
          if (!Number.isNaN(numeric)) {
            normalizationMap.stringToNumber[id] = numeric;
          }
        } else if (typeof id === 'number' && !Number.isNaN(id)) {
          normalizationMap.numberToString[id] = String(id);
        }
      });
      console.debug('submitStrikes pre-validation', {
        strikes,
        normalizedStrikes: canonicalStrikes,
        strikeTypes,
        poolIds,
        docketIds,
        normalizationMap,
      });
    }

    const finalizeAction = (details) => {
      const endedAt = new Date().toISOString();
      setLastAction({
        endedAt,
        durationMs: Date.parse(endedAt) - startedAtMs,
        ...details,
      });
    };

    if (!history.jury || history.jury.locked || history.jury.skipped) {
      finalizeAction({ result: 'noop', rejectReason: 'jury_unavailable' });
      logEvent('Jury strikes submit ignored (jury unavailable).');
      showDebugBanner('jury_unavailable');
      setLoadingMsg(null);
      return;
    }

    if (!Array.isArray(strikes) || hasInvalidStrikeIds) {
      finalizeAction({ result: 'rejected', rejectReason: 'invalid_selection' });
      logEvent('Jury strikes rejected: invalid_selection.');
      showDebugBanner('invalid_selection');
      setError('Selected juror IDs are invalid. Please reselect from the current pool.');
      setLoadingMsg(null);
      return;
    }

    const poolJurorIds = new Set(getCanonicalJurorIds(history.jury.pool ?? []));
    const docketJurorIds = new Set(getCanonicalJurorIds(history.case?.jurors ?? []));
    const allowedJurorIds = poolJurorIds.size ? poolJurorIds : docketJurorIds;
    const strikeValidation = validateStrikeIds(canonicalStrikes, [...allowedJurorIds]);

    if (!strikeValidation.ok) {
      finalizeAction({ result: 'rejected', rejectReason: 'invalid_selection' });
      logEvent('Jury strikes rejected: invalid_selection.');
      showDebugBanner('invalid_selection');
      setError('Selected juror IDs are invalid. Please reselect from the current pool.');
      setLoadingMsg(null);
      return;
    }

    if (canonicalStrikes.length !== 2) {
      logEvent('Jury strikes submitted with a non-standard selection count.', {
        verbose: true,
      });
    }

    try {
      let data = null;
      const debugFlags = getDebugState().flags;
      if (debugEnabled() && debugFlags.bypassJuryLlm) {
        const poolIds = getCanonicalJurorIds(history.jury.pool ?? []);
        const seatedIds = poolIds.filter((id) => !canonicalStrikes.includes(id));
        data = {
          opponent_strikes: [],
          seated_juror_ids: seatedIds,
          judge_comment: 'Bypass LLM enabled: auto-approving strikes.',
        };
        logEvent('Bypass LLM enabled: auto-approving jury strikes.');
      } else {
        logEvent('Jury strikes request started.');
        const { parsed, rawText } = await requestLlmJson({
          userPrompt: 'Strike',
          systemPrompt: getJuryStrikePrompt(
            buildDocketPromptCase(history.case),
            canonicalStrikes,
            config.role
          ),
          responseLabel: 'jury',
        });
        setLastAction({ rawModelText: rawText });
        logEvent('Jury strikes request finished.');
        logEvent(`Jury strikes raw payload size: ${rawText.length}`, {
          verbose: true,
        });
        try {
          data = parseJuryResponse(parsed);
          logEvent('Jury strikes parse success.');
        } catch (parseError) {
          finalizeAction({ result: 'parse_fail', rejectReason: 'parse_failed' });
          logEvent('Jury strikes parse failed.');
          showDebugBanner('parse_failed');
          setError(getLlmClientErrorMessage(parseError, 'Strike failed.'));
          setLoadingMsg(null);
          return;
        }
      }

      if (debugEnabled()) {
        const opponentStrikeTypes = (data.opponent_strikes ?? []).map((id) => typeof id);
        const seatedStrikeTypes = (data.seated_juror_ids ?? []).map((id) => typeof id);
        console.debug('jury strike parsed response', {
          opponentStrikes: data.opponent_strikes,
          opponentStrikeTypes,
          seatedJurorIds: data.seated_juror_ids,
          seatedJurorTypes: seatedStrikeTypes,
        });
      }

      setLastAction({ parsed: data });

      // The docket is the single source of truth for juror IDs; reject unknown or duplicate IDs.
      const docketJurorIds = new Set(getCanonicalJurorIds(history.case?.jurors ?? []));
      const normalizedOpponentStrikes = normalizeStrikeIds(data.opponent_strikes);
      const normalizedSeatedIds = normalizeStrikeIds(data.seated_juror_ids);
      const opponentValidation = validateStrikeIds(data.opponent_strikes, [
        ...docketJurorIds,
      ]);
      const seatedValidation = validateStrikeIds(data.seated_juror_ids, [
        ...docketJurorIds,
      ]);

      if (!opponentValidation.ok || !seatedValidation.ok) {
        const poolIds = getCanonicalJurorIds(history.jury?.pool ?? []);
        const docketIds = [...docketJurorIds];
        setLastAction({
          payload: {
            poolIds,
            docketIds,
            submittedIds: canonicalStrikes,
            invalidIds: {
              opponent: opponentValidation.invalidIds,
              seated: seatedValidation.invalidIds,
            },
            responseIds: {
              opponent: data.opponent_strikes ?? [],
              seated: data.seated_juror_ids ?? [],
            },
          },
        });
        finalizeAction({ result: 'rejected', rejectReason: 'invalid_ids' });
        logEvent('Jury strikes rejected: invalid_ids.');
        showDebugBanner('invalid_ids');
        setError('Strike results referenced jurors outside the docket. Please retry.');
        setLoadingMsg(null);
        return;
      }

      setHistory((prev) => {
        const playerStrikeIds = new Set(canonicalStrikes);
        const opponentStrikeIds = new Set(normalizedOpponentStrikes);
        const seatedIds = new Set(normalizedSeatedIds);
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
            myStrikes: canonicalStrikes,
            opponentStrikes: normalizedOpponentStrikes,
            seatedIds: normalizedSeatedIds,
            comment: data.judge_comment,
            invalidStrike: false,
            pool: updatedPool,
            locked: true,
          },
          motion: createMotionState(),
          counselNotes: deriveJuryCounselNotes(seatedJurors, config.role),
        };
      });
      finalizeAction({ result: 'success' });
      logEvent('Jury strikes applied successfully.');
      setLoadingMsg(null);
    } catch (err) {
      console.error(err);
      finalizeAction({ result: 'error', rejectReason: 'request_failed' });
      logEvent('Jury strikes request error.');
      showDebugBanner('request_failed');
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
      const visibilityContext = buildVisibilityContext(sanctionsState);
      const { parsed } = await requestLlmJson({
        userPrompt: isMotionStep ? 'Draft motion' : 'Draft rebuttal',
        systemPrompt: getOpposingCounselPrompt(
          buildDocketPromptCase(history.case),
          config.difficulty,
          history.motion.motionPhase,
          expectedRole,
          history.motion.motionText,
          visibilityContext,
          buildSanctionPromptContext(sanctionsState, {
            caseType: config.caseType,
            lockedJurisdiction: config.jurisdiction,
          })
        ),
        responseLabel: 'motion_text',
      });
      const data = parseMotionTextResponse(parsed);

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

    const startedAt = new Date().toISOString();
    const startedAtMs = Date.parse(startedAt);
    setLastAction({
      name: 'requestMotionRuling',
      startedAt,
      endedAt: null,
      durationMs: null,
      payload: {
        motionPhase: history.motion.motionPhase,
        motionBy: history.motion.motionBy,
        rebuttalBy: history.motion.rebuttalBy,
      },
      result: null,
      rejectReason: null,
      rawModelText: null,
      parsed: null,
    });
    setLoadingMsg('Judge is ruling on the motion...');
    try {
      const visibilityContext = buildVisibilityContext(sanctionsState);
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
      const { parsed, rawText } = await requestLlmJson({
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
          },
          visibilityContext,
          buildSanctionPromptContext(sanctionsState, {
            caseType: config.caseType,
            lockedJurisdiction: config.jurisdiction,
          })
        ),
        responseLabel: 'motion',
      });
      setLastAction({ rawModelText: rawText });
      /** @type {MotionResult} */
      const data = parseMotionResponse(parsed);
      setLastAction({ parsed: data });
      // Temporary instrumentation: remove after validating motion ruling payloads.
      console.info('Motion ruling received', {
        ruling: data?.ruling,
        outcomeText: data?.outcome_text,
      });
      const accountabilityEntry = buildAccountabilityEntry(data.accountability);
      const rulingDiff = applyMotionRulingDiff(history, data);
      const nextDisposition = deriveDispositionFromMotion({
        ...history.motion,
        ruling: data,
      });

      const nextHistory = {
        ...history,
        motion: {
          ...(history.motion ?? {}),
          ruling: {
            ...(history.motion?.ruling ?? {}),
            ...data,
            docket_entries: rulingDiff.docketEntries,
          },
          motionPhase: 'motion_ruling_locked',
          locked: true,
        },
        disposition: guardDisposition(history.disposition, nextDisposition),
        case: {
          ...history.case,
          evidence: rulingDiff.evidence,
        },
        counselNotes: deriveMotionCounselNotes(history.motion, data, config.role),
        trial: { ...history.trial, locked: false },
        sanctions: accountabilityEntry
          ? [...(history.sanctions ?? []), accountabilityEntry]
          : history.sanctions,
      };
      setHistory(nextHistory);
      const endedAt = new Date().toISOString();
      setLastAction({
        endedAt,
        durationMs: Date.parse(endedAt) - startedAtMs,
        result: 'success',
      });
      setLoadingMsg(null);
      completeRun({
        verdict: null,
        disposition: nextDisposition,
        achievementId: null,
        nextHistory,
        sanctionsAfter: sanctionsState,
        endedAt,
      });
    } catch (err) {
      console.error(err);
      const endedAt = new Date().toISOString();
      setLastAction({
        endedAt,
        durationMs: Date.parse(endedAt) - startedAtMs,
        result: 'error',
        rejectReason: 'validation_failed',
        payload:
          err instanceof LlmClientError
            ? err.context ?? { message: err.message }
            : { message: err?.message ?? 'Unknown error', error: err },
      });
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
    if (isTerminalDisposition(history.disposition)) {
      setError('This case has already reached a terminal disposition.');
      return;
    }
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
      const { parsed } = await requestLlmJson({
        userPrompt: 'Verdict',
        systemPrompt: getFinalVerdictPrompt(
          caseForVerdict,
          history.motion.ruling,
          seatedJurors,
          compliantArgument,
          config.difficulty,
          summarizeNonCompliance(argumentRecord),
          buildSanctionPromptContext(sanctionsState, {
            caseType: config.caseType,
            lockedJurisdiction: config.jurisdiction,
          })
        ),
        responseLabel: 'verdict',
      });
      /** @type {VerdictResult} */
      const data = parseVerdictResponse(parsed, {
        isJuryTrial: history.case?.is_jury_trial,
        seatedJurorIds: seatedJurors.map((juror) => juror.id),
        docketJurorIds: (history.case?.jurors ?? []).map((juror) => juror.id),
      });
      const accountabilityEntry = buildAccountabilityEntry(data.accountability);
      const nextDisposition = deriveDispositionFromVerdict(data);
      const hasTerminalDisposition = isTerminalDisposition(nextDisposition);
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

      if (!isVerdictCompliant) {
        setHistory((prev) => ({
          ...prev,
          trial: {
            ...prev.trial,
            text,
            verdict: prev.trial?.verdict,
            locked: false,
            rejectedVerdicts: [
              ...(prev.trial?.rejectedVerdicts ?? []),
              {
                payload: parsed,
                reason: 'Verdict referenced off-docket or inadmissible material.',
                validation: verdictRecord,
                timestamp: new Date().toISOString(),
              },
            ],
          },
          validationHistory: [...(prev.validationHistory ?? []), verdictRecord],
        }));
        setError('Verdict rejected for off-docket or inadmissible references.');
        setLoadingMsg(null);
        return;
      }
      const nextHistory = {
        ...history,
        trial: { text, verdict: data, locked: hasTerminalDisposition },
        disposition: guardDisposition(history.disposition, nextDisposition),
        counselNotes: deriveVerdictCounselNotes(data, config.role),
        validationHistory: [...(history.validationHistory ?? []), verdictRecord],
        sanctions: accountabilityEntry
          ? [...(history.sanctions ?? []), accountabilityEntry]
          : history.sanctions,
      };
      setHistory(nextHistory);
      const shouldReinstate =
        isMeritReleaseDisposition(nextDisposition) &&
        sanctionsState.state === SANCTION_STATES.PUBLIC_DEFENDER;
      // eslint-disable-next-line react-hooks/purity
      const nowMs = shouldReinstate ? Date.now() : null;
      const nextSanctionsState = shouldReinstate
        ? buildSanctionsState(SANCTION_STATES.RECENTLY_REINSTATED, nowMs, {
            lastMisconductAt: sanctionsState.lastMisconductAt,
            recidivismCount: sanctionsState.recidivismCount,
          })
        : sanctionsState;
      if (shouldReinstate) {
        setSanctionsState(nextSanctionsState);
      }
      if (data.achievement_title) {
        appendAchievement(data.achievement_title);
      }
      if (hasTerminalDisposition) {
        completeRun({
          verdict: data,
          disposition: nextDisposition,
          achievementId: data.achievement_title ?? null,
          nextHistory,
          sanctionsAfter: nextSanctionsState,
        });
      }
      setLoadingMsg(null);
    } catch (err) {
      console.error(err);
      setError(getLlmClientErrorMessage(err, 'Verdict failed.'));
      setLoadingMsg(null);
    }
  };

  /**
   * Generate a lightweight auto-drafted player submission for playtesting.
   *
   * @param {'legit' | 'absurd'} mode - Generation mode.
   * @param {'motion' | 'argument'} stage - Submission stage.
   * @returns {Promise<string>} Generated submission text.
   */
  const generateAutoSubmission = async (mode, stage) => {
    if (!['legit', 'absurd'].includes(mode) || !['motion', 'argument'].includes(stage)) {
      return '';
    }

    const opposingArgument =
      stage === 'motion'
        ? history.motion?.motionPhase === 'rebuttal_submission'
          ? history.motion?.motionText ?? ''
          : ''
        : history.motion?.rebuttalText || history.motion?.motionText || '';

    setError(null);
    setLoadingMsg(mode === 'absurd' ? 'Generating chaos...' : 'Generating draft argument...');
    try {
      const { parsed } = await requestLlmJson({
        userPrompt: `Auto ${mode} ${stage}`,
        systemPrompt: getAutoSubmissionPrompt({
          stage,
          mode,
          caseData: buildDocketPromptCase(history.case),
          playerRole: config.role,
          opposingArgument,
        }),
        responseLabel: 'auto_submission',
      });
      const data = parseMotionTextResponse(parsed);
      setLoadingMsg(null);
      return data.text;
    } catch (err) {
      console.error(err);
      setError(getLlmClientErrorMessage(err, 'Auto-generation failed.'));
      setLoadingMsg(null);
      return '';
    }
  };

  const formatJurorLabel = (id, pool = []) => {
    const juror = pool.find((entry) => entry.id === id);
    if (juror?.name) return `${juror.name} (#${juror.id})`;
    return `Juror #${id}`;
  };

  const formatJurorList = (ids = [], pool = []) =>
    ids.map((id) => formatJurorLabel(id, pool)).join(', ');

  const buildSanctionsSection = (sanctions = []) => {
    if (!sanctions.length) return null;
    const lines = sanctions.map((entry) => {
        const state = entry.state ? entry.state.toUpperCase() : 'NOTICE';
        return `- ${state}: ${entry.docket_text}`;
      });
    return `SANCTIONS/STATUS FLAGS:\n${lines.join('\n')}`;
  };

  const toJsonClone = (value) => JSON.parse(JSON.stringify(value));

  const buildDocketSnapshot = (historyState) => {
    const snapshot = {
      case: toJsonClone(historyState.case ?? null),
      jury: toJsonClone(historyState.jury ?? null),
      motion: toJsonClone(historyState.motion ?? null),
      trial: toJsonClone(historyState.trial ?? null),
      disposition: toJsonClone(historyState.disposition ?? null),
      sanctions: toJsonClone(historyState.sanctions ?? []),
      counselNotes: historyState.counselNotes ?? '',
      validationHistory: toJsonClone(historyState.validationHistory ?? []),
    };

    return {
      generatedAt: new Date().toISOString(),
      sections: {
        case: snapshot.case,
        header: {
          title: snapshot.case?.title ?? null,
          judge: snapshot.case?.judge?.name ?? null,
        },
        facts: snapshot.case?.facts ?? [],
        jury: snapshot.jury,
        motion: snapshot.motion,
        trial: snapshot.trial,
        disposition: snapshot.disposition,
        sanctions: snapshot.sanctions,
        counselNotes: snapshot.counselNotes,
        validationHistory: snapshot.validationHistory,
      },
    };
  };

  /**
   * Copy the full docket history to the clipboard.
   *
   * @param {number} [docketNumber] - Optional docket number to include in the header.
   */
  const handleCopyFull = async (docketNumber) => {
    const sections = [];
    const headerLines = [`DOCKET: ${history.case.title}`, `JUDGE: ${history.case.judge.name}`];
    if (typeof docketNumber === 'number') {
      headerLines.push(`DOCKET #: ${docketNumber}`);
    }
    sections.push(headerLines.join('\n'));

    if (history.case.facts?.length) {
      sections.push(`FACTS:\n${history.case.facts.join('\n')}`);
    }

    if (history.jury && !history.jury.skipped && history.jury.locked) {
      const seatedJurors = history.jury.pool.filter((juror) => juror.status === 'seated');
      const juryLines = [];
      if (seatedJurors.length) {
        juryLines.push(`Seated Jurors: ${formatJurorList(history.jury.seatedIds, history.jury.pool)}`);
      }
      if (history.jury.comment) {
        juryLines.push(history.jury.comment);
      }
      const strikeLines = [];
      if (history.jury.myStrikes?.length) {
        strikeLines.push(`Player Strikes: ${formatJurorList(history.jury.myStrikes, history.jury.pool)}`);
      }
      if (history.jury.opponentStrikes?.length) {
        strikeLines.push(
          `Opponent Strikes: ${formatJurorList(history.jury.opponentStrikes, history.jury.pool)}`
        );
      }
      if (strikeLines.length) {
        juryLines.push(strikeLines.join('\n'));
      }
      if (juryLines.length) {
        sections.push(`JURY SEATED (${seatedJurors.length}):\n${juryLines.join('\n')}`);
      }
    }

    if (history.motion) {
      const motionLines = [];
      const motionLabel =
        history.motion.motionBy === 'prosecution' ? 'Prosecution Motion' : 'Defense Motion';
      const rebuttalLabel =
        history.motion.rebuttalBy === 'prosecution' ? 'Prosecution Rebuttal' : 'Defense Rebuttal';
      if (history.motion.motionText) {
        motionLines.push(`${motionLabel}:\n"${stripMarkdown(history.motion.motionText)}"`);
      }
      if (history.motion.rebuttalText) {
        motionLines.push(`${rebuttalLabel}:\n"${stripMarkdown(history.motion.rebuttalText)}"`);
      }
      if (history.motion.ruling) {
        motionLines.push(
          `RULING: ${history.motion.ruling.ruling} - "${history.motion.ruling.outcome_text}"`
        );
      }
      if (motionLines.length) {
        sections.push(`PRE-TRIAL MOTIONS:\n${motionLines.join('\n\n')}`);
      }
    }

    if (history.counselNotes?.trim()) {
      sections.push(
        `COUNSEL NOTES (NON-RECORD FLAVOR):\n${history.counselNotes.trim()}`
      );
    }

    // Terminal motion outcomes (ex: dismissal) override later-phase export content.
    const disposition = history.disposition;
    const reachedTrial = Boolean(history.trial?.text?.trim());
    const shouldStopAtDisposition =
      disposition?.source === 'motion' && isTerminalDisposition(disposition);

    if (reachedTrial && !shouldStopAtDisposition) {
      sections.push(`TRIAL ARGUMENT:\n"${stripMarkdown(history.trial.text)}"`);
    }

    if (disposition) {
      const dispositionLines = [];
      if (disposition.summary) {
        dispositionLines.push(`OUTCOME: ${disposition.summary}`);
      }
      if (disposition.details) {
        dispositionLines.push(disposition.details);
      }
      sections.push(`FINAL DISPOSITION:\n${dispositionLines.join('\n')}`);
    }

    if (!shouldStopAtDisposition && history.trial?.verdict) {
      const verdict = history.trial.verdict;
      const roundedScore = Math.round(verdict.final_weighted_score);
      const baseScore = Math.min(100, Math.max(0, roundedScore));
      const scoreLines = [`BASE SCORE: ${baseScore}/100`];
      if (verdict.final_weighted_score > 100) {
        scoreLines.push(
          `OVERFLOW: ${verdict.overflow_reason_code} - ${verdict.overflow_explanation} (${roundedScore}/100)`
        );
      }
      if (verdict.achievement_title) {
        scoreLines.push(`ACHIEVEMENT: ${verdict.achievement_title}`);
      }
      sections.push(`SCORE + ACHIEVEMENT:\n${scoreLines.join('\n')}`);
    }

    const sanctionsSection = buildSanctionsSection(history.sanctions);
    if (sanctionsSection) {
      sections.push(sanctionsSection);
    }

    const log = sections.join('\n\n');
    const didCopy = await copyToClipboard(log);
    if (didCopy) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopied(false);
    }
  };

  return {
    gameState,
    history,
    config,
    loadingMsg,
    error,
    copied,
    debugBanner,
    runOutcome,
    sanctionsState,
    generateCase,
    submitStrikes,
    submitMotionStep,
    triggerAiMotionSubmission,
    requestMotionRuling,
    submitArgument,
    generateAutoSubmission,
    handleCopyFull,
    resetGame,
    toggleStrikeSelection,
  };
};

export default useGameState;
export const __testables = {
  SANCTION_STATES,
  buildDefaultSanctionsState,
  countNewSanctionEntries,
  deriveSanctionsState,
  evaluateConductTrigger,
  RECIDIVISM_WINDOW_MS,
  SANCTION_DURATION_MS,
};
