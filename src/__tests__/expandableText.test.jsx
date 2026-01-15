import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ExpandableText from '../components/shared/ExpandableText';

globalThis.React = React;

describe('ExpandableText', () => {
  it('toggles between collapsed and expanded states for long text', () => {
    const longText = Array.from({ length: 240 }, (_, index) => `word-${index}`).join(' ');

    render(<ExpandableText text={longText} previewLines={2} />);

    const showMoreButton = screen.getByRole('button', { name: /show more/i });
    expect(showMoreButton).toBeInTheDocument();

    fireEvent.click(showMoreButton);

    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
  });
});
