import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SetupHub from '../components/shell/SetupHub';
import { SANCTION_STATES } from '../lib/constants';

globalThis.React = React;

describe('SetupHub', () => {
  it('renders a status summary using sanctions and profile data', () => {
    render(
      <SetupHub
        onStart={vi.fn()}
        error={null}
        sanctionsState={{ state: SANCTION_STATES.PUBLIC_DEFENDER, level: 3 }}
        profile={{ pdStatus: { startedAt: 'now', expiresAt: null } }}
        isInitializing={false}
        initializingRole={null}
      />
    );

    expect(screen.getByText('Status Summary')).toBeInTheDocument();
    expect(screen.getByText(/Tier 3/i)).toBeInTheDocument();
    expect(screen.getByText('Public Defender')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Disbarred')).toBeInTheDocument();
  });

  it('gates rapid side clicks to a single start call', () => {
    const onStart = vi.fn();

    render(
      <SetupHub
        onStart={onStart}
        error={null}
        sanctionsState={null}
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
});
