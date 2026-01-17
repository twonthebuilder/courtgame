import {
  PROFILE_SCHEMA_VERSION,
  PROFILE_STORAGE_KEY,
  RUN_HISTORY_SCHEMA_VERSION,
  RUN_HISTORY_STORAGE_KEY,
} from './constants';

const LEGACY_SANCTIONS_STORAGE_KEY = 'courtgame.sanctions.state';

const hasWindowStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const nowIso = () => new Date().toISOString();

const parseStoredJson = (rawValue) => {
  if (!rawValue) return { value: null, error: null };
  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object') {
      return { value: null, error: new Error('Stored data is not an object.') };
    }
    return { value: parsed, error: null };
  } catch (error) {
    return { value: null, error };
  }
};

const loadStoredObject = (key, label) => {
  if (!hasWindowStorage()) return { value: null, error: null };
  const rawValue = window.localStorage.getItem(key);
  const { value, error } = parseStoredJson(rawValue);
  if (error) {
    console.warn(`Failed to parse stored ${label}.`, error);
  }
  return { value, error };
};

const saveStoredObject = (key, payload) => {
  if (!hasWindowStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(payload));
};

export const defaultPlayerProfile = () => {
  const timestamp = nowIso();
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    sanctions: null,
    pdStatus: null,
    reinstatement: null,
    stats: {
      runsCompleted: 0,
      verdictsFinalized: 0,
    },
    achievements: [],
  };
};

export const defaultRunHistory = () => {
  const timestamp = nowIso();
  return {
    schemaVersion: RUN_HISTORY_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    runs: [],
  };
};

const normalizeProfile = (profile) => {
  if (profile?.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    console.warn('Stored player profile schema mismatch. Resetting to defaults.');
    const reset = defaultPlayerProfile();
    saveStoredObject(PROFILE_STORAGE_KEY, reset);
    return reset;
  }
  return profile;
};

const normalizeRunHistory = (history) => {
  if (history?.schemaVersion !== RUN_HISTORY_SCHEMA_VERSION) {
    console.warn('Stored run history schema mismatch. Resetting to defaults.');
    const reset = defaultRunHistory();
    saveStoredObject(RUN_HISTORY_STORAGE_KEY, reset);
    return reset;
  }
  return history;
};

export const loadPlayerProfile = () => {
  if (!hasWindowStorage()) return defaultPlayerProfile();

  const { value, error } = loadStoredObject(PROFILE_STORAGE_KEY, 'player profile');
  if (error) {
    const reset = defaultPlayerProfile();
    saveStoredObject(PROFILE_STORAGE_KEY, reset);
    return reset;
  }
  if (value) return normalizeProfile(value);

  // Migration: pull legacy sanctions state into the profile when no v1 data exists.
  const { value: legacySanctions, error: legacyError } = loadStoredObject(
    LEGACY_SANCTIONS_STORAGE_KEY,
    'legacy sanctions state',
  );
  if (legacyError) {
    const reset = defaultPlayerProfile();
    saveStoredObject(PROFILE_STORAGE_KEY, reset);
    return reset;
  }

  if (legacySanctions) {
    const migrated = { ...defaultPlayerProfile(), sanctions: legacySanctions };
    saveStoredObject(PROFILE_STORAGE_KEY, migrated);
    return migrated;
  }

  const freshProfile = defaultPlayerProfile();
  saveStoredObject(PROFILE_STORAGE_KEY, freshProfile);
  return freshProfile;
};

export const savePlayerProfile = (profile) => {
  if (!hasWindowStorage()) return null;
  const timestamp = nowIso();
  const payload = {
    ...profile,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    createdAt: profile?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  saveStoredObject(PROFILE_STORAGE_KEY, payload);
  return payload;
};

export const loadRunHistory = () => {
  if (!hasWindowStorage()) return defaultRunHistory();
  const { value, error } = loadStoredObject(RUN_HISTORY_STORAGE_KEY, 'run history');
  if (error) {
    const reset = defaultRunHistory();
    saveStoredObject(RUN_HISTORY_STORAGE_KEY, reset);
    return reset;
  }
  if (value) return normalizeRunHistory(value);
  const freshHistory = defaultRunHistory();
  saveStoredObject(RUN_HISTORY_STORAGE_KEY, freshHistory);
  return freshHistory;
};

export const saveRunHistory = (history) => {
  if (!hasWindowStorage()) return null;
  const timestamp = nowIso();
  const payload = {
    ...history,
    schemaVersion: RUN_HISTORY_SCHEMA_VERSION,
    createdAt: history?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  saveStoredObject(RUN_HISTORY_STORAGE_KEY, payload);
  return payload;
};

export {
  PROFILE_STORAGE_KEY,
  RUN_HISTORY_STORAGE_KEY,
  PROFILE_SCHEMA_VERSION,
  RUN_HISTORY_SCHEMA_VERSION,
};
