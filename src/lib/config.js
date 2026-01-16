/**
 * Centralized configuration values for Pocket Court.
 * Keep these values in sync with UI selectors and environment expectations.
 */

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

/**
 * Supported jurisdictions for case generation.
 *
 * @type {{value: string, label: string}[]}
 */
export const JURISDICTIONS = [
  { value: 'USA', label: 'USA' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Fictional', label: 'Fictional' },
];

/**
 * Default configuration values for a new game session.
 *
 * @type {{difficulty: string, jurisdiction: string, role: string}}
 */
export const DEFAULT_GAME_CONFIG = {
  difficulty: DEFAULT_DIFFICULTY,
  jurisdiction: 'USA',
  role: 'defense',
};
