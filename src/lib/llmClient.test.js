import { describe, expect, it } from 'vitest';
import {
  getLlmClientErrorMessage,
  LlmClientError,
  parseCaseResponse,
  parseJuryResponse,
  parseMotionResponse,
  parseMotionTextResponse,
  parseVerdictResponse,
} from './llmClient';

describe('llmClient response parsers', () => {
  const baseCase = {
    title: 'State v. Quick',
    facts: ['A dispute occurred.'],
    is_jury_trial: true,
    judge: { name: 'Hon. Ada Lovelace' },
    jurors: [{ id: 1, name: 'Juror One' }],
  };

  it('accepts a valid case response', () => {
    expect(parseCaseResponse(baseCase)).toEqual(baseCase);
  });

  it('rejects an invalid case response', () => {
    expect(() => parseCaseResponse({ ...baseCase, title: '' })).toThrow(LlmClientError);
  });

  it('accepts a valid jury response', () => {
    const payload = {
      opponent_strikes: [2, 3],
      seated_juror_ids: [1, 4, 5],
      judge_comment: 'Approved.',
    };

    expect(parseJuryResponse(payload)).toEqual(payload);
  });

  it('rejects an invalid jury response', () => {
    expect(() => parseJuryResponse({ opponent_strikes: ['a'] })).toThrow(LlmClientError);
  });

  it('accepts a valid motion response', () => {
    const payload = { ruling: 'Denied', outcome_text: 'Insufficient basis.' };
    expect(parseMotionResponse(payload)).toEqual(payload);
  });

  it('accepts a valid motion text response', () => {
    const payload = { text: 'Motion to dismiss.' };
    expect(parseMotionTextResponse(payload)).toEqual(payload);
  });

  it('accepts a valid verdict response', () => {
    const payload = {
      final_ruling: 'Not guilty',
      final_weighted_score: 82.5,
      judge_opinion: 'Compelling defense argument.',
    };
    expect(parseVerdictResponse(payload)).toEqual(payload);
  });
});

describe('llmClient error messaging', () => {
  it('prefers userMessage on LlmClientError', () => {
    const error = new LlmClientError('boom', { userMessage: 'Friendly error.' });
    expect(getLlmClientErrorMessage(error, 'Fallback')).toBe('Friendly error.');
  });

  it('falls back when no userMessage is present', () => {
    expect(getLlmClientErrorMessage(new Error('oops'), 'Fallback')).toBe('Fallback');
  });
});
