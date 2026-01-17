import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DebugOverlay from '../components/DebugOverlay';

vi.mock('../lib/debugStore', () => ({
  debugEnabled: () => true,
  getDebugState: () => {
    throw new Error('debug store failure');
  },
  setDebugFlag: vi.fn(),
  subscribeDebugStore: () => {
    throw new Error('debug store failure');
  },
}));

describe('DebugOverlay', () => {
  it('hides the overlay when the debug store fails', async () => {
    render(
      <DebugOverlay
        gameState="playing"
        config={{}}
        history={{}}
        sanctionsState={null}
      />
    );

    fireEvent.keyDown(window, { code: 'F3' });

    await waitFor(() => {
      expect(screen.queryByText('Debug Overlay (F3)')).not.toBeInTheDocument();
    });
  });
});
