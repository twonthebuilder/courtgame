import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PostRun from '../components/shell/PostRun';
import { SANCTION_STATES } from '../lib/constants';

globalThis.React = React;

describe('PostRun', () => {
  it('summarizes before and after snapshots for the completed run', () => {
    const outcome = {
      disposition: { summary: 'Case closed', details: 'Run completed.' },
      sanctions: {
        before: { state: SANCTION_STATES.WARNED, level: 1 },
        after: { state: SANCTION_STATES.PUBLIC_DEFENDER, level: 3 },
      },
    };

    render(
      <PostRun
        outcome={outcome}
        sanctionsState={null}
        profile={{ pdStatus: { startedAt: 'now', expiresAt: null }, sanctions: outcome.sanctions.after }}
        onNewCase={vi.fn()}
        onMainMenu={vi.fn()}
      />
    );

    const beforePanel = screen.getByText('Before this run').closest('div');
    const afterPanel = screen.getByText('After this run').closest('div');

    expect(beforePanel).not.toBeNull();
    expect(afterPanel).not.toBeNull();

    expect(within(beforePanel).getByText(/Tier 1/i)).toBeInTheDocument();
    expect(within(afterPanel).getByText(/Tier 3/i)).toBeInTheDocument();
    expect(within(afterPanel).getByText('Active')).toBeInTheDocument();
  });
});
