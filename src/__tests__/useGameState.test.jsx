import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import useGameState, { __testables } from '../hooks/useGameState';
import { copyToClipboard } from '../lib/clipboard';
import { getDebugState, __testables as debugTestables } from '../lib/debugStore';
import {
  CASE_TYPES,
  COURT_TYPES,
  FINAL_DISPOSITIONS,
  GAME_STATES,
  JURISDICTIONS,
  SANCTION_ENTRY_STATES,
  SANCTION_REASON_CODES,
  SANCTION_STATES,
  SANCTION_VISIBILITY,
  SANCTIONS_TIMERS_MS,
  PROFILE_STORAGE_KEY,
} from '../lib/constants';
import { requestLlmJson } from '../lib/llmClient';
import { defaultPlayerProfile, loadPlayerProfile, loadRunHistory } from '../lib/persistence';

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
const buildSanctionsEntry = ({
  id,
  state = SANCTION_ENTRY_STATES.WARNED,
  trigger = SANCTION_REASON_CODES.DECORUM_VIOLATION,
  docketText = 'The court notes misconduct on the record.',
  timestamp,
} = {}) => ({
  id: id ?? `s-${Math.random().toString(16).slice(2)}`,
  state,
  trigger,
  docket_text: docketText,
  visibility: SANCTION_VISIBILITY.PUBLIC,
  timestamp: timestamp ?? new Date().toISOString(),
});
const baseAccountability = {
  sanction_recommended: false,
  severity: null,
  target: null,
  reason: null,
};
const buildVerdict = (overrides = {}) => ({
  jury_verdict: 'N/A',
  jury_reasoning: '',
  jury_score: 0,
  judge_score: 0,
  judge_opinion: 'Bench decision.',
  final_ruling: 'Not Guilty',
  is_jnov: false,
  final_weighted_score: 80,
  overflow_reason_code: null,
  overflow_explanation: null,
  achievement_title: null,
  accountability: baseAccountability,
  ...overrides,
});
const buildMotionBreakdown = (overrides = {}) => ({
  issues: [
    {
      id: 'issue-1',
      label: 'Threshold issue',
      disposition: 'DENIED',
      reasoning: 'The motion does not satisfy the required legal threshold.',
      affectedEvidenceIds: [],
    },
  ],
  docket_entries: ['The court issues a preliminary ruling on the motion.'],
  ...overrides,
});
const buildMotionRuling = (overrides = {}) => ({
  ruling: 'DENIED',
  outcome_text: 'Denied',
  score: 50,
  evidence_status_updates: [],
  accountability: baseAccountability,
  breakdown: buildMotionBreakdown(),
  ...overrides,
});
const buildLlmResponse = (payload, rawText = JSON.stringify(payload)) => ({
  parsed: payload,
  rawText,
});

