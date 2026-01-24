/**
 * Canonical identifiers and contract values for Pocket Court.
 * These constants are the single source of truth for lifecycle and outcome logic.
 */

export const GAME_STATES = Object.freeze({
  START: 'start',
  INITIALIZING: 'initializing',
  PLAYING: 'playing',
  ENDED: 'ended',
});

export const GAME_PHASES = Object.freeze({
  SETUP: 'setup',
  JURY_SELECTION: 'jury_selection',
  PRETRIAL: 'pretrial',
  TRIAL: 'trial',
  VERDICT: 'verdict',
  ENDED: 'ended',
});

export const FINAL_DISPOSITIONS = Object.freeze({
  GUILTY: 'guilty',
  NOT_GUILTY: 'not_guilty',
  MISTRIAL_HUNG_JURY: 'mistrial_hung_jury',
  MISTRIAL_CONDUCT: 'mistrial_conduct',
  DISMISSED: 'dismissed',
  DISMISSED_WITH_PREJUDICE: 'dismissed_with_prejudice',
  DISMISSED_WITHOUT_PREJUDICE: 'dismissed_without_prejudice',
});

export const TERMINAL_DISPOSITIONS = new Set(Object.values(FINAL_DISPOSITIONS));

export const SANCTION_STATES = Object.freeze({
  CLEAN: 'clean',
  WARNED: 'warned',
  SANCTIONED: 'sanctioned',
  PUBLIC_DEFENDER: 'public_defender',
  RECENTLY_REINSTATED: 'recently_reinstated',
});

export const SANCTION_LEVELS = Object.freeze({
  [SANCTION_STATES.CLEAN]: 0,
  [SANCTION_STATES.WARNED]: 1,
  [SANCTION_STATES.SANCTIONED]: 2,
  [SANCTION_STATES.PUBLIC_DEFENDER]: 3,
  [SANCTION_STATES.RECENTLY_REINSTATED]: 1,
});

export const SANCTION_ENTRY_STATES = Object.freeze({
  NOTICED: 'noticed',
  WARNED: 'warned',
  SANCTIONED: 'sanctioned',
});

export const SANCTION_REASON_CODES = Object.freeze({
  CONTEMPT: 'contempt',
  DECORUM_VIOLATION: 'decorum_violation',
  EVIDENCE_VIOLATION: 'evidence_violation',
  MISREPRESENTATION: 'misrepresentation',
  DISCOVERY_VIOLATION: 'discovery_violation',
  DEADLINE_VIOLATION: 'deadline_violation',
  OTHER: 'other',
});

export const SANCTION_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  SEALED: 'sealed',
  INTERNAL: 'internal',
});

export const CASE_TYPES = Object.freeze({
  STANDARD: 'standard',
  PUBLIC_DEFENDER: 'public_defender',
});

export const COURT_TYPES = Object.freeze({
  STANDARD: 'standard',
  NIGHT_COURT: 'nightCourt',
  SUPREME_COURT: 'supremeCourt',
});

export const JURISDICTIONS = Object.freeze({
  USA: 'USA',
  CANADA: 'Canada',
  FICTIONAL: 'Fictional',
  MUNICIPAL_NIGHT_COURT: 'Municipal Night Court',
});

export const SANCTIONS_TIMERS_MS = Object.freeze({
  RECIDIVISM_WINDOW: 30 * 60 * 1000,
  COOLDOWN_RESET: 2 * 60 * 60 * 1000,
  WARNING_DURATION: 20 * 60 * 1000,
  SANCTION_DURATION: 45 * 60 * 1000,
  PUBLIC_DEFENDER_DURATION: 60 * 60 * 1000,
  REINSTATEMENT_GRACE: 20 * 60 * 1000,
});

export const PROFILE_STORAGE_KEY = 'pocketcourt.profile.v1';
export const RUN_HISTORY_STORAGE_KEY = 'pocketcourt.runHistory.v1';
export const PROFILE_SCHEMA_VERSION = 1;
export const RUN_HISTORY_SCHEMA_VERSION = 2;

const isCanonicalValue = (value, values) => values.includes(value);

/**
 * Normalize case type inputs into canonical identifiers.
 *
 * @param {string} value - Case type to normalize.
 * @returns {string} Canonical case type identifier.
 */
export const normalizeCaseType = (value) =>
  isCanonicalValue(value, Object.values(CASE_TYPES)) ? value : CASE_TYPES.STANDARD;

/**
 * Normalize jurisdiction inputs into canonical identifiers.
 *
 * @param {string} value - Jurisdiction to normalize.
 * @returns {string} Canonical jurisdiction identifier.
 */
export const normalizeJurisdiction = (value) =>
  isCanonicalValue(value, Object.values(JURISDICTIONS)) ? value : JURISDICTIONS.USA;

/**
 * Normalize sanctions state inputs into canonical identifiers.
 *
 * @param {string} value - Sanctions state to normalize.
 * @returns {string} Canonical sanctions state identifier.
 */
export const normalizeSanctionState = (value) =>
  isCanonicalValue(value, Object.values(SANCTION_STATES)) ? value : SANCTION_STATES.CLEAN;

/**
 * Normalize game state inputs into canonical identifiers.
 *
 * @param {string} value - Game state to normalize.
 * @returns {string} Canonical game state identifier.
 */
export const normalizeGameState = (value) =>
  isCanonicalValue(value, Object.values(GAME_STATES)) ? value : GAME_STATES.START;
