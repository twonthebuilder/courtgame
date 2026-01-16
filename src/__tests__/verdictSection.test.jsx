import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VerdictSection from '../components/docket/VerdictSection';

globalThis.React = React;

describe('VerdictSection', () => {
  it('shows the normalized base score for standard verdicts', () => {
    const result = {
      final_ruling: 'Not Guilty',
      final_weighted_score: 78.4,
      judge_opinion: 'Measured ruling.',
      jury_verdict: 'N/A',
      jury_reasoning: '',
      jury_score: 0,
      is_jnov: false,
      achievement_title: null,
      overflow_reason_code: null,
      overflow_explanation: null,
    };

    render(<VerdictSection result={result} />);

    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.queryByText(/overflow/i)).not.toBeInTheDocument();
  });

  it('shows overflow details while clamping the base score to 100', () => {
    const result = {
      final_ruling: 'Not Guilty',
      final_weighted_score: 132.4,
      judge_opinion: 'Masterful close.',
      jury_verdict: 'N/A',
      jury_reasoning: '',
      jury_score: 0,
      is_jnov: false,
      achievement_title: null,
      overflow_reason_code: 'LEGENDARY_ARGUMENT',
      overflow_explanation: 'Argument exceeded the difficulty curve.',
    };

    render(<VerdictSection result={result} />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText(/Overflow 132\/100/i)).toBeInTheDocument();
    expect(screen.getByText(/LEGENDARY_ARGUMENT/)).toBeInTheDocument();
  });
});
