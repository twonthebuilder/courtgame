import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PocketCourt from '../App';
import { SANCTION_STATES } from '../lib/constants';
import { __testables as gameStateTestables } from '../hooks/useGameState';

globalThis.React = React;

vi.mock('../components/DebugOverlay', () => ({
  default: () => {
    throw new Error('DebugOverlay crash');
  },
}));

vi.mock('../hooks/useGameState', async () => {
  const actual = await vi.importActual('../hooks/useGameState');
  const { GAME_STATES, SANCTION_STATES } = await vi.importActual('../lib/constants');
  let onShellEvent = null;
  const generateCase = vi.fn();
  const runEndedPayload = {
    disposition: {
      summary: 'Case Closed',
      details: 'The court has closed the docket for this run.',
    },
    sanctions: {
      before: { state: SANCTION_STATES.CLEAN, level: 0 },
      after: { state: SANCTION_STATES.CLEAN, level: 0 },
    },
  };
  const resetGame = vi.fn(() => {
    if (typeof onShellEvent === 'function') {
      onShellEvent({ type: 'RUN_ENDED', payload: runEndedPayload });
    }
  });
  const mockState = {
    gameState: GAME_STATES.PLAYING,
    config: {
      role: 'defense',
      difficulty: 'normal',
      jurisdiction: 'usa',
      courtType: 'standard',
      caseType: 'standard',
    },
    history: {
      case: {
        title: 'Mock Case',
        facts: [],
        evidence: [],
        is_jury_trial: false,
        judge: { name: 'Hon. Test' },
        opposing_counsel: {
          name: 'Opposing Counsel',
          bio: '',
          style_tells: '',
          current_posture: '',
        },
      },
      jury: {
        skipped: true,
        pool: [],
        locked: true,
        myStrikes: [],
        opponentStrikes: [],
        comment: '',
      },
      motion: {
        locked: true,
        motionPhase: 'motion_ruling_locked',
        motionText: '',
        motionBy: 'defense',
        rebuttalText: '',
        rebuttalBy: 'prosecution',
        ruling: {
          ruling: 'DENIED',
          outcome_text: 'Denied.',
          score: 0,
          evidence_status_updates: [],
          breakdown: {
            issues: [
              {
                id: 'issue-1',
                label: 'Issue',
                disposition: 'DENIED',
                reasoning: 'Placeholder.',
                affectedEvidenceIds: [],
              },
            ],
            docket_entries: [],
          },
        },
      },
      trial: {
        locked: true,
        text: 'Closing statement',
        verdict: {
          final_weighted_score: 82,
          final_ruling: 'Not Guilty',
          overflow_reason_code: null,
          overflow_explanation: null,
          achievement_title: null,
          judge_opinion: 'The court finds no basis for conviction.',
          jury_verdict: 'N/A',
          jury_reasoning: '',
        },
      },
      counselNotes: '',
      disposition: null,
    },
    loadingMsg: null,
    error: null,
    copied: false,
    debugBanner: null,
    sanctionsState: { state: SANCTION_STATES.CLEAN, level: 0 },
    generateCase,
    submitStrikes: vi.fn(),
    submitMotionStep: vi.fn(),
    triggerAiMotionSubmission: vi.fn(),
    requestMotionRuling: vi.fn(),
    submitArgument: vi.fn(),
    handleCopyFull: vi.fn(),
    resetGame,
    toggleStrikeSelection: vi.fn(),
  };

  const emitShellEvent = (event) => {
    if (typeof onShellEvent === 'function') {
      onShellEvent(event);
    }
  };

  return {
    ...actual,
    default: (options = {}) => {
      onShellEvent = options?.onShellEvent ?? null;
      return mockState;
    },
    __testables: {
      emitShellEvent,
      generateCase,
      resetGame,
    },
  };
});

describe('App run start flow', () => {
  beforeEach(() => {
    window.Element.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    gameStateTestables.generateCase.mockClear();
    gameStateTestables.resetGame.mockClear();
  });

  it('mounts RunShell once per start click and contains DebugOverlay errors', async () => {
    render(<PocketCourt />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    const defenseButton = screen.getByRole('button', { name: /defense/i });
    fireEvent.click(defenseButton);
    fireEvent.click(defenseButton);

    await waitFor(() => {
      expect(gameStateTestables.generateCase).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('COPY DOCKET')).toBeInTheDocument();
  });

  it('routes start_failed back to SetupHub without re-entering Run', async () => {
    render(<PocketCourt />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: /defense/i }));

    await waitFor(() => {
      expect(gameStateTestables.generateCase).toHaveBeenCalledTimes(1);
    });

    act(() => {
      gameStateTestables.emitShellEvent({
        type: 'start_failed',
        message: 'Failed to start run.',
      });
    });

    expect(await screen.findByText('Profile')).toBeInTheDocument();
    expect(screen.queryByText('COPY DOCKET')).not.toBeInTheDocument();
    expect(gameStateTestables.generateCase).toHaveBeenCalledTimes(1);
  });

  it('routes both new-case actions to SetupHub', async () => {
    render(<PocketCourt />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    fireEvent.click(screen.getByRole('button', { name: /defense/i }));

    await waitFor(() => {
      expect(gameStateTestables.generateCase).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /start new case/i }));

    expect(await screen.findByText('Profile')).toBeInTheDocument();
    expect(screen.queryByText('COPY DOCKET')).not.toBeInTheDocument();
    expect(gameStateTestables.resetGame).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /defense/i }));

    await waitFor(() => {
      expect(gameStateTestables.generateCase).toHaveBeenCalledTimes(2);
    });

    act(() => {
      gameStateTestables.emitShellEvent({
        type: 'RUN_ENDED',
        payload: {
          disposition: {
            summary: 'Not Guilty',
            details: 'Judge cleared the docket.',
          },
          sanctions: {
            before: { state: SANCTION_STATES.CLEAN, level: 0 },
            after: { state: SANCTION_STATES.CLEAN, level: 0 },
          },
        },
      });
    });

    expect(await screen.findByRole('button', { name: /new case/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /new case/i }));

    expect(await screen.findByText('Profile')).toBeInTheDocument();
    expect(screen.queryByText('Outcome Summary')).not.toBeInTheDocument();
  });
});
