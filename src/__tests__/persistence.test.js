import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  defaultPlayerProfile,
  defaultRunHistory,
  loadPlayerProfile,
  loadRunHistory,
  savePlayerProfile,
  saveRunHistory,
} from '../lib/persistence';

const LEGACY_SANCTIONS_KEY = 'courtgame.sanctions.state';
const PROFILE_KEY = 'pocketcourt.profile.v1';

describe('persistence helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('builds default player profile metadata', () => {
    const profile = defaultPlayerProfile();
    expect(profile.schemaVersion).toBe(1);
    expect(profile.createdAt).toBeTruthy();
    expect(profile.updatedAt).toBeTruthy();
    expect(profile.sanctions).toBeNull();
    expect(profile.pdStatus).toBeNull();
    expect(profile.reinstatement).toBeNull();
    expect(profile.stats).toEqual({ runsCompleted: 0, verdictsFinalized: 0 });
    expect(profile.achievements).toEqual([]);
  });

  it('builds default run history metadata', () => {
    const history = defaultRunHistory();
    expect(history.schemaVersion).toBe(1);
    expect(history.createdAt).toBeTruthy();
    expect(history.updatedAt).toBeTruthy();
    expect(history.runs).toEqual([]);
  });

  it('roundtrips player profiles via localStorage', () => {
    const saved = savePlayerProfile({ sanctions: { state: 'clean' } });
    const loaded = loadPlayerProfile();
    expect(loaded).toMatchObject(saved);
  });

  it('persists v1 schema metadata when saving and loading profiles', () => {
    const saved = savePlayerProfile({ schemaVersion: 0, sanctions: { state: 'clean' } });

    expect(saved.schemaVersion).toBe(1);
    expect(JSON.parse(window.localStorage.getItem(PROFILE_KEY))).toMatchObject({
      schemaVersion: 1,
    });

    const loaded = loadPlayerProfile();
    expect(loaded.schemaVersion).toBe(1);
  });

  it('roundtrips run history via localStorage', () => {
    const saved = saveRunHistory({ runs: [{ id: 'run-1' }] });
    const loaded = loadRunHistory();
    expect(loaded).toMatchObject(saved);
  });

  it('migrates legacy sanctions into the profile when v1 is absent', () => {
    const legacySanctions = { state: 'warning', level: 1 };
    window.localStorage.setItem(LEGACY_SANCTIONS_KEY, JSON.stringify(legacySanctions));

    const loaded = loadPlayerProfile();

    expect(loaded.sanctions).toEqual(legacySanctions);
    expect(JSON.parse(window.localStorage.getItem(PROFILE_KEY))).toMatchObject({
      sanctions: legacySanctions,
      schemaVersion: 1,
    });
  });

  it('resets corrupted profiles and logs a warning', () => {
    window.localStorage.setItem(PROFILE_KEY, '{not-json}');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const loaded = loadPlayerProfile();

    expect(warnSpy).toHaveBeenCalled();
    expect(loaded.schemaVersion).toBe(1);
  });

  it('resets profile schema mismatches and logs a warning', () => {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ schemaVersion: 0 }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const loaded = loadPlayerProfile();

    expect(warnSpy).toHaveBeenCalled();
    expect(loaded.schemaVersion).toBe(1);
  });
});
