import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SetupHub from '../components/shell/SetupHub';
import { SANCTION_STATES } from '../lib/constants';

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
});
