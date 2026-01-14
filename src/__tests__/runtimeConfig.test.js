import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getActiveApiKey,
  getApiKeyStorageKey,
  persistApiKey,
  setRuntimeApiKey,
} from '../lib/runtimeConfig';

describe('runtime config', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setRuntimeApiKey('');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
    setRuntimeApiKey('');
  });

  it('uses the runtime key over the environment key', () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'env-key');
    setRuntimeApiKey('runtime-key');

    expect(getActiveApiKey()).toBe('runtime-key');
  });

  it('persists and clears the stored key based on the remember toggle', () => {
    const storageKey = getApiKeyStorageKey();

    persistApiKey('stored-key', true);
    expect(window.localStorage.getItem(storageKey)).toBe('stored-key');

    persistApiKey('stored-key', false);
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });
});
