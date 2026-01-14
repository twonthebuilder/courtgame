import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import useGameState from '../hooks/useGameState';
import { requestLlmJson } from '../lib/llmClient';

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
  is_jury_trial: false,
  judge: { name: 'Hon. River' },
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
      result.current.generateCase('defense', 'regular', 'USA');
    });

    expect(result.current.gameState).toBe('initializing');

    await act(async () => {
      resolveRequest(benchCasePayload);
      await deferred;
    });

    expect(result.current.gameState).toBe('playing');
    expect(result.current.history.case.title).toBe('Bench Trial');
  });

  it('tracks the jury skip path and uses empty seated jurors on verdict', async () => {
    requestLlmJson
      .mockResolvedValueOnce(benchCasePayload)
      .mockResolvedValueOnce({ ruling: 'DENIED', outcome_text: 'Denied', score: 50 })
      .mockResolvedValueOnce({
        final_ruling: 'Acquitted',
        final_weighted_score: 77,
        judge_opinion: 'Bench decision',
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'regular', 'USA');
    });

    expect(result.current.history.jury.skipped).toBe(true);

    await act(async () => {
      await result.current.submitMotion('Suppress evidence');
    });

    await act(async () => {
      await result.current.submitArgument('Closing');
    });

    const verdictCall = requestLlmJson.mock.calls[2][0];
    expect(verdictCall.systemPrompt).toContain('Jury: []');
    expect(result.current.history.trial.verdict.final_ruling).toBe('Acquitted');
  });

  it('surfaces errors and resets to start on generation failure', async () => {
    requestLlmJson.mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'regular', 'USA');
    });

    expect(result.current.gameState).toBe('start');
    expect(result.current.error).toBe('Docket creation failed. Please try again.');
  });
});
