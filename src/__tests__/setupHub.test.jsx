import React from 'react';
import { render, screen } from '@testing-library/react';
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
        sanctionsState={{ state: SANCTION_STATES.SANCTIONED, level: 2 }}
        profile={{ pdStatus: { startedAt: 'now', expiresAt: null }, sanctions: { disbarred: true } }}
        isInitializing={false}
        initializingRole={null}
      />
    );

    expect(screen.getByText('Status Summary')).toBeInTheDocument();
    expect(screen.getByText(/Tier 2/i)).toBeInTheDocument();
    expect(screen.getByText('Public Defender')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Disbarred')).toBeInTheDocument();
  });
});
