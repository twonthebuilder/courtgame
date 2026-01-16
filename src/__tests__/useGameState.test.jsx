import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import useGameState, { __testables } from '../hooks/useGameState';
import { copyToClipboard } from '../lib/clipboard';
import {
  CASE_TYPES,
  FINAL_DISPOSITIONS,
  GAME_STATES,
  JURISDICTIONS,
  SANCTION_ENTRY_STATES,
  SANCTION_REASON_CODES,
  SANCTION_STATES,
  SANCTION_VISIBILITY,
} from '../lib/constants';
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
  ...overrides,
});

describe('useGameState transitions', () => {
  beforeEach(() => {
    requestLlmJson.mockReset();
    copyToClipboard.mockClear();
    window.localStorage.clear();
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
        CASE_TYPES.STANDARD
      );
    });

    expect(result.current.gameState).toBe(GAME_STATES.INITIALIZING);

    await act(async () => {
      resolveRequest(benchCasePayload);
      await deferred;
    });

    expect(result.current.gameState).toBe(GAME_STATES.PLAYING);
    expect(result.current.history.case.title).toBe('Bench Trial');
    expect(result.current.history.counselNotes).toBe('');
  });

  it('normalizes legacy difficulty values before storing config', async () => {
    requestLlmJson.mockResolvedValueOnce(benchCasePayload);

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase(
        'defense',
        'regular',
        JURISDICTIONS.USA,
        CASE_TYPES.STANDARD
      );
    });

    expect(result.current.config.difficulty).toBe('normal');
  });

  it('locks the config when public defender mode is active', async () => {
    const nowMs = Date.now();
    const storedState = {
      ...__testables.buildDefaultSanctionsState(nowMs),
      state: SANCTION_STATES.PUBLIC_DEFENDER,
    };
    window.localStorage.setItem('courtgame.sanctions.state', JSON.stringify(storedState));

    requestLlmJson.mockResolvedValueOnce(benchCasePayload);

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('prosecution', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
    });

    const generatorCall = requestLlmJson.mock.calls[0][0];
    expect(generatorCall.systemPrompt).toContain('PUBLIC DEFENDER MODE CONSTRAINTS');
    expect(result.current.config.role).toBe('defense');
    expect(result.current.config.jurisdiction).toBe(JURISDICTIONS.MUNICIPAL_NIGHT_COURT);
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
    window.localStorage.setItem('courtgame.sanctions.state', JSON.stringify(storedState));

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
        final_ruling: 'Not Guilty',
        final_weighted_score: 77,
        judge_opinion: 'Bench decision',
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
    window.localStorage.setItem('courtgame.sanctions.state', JSON.stringify(storedState));

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
        final_ruling: 'Guilty',
        final_weighted_score: 44,
        judge_opinion: 'Bench decision',
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
    window.localStorage.setItem('courtgame.sanctions.state', JSON.stringify(storedState));

    requestLlmJson
      .mockResolvedValueOnce(benchCasePayload)
      .mockResolvedValueOnce({ text: 'AI drafted motion.' })
      .mockResolvedValueOnce({
        ruling: 'DENIED',
        outcome_text: 'Denied',
        score: 45,
        evidence_status_updates: [{ id: 1, status: 'admissible' }],
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('prosecution', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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

  it('surfaces errors and resets to start on generation failure', async () => {
    requestLlmJson.mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
    });

    expect(result.current.gameState).toBe(GAME_STATES.START);
    expect(result.current.error).toBe('Docket creation failed. Please try again.');
  });

  it('enforces defense/prosecution turn order during the motion exchange', async () => {
    requestLlmJson
      .mockResolvedValueOnce(benchCasePayload)
      .mockResolvedValueOnce({ text: 'AI drafted motion.' });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('prosecution', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
    });

    act(() => {
      result.current.history.counselNotes = 'Remember to cite precedent.';
    });

    act(() => {
      result.current.handleCopyFull();
    });

    expect(copyToClipboard).toHaveBeenCalledTimes(1);
    expect(copyToClipboard.mock.calls[0][0]).toContain(
      'COUNSEL NOTES (NON-RECORD FLAVOR):\nRemember to cite precedent.'
    );
  });

  it('includes achievement titles in the copied docket when present', async () => {
    requestLlmJson.mockResolvedValueOnce(benchCasePayload);

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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

    act(() => {
      result.current.handleCopyFull();
    });

    expect(copyToClipboard.mock.calls[0][0]).toContain(
      'ACHIEVEMENT: The Blender and the Pigeon Conspiracy'
    );
  });

  it('omits trial and verdict details when a dismissal ends the case', async () => {
    requestLlmJson.mockResolvedValueOnce(benchCasePayload);

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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

    act(() => {
      result.current.handleCopyFull();
    });

    const copiedText = copyToClipboard.mock.calls[0][0];
    expect(copiedText).toContain('FINAL DISPOSITION:');
    expect(copiedText).toContain('Dismissed (Pre-Trial Motion Granted)');
    expect(copiedText).not.toContain('TRIAL ARGUMENT:');
    expect(copiedText).not.toContain('SCORE + ACHIEVEMENT:');
  });

  it('records canonical dismissal dispositions from motion rulings', async () => {
    requestLlmJson
      .mockResolvedValueOnce(benchCasePayload)
      .mockResolvedValueOnce({
        ruling: 'GRANTED',
        outcome_text: 'Motion to dismiss granted. Case dismissed with prejudice.',
        score: 90,
        evidence_status_updates: [],
      });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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

  it('blocks verdict submissions once a terminal disposition is set', async () => {
    requestLlmJson.mockResolvedValueOnce(benchCasePayload);

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
    requestLlmJson.mockResolvedValueOnce(benchCasePayload);

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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
        },
        motionPhase: 'motion_ruling_locked',
        locked: true,
      };
      result.current.history.trial = {
        locked: false,
        text: longArgument,
      };
    });

    act(() => {
      result.current.handleCopyFull();
    });

    const copiedText = copyToClipboard.mock.calls[0][0];
    expect(copiedText).toContain(longArgument);
    expect(copiedText).not.toContain('...');
  });

  it('keeps the section order stable', async () => {
    requestLlmJson.mockResolvedValueOnce({
      ...juryCasePayload,
      title: 'Order Case',
      facts: ['First fact', 'Second fact'],
      judge: { name: 'Hon. Order' },
    });

    const { result } = renderHook(() => useGameState());

    await act(async () => {
      await result.current.generateCase('defense', 'normal', JURISDICTIONS.USA, CASE_TYPES.STANDARD);
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

    act(() => {
      result.current.handleCopyFull();
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
