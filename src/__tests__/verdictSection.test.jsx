import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VerdictSection from '../components/docket/VerdictSection';

globalThis.React = React;

describe('VerdictSection', () => {
  it('renders judge and jury opinions as distinct cards', () => {
    const result = {
      final_weighted_score: 88,
      final_ruling: 'Not Guilty',
      overflow_reason_code: '',
      overflow_explanation: '',
      achievement_title: '',
      judge_opinion: 'Bench opinion.',
      jury_verdict: 'Not Guilty',
      jury_reasoning: 'Jury reasoning text.',
    };

    render(<VerdictSection result={result} />);

    const judgeTitle = screen.getByText("Judge's Opinion");
    const juryTitle = screen.getByText('Jury Reasoning');
    const judgeCard = judgeTitle.closest('div');
    const juryCard = juryTitle.closest('div');

    expect(judgeCard).toBeInTheDocument();
    expect(juryCard).toBeInTheDocument();
    expect(judgeCard).not.toBe(juryCard);
    expect(judgeCard).toHaveClass('rounded-lg');
    expect(juryCard).toHaveClass('rounded-lg');
  });
});
