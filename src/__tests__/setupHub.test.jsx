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

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText(/Tier 3/i)).toBeInTheDocument();
    expect(screen.getAllByText('Public Defender').length).toBeGreaterThan(0);
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
    expect(screen.getByRole('button', { name: /prosecution/i })).toBeDisabled();
    expect(
      screen
        .getAllByRole('button', { name: /public defender/i })
        .every((button) => button.hasAttribute('disabled'))
    ).toBe(true);

    vi.useRealTimers();
  });

  it('forces disbarred players into public defender mode without blocking start', () => {
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

    expect(screen.queryByText(/Start blocked by bar status/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prosecution/i })).toBeDisabled();
    const publicDefenderActionButton = screen
      .getAllByRole('button', { name: /public defender/i })
      .find((button) => !button.hasAttribute('disabled'));
    expect(publicDefenderActionButton).toBeDefined();

    fireEvent.click(publicDefenderActionButton);
    expect(onStart).toHaveBeenCalledWith(
      'defense',
      expect.any(String),
      expect.any(String),
      COURT_TYPES.NIGHT_COURT
    );

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
    const publicDefenderActionButton = screen
      .getAllByRole('button', { name: /public defender/i })
      .find((button) => !button.hasAttribute('disabled'));
    expect(publicDefenderActionButton).toBeDefined();

    fireEvent.click(publicDefenderActionButton);

    expect(onStart).toHaveBeenCalledWith(
      'defense',
      expect.any(String),
      expect.any(String),
      COURT_TYPES.NIGHT_COURT
    );

    vi.useRealTimers();
  });

  it('hides non-public-defender courts when sanctions tier is 2+', () => {
    render(
      <SetupHub
        onStart={vi.fn()}
        error={null}
        profile={{
          sanctions: { state: SANCTION_STATES.SANCTIONED, level: 2 },
        }}
        isInitializing={false}
        initializingRole={null}
      />
    );

    expect(screen.getAllByRole('button', { name: /public defender/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /night court/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /standard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /supreme court/i })).not.toBeInTheDocument();
  });

  it('blocks supreme court option while warned', () => {
    render(
      <SetupHub
        onStart={vi.fn()}
        error={null}
        profile={{
          sanctions: { state: SANCTION_STATES.WARNED, level: 1 },
        }}
        isInitializing={false}
        initializingRole={null}
      />
    );

    expect(screen.getByRole('button', { name: /night court/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /standard/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /supreme court/i })).not.toBeInTheDocument();
  });
});
