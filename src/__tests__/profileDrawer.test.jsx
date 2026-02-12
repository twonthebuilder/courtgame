import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import ProfileDrawer from '../components/profile/ProfileDrawer';
import { saveRunHistory } from '../lib/persistence';
import { SANCTION_STATES } from '../lib/constants';

globalThis.React = React;

describe('ProfileDrawer', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders bar status, stats, and last run outcome when available', () => {
    saveRunHistory({
      runs: [
        {
          id: 'run-1',
          startedAt: '2024-02-01T00:00:00.000Z',
          endedAt: '2024-02-01T01:00:00.000Z',
          jurisdiction: 'USA',
          difficulty: 'normal',
          courtType: 'nightCourt',
          playerRole: 'defense',
          outcome: 'dismissed_with_prejudice',
          score: 88,
          caseTitle: 'State v. Doe',
          judgeName: 'Hon. Redwood',
        },
      ],
    });

    render(
      <ProfileDrawer
        profile={{
          sanctions: { state: SANCTION_STATES.WARNED, level: 1 },
          stats: { runsCompleted: 3, verdictsFinalized: 2 },
          achievements: [{ title: 'First win', awardedAt: '2024-01-01T00:00:00.000Z' }],
          caseHistory: [
            {
              id: 'case-1',
              caseName: 'State v. Doe',
              outcome: 'dismissed_with_prejudice',
              date: '2024-02-01T01:00:00.000Z',
              finalSanctionsCount: 1,
              docketSnapshot: {
                sections: {
                  case: {
                    title: 'State v. Doe',
                    defendant: 'Jordan Doe',
                    charge: 'Fraud',
                    judge: { name: 'Hon. Redwood', bias: 'Strict on procedure.' },
                    facts: ['Fact one'],
                    evidence: ['Memo'],
                    opposing_counsel: {},
                    is_jury_trial: false,
                  },
                  counselNotes: 'Notes',
                  jury: { skipped: true },
                  motion: {
                    motionPhase: 'motion_ruling_locked',
                    motionText: 'Move to dismiss',
                    motionBy: 'defense',
                    rebuttalText: 'Denied',
                    rebuttalBy: 'prosecution',
                    ruling: { ruling: 'GRANTED', outcome_text: 'Dismissed.' },
                  },
                  trial: { text: '', verdict: null },
                  sanctions: [{ id: 's1', docket_text: 'Warning' }],
                },
              },
            },
          ],
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /open profile drawer/i }));

    expect(screen.getByText('Bar Status')).toBeInTheDocument();
    expect(screen.getByText(/Tier 1/i)).toBeInTheDocument();
    expect(screen.getByText('Key Stats')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getAllByText(/Dismissed With Prejudice/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/State v\. Doe/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Judge: Hon\. Redwood/i)).toBeInTheDocument();
    expect(screen.getByText(/Role: Defense/i)).toBeInTheDocument();
    expect(screen.getByText(/Difficulty: Normal/i)).toBeInTheDocument();
    expect(screen.getByText(/Jurisdiction: USA/i)).toBeInTheDocument();
    expect(screen.getByText(/Court: Night Court/i)).toBeInTheDocument();
    expect(screen.getByText(/Past Cases/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /state v\. doe/i }));
    expect(screen.getAllByText(/State v\. Doe/i).length).toBeGreaterThan(1);
    expect(screen.getByText(/Sanctions: 1/i)).toBeInTheDocument();
  });

  it('opens and closes the drawer with mobile-safe layout', () => {
    window.innerWidth = 360;
    window.dispatchEvent(new Event('resize'));

    render(
      <ProfileDrawer
        profile={{
          sanctions: { state: SANCTION_STATES.PUBLIC_DEFENDER, level: 2 },
          pdStatus: {
            startedAt: '2024-01-01T00:00:00.000Z',
            expiresAt: '2099-01-01T00:20:00.000Z',
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /open profile drawer/i }));

    const dialog = screen.getByRole('dialog', { name: /profile summary/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toContain('w-full');
    expect(screen.getByText('Bar Status')).toBeInTheDocument();
    expect(screen.getByText(/Public defender ends/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close profile drawer/i }));
    expect(screen.queryByRole('dialog', { name: /profile summary/i })).not.toBeInTheDocument();
  });

  it('uses the latest completed run and ignores in-progress run-history entries', () => {
    saveRunHistory({
      runs: [
        {
          id: 'run-complete',
          startedAt: '2024-02-01T00:00:00.000Z',
          endedAt: '2024-02-01T01:00:00.000Z',
          jurisdiction: 'USA',
          difficulty: 'normal',
          courtType: 'standard',
          playerRole: 'defense',
          outcome: 'not_guilty',
          score: 82,
          caseTitle: 'People v. Lane',
          judgeName: 'Hon. Slate',
        },
        {
          id: 'run-in-progress',
          startedAt: '2024-02-02T00:00:00.000Z',
          endedAt: null,
          jurisdiction: 'USA',
          difficulty: 'normal',
          courtType: 'standard',
          playerRole: 'defense',
          outcome: null,
          score: null,
          caseTitle: 'State v. Pending',
          judgeName: 'Hon. Queue',
        },
      ],
    });

    render(
      <ProfileDrawer
        profile={{
          sanctions: { state: SANCTION_STATES.CLEAN, level: 0 },
          stats: { runsCompleted: 1, verdictsFinalized: 1 },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /open profile drawer/i }));

    expect(screen.getByText(/Not Guilty/i)).toBeInTheDocument();
    expect(screen.getByText(/Case: People v\. Lane/i)).toBeInTheDocument();
    expect(screen.queryByText(/Case: State v\. Pending/i)).not.toBeInTheDocument();
  });
});
