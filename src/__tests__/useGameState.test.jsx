import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import useGameState from '../hooks/useGameState';
import { copyToClipboard } from '../lib/clipboard';
import { requestLlmJson } from '../lib/llmClient';

vi.mock('../lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock('../lib/llmClient', async () => {
  const actual = await vi.importActual('../lib/llmClient');
  return {
    ...actual,
    requestLlmJson: vi.fn(),
  };
});

const benchCasePayload = {
  title: 'Bench Trial',
  facts: ['Fact one'],
  evidence: ['Camera footage', 'Hidden memo'],
  is_jury_trial: false,
  judge: { name: 'Hon. River' },
  opposing_counsel: {
    name: 'Alex Morgan',
    bio: 'Known for tight procedural arguments.',
    style_tells: 'Speaks in clipped bullet points.',
    current_posture: 'Positioning for an early settlement.',
  },
};
const juryCasePayload = {
  title: 'Jury Trial',
  facts: ['Fact two'],
  evidence: ['Signed waiver'],
  is_jury_trial: true,
  judge: { name: 'Hon. Lake' },
  jurors: [
    { id: 1, name: 'J1', age: 35, job: 'Teacher', bias_hint: 'Skeptical of corporations.' },
    { id: 2, name: 'J2', age: 52, job: 'Engineer', bias_hint: 'Trusts expert testimony.' },
    { id: 3, name: 'J3', age: 44, job: 'Nurse', bias_hint: 'Favors strict safety rules.' },
  ],
  opposing_counsel: {
    name: 'Riley Park',
    bio: 'Direct and incisive.',
    style_tells: 'Short, factual bursts.',
    current_posture: 'Setting an aggressive pace.',
  },
};

