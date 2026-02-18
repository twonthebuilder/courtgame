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
  { value: JURISDICTIONS.FICTIONAL, label: 'Fictional' },
  { value: JURISDICTIONS.CANADA, label: 'Canada' },
  { value: JURISDICTIONS.USA, label: 'USA' },
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
  difficulty: 'silly',
  jurisdiction: JURISDICTIONS.FICTIONAL,
  courtType: COURT_TYPES.NIGHT_COURT,
  role: 'defense',
  caseType: CASE_TYPES.STANDARD,
};

export const DEFAULT_LLM_PROVIDER = 'gemini';
export const DEFAULT_LLM_MODEL = 'gemini-2.5-flash-preview-09-2025';

const LLM_ENV_KEYS = {
  provider: 'VITE_LLM_PROVIDER',
  model: 'VITE_LLM_MODEL',
  endpoint: 'VITE_LLM_ENDPOINT',
};

/**
 * Supported AI providers for runtime selection.
 *
 * @type {{value: string, label: string}[]}
 */
export const AI_PROVIDERS = [{ value: DEFAULT_LLM_PROVIDER, label: 'Gemini' }];

const LLM_MODEL_ENDPOINTS = {
  gemini: {
    'gemini-2.5-flash-preview-09-2025':
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent',
    'gemini-2.5-flash':
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  },
};

/**
 * Resolve and validate LLM provider/model/endpoint settings.
 *
 * Invalid or missing provider/model values fall back to canonical defaults.
 * Endpoint overrides must be a valid URL.
 *
 * @param {Record<string, string | undefined>} [env] - Environment object (defaults to import.meta.env).
 * @returns {{provider: string, model: string, endpoint: string, isFallback: boolean, warnings: string[]}}
 */
export const resolveLlmConfig = (env = import.meta.env ?? {}) => {
  const warnings = [];
  const configuredProvider = env[LLM_ENV_KEYS.provider]?.trim().toLowerCase();
  const configuredModel = env[LLM_ENV_KEYS.model]?.trim();
  const configuredEndpoint = env[LLM_ENV_KEYS.endpoint]?.trim();

  let provider = configuredProvider || DEFAULT_LLM_PROVIDER;
  if (!LLM_MODEL_ENDPOINTS[provider]) {
    warnings.push(
      `Unsupported provider "${configuredProvider}". Falling back to ${DEFAULT_LLM_PROVIDER}.`
    );
    provider = DEFAULT_LLM_PROVIDER;
  }

  const providerModels = LLM_MODEL_ENDPOINTS[provider];
  let model = configuredModel || DEFAULT_LLM_MODEL;
  if (!providerModels[model]) {
    warnings.push(
      `Unsupported model "${configuredModel}" for provider "${provider}". Falling back to ${DEFAULT_LLM_MODEL}.`
    );
    model = DEFAULT_LLM_MODEL;
  }

  const defaultEndpoint = providerModels[model];
  let endpoint = defaultEndpoint;
  if (configuredEndpoint) {
    try {
      const parsed = new URL(configuredEndpoint);
      endpoint = parsed.toString();
    } catch {
      warnings.push(
        `Invalid endpoint override "${configuredEndpoint}". Falling back to model default endpoint.`
      );
    }
  }

  return {
    provider,
    model,
    endpoint,
    isFallback: warnings.length > 0,
    warnings,
  };
};

/**
 * Strictly validate a model identifier for a provider.
 *
 * @param {string} provider - Provider identifier.
 * @param {string} model - Model identifier.
 * @returns {{endpoint: string}}
 */
export const getEndpointForModel = (provider, model) => {
  const providerModels = LLM_MODEL_ENDPOINTS[provider];
  if (!providerModels) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const endpoint = providerModels[model];
  if (!endpoint) {
    throw new Error(`Unsupported model "${model}" for provider "${provider}"`);
  }
  return { endpoint };
};
