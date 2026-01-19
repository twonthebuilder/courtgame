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
    evidence: ['Camera still'],
    opposing_counsel: {
      name: 'Jordan Wright',
      age_range: '30s',
      bio: 'A meticulous litigator with a reputation for sharp cross-examination.',
      style_tells: 'Keeps a color-coded notebook and pauses before objections.',
      current_posture: 'Signaling a willingness to negotiate on lesser charges.',
    },
  };

  it('accepts a valid case response', () => {
    expect(parseCaseResponse(baseCase)).toEqual({
      ...baseCase,
      evidence: [{ id: 1, text: 'Camera still', status: 'admissible' }],
    });
  });

  it('rejects an invalid case response', () => {
    expect(() => parseCaseResponse({ ...baseCase, title: '' })).toThrow(LlmClientError);
  });

  it('maps opposing_statement into opposing_counsel when needed', () => {
    const payload = {
      ...baseCase,
      opposing_counsel: undefined,
      opposing_statement: 'The state intends to pursue every charge with vigor.',
    };

    expect(parseCaseResponse(payload)).toMatchObject({
      opposing_counsel: {
        bio: 'The state intends to pursue every charge with vigor.',
      },
    });
  });

  it('rejects a case response missing opposing counsel data', () => {
    const payload = { ...baseCase, opposing_counsel: undefined, opposing_statement: '' };
    expect(() => parseCaseResponse(payload)).toThrow(LlmClientError);
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
    const payload = {
      ruling: 'DENIED',
      outcome_text: 'Insufficient basis.',
      score: 55,
      evidence_status_updates: [{ id: 1, status: 'admissible' }],
      breakdown: {
        issues: [
          {
            id: 'issue-1',
            label: 'Standing',
            disposition: 'DENIED',
            reasoning: 'The defense lacked standing.',
            affectedEvidenceIds: [1],
          },
        ],
        docket_entries: ['Motion denied on standing grounds.'],
      },
    };
    expect(parseMotionResponse(payload)).toEqual(payload);
  });

  it('rejects a motion response missing a breakdown', () => {
    const payload = {
      ruling: 'Denied',
      outcome_text: 'Insufficient basis.',
      score: 55,
      evidence_status_updates: [{ id: 1, status: 'admissible' }],
    };
    expect(() => parseMotionResponse(payload)).toThrow(LlmClientError);
  });

  it('rejects a motion response with invalid breakdown dispositions', () => {
    const payload = {
      ruling: 'Denied',
      outcome_text: 'Insufficient basis.',
      score: 55,
      evidence_status_updates: [{ id: 1, status: 'admissible' }],
      breakdown: {
        issues: [
          {
            id: 'issue-1',
            label: 'Standing',
            disposition: 'MIXED',
            reasoning: 'Incorrect label.',
          },
        ],
        docket_entries: ['Entry.'],
      },
    };
    expect(() => parseMotionResponse(payload)).toThrow(LlmClientError);
  });

  it('accepts a valid motion text response', () => {
    const payload = { text: 'Motion to dismiss.' };
    expect(parseMotionTextResponse(payload)).toEqual(payload);
  });

  it('accepts a valid verdict response for bench trials', () => {
    const payload = {
      final_ruling: 'Not guilty',
      final_weighted_score: 82.5,
      judge_opinion: 'Compelling defense argument.',
    };
    expect(parseVerdictResponse(payload, { isJuryTrial: false })).toEqual(payload);
  });

  it('accepts a valid verdict response for jury trials', () => {
    const payload = {
      final_ruling: 'Guilty',
      final_weighted_score: 91,
      judge_opinion: 'The evidence was strong.',
      jury_verdict: 'Guilty',
      jury_reasoning: 'The testimony aligned with the evidence.',
      jury_score: 88,
    };
    expect(parseVerdictResponse(payload, { isJuryTrial: true })).toEqual(payload);
  });

  it('accepts a verdict response with overflow details when score exceeds 100', () => {
    const payload = {
      final_ruling: 'Not guilty',
      final_weighted_score: 112,
      judge_opinion: 'Exceptional advocacy.',
      overflow_reason_code: 'LEGENDARY_ARGUMENT',
      overflow_explanation: 'Argument outperformed the difficulty curve.',
    };
    expect(parseVerdictResponse(payload, { isJuryTrial: false })).toEqual(payload);
  });

  it('rejects overflow scores missing a reason code or explanation', () => {
    const payload = {
      final_ruling: 'Not guilty',
      final_weighted_score: 105,
      judge_opinion: 'Exceptional advocacy.',
    };
    expect(() => parseVerdictResponse(payload, { isJuryTrial: false })).toThrow(LlmClientError);
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