describe('useGameState transitions', () => {
  beforeEach(() => {
    requestLlmJson.mockReset();
  });

  it('moves from start to initializing to playing when a case is generated', async () => {
    let resolveRequest;
    const deferred = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    requestLlmJson.mockReturnValueOnce(deferred);

    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.generateCase('defense', 'normal', 'USA');
    });

    expect(result.current.gameState).toBe('initializing');

    await act(async () => {
      resolveRequest(benchCasePayload);
      await deferred;
    });

    expect(result.current.gameState).toBe('playing');
    expect(result.current.history.case.title).toBe('Bench Trial');
    expect(result.current.history.counselNotes).toBe('');
  });

  it('normalizes legacy difficulty values before storing config', async () => {
    requestLlmJson.mockResolvedValueOnce(benchCasePayload);

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'regular', 'USA');
    });

    expect(result.current.config.difficulty).toBe('normal');
  });

  it('tracks the jury skip path and uses empty seated jurors on verdict', async () => {
    requestLlmJson
      .mockResolvedValueOnce(benchCasePayload)
      .mockResolvedValueOnce({ text: 'Opposing response.' })
      .mockResolvedValueOnce({
        ruling: 'DENIED',
        outcome_text: 'Denied',
        score: 50,
        evidence_status_updates: [
          { id: 1, status: 'admissible' },
          { id: 2, status: 'suppressed' },
        ],
      })
      .mockResolvedValueOnce({
        final_ruling: 'Acquitted',
        final_weighted_score: 77,
        judge_opinion: 'Bench decision',
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', 'USA');
    });

    expect(result.current.history.jury.skipped).toBe(true);

    await act(async () => {
      await result.current.submitMotionStep('Suppress evidence');
    });

    await act(async () => {
      await result.current.triggerAiMotionSubmission();
    });

    await act(async () => {
      await result.current.requestMotionRuling();
    });

    await act(async () => {
      await result.current.submitArgument('Closing');
    });

    const verdictCall = requestLlmJson.mock.calls[3][0];
    expect(verdictCall.systemPrompt).toContain('Jury: []');
    expect(verdictCall.systemPrompt).toContain('Camera footage');
    expect(verdictCall.systemPrompt).not.toContain('Hidden memo');
    expect(result.current.history.trial.verdict.final_ruling).toBe('Acquitted');
  });

  it('surfaces errors and resets to start on generation failure', async () => {
    requestLlmJson.mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', 'USA');
    });

    expect(result.current.gameState).toBe('start');
    expect(result.current.error).toBe('Docket creation failed. Please try again.');
  });

  it('enforces defense/prosecution turn order during the motion exchange', async () => {
    requestLlmJson
      .mockResolvedValueOnce(benchCasePayload)
      .mockResolvedValueOnce({ text: 'AI drafted motion.' });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('prosecution', 'normal', 'USA');
    });

    await act(async () => {
      await result.current.submitMotionStep('Our motion');
    });

    expect(result.current.error).toBe('It is not your turn to file this submission.');
    expect(result.current.history.motion.motionText).toBe('');

    await act(async () => {
      await result.current.triggerAiMotionSubmission();
    });

    expect(result.current.history.motion.motionText).toBe('AI drafted motion.');
    expect(result.current.history.motion.motionPhase).toBe('rebuttal_submission');

    await act(async () => {
      await result.current.submitMotionStep('Our rebuttal');
    });

    expect(result.current.history.motion.rebuttalText).toBe('Our rebuttal');
  });

  it('locks the motion phase after a ruling is issued', async () => {
    requestLlmJson
      .mockResolvedValueOnce(benchCasePayload)
      .mockResolvedValueOnce({ text: 'AI rebuttal.' })
      .mockResolvedValueOnce({
        ruling: 'DENIED',
        outcome_text: 'Denied',
        score: 45,
        evidence_status_updates: [{ id: 1, status: 'admissible' }],
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', 'USA');
    });

    await act(async () => {
      await result.current.submitMotionStep('Suppress the evidence.');
    });

    await act(async () => {
      await result.current.triggerAiMotionSubmission();
    });

    await act(async () => {
      await result.current.requestMotionRuling();
    });

    expect(result.current.history.motion.motionPhase).toBe('motion_ruling_locked');
    expect(result.current.history.motion.locked).toBe(true);
    expect(result.current.history.motion.ruling.ruling).toBe('DENIED');

    await act(async () => {
      await result.current.requestMotionRuling();
    });

    expect(requestLlmJson).toHaveBeenCalledTimes(3);
  });

  it('updates counsel notes when the jury is seated', async () => {
    requestLlmJson
      .mockResolvedValueOnce(juryCasePayload)
      .mockResolvedValueOnce({
        opponent_strikes: [3],
        seated_juror_ids: [1],
        judge_comment: 'Seated.',
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', 'USA');
    });

    await act(async () => {
      await result.current.submitStrikes([2]);
    });

    expect(result.current.history.counselNotes).toContain('We are reading a jury');
    const jurorStatuses = result.current.history.jury.pool.map((juror) => [juror.id, juror.status]);
    expect(jurorStatuses).toEqual([
      [1, 'seated'],
      [2, 'struck_by_player'],
      [3, 'struck_by_opponent'],
    ]);
    expect(result.current.history.jury.pool[0].status_history).toEqual(['eligible', 'seated']);
  });

  it('marks invalid strike submissions that reference jurors outside the docket', async () => {
    requestLlmJson
      .mockResolvedValueOnce(juryCasePayload)
      .mockResolvedValueOnce({
        opponent_strikes: [99],
        seated_juror_ids: [1, 1],
        judge_comment: 'Invalid juror IDs.',
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', 'USA');
    });

    await act(async () => {
      await result.current.submitStrikes([2]);
    });

    expect(result.current.history.jury.invalidStrike).toBe(true);
    expect(result.current.history.jury.locked).toBe(false);
    expect(result.current.history.jury.seatedIds).toBeUndefined();
    expect(result.current.error).toBe(
      'Strike results referenced jurors outside the docket. Please retry.'
    );
  });

  it('overwrites counsel notes after motion ruling and verdict', async () => {
    requestLlmJson
      .mockResolvedValueOnce(benchCasePayload)
      .mockResolvedValueOnce({ text: 'Opposing response.' })
      .mockResolvedValueOnce({
        ruling: 'GRANTED',
        outcome_text: 'Granted',
        score: 50,
        evidence_status_updates: [{ id: 1, status: 'suppressed' }],
      })
      .mockResolvedValueOnce({
        final_ruling: 'Acquitted',
        final_weighted_score: 77,
        judge_opinion: 'Bench decision',
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', 'USA');
    });

    await act(async () => {
      await result.current.submitMotionStep('Suppress evidence');
    });

    await act(async () => {
      await result.current.triggerAiMotionSubmission();
    });

    await act(async () => {
      await result.current.requestMotionRuling();
    });

    const motionNote = result.current.history.counselNotes;

    await act(async () => {
      await result.current.submitArgument('Closing');
    });

    expect(result.current.history.counselNotes).not.toBe(motionNote);
    expect(result.current.history.counselNotes).toContain('verdict');
  });

  it('rejects verdicts that cite suppressed evidence', async () => {
    requestLlmJson
      .mockResolvedValueOnce(benchCasePayload)
      .mockResolvedValueOnce({ text: 'Opposing response.' })
      .mockResolvedValueOnce({
        ruling: 'DENIED',
        outcome_text: 'Denied',
        score: 50,
        evidence_status_updates: [
          { id: 1, status: 'admissible' },
          { id: 2, status: 'suppressed' },
        ],
      })
      .mockResolvedValueOnce({
        final_ruling: 'Guilty based on Evidence 2',
        final_weighted_score: 60,
        judge_opinion: 'Evidence 2 controls this outcome.',
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', 'USA');
    });

    await act(async () => {
      await result.current.submitMotionStep('Suppress evidence');
    });

    await act(async () => {
      await result.current.triggerAiMotionSubmission();
    });

    await act(async () => {
      await result.current.requestMotionRuling();
    });

    await act(async () => {
      await result.current.submitArgument('Closing argument');
    });

    expect(result.current.history.trial.verdict).toBeUndefined();
    expect(result.current.history.trial.rejectedVerdicts).toHaveLength(1);
    expect(result.current.error).toBe(
      'Verdict rejected for off-docket or inadmissible references.'
    );
  });

  it('includes counsel notes in the copied docket when present', async () => {
    requestLlmJson.mockResolvedValueOnce(benchCasePayload);

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', 'USA');
    });

    act(() => {
      result.current.history.counselNotes = 'Remember to cite precedent.';
    });

    act(() => {
      result.current.handleCopyFull();
    });

    expect(copyToClipboard).toHaveBeenCalledTimes(1);
    expect(copyToClipboard.mock.calls[0][0]).toContain(
      'COUNSEL NOTES:\nRemember to cite precedent.'
    );
  });
});
