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
    expect(screen.getByText(/Dismissed With Prejudice/i)).toBeInTheDocument();
    expect(screen.getByText(/State v\. Doe/i)).toBeInTheDocument();
    expect(screen.getByText(/Judge: Hon\. Redwood/i)).toBeInTheDocument();
    expect(screen.getByText(/Role: Defense/i)).toBeInTheDocument();
    expect(screen.getByText(/Difficulty: Normal/i)).toBeInTheDocument();
    expect(screen.getByText(/Jurisdiction: USA/i)).toBeInTheDocument();
    expect(screen.getByText(/Court: Night Court/i)).toBeInTheDocument();
  });
});
