import { describe, expect, it } from 'vitest';
import {
  canonicalizeJurorPool,
  normalizeJurorId,
  normalizeStrikeIds,
  validateStrikeIds,
} from '../lib/juryIds';

describe('juryIds helpers', () => {
  it('normalizes juror ids to numbers', () => {
    expect(normalizeJurorId(4)).toBe(4);
    expect(normalizeJurorId(' 3 ')).toBe(3);
    expect(normalizeJurorId('')).toBeNull();
    expect(normalizeJurorId('abc')).toBeNull();
    expect(normalizeJurorId(null)).toBeNull();
  });

  it('normalizes strike ids and filters invalid values', () => {
    expect(normalizeStrikeIds([1, ' 2 ', null, 'bad'])).toEqual([1, 2]);
    expect(normalizeStrikeIds('nope')).toEqual([]);
  });

  it('canonicalizes juror ids deterministically', () => {
    const jurors = [
      { id: 10, name: 'J1' },
      { id: '2', name: 'J2' },
      { name: 'J3' },
    ];

    expect(canonicalizeJurorPool(jurors)).toEqual([
      { id: 1, name: 'J1' },
      { id: 2, name: 'J2' },
      { id: 3, name: 'J3' },
    ]);
  });

  it('validates strike ids against the pool', () => {
    const poolIds = [1, 2, 3];

    expect(validateStrikeIds([1, '2'], poolIds)).toEqual({ ok: true, invalidIds: [] });
    expect(validateStrikeIds([1, 1], poolIds)).toEqual({ ok: false, invalidIds: [1] });
    expect(validateStrikeIds([4], poolIds)).toEqual({ ok: false, invalidIds: [4] });
    expect(validateStrikeIds(['bad'], poolIds)).toEqual({
      ok: false,
      invalidIds: ['bad'],
    });
  });
});
