import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MainMenu from '../components/shell/MainMenu';

globalThis.React = React;

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('MainMenu mobile viewport guard', () => {
  it('renders and allows Play action at mobile width', () => {
    // jsdom does not evaluate CSS; this guards against crashes, not layout fidelity.
    setViewportWidth(375);

    const handlePlay = vi.fn();
    render(<MainMenu onPlay={handlePlay} />);

    const playButton = screen.getByRole('button', { name: 'Play' });
    expect(playButton).toBeEnabled();

    fireEvent.click(playButton);
    expect(handlePlay).toHaveBeenCalledTimes(1);
  });
});
