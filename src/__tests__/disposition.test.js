import { describe, expect, it } from 'vitest';
import { deriveDispositionFromMotion, deriveDispositionFromVerdict } from '../lib/disposition';

describe('deriveDispositionFromMotion', () => {
  it('returns null when a motion is partially granted with dismissal language', () => {
    const result = deriveDispositionFromMotion({
      ruling: {
        ruling: 'PARTIALLY_GRANTED',
        decision: {
          ruling: 'partially_granted',
          dismissal: { isDismissed: false, withPrejudice: false },
          opinion: 'Claims are dismissed with prejudice.',
        },
        outcome_text: 'Claims are dismissed with prejudice.',
      },
    });

    expect(result).toBeNull();
  });

  it('returns a terminal disposition when a motion is granted with dismissal language', () => {
    const result = deriveDispositionFromMotion({
      ruling: {
        ruling: 'GRANTED',
        decision: {
          ruling: 'dismissed',
          dismissal: { isDismissed: true, withPrejudice: true },
          opinion: 'All claims are dismissed with prejudice.',
        },
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
        decision: {
          ruling: 'denied',
          dismissal: { isDismissed: false, withPrejudice: false },
          opinion: 'Motion denied; case not dismissed.',
        },
        outcome_text: 'Motion denied; case not dismissed.',
      },
    });

    expect(result).toBeNull();
  });
});

describe('deriveDispositionFromVerdict', () => {
  it('returns not_guilty when the final ruling says the defense prevails', () => {
    const result = deriveDispositionFromVerdict({
      final_ruling: 'Final ruling: the defense prevails on all counts.',
      jury_verdict: 'Not Guilty',
    });

    expect(result).toMatchObject({
      type: 'not_guilty',
      source: 'verdict',
    });
  });

  it('returns not_guilty when the final ruling says found for the defendant', () => {
    const result = deriveDispositionFromVerdict({
      final_ruling: 'Judgment entered for the defendant.',
      jury_verdict: 'N/A',
    });

    expect(result).toMatchObject({
      type: 'not_guilty',
      source: 'verdict',
    });
  });

  it('returns guilty when the final ruling says the state prevails', () => {
    const result = deriveDispositionFromVerdict({
      final_ruling: 'The State prevails and judgment is entered accordingly.',
      jury_verdict: 'Guilty',
    });

    expect(result).toMatchObject({
      type: 'guilty',
      source: 'verdict',
    });
  });

  it('returns guilty when the final ruling says found in favor of the prosecution', () => {
    const result = deriveDispositionFromVerdict({
      final_ruling: 'Final ruling: found in favor of the prosecution.',
      jury_verdict: 'N/A',
    });

    expect(result).toMatchObject({
      type: 'guilty',
      source: 'verdict',
    });
  });
});
