/**
 * Centralized configuration values for Pocket Court.
 * Keep these values in sync with UI selectors and environment expectations.
 */

import { CASE_TYPES, COURT_TYPES, JURISDICTIONS } from './constants';

export const DEFAULT_DIFFICULTY = 'normal';

const DIFFICULTY_ALIASES = {
  regular: DEFAULT_DIFFICULTY,
};

export const CANONICAL_DIFFICULTIES = ['silly', 'normal', 'nuance'];

/**
 * Normalize difficulty inputs (including legacy aliases) into canonical IDs.
 *
 * @param {string} value - Difficulty value to normalize.
 * @returns {string} Canonical difficulty identifier.
 */
export const normalizeDifficulty = (value) => {
  if (typeof value !== 'string') return DEFAULT_DIFFICULTY;
  const normalized = value.trim().toLowerCase();
  if (DIFFICULTY_ALIASES[normalized]) return DIFFICULTY_ALIASES[normalized];
  if (CANONICAL_DIFFICULTIES.includes(normalized)) return normalized;
  return DEFAULT_DIFFICULTY;
};

/**
 * Supported difficulty options for the game setup flow.
 *
 * @type {{value: string, label: string}[]}
 */
export const DIFFICULTY_OPTIONS = [
  { value: 'silly', label: 'Silly' },
  { value: 'normal', label: 'Normal' },
  { value: 'nuance', label: 'Nuance' },
];

const COURT_TYPE_ALIASES = {
  'municipal night court': COURT_TYPES.NIGHT_COURT,
  'night court': COURT_TYPES.NIGHT_COURT,
  'supreme court': COURT_TYPES.SUPREME_COURT,
};

export const CANONICAL_COURT_TYPES = Object.values(COURT_TYPES);

/**
 * Normalize court type inputs (including legacy aliases) into canonical IDs.
 *
 * @param {string} value - Court type value to normalize.
 * @returns {string} Canonical court type identifier.
 */
export const normalizeCourtType = (value) => {
  if (typeof value !== 'string') return COURT_TYPES.STANDARD;
  const normalized = value.trim().toLowerCase();
  if (COURT_TYPE_ALIASES[normalized]) return COURT_TYPE_ALIASES[normalized];
  if (CANONICAL_COURT_TYPES.includes(value)) return value;
  return COURT_TYPES.STANDARD;
};

/**
 * Supported court types for the game setup flow.
 *
 * @type {{value: string, label: string}[]}
 */
export const COURT_TYPE_OPTIONS = [
  { value: COURT_TYPES.NIGHT_COURT, label: 'Night Court' },
  { value: COURT_TYPES.STANDARD, label: 'Standard' },
  { value: COURT_TYPES.SUPREME_COURT, label: 'Supreme Court' },
];

/**
 * Supported jurisdictions for case generation.
 *
 * @type {{value: string, label: string}[]}
 */
export const JURISDICTION_OPTIONS = [
  { value: JURISDICTIONS.USA, label: 'USA' },
  { value: JURISDICTIONS.CANADA, label: 'Canada' },
  { value: JURISDICTIONS.FICTIONAL, label: 'Fictional' },
];

/**
 * Supported case types for game setup.
 *
 * @type {{value: string, label: string}[]}
 */
export const CASE_TYPE_OPTIONS = [
  { value: CASE_TYPES.STANDARD, label: 'Standard' },
  { value: CASE_TYPES.PUBLIC_DEFENDER, label: 'Public Defender' },
];

/**
 * Default configuration values for a new game session.
 *
 * @type {{difficulty: string, jurisdiction: string, courtType: string, role: string, caseType: string}}
 */
export const DEFAULT_GAME_CONFIG = {
  difficulty: DEFAULT_DIFFICULTY,
  jurisdiction: JURISDICTIONS.USA,
  courtType: COURT_TYPES.STANDARD,
  role: 'defense',
  caseType: CASE_TYPES.STANDARD,
};
