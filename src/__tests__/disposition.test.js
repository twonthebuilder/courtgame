import { describe, expect, it } from 'vitest';
import { deriveDispositionFromMotion } from '../lib/disposition';

describe('deriveDispositionFromMotion', () => {
  it('returns null when a denied motion references a non-dismissal outcome', () => {
    const result = deriveDispositionFromMotion({
      ruling: {
        ruling: 'DENIED',
        outcome_text: 'Motion denied; case not dismissed.',
      },
    });

    expect(result).toBeNull();
  });
});
