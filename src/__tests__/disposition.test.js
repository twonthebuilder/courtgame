import { describe, expect, it } from 'vitest';
import { deriveDispositionFromMotion } from '../lib/disposition';

describe('deriveDispositionFromMotion', () => {
  it('returns null when a motion is partially granted with dismissal language', () => {
    const result = deriveDispositionFromMotion({
      ruling: {
        ruling: 'PARTIALLY_GRANTED',
        outcome_text: 'Claims are dismissed with prejudice.',
      },
    });

    expect(result).toBeNull();
  });

  it('returns a terminal disposition when a motion is granted with dismissal language', () => {
    const result = deriveDispositionFromMotion({
      ruling: {
        ruling: 'GRANTED',
        outcome_text: 'All claims are dismissed with prejudice.',
      },
    });

    expect(result).toMatchObject({
      type: 'dismissed_with_prejudice',
      source: 'motion',
    });
  });

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
