import { describe, expect, it } from 'vitest';
import { DEFAULT_DIFFICULTY, normalizeDifficulty } from '../lib/config';

describe('difficulty normalization', () => {
  it('maps legacy and unknown difficulty values to canonical ids', () => {
    expect(normalizeDifficulty('regular')).toBe('normal');
    expect(normalizeDifficulty(' Normal ')).toBe('normal');
    expect(normalizeDifficulty('silly')).toBe('silly');
    expect(normalizeDifficulty('nuance')).toBe('nuance');
    expect(normalizeDifficulty('unknown')).toBe(DEFAULT_DIFFICULTY);
  });
});
