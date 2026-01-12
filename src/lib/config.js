/**
 * Centralized configuration values for Pocket Court.
 * Keep these values in sync with UI selectors and environment expectations.
 */

/**
 * API key for the Gemini model. Expected to be supplied via Vite env.
 *
 * @type {string}
 */
export const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';

/**
 * Supported difficulty options for the game setup flow.
 *
 * @type {{value: string, label: string}[]}
 */
export const DIFFICULTY_OPTIONS = [
  { value: 'silly', label: 'Silly' },
  { value: 'regular', label: 'Regular' },
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
  difficulty: 'regular',
  jurisdiction: 'USA',
  role: 'defense',
};
