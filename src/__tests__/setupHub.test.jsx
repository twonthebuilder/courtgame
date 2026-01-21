import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SetupHub from '../components/shell/SetupHub';
import { COURT_TYPES, SANCTION_STATES } from '../lib/constants';

globalThis.React = React;

describe('SetupHub', () => {
  it('renders a status summary using sanctions and profile data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    render(
      <SetupHub
        onStart={vi.fn()}
        error={null}
        profile={{
          sanctions: { state: SANCTION_STATES.PUBLIC_DEFENDER, level: 3 },
          pdStatus: {
            startedAt: '2024-01-01T00:00:00.000Z',
            expiresAt: '2024-01-01T00:30:00.000Z',
          },
        }}
        isInitializing={false}
        initializingRole={null}
      />
    );

    expect(screen.getByText('Status Summary')).toBeInTheDocument();
    expect(screen.getByText(/Tier 3/i)).toBeInTheDocument();
    expect(screen.getByText('Public Defender')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Disbarred')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('gates rapid side clicks to a single start call', () => {
    const onStart = vi.fn();

    render(
      <SetupHub
        onStart={onStart}
        error={null}
        profile={null}
        isInitializing={false}
        initializingRole={null}
      />
    );

    const defenseButton = screen.getByRole('button', { name: /defense/i });
    fireEvent.click(defenseButton);
    fireEvent.click(defenseButton);

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('blocks start during reinstatement grace and shows the timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    render(
      <SetupHub
        onStart={vi.fn()}
        error={null}
        profile={{
          sanctions: {
            state: SANCTION_STATES.RECENTLY_REINSTATED,
            level: 2,
            recentlyReinstatedUntil: '2024-01-01T00:10:00.000Z',
          },
        }}
        isInitializing={false}
        initializingRole={null}
      />
    );

    expect(screen.getByText(/Start blocked by bar status/i)).toBeInTheDocument();
    expect(screen.getByText(/Reinstatement grace ends/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /defense/i })).toBeDisabled();

    vi.useRealTimers();
  });

  it('blocks start while disbarred and disables role buttons', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const onStart = vi.fn();

    render(
      <SetupHub
        onStart={onStart}
        error={null}
        profile={{
          sanctions: { state: SANCTION_STATES.PUBLIC_DEFENDER, level: 4 },
          pdStatus: {
            startedAt: '2024-01-01T00:00:00.000Z',
            expiresAt: '2024-01-01T00:15:00.000Z',
          },
        }}
        isInitializing={false}
        initializingRole={null}
      />
    );

    expect(screen.getByText(/Start blocked by bar status/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prosecution/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /public defender/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /public defender/i }));
    expect(onStart).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('forces public defender role and court type during PD assignment', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const onStart = vi.fn();

    render(
      <SetupHub
        onStart={onStart}
        error={null}
        profile={{
          sanctions: { state: SANCTION_STATES.CLEAN, level: 0 },
          pdStatus: {
            startedAt: '2024-01-01T00:00:00.000Z',
            expiresAt: '2024-01-01T00:30:00.000Z',
          },
        }}
        isInitializing={false}
        initializingRole={null}
      />
    );

    expect(screen.getByRole('button', { name: /prosecution/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /public defender/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /public defender/i }));

    expect(onStart).toHaveBeenCalledWith(
      'defense',
      expect.any(String),
      expect.any(String),
      COURT_TYPES.NIGHT_COURT
    );

    vi.useRealTimers();
  });
});
