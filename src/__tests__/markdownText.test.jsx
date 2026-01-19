import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MarkdownText from '../components/shared/MarkdownText';

globalThis.React = React;

describe('MarkdownText', () => {
  it('renders headings, lists, emphasis, and code blocks', () => {
    const sample = [
      '# Heading',
      '',
      '- First item',
      '- Second *item*',
      '',
      '**Bold text** and *italic text*',
      '',
      '```',
      'const value = 42;',
      '```',
    ].join('\n');

    render(<MarkdownText text={sample} />);

    const heading = screen.getByRole('heading', { name: 'Heading' });
    expect(heading.tagName).toBe('H3');

    expect(screen.getByText('First item')).toBeInTheDocument();

    const italicItem = screen.getByText('item');
    expect(italicItem.tagName).toBe('EM');

    const boldText = screen.getByText('Bold text');
    expect(boldText.tagName).toBe('STRONG');

    const italicText = screen.getByText('italic text');
    expect(italicText.tagName).toBe('EM');

    const codeText = screen.getByText('const value = 42;');
    expect(codeText.tagName).toBe('CODE');
  });

  it('does not render raw HTML tags', () => {
    const { container } = render(<MarkdownText text="<strong>Not allowed</strong>" />);

    expect(screen.getByText('Not allowed')).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeNull();
  });

  it('falls back to plain text when parsing fails', () => {
    render(<MarkdownText text={{}} />);

    expect(screen.getByText('[object Object]')).toBeInTheDocument();
  });
});
