const GEMINI_STORAGE_KEY = 'pocketcourt.geminiKey';

/**
 * Supported AI providers for runtime selection.
 *
 * @type {{value: string, label: string}[]}
 */
export const AI_PROVIDERS = [{ value: 'gemini', label: 'Gemini' }];

let runtimeApiKey = '';

/**
 * Set the runtime API key for the current session.
 *
 * @param {string} key - API key provided by the user.
 */
export const setRuntimeApiKey = (key) => {
  runtimeApiKey = typeof key === 'string' ? key.trim() : '';
};

/**
 * Read the runtime API key that overrides environment config.
 *
 * @returns {string} The current runtime API key, or an empty string.
 */
export const getRuntimeApiKey = () => runtimeApiKey;

/**
 * Resolve the Gemini API key from the build-time environment.
 *
 * @returns {string} The environment API key, or an empty string.
 */
const getEnvApiKey = () => import.meta.env.VITE_GEMINI_API_KEY ?? '';

/**
 * Retrieve the active API key (runtime overrides env).
 *
 * @returns {string} The API key to use for requests.
 */
export const getActiveApiKey = () => runtimeApiKey || getEnvApiKey();

/**
 * Load the remembered API key from localStorage, if available.
 *
 * @returns {string} The stored key, or an empty string.
 */
export const loadStoredApiKey = () => {
  if (typeof window === 'undefined') return '';
  try {
    const storedKey = window.localStorage.getItem(GEMINI_STORAGE_KEY) ?? '';
    if (storedKey) {
      runtimeApiKey = storedKey;
    }
    return storedKey;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to read API key from localStorage.', error);
    }
    return runtimeApiKey;
  }
};

/**
 * Persist the runtime API key when the user opts in to remembering it.
 *
 * @param {string} key - API key to persist.
 * @param {boolean} remember - Whether to persist the key on this device.
 */
export const persistApiKey = (key, remember) => {
  const sanitizedKey = typeof key === 'string' ? key.trim() : '';
  runtimeApiKey = sanitizedKey;
  if (typeof window === 'undefined') return;

  if (remember && sanitizedKey) {
    try {
      window.localStorage.setItem(GEMINI_STORAGE_KEY, sanitizedKey);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Failed to save API key to localStorage.', error);
      }
      return;
    }
    return;
  }

  try {
    window.localStorage.removeItem(GEMINI_STORAGE_KEY);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Failed to remove API key from localStorage.', error);
    }
    return;
  }
};

/**
 * Expose the storage key for tests and diagnostics.
 *
 * @returns {string} The localStorage key used for persistence.
 */
export const getApiKeyStorageKey = () => GEMINI_STORAGE_KEY;
