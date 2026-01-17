import { describe, expect, it } from 'vitest';
import { DEFAULT_DIFFICULTY, normalizeCourtType, normalizeDifficulty } from '../lib/config';
import { COURT_TYPES } from '../lib/constants';

describe('difficulty normalization', () => {
  it('maps legacy and unknown difficulty values to canonical ids', () => {
    expect(normalizeDifficulty('regular')).toBe('normal');
    expect(normalizeDifficulty(' Normal ')).toBe('normal');
    expect(normalizeDifficulty('silly')).toBe('silly');
    expect(normalizeDifficulty('nuance')).toBe('nuance');
    expect(normalizeDifficulty('unknown')).toBe(DEFAULT_DIFFICULTY);
  });
});

describe('court type normalization', () => {
  it('maps legacy and unknown court types to canonical ids', () => {
    expect(normalizeCourtType('Municipal Night Court')).toBe(COURT_TYPES.NIGHT_COURT);
    expect(normalizeCourtType('night court')).toBe(COURT_TYPES.NIGHT_COURT);
    expect(normalizeCourtType(COURT_TYPES.SUPREME_COURT)).toBe(COURT_TYPES.SUPREME_COURT);
    expect(normalizeCourtType('unknown')).toBe(COURT_TYPES.STANDARD);
  });
});