describe('useGameState transitions', () => {
  beforeEach(() => {
    requestLlmJson.mockReset();
    copyToClipboard.mockReset();
    copyToClipboard.mockResolvedValue(true);
    window.localStorage.clear();
    debugTestables.resetDebugState();
  });

  it('moves from start to initializing to playing when a case is generated', async () => {
    let resolveRequest;
    const deferred = new Promise((resolve) => {
      resolveRequest = resolve;
    });
    requestLlmJson.mockReturnValueOnce(deferred);

    const { result } = renderHook(() => useGameState());

    act(() => {
      result.current.generateCase(
        'defense',
        'normal',
        JURISDICTIONS.USA,
        COURT_TYPES.STANDARD
      );
    });

    expect(result.current.gameState).toBe(GAME_STATES.INITIALIZING);

    await act(async () => {
      resolveRequest(buildLlmResponse(benchCasePayload));
      await deferred;
    });

    expect(result.current.gameState).toBe(GAME_STATES.PLAYING);
    expect(result.current.history.case.title).toBe('Bench Trial');
    expect(result.current.history.counselNotes).toBe('');
  });

  it('emits RUN_ENDED and clears run state when resetGame is called', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(benchCasePayload));

    const onShellEvent = vi.fn();
    const { result } = renderHook(() => useGameState({ onShellEvent }));

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.resetGame();
    });

    const runEndedEvent = onShellEvent.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === 'RUN_ENDED');

    expect(runEndedEvent).toEqual(
      expect.objectContaining({
        type: 'RUN_ENDED',
        payload: expect.objectContaining({
          sanctions: expect.objectContaining({
            before: expect.objectContaining({ state: SANCTION_STATES.CLEAN }),
            after: expect.objectContaining({ state: SANCTION_STATES.CLEAN }),
          }),
        }),
      })
    );
    expect(result.current.runOutcome).toBeNull();
    expect(result.current.history.disposition).toBeNull();
  });

  it('normalizes legacy difficulty values before storing config', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(benchCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase(
        'defense',
        'regular',
        JURISDICTIONS.USA,
        COURT_TYPES.STANDARD
      );
    });

    expect(result.current.config.difficulty).toBe('normal');
  });

  it('toggles strike selections and ignores invalid ids', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(juryCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase(
        'defense',
        'normal',
        JURISDICTIONS.USA,
        COURT_TYPES.STANDARD
      );
    });

    expect(result.current.history.jury.myStrikes).toEqual([]);

    act(() => {
      result.current.toggleStrikeSelection('1');
    });
    expect(result.current.history.jury.myStrikes).toEqual([1]);

    act(() => {
      result.current.toggleStrikeSelection(1);
    });
    expect(result.current.history.jury.myStrikes).toEqual([]);

    act(() => {
      result.current.toggleStrikeSelection('bad-id');
    });
    expect(result.current.history.jury.myStrikes).toEqual([]);

    act(() => {
      result.current.toggleStrikeSelection(2);
      result.current.toggleStrikeSelection(Number.NaN);
    });
    expect(result.current.history.jury.myStrikes).toEqual([2]);
  });

  it('stores normalized strike IDs when toggling selections', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(juryCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase(
        'defense',
        'normal',
        JURISDICTIONS.USA,
        COURT_TYPES.STANDARD
      );
    });

    act(() => {
      result.current.toggleStrikeSelection('2');
      result.current.toggleStrikeSelection('3');
    });

    expect(result.current.history.jury.myStrikes).toEqual([2, 3]);
    expect(result.current.history.jury.myStrikes.every((id) => typeof id === 'number')).toBe(
      true
    );
  });

  it('locks the config when public defender mode is active', async () => {
    const nowMs = Date.now();
    const storedState = {
      ...__testables.buildDefaultSanctionsState(nowMs),
      state: SANCTION_STATES.PUBLIC_DEFENDER,
    };
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ ...defaultPlayerProfile(), sanctions: storedState })
    );

    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(benchCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('prosecution', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    const generatorCall = requestLlmJson.mock.calls[0][0];
    expect(generatorCall.systemPrompt).toContain('PUBLIC DEFENDER MODE CONSTRAINTS');
    expect(result.current.config.role).toBe('defense');
    expect(result.current.config.jurisdiction).toBe(JURISDICTIONS.USA);
    expect(result.current.config.courtType).toBe(COURT_TYPES.NIGHT_COURT);
    expect(result.current.config.caseType).toBe(CASE_TYPES.PUBLIC_DEFENDER);
  });

  it('reinstates from public defender mode after a not guilty verdict', async () => {
    const nowMs = Date.now();
    const storedState = {
      ...__testables.buildDefaultSanctionsState(nowMs),
      state: SANCTION_STATES.PUBLIC_DEFENDER,
      level: 3,
      startedAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + 60 * 60 * 1000).toISOString(),
      recentlyReinstatedUntil: null,
    };
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ ...defaultPlayerProfile(), sanctions: storedState })
    );

    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'Opposing response.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            evidence_status_updates: [
              { id: 1, status: 'admissible' },
              { id: 2, status: 'suppressed' },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        buildLlmResponse({
          final_ruling: 'Not Guilty',
          final_weighted_score: 77,
          judge_opinion: 'Bench decision',
          accountability: baseAccountability,
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    const runHistoryAfterStart = loadRunHistory();
    expect(runHistoryAfterStart.runs).toHaveLength(1);
    expect(runHistoryAfterStart.runs[0]).toMatchObject({
      jurisdiction: JURISDICTIONS.USA,
      difficulty: 'normal',
      courtType: COURT_TYPES.NIGHT_COURT,
      playerRole: 'defense',
      caseTitle: 'Bench Trial',
      judgeName: 'Hon. River',
      endedAt: null,
      outcome: null,
      score: null,
      achievementId: null,
      sanctionDelta: {
        before: expect.any(Object),
        after: null,
      },
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
      await result.current.submitArgument('Closing');
    });

    expect(result.current.sanctionsState.state).toBe(
      SANCTION_STATES.RECENTLY_REINSTATED
    );
    expect(result.current.sanctionsState.recentlyReinstatedUntil).toBeTruthy();
  });

  it('retains public defender mode after a guilty verdict', async () => {
    const nowMs = Date.now();
    const storedState = {
      ...__testables.buildDefaultSanctionsState(nowMs),
      state: SANCTION_STATES.PUBLIC_DEFENDER,
      level: 3,
      startedAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + 60 * 60 * 1000).toISOString(),
      recentlyReinstatedUntil: null,
    };
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ ...defaultPlayerProfile(), sanctions: storedState })
    );

    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'Opposing response.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            evidence_status_updates: [
              { id: 1, status: 'admissible' },
              { id: 2, status: 'suppressed' },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        buildLlmResponse({
          final_ruling: 'Guilty',
          final_weighted_score: 44,
          judge_opinion: 'Bench decision',
          accountability: baseAccountability,
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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
      await result.current.submitArgument('Closing');
    });

    expect(result.current.sanctionsState.state).toBe(
      SANCTION_STATES.PUBLIC_DEFENDER
    );
  });

  it('tracks the jury skip path and uses empty seated jurors on verdict', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'Opposing response.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            evidence_status_updates: [
              { id: 1, status: 'admissible' },
              { id: 2, status: 'suppressed' },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        buildLlmResponse({
          final_ruling: 'Acquitted',
          final_weighted_score: 77,
          judge_opinion: 'Bench decision',
          accountability: baseAccountability,
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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

  it('includes recently reinstated context for judges and opposing counsel', async () => {
    const nowMs = Date.now();
    const storedState = {
      ...__testables.buildDefaultSanctionsState(nowMs),
      state: SANCTION_STATES.RECENTLY_REINSTATED,
      level: 1,
      startedAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + 20 * 60 * 1000).toISOString(),
      recentlyReinstatedUntil: new Date(nowMs + 20 * 60 * 1000).toISOString(),
    };
    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ ...defaultPlayerProfile(), sanctions: storedState })
    );

    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'AI drafted motion.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            score: 45,
            evidence_status_updates: [{ id: 1, status: 'admissible' }],
          })
        )
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('prosecution', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    await act(async () => {
      await result.current.triggerAiMotionSubmission();
    });

    await act(async () => {
      await result.current.submitMotionStep('Our rebuttal');
    });

    await act(async () => {
      await result.current.requestMotionRuling();
    });

    const opposingCounselCall = requestLlmJson.mock.calls[1][0];
    const motionRulingCall = requestLlmJson.mock.calls[2][0];
    expect(opposingCounselCall.systemPrompt).toContain('recentlyReinstatedUntil');
    expect(motionRulingCall.systemPrompt).toContain('recentlyReinstatedUntil');
  });

  it('surfaces errors and emits a start failure event', async () => {
    requestLlmJson.mockRejectedValueOnce(new Error('Network down'));

    const onShellEvent = vi.fn();
    const { result } = renderHook(() => useGameState({ onShellEvent }));

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    expect(result.current.gameState).toBe(GAME_STATES.INITIALIZING);
    expect(result.current.error).toBe('Docket creation failed. Please try again.');
    expect(onShellEvent).toHaveBeenCalledWith({
      type: 'start_failed',
      message: 'Docket creation failed. Please try again.',
    });
  });

  it('enforces defense/prosecution turn order during the motion exchange', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'AI drafted motion.' }));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('prosecution', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'AI rebuttal.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            score: 45,
            evidence_status_updates: [{ id: 1, status: 'admissible' }],
          })
        )
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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

  it('updates evidence statuses from valid motion breakdown updates', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'AI rebuttal.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            ruling: 'DENIED',
            outcome_text: 'Denied',
            evidence_status_updates: [
              { id: 1, status: 'suppressed' },
              { id: 2, status: 'admissible' },
            ],
            breakdown: buildMotionBreakdown({
              issues: [
                {
                  id: 'issue-1',
                  label: 'Suppression',
                  disposition: 'DENIED',
                  reasoning: 'The evidence remains admissible.',
                  affectedEvidenceIds: [1],
                },
              ],
            }),
          })
        )
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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

    const evidenceStatuses = result.current.history.case.evidence.map((item) => item.status);
    expect(evidenceStatuses).toEqual(['suppressed', 'admissible']);
  });

  it('rejects motion rulings with invalid evidence ids without mutating history', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'AI rebuttal.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            ruling: 'DENIED',
            outcome_text: 'Denied',
            evidence_status_updates: [{ id: 99, status: 'suppressed' }],
            breakdown: buildMotionBreakdown({
              issues: [
                {
                  id: 'issue-99',
                  label: 'Invalid Evidence',
                  disposition: 'DENIED',
                  reasoning: 'Referenced evidence does not exist.',
                  affectedEvidenceIds: [99],
                },
              ],
            }),
          })
        )
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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

    expect(result.current.history.motion.ruling).toBeNull();
    expect(result.current.history.motion.motionPhase).toBe('rebuttal_submission');
    expect(result.current.history.motion.locked).toBe(false);
    expect(result.current.history.case.evidence.map((item) => item.status)).toEqual([
      'admissible',
      'admissible',
    ]);
    expect(result.current.error).toBe(
      'Motion ruling referenced evidence outside the docket. Please retry.'
    );
    expect(getDebugState().lastAction?.payload).toMatchObject({
      missingEvidenceIds: [99],
    });
  });

  it('does not end the run on partially granted motion rulings', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'AI rebuttal.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            ruling: 'PARTIALLY GRANTED',
            outcome_text: 'Partially granted.',
            evidence_status_updates: [
              { id: 1, status: 'suppressed' },
              { id: 2, status: 'admissible' },
            ],
          })
        )
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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
    expect(result.current.history.disposition).toBeNull();
    expect(result.current.runOutcome).toBeNull();
  });

  it('records stats, run history, and achievements on verdict finalization', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'Opposing response.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            evidence_status_updates: [{ id: 1, status: 'admissible' }],
          })
        )
      )
      .mockResolvedValueOnce(
        buildLlmResponse({
          final_ruling: 'Not Guilty',
          final_weighted_score: 99,
          judge_opinion: 'Bench decision',
          achievement_title: 'Order of Operations',
          accountability: baseAccountability,
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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
      await result.current.submitArgument('Closing');
    });

    const profile = loadPlayerProfile();
    const runHistory = loadRunHistory();

    expect(profile.stats).toEqual({
      runsCompleted: 1,
      verdictsFinalized: 1,
      sanctionsIncurred: 0,
    });
    expect(profile.achievements[0]).toMatchObject({
      title: 'Order of Operations',
    });
    expect(runHistory.runs).toHaveLength(1);
    expect(runHistory.runs[0]).toMatchObject({
      jurisdiction: JURISDICTIONS.USA,
      difficulty: 'normal',
      playerRole: 'defense',
      caseTitle: 'Bench Trial',
      judgeName: 'Hon. River',
      outcome: 'not_guilty',
      score: 99,
      achievementId: 'Order of Operations',
      sanctionDelta: {
        before: expect.any(Object),
        after: expect.any(Object),
      },
    });
    expect(runHistory.runs[0].endedAt).toBeTruthy();
  });

  it('logs structured accountability sanctions from verdict payloads', async () => {
    const accountability = {
      sanction_recommended: true,
      severity: 'warning',
      target: 'defense',
      reason: 'frivolous arguments',
    };

    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'Opposing response.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            evidence_status_updates: [{ id: 1, status: 'admissible' }],
          })
        )
      )
      .mockResolvedValueOnce(
        buildLlmResponse(buildVerdict({ accountability, jury_reasoning: 'N/A' }))
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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
      await result.current.submitArgument('Closing');
    });

    expect(result.current.history.sanctions).toHaveLength(1);
    expect(result.current.history.sanctions[0].accountability).toMatchObject(accountability);
    expect(result.current.sanctionsState.state).toBe(SANCTION_STATES.WARNED);
  });

  it('records run history when a motion ends the run early', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'Opposing response.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            ruling: 'GRANTED',
            outcome_text: 'Dismissed with prejudice',
            evidence_status_updates: [{ id: 1, status: 'admissible' }],
          })
        )
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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

    const profile = loadPlayerProfile();
    const runHistory = loadRunHistory();

    expect(profile.stats).toEqual({
      runsCompleted: 1,
      verdictsFinalized: 0,
      sanctionsIncurred: 0,
    });
    expect(runHistory.runs).toHaveLength(1);
    expect(runHistory.runs[0]).toMatchObject({
      jurisdiction: JURISDICTIONS.USA,
      difficulty: 'normal',
      playerRole: 'defense',
      caseTitle: 'Bench Trial',
      judgeName: 'Hon. River',
      outcome: 'dismissed_with_prejudice',
      score: null,
      achievementId: null,
      sanctionDelta: {
        before: expect.any(Object),
        after: expect.any(Object),
      },
    });
    expect(runHistory.runs[0].endedAt).toBeTruthy();
  });

  it('updates counsel notes when the jury is seated', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(juryCasePayload))
      .mockResolvedValueOnce(
        buildLlmResponse({
          opponent_strikes: [3],
          seated_juror_ids: [1],
          judge_comment: 'Seated.',
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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
      .mockResolvedValueOnce(buildLlmResponse(juryCasePayload))
      .mockResolvedValueOnce(
        buildLlmResponse({
          opponent_strikes: [99],
          seated_juror_ids: [1, 1],
          judge_comment: 'Invalid juror IDs.',
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    await act(async () => {
      await result.current.submitStrikes([2]);
    });

    expect(getDebugState().lastAction?.payload).toMatchObject({
      submittedIds: [2],
      poolIds: [1, 2, 3],
      invalidIds: {
        opponent: [99],
        seated: [1],
      },
    });
    expect(result.current.history.jury.invalidStrike).toBe(false);
    expect(result.current.history.jury.locked).toBe(false);
    expect(result.current.history.jury.seatedIds).toBeUndefined();
    expect(result.current.history.jury.myStrikes).toEqual([]);
    expect(result.current.error).toBe(
      'Strike results referenced jurors outside the docket. Please retry.'
    );
  });

  it('normalizes strike ids before building the jury strike prompt', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(juryCasePayload))
      .mockResolvedValueOnce(
        buildLlmResponse({
          opponent_strikes: [3],
          seated_juror_ids: [1],
          judge_comment: 'Seated.',
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase(
        'defense',
        'normal',
        JURISDICTIONS.USA,
        COURT_TYPES.STANDARD
      );
    });

    await act(async () => {
      await result.current.submitStrikes(['2']);
    });

    const strikeCall = requestLlmJson.mock.calls[1][0];
    expect(strikeCall.systemPrompt).toContain('Player (defense) struck IDs: [2]');
  });

  it('stores canonical juror ids and preserves them through submission', async () => {
    const nonCanonicalPayload = {
      ...juryCasePayload,
      jurors: [
        { id: 10, name: 'J1', age: 35, job: 'Teacher', bias_hint: 'Skeptical.' },
        { id: 20, name: 'J2', age: 52, job: 'Engineer', bias_hint: 'Trusts experts.' },
        { id: 30, name: 'J3', age: 44, job: 'Nurse', bias_hint: 'Favors rules.' },
      ],
    };

    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(nonCanonicalPayload))
      .mockResolvedValueOnce(
        buildLlmResponse({
          opponent_strikes: [],
          seated_juror_ids: [3],
          judge_comment: 'Seated.',
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase(
        'defense',
        'normal',
        JURISDICTIONS.USA,
        COURT_TYPES.STANDARD
      );
    });

    expect(result.current.history.case.jurors.map((juror) => juror.id)).toEqual([1, 2, 3]);
    expect(result.current.history.jury.pool.map((juror) => juror.id)).toEqual([1, 2, 3]);

    act(() => {
      result.current.toggleStrikeSelection(1);
      result.current.toggleStrikeSelection(2);
    });

    expect(result.current.history.jury.myStrikes).toEqual([1, 2]);

    await act(async () => {
      await result.current.submitStrikes(result.current.history.jury.myStrikes);
    });

    const strikeCall = requestLlmJson.mock.calls[1][0];
    expect(strikeCall.systemPrompt).toContain('Player (defense) struck IDs: [1,2]');
  });

  it('rejects invalid strike submissions without mutating jury state', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(juryCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    const poolStatusSnapshot = result.current.history.jury.pool.map((juror) => juror.status);

    await act(async () => {
      await result.current.submitStrikes([2, 'bad-id']);
    });

    expect(result.current.error).toBe(
      'Selected juror IDs are invalid. Please reselect from the current pool.'
    );
    expect(getDebugState().lastAction).toMatchObject({
      result: 'rejected',
      rejectReason: 'invalid_selection',
    });
    expect(result.current.history.jury.locked).toBe(false);
    expect(result.current.history.jury.seatedIds).toBeUndefined();
    expect(result.current.history.jury.myStrikes).toEqual([]);
    expect(result.current.history.jury.pool.map((juror) => juror.status)).toEqual(
      poolStatusSnapshot
    );
  });

  it('rejects jury strikes that are outside the current pool', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(juryCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.toggleStrikeSelection(2);
    });

    await act(async () => {
      await result.current.submitStrikes([99]);
    });

    expect(result.current.history.jury.myStrikes).toEqual([2]);
    expect(result.current.error).toBe(
      'Selected juror IDs are invalid. Please reselect from the current pool.'
    );
    expect(getDebugState().lastAction).toMatchObject({
      result: 'rejected',
      rejectReason: 'invalid_selection',
    });
    expect(requestLlmJson).toHaveBeenCalledTimes(1);
  });

  it('accepts valid strike selections for defense and prosecution', async () => {
    const roles = ['defense', 'prosecution'];

    for (const role of roles) {
      requestLlmJson.mockReset();
      requestLlmJson
        .mockResolvedValueOnce(buildLlmResponse(juryCasePayload))
        .mockResolvedValueOnce(
          buildLlmResponse({
            opponent_strikes: [],
            seated_juror_ids: [1],
            judge_comment: 'Seated.',
          })
        );

      const { result } = renderHook(() => useGameState());

      await act(async () => {
        await result.current.generateCase(role, 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
      });

      await act(async () => {
        await result.current.submitStrikes([2, 3]);
      });

      expect(result.current.history.jury.locked).toBe(true);
      expect(result.current.history.jury.myStrikes).toEqual([2, 3]);
      expect(result.current.history.jury.seatedIds).toEqual([1]);
      expect(result.current.error).toBeNull();
    }
  });

  it('rejects stale strike selections when the pool changes', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(juryCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.toggleStrikeSelection(2);
    });

    act(() => {
      result.current.history.jury.pool = result.current.history.jury.pool.filter(
        (juror) => juror.id !== 2
      );
    });

    await act(async () => {
      await result.current.submitStrikes([2]);
    });

    expect(result.current.error).toBe(
      'Selected juror IDs are invalid. Please reselect from the current pool.'
    );
    expect(getDebugState().lastAction).toMatchObject({
      result: 'rejected',
      rejectReason: 'invalid_selection',
    });
    expect(result.current.history.jury.locked).toBe(false);
    expect(result.current.history.jury.myStrikes).toEqual([2]);
    expect(requestLlmJson).toHaveBeenCalledTimes(1);
  });

  it('stores raw model text on jury strike submissions', async () => {
    const rawStrikeText = '{"opponent_strikes":[3],"seated_juror_ids":[1],"judge_comment":"Seated."}';
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(juryCasePayload))
      .mockResolvedValueOnce(
        buildLlmResponse(
          {
            opponent_strikes: [3],
            seated_juror_ids: [1],
            judge_comment: 'Seated.',
          },
          rawStrikeText
        )
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    await act(async () => {
      await result.current.submitStrikes([2]);
    });

    expect(getDebugState().lastAction?.rawModelText).toBe(rawStrikeText);
  });

  it('overwrites counsel notes after motion ruling and verdict', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'Opposing response.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            ruling: 'GRANTED',
            outcome_text: 'Granted',
            evidence_status_updates: [{ id: 1, status: 'suppressed' }],
          })
        )
      )
      .mockResolvedValueOnce(
        buildLlmResponse({
          final_ruling: 'Acquitted',
          final_weighted_score: 77,
          judge_opinion: 'Bench decision',
          accountability: baseAccountability,
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse({ text: 'Opposing response.' }))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            evidence_status_updates: [
              { id: 1, status: 'admissible' },
              { id: 2, status: 'suppressed' },
            ],
          })
        )
      )
      .mockResolvedValueOnce(
        buildLlmResponse({
          final_ruling: 'Guilty based on Evidence 2',
          final_weighted_score: 60,
          judge_opinion: 'Evidence 2 controls this outcome.',
          accountability: baseAccountability,
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
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
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(benchCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.counselNotes = 'Remember to cite precedent.';
    });

    await act(async () => {
      await result.current.handleCopyFull();
    });

    expect(copyToClipboard).toHaveBeenCalledTimes(1);
    expect(copyToClipboard.mock.calls[0][0]).toContain(
      'COUNSEL NOTES (NON-RECORD FLAVOR):\nRemember to cite precedent.'
    );
  });

  it('updates copied state only when the clipboard write succeeds', async () => {
    vi.useFakeTimers();
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(benchCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    copyToClipboard.mockResolvedValueOnce(true);
    await act(async () => {
      await result.current.handleCopyFull();
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.copied).toBe(false);

    copyToClipboard.mockResolvedValueOnce(false);
    await act(async () => {
      await result.current.handleCopyFull();
    });

    expect(result.current.copied).toBe(false);

    vi.useRealTimers();
  });

  it('includes achievement titles in the copied docket when present', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(benchCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.trial = {
        locked: true,
        text: 'Closing argument.',
        verdict: buildVerdict({
          final_ruling: 'Guilty',
          final_weighted_score: 95,
          achievement_title: 'The Blender and the Pigeon Conspiracy',
        }),
      };
    });

    await act(async () => {
      await result.current.handleCopyFull();
    });

    expect(copyToClipboard.mock.calls[0][0]).toContain(
      'ACHIEVEMENT: The Blender and the Pigeon Conspiracy'
    );
  });

  it('omits trial and verdict details when a dismissal ends the case', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(benchCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.motion = {
        motionText: 'Move to dismiss.',
        motionBy: 'defense',
        rebuttalText: 'Opposes dismissal.',
        rebuttalBy: 'prosecution',
        ruling: {
          ruling: 'GRANTED',
          outcome_text: 'Motion to dismiss granted. Case dismissed with prejudice.',
          score: 90,
          evidence_status_updates: [],
          breakdown: buildMotionBreakdown({
            issues: [
              {
                id: 'dismissal-1',
                label: 'Dismissal',
                disposition: 'GRANTED',
                reasoning: 'The record supports dismissal.',
                affectedEvidenceIds: [],
              },
            ],
            docket_entries: ['Dismissal entered.'],
          }),
        },
        motionPhase: 'motion_ruling_locked',
        locked: true,
      };
      result.current.history.disposition = {
        type: FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE,
        source: 'motion',
        summary: 'Dismissed (Pre-Trial Motion Granted)',
        details: 'RULING: GRANTED - "Motion to dismiss granted. Case dismissed with prejudice."',
      };
      result.current.history.trial = {
        locked: true,
        text: 'Argument that should not appear.',
        verdict: buildVerdict({ final_ruling: 'Mistrial' }),
      };
    });

    await act(async () => {
      await result.current.handleCopyFull();
    });

    const copiedText = copyToClipboard.mock.calls[0][0];
    expect(copiedText).toContain('FINAL DISPOSITION:');
    expect(copiedText).toContain('Dismissed (Pre-Trial Motion Granted)');
    expect(copiedText).not.toContain('TRIAL ARGUMENT:');
    expect(copiedText).not.toContain('SCORE + ACHIEVEMENT:');
  });

  it('records canonical dismissal dispositions from motion rulings', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            ruling: 'GRANTED',
            outcome_text: 'Motion to dismiss granted. Case dismissed with prejudice.',
            score: 90,
          })
        )
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.motion = {
        motionText: 'Move to dismiss.',
        motionBy: 'defense',
        rebuttalText: 'Opposes dismissal.',
        rebuttalBy: 'prosecution',
        ruling: null,
        motionPhase: 'rebuttal_submission',
        locked: false,
      };
    });

    await act(async () => {
      await result.current.requestMotionRuling();
    });

    expect(result.current.history.disposition.type).toBe(
      FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE
    );
    expect(result.current.history.disposition.source).toBe('motion');
  });

  it('emits RUN_ENDED with outcome payload when a dismissal ends the run', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            ruling: 'GRANTED',
            outcome_text: 'Motion to dismiss granted. Case dismissed with prejudice.',
            score: 90,
          })
        )
      );

    const onShellEvent = vi.fn();
    const { result } = renderHook(() => useGameState({ onShellEvent }));

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.motion = {
        motionText: 'Move to dismiss.',
        motionBy: 'defense',
        rebuttalText: 'Opposes dismissal.',
        rebuttalBy: 'prosecution',
        ruling: null,
        motionPhase: 'rebuttal_submission',
        locked: false,
      };
    });

    await act(async () => {
      await result.current.requestMotionRuling();
    });

    const runEndedEvent = onShellEvent.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === 'RUN_ENDED');

    expect(runEndedEvent).toEqual(
      expect.objectContaining({
        type: 'RUN_ENDED',
        payload: expect.objectContaining({
          disposition: expect.objectContaining({
            type: FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE,
          }),
          sanctions: expect.objectContaining({
            after: expect.objectContaining({ state: SANCTION_STATES.CLEAN }),
          }),
        }),
      })
    );
    expect(result.current.runOutcome.disposition.type).toBe(
      FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE
    );
    const profile = loadPlayerProfile();
    expect(profile.caseHistory[0]).toEqual(
      expect.objectContaining({
        caseName: 'Bench Trial',
        outcome: FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE,
      })
    );
    expect(result.current.gameState).toBe(GAME_STATES.PLAYING);
  });

  it('ends the run on a dismissal and blocks further docket submissions', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            ruling: 'GRANTED',
            outcome_text: 'Motion to dismiss granted. Case dismissed with prejudice.',
            score: 90,
          })
        )
      );

    const onShellEvent = vi.fn();
    const { result } = renderHook(() => useGameState({ onShellEvent }));

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.motion = {
        motionText: 'Move to dismiss.',
        motionBy: 'defense',
        rebuttalText: 'Opposes dismissal.',
        rebuttalBy: 'prosecution',
        ruling: null,
        motionPhase: 'rebuttal_submission',
        locked: false,
      };
    });

    await act(async () => {
      await result.current.requestMotionRuling();
    });

    const runEndedEvent = onShellEvent.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === 'RUN_ENDED');

    expect(runEndedEvent).toEqual(
      expect.objectContaining({
        type: 'RUN_ENDED',
        payload: expect.objectContaining({
          disposition: expect.objectContaining({
            type: FINAL_DISPOSITIONS.DISMISSED_WITH_PREJUDICE,
          }),
        }),
      })
    );

    await act(async () => {
      await result.current.submitArgument('Closing argument.');
    });

    expect(result.current.error).toBe('This case has already reached a terminal disposition.');
    expect(requestLlmJson).toHaveBeenCalledTimes(2);
  });

  it('does not set disposition on denied motions and allows verdict submission', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildMotionRuling({
            outcome_text: 'Motion denied; case not dismissed.',
            score: 45,
          })
        )
      )
      .mockResolvedValueOnce(
        buildLlmResponse({
          final_ruling: 'Not Guilty',
          final_weighted_score: 77,
          judge_opinion: 'Bench decision',
          accountability: baseAccountability,
        })
      );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.motion = {
        motionText: 'Move to dismiss.',
        motionBy: 'defense',
        rebuttalText: 'Opposes dismissal.',
        rebuttalBy: 'prosecution',
        ruling: null,
        motionPhase: 'rebuttal_submission',
        locked: false,
      };
    });

    await act(async () => {
      await result.current.requestMotionRuling();
    });

    expect(result.current.history.disposition).toBeNull();

    await act(async () => {
      await result.current.submitArgument('Closing argument.');
    });

    expect(requestLlmJson).toHaveBeenCalledTimes(3);
    expect(result.current.error).toBeNull();
  });


  it('stores a terminal case docket snapshot in player profile history', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse(buildVerdict({ jury_reasoning: 'N/A' })));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.motion = {
        motionText: 'Motion text.',
        motionBy: 'defense',
        rebuttalText: 'Rebuttal text.',
        rebuttalBy: 'prosecution',
        ruling: {
          ruling: 'DENIED',
          outcome_text: 'Denied.',
          score: 45,
          evidence_status_updates: [],
          breakdown: buildMotionBreakdown(),
        },
        motionPhase: 'motion_ruling_locked',
        locked: true,
      };
    });

    await act(async () => {
      await result.current.submitArgument('Closing statement.');
    });

    const profile = loadPlayerProfile();
    expect(profile.caseHistory).toHaveLength(1);
    const savedCase = profile.caseHistory[0];
    expect(savedCase.caseName).toBe('Bench Trial');
    expect(savedCase.outcome).toBe(FINAL_DISPOSITIONS.NOT_GUILTY);
    expect(savedCase.finalSanctionsCount).toBe(0);
    expect(savedCase.docketSnapshot.sections.case.title).toBe('Bench Trial');
    expect(savedCase.docketSnapshot.sections.trial.text).toBe('Closing statement.');
    expect(savedCase.docketSnapshot.sections.trial.verdict.final_ruling).toBe('Not Guilty');
  });

  it('emits RUN_ENDED with outcome payload after a final verdict', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(buildLlmResponse(buildVerdict({ jury_reasoning: 'N/A' })));

    const onShellEvent = vi.fn();
    const { result } = renderHook(() => useGameState({ onShellEvent }));

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.motion = {
        motionText: 'Motion text.',
        motionBy: 'defense',
        rebuttalText: 'Rebuttal text.',
        rebuttalBy: 'prosecution',
        ruling: {
          ruling: 'DENIED',
          outcome_text: 'Denied.',
          score: 45,
          evidence_status_updates: [],
          breakdown: buildMotionBreakdown(),
        },
        motionPhase: 'motion_ruling_locked',
        locked: true,
      };
    });

    await act(async () => {
      await result.current.submitArgument('Closing statement.');
    });

    const runEndedEvent = onShellEvent.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === 'RUN_ENDED');

    expect(runEndedEvent).toEqual(
      expect.objectContaining({
        type: 'RUN_ENDED',
        payload: expect.objectContaining({
          disposition: expect.objectContaining({
            type: FINAL_DISPOSITIONS.NOT_GUILTY,
          }),
          sanctions: expect.objectContaining({
            before: expect.objectContaining({ state: SANCTION_STATES.CLEAN }),
            after: expect.objectContaining({ state: SANCTION_STATES.CLEAN }),
          }),
        }),
      })
    );
    expect(result.current.runOutcome.disposition.type).toBe(FINAL_DISPOSITIONS.NOT_GUILTY);
    expect(result.current.gameState).toBe(GAME_STATES.PLAYING);
  });

  it('ends the run on a mistrial verdict and blocks further submissions', async () => {
    requestLlmJson
      .mockResolvedValueOnce(buildLlmResponse(benchCasePayload))
      .mockResolvedValueOnce(
        buildLlmResponse(
          buildVerdict({
            final_ruling: 'Mistrial declared.',
            final_weighted_score: 0,
            judge_opinion: 'The court declares a mistrial.',
            jury_reasoning: 'N/A',
          })
        )
      );

    const onShellEvent = vi.fn();
    const { result } = renderHook(() => useGameState({ onShellEvent }));

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.motion = {
        motionText: 'Motion text.',
        motionBy: 'defense',
        rebuttalText: 'Rebuttal text.',
        rebuttalBy: 'prosecution',
        ruling: {
          ruling: 'DENIED',
          outcome_text: 'Denied.',
          score: 45,
          evidence_status_updates: [],
          breakdown: buildMotionBreakdown(),
        },
        motionPhase: 'motion_ruling_locked',
        locked: true,
      };
    });

    await act(async () => {
      await result.current.submitArgument('Closing statement.');
    });

    const runEndedEvent = onShellEvent.mock.calls
      .map(([event]) => event)
      .find((event) => event.type === 'RUN_ENDED');

    expect(runEndedEvent).toEqual(
      expect.objectContaining({
        type: 'RUN_ENDED',
        payload: expect.objectContaining({
          disposition: expect.objectContaining({
            type: FINAL_DISPOSITIONS.MISTRIAL_CONDUCT,
          }),
        }),
      })
    );

    await act(async () => {
      await result.current.submitArgument('Another closing.');
    });

    expect(result.current.error).toBe('This case has already reached a terminal disposition.');
    expect(requestLlmJson).toHaveBeenCalledTimes(2);
  });

  it('blocks verdict submissions once a terminal disposition is set', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(benchCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.disposition = {
        type: FINAL_DISPOSITIONS.DISMISSED,
        source: 'motion',
        summary: 'Dismissed (Pre-Trial Motion Granted)',
        details: 'RULING: GRANTED - "Dismissed."',
      };
    });

    await act(async () => {
      await result.current.submitArgument('Closing argument.');
    });

    expect(requestLlmJson).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe('This case has already reached a terminal disposition.');
  });

  it('copies full text without ellipses', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(benchCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    const longArgument = Array.from({ length: 40 }, (_, index) => `Sentence ${index + 1}.`).join(' ');

    act(() => {
      result.current.history.motion = {
        motionText: 'Motion text.',
        motionBy: 'defense',
        rebuttalText: 'Rebuttal text.',
        rebuttalBy: 'prosecution',
        ruling: {
          ruling: 'DENIED',
          outcome_text: 'Motion denied.',
          score: 50,
          evidence_status_updates: [],
          breakdown: buildMotionBreakdown(),
        },
        motionPhase: 'motion_ruling_locked',
        locked: true,
      };
      result.current.history.trial = {
        locked: false,
        text: longArgument,
      };
    });

    await act(async () => {
      await result.current.handleCopyFull();
    });

    const copiedText = copyToClipboard.mock.calls[0][0];
    expect(copiedText).toContain(longArgument);
    expect(copiedText).not.toContain('...');
  });

  it('strips markdown from motion and trial text when copying full docket', async () => {
    requestLlmJson.mockResolvedValueOnce(buildLlmResponse(benchCasePayload));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    const motionMarkdown = '## Motion heading\n**Bold** point\n- Item one\n- Item two';
    const trialMarkdown = 'Argument with `code` and [link](https://example.com).';

    act(() => {
      result.current.history.motion = {
        motionText: motionMarkdown,
        motionBy: 'defense',
        rebuttalText: 'Rebuttal text.',
        rebuttalBy: 'prosecution',
        ruling: {
          ruling: 'DENIED',
          outcome_text: 'Motion denied.',
          score: 50,
          evidence_status_updates: [],
          breakdown: buildMotionBreakdown(),
        },
        motionPhase: 'motion_ruling_locked',
        locked: true,
      };
      result.current.history.trial = {
        locked: false,
        text: trialMarkdown,
      };
    });

    await act(async () => {
      await result.current.handleCopyFull();
    });

    const copiedText = copyToClipboard.mock.calls[0][0];
    expect(copiedText).toContain('Motion heading\nBold point\nItem one');
    expect(copiedText).toContain('Argument with code and link.');
    expect(copiedText).not.toContain('**');
    expect(copiedText).not.toContain('```');
    expect(copiedText).not.toContain('[link]');
    expect(copiedText).not.toContain('- Item one');
  });

  it('keeps the section order stable', async () => {
    requestLlmJson.mockResolvedValueOnce(
      buildLlmResponse({
        ...juryCasePayload,
        title: 'Order Case',
        facts: ['First fact', 'Second fact'],
        judge: { name: 'Hon. Order' },
      })
    );

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, COURT_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.jury = {
        pool: juryCasePayload.jurors.map((juror) => ({ ...juror, status: 'seated' })),
        myStrikes: [1],
        opponentStrikes: [2],
        seatedIds: [1, 2, 3],
        comment: 'Jury seated without issue.',
        locked: true,
      };
      result.current.history.motion = {
        motionText: 'Motion text.',
        motionBy: 'defense',
        rebuttalText: 'Rebuttal text.',
        rebuttalBy: 'prosecution',
        ruling: {
          ruling: 'DENIED',
          outcome_text: 'Motion denied.',
          score: 50,
          evidence_status_updates: [],
          breakdown: buildMotionBreakdown(),
        },
        motionPhase: 'motion_ruling_locked',
        locked: true,
      };
      result.current.history.counselNotes = 'Keep the story tight.';
      result.current.history.trial = {
        locked: true,
        text: 'Trial argument.',
        verdict: buildVerdict({
          final_ruling: 'Not Guilty',
          final_weighted_score: 101,
          overflow_reason_code: 'legendary',
          overflow_explanation: 'An exceptional showing.',
          achievement_title: 'Order of Operations',
        }),
      };
      result.current.history.disposition = {
        type: FINAL_DISPOSITIONS.NOT_GUILTY,
        source: 'verdict',
        summary: 'Not Guilty',
        details: 'JUDGE OPINION: "Bench decision."',
      };
      result.current.history.sanctions = [
        buildSanctionsEntry({ docketText: 'The court issues a warning.' }),
      ];
    });

    await act(async () => {
      await result.current.handleCopyFull();
    });

    const copiedText = copyToClipboard.mock.calls[0][0];
    const headers = [
      'DOCKET:',
      'FACTS:',
      'JURY SEATED',
      'PRE-TRIAL MOTIONS:',
      'COUNSEL NOTES',
      'TRIAL ARGUMENT:',
      'FINAL DISPOSITION:',
      'SCORE + ACHIEVEMENT:',
      'SANCTIONS/STATUS FLAGS:',
    ];
    const positions = headers.map((header) => copiedText.indexOf(header));
    positions.forEach((position) => expect(position).toBeGreaterThan(-1));
    positions.reduce((prev, current) => {
      expect(current).toBeGreaterThan(prev);
      return current;
    }, -1);
  });

  it('escalates sanctions to warned when a docketed warning is logged', () => {
    const nowMs = Date.now();
    const baseState = __testables.buildDefaultSanctionsState(nowMs);
    const sanctionsLog = [
      buildSanctionsEntry({
        id: 's-1',
        docketText: 'The court issues a warning for decorum.',
        timestamp: new Date(nowMs).toISOString(),
      }),
    ];

    const nextState = __testables.deriveSanctionsState(baseState, sanctionsLog, nowMs);

    expect(nextState.state).toBe(SANCTION_STATES.WARNED);
    expect(nextState.lastMisconductAt).toBeDefined();
  });

  it('ignores non-trigger docket text when evaluating conduct', () => {
    const entry = buildSanctionsEntry({
      id: 's-2',
      trigger: SANCTION_REASON_CODES.OTHER,
      docketText: 'Losing on the merits is not misconduct.',
    });

    const evaluation = __testables.evaluateConductTrigger(
      entry,
      [entry],
      __testables.RECIDIVISM_WINDOW_MS
    );

    expect(evaluation.triggered).toBe(false);
  });

  it('counts newly-triggered sanctions once when entries are added', () => {
    const warnedEntry = buildSanctionsEntry({
      id: 's-4',
      docketText: 'The court issues a warning for decorum.',
    });
    const nonTriggerEntry = buildSanctionsEntry({
      id: 's-5',
      docketText: 'Losing on the merits is not misconduct.',
    });
    const counted = new Set();

    expect(__testables.countNewSanctionEntries([warnedEntry], counted)).toBe(1);
    expect(__testables.countNewSanctionEntries([warnedEntry], counted)).toBe(0);
    expect(__testables.countNewSanctionEntries([warnedEntry, nonTriggerEntry], counted)).toBe(0);
  });

  it('escalates to public defender mode after repeated procedural violations', () => {
    const nowMs = Date.now();
    const firstEntryTime = nowMs - 5 * 60 * 1000;
    const secondEntryTime = nowMs;
    const sanctionedState = {
      ...__testables.buildDefaultSanctionsState(firstEntryTime),
      state: SANCTION_STATES.SANCTIONED,
      level: 2,
      startedAt: new Date(firstEntryTime).toISOString(),
      expiresAt: new Date(firstEntryTime + __testables.SANCTION_DURATION_MS).toISOString(),
      lastMisconductAt: new Date(firstEntryTime).toISOString(),
      recidivismCount: 1,
      recentlyReinstatedUntil: null,
    };
    const sanctionsLog = [
      buildSanctionsEntry({
        id: 's-3',
        trigger: SANCTION_REASON_CODES.DEADLINE_VIOLATION,
        docketText: 'Procedural violation: missed deadline.',
        timestamp: new Date(firstEntryTime).toISOString(),
      }),
      buildSanctionsEntry({
        id: 's-4',
        trigger: SANCTION_REASON_CODES.DEADLINE_VIOLATION,
        docketText: 'Repeated procedural violation on the docket.',
        timestamp: new Date(secondEntryTime).toISOString(),
      }),
    ];

    const nextState = __testables.deriveSanctionsState(
      sanctionedState,
      sanctionsLog,
      secondEntryTime
    );

    expect(nextState.state).toBe(SANCTION_STATES.PUBLIC_DEFENDER);
  });

  it('transitions from clean to warned on first misconduct entry', () => {
    const nowMs = Date.now();
    const baseState = __testables.buildDefaultSanctionsState(nowMs);
    const sanctionsLog = [
      buildSanctionsEntry({
        id: 's-5',
        docketText: 'The court issues a warning for decorum.',
        timestamp: new Date(nowMs).toISOString(),
      }),
    ];

    const nextState = __testables.deriveSanctionsState(baseState, sanctionsLog, nowMs);

    expect(nextState.state).toBe(SANCTION_STATES.WARNED);
    expect(nextState.expiresAt).toBeTruthy();
  });

  it('escalates warned counsel to sanctioned on recidivism within the window', () => {
    const nowMs = Date.now();
    const firstEntryTime = nowMs - 10 * 60 * 1000;
    const warnedState = {
      ...__testables.buildDefaultSanctionsState(firstEntryTime),
      state: SANCTION_STATES.WARNED,
      level: 1,
      startedAt: new Date(firstEntryTime).toISOString(),
      expiresAt: new Date(nowMs + 10 * 60 * 1000).toISOString(),
      lastMisconductAt: new Date(firstEntryTime).toISOString(),
      recidivismCount: 1,
      recentlyReinstatedUntil: null,
    };
    const sanctionsLog = [
      buildSanctionsEntry({
        id: 's-6',
        docketText: 'Another warning for decorum.',
        timestamp: new Date(nowMs).toISOString(),
      }),
    ];

    const nextState = __testables.deriveSanctionsState(warnedState, sanctionsLog, nowMs);

    expect(nextState.state).toBe(SANCTION_STATES.SANCTIONED);
  });

  it('decays recidivism counts after the cooldown window passes', () => {
    const nowMs = Date.now();
    const lastMisconductAt = nowMs - 3 * 60 * 60 * 1000;
    const warnedState = {
      ...__testables.buildDefaultSanctionsState(lastMisconductAt),
      state: SANCTION_STATES.WARNED,
      level: 1,
      startedAt: new Date(lastMisconductAt).toISOString(),
      expiresAt: new Date(nowMs + 10 * 60 * 1000).toISOString(),
      lastMisconductAt: new Date(lastMisconductAt).toISOString(),
      recidivismCount: 2,
      recentlyReinstatedUntil: null,
    };

    const nextState = __testables.deriveSanctionsState(warnedState, [], nowMs);

    expect(nextState.state).toBe(SANCTION_STATES.WARNED);
    expect(nextState.recidivismCount).toBe(0);
  });

  it('prunes recidivism counts on read when the cooldown window has passed', () => {
    const nowMs = Date.now();
    const lastMisconductAt = nowMs - SANCTIONS_TIMERS_MS.COOLDOWN_RESET - 10 * 1000;
    const storedState = {
      ...__testables.buildDefaultSanctionsState(lastMisconductAt),
      state: SANCTION_STATES.WARNED,
      lastMisconductAt: new Date(lastMisconductAt).toISOString(),
      expiresAt: new Date(nowMs + 10 * 60 * 1000).toISOString(),
      recidivismCount: 2,
      recentlyReinstatedUntil: null,
    };

    window.localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ ...defaultPlayerProfile(), sanctions: storedState })
    );

    const { result } = renderHook(() => useGameState());

    expect(result.current.sanctionsState.state).toBe(SANCTION_STATES.WARNED);
    expect(result.current.sanctionsState.recidivismCount).toBe(0);
  });

  it('clears sanctions after time served expires', () => {
    const nowMs = Date.now();
    const expiredAt = nowMs - 5 * 60 * 1000;
    const sanctionedState = {
      ...__testables.buildDefaultSanctionsState(expiredAt),
      state: SANCTION_STATES.SANCTIONED,
      level: 2,
      startedAt: new Date(expiredAt).toISOString(),
      expiresAt: new Date(expiredAt).toISOString(),
      lastMisconductAt: new Date(expiredAt).toISOString(),
      recidivismCount: 1,
      recentlyReinstatedUntil: null,
    };

    const nextState = __testables.deriveSanctionsState(sanctionedState, [], nowMs);

    expect(nextState.state).toBe(SANCTION_STATES.CLEAN);
    expect(nextState.expiresAt).toBeNull();
    expect(nextState.recidivismCount).toBe(0);
  });
});
