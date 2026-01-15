import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ArgumentSection from '../components/docket/ArgumentSection';
import CaseHeader from '../components/docket/CaseHeader';
import MotionSection from '../components/docket/MotionSection';

globalThis.React = React;

describe('docket section submitted text rendering', () => {
  const baseCase = {
    defendant: 'Jordan Miles',
    charge: 'Fraud',
    judge: { name: 'Judge Rowe', bias: 'Strict on procedure' },
    facts: ['A key document went missing.'],
    evidence: ['Missing contract exhibit.'],
    opposing_counsel: {
      name: 'Ava Lin',
      bio: 'Known for tight filings.',
      style_tells: 'Precise language.',
      current_posture: 'Pressing for summary judgment.',
    },
  };

  it('shows a fallback when no counsel notes are provided', () => {
    render(<CaseHeader data={baseCase} counselNotes="" />);

    expect(screen.getByText('Counsel Notes')).toBeInTheDocument();
    expect(screen.getByText('No counsel notes yet.')).toBeInTheDocument();
  });

  it('renders trimmed counsel notes when provided', () => {
    render(<CaseHeader data={baseCase} counselNotes="  Emphasize timeline gaps.  " />);

    expect(screen.getByText('Emphasize timeline gaps.')).toBeInTheDocument();
  });

  it('shows the submitted motion text when locked', () => {
    render(
      <MotionSection
        isLocked
        motionPhase="motion_ruling_locked"
        motionText="Suppress evidence"
        motionBy="defense"
        rebuttalText="Opposing response"
        rebuttalBy="prosecution"
        playerRole="defense"
        isLoading={false}
        onSubmitStep={() => {}}
        ruling={{ ruling: 'GRANTED', outcome_text: 'Granted', score: 88 }}
      />
    );

    expect(screen.getByText('Defense Motion')).toBeInTheDocument();
    expect(screen.getByText('"Suppress evidence"')).toBeInTheDocument();
    expect(screen.getByText('Prosecution Rebuttal')).toBeInTheDocument();
    expect(screen.getByText('"Opposing response"')).toBeInTheDocument();
  });

  it('shows the current player motion prompt when it is their turn', () => {
    render(
      <MotionSection
        isLocked={false}
        motionPhase="motion_submission"
        motionText=""
        motionBy="defense"
        rebuttalText=""
        rebuttalBy="prosecution"
        playerRole="defense"
        isLoading={false}
        onSubmitStep={() => {}}
        ruling={null}
      />
    );

    expect(screen.getByText('Your Defense Motion')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your Honor, the defense moves to...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'File Defense Motion' })).toBeInTheDocument();
  });

  it('locks input and shows the ruling when it is available', () => {
    render(
      <MotionSection
        isLocked={false}
        motionPhase="motion_submission"
        motionText="Motion text"
        motionBy="defense"
        rebuttalText="Rebuttal text"
        rebuttalBy="prosecution"
        playerRole="defense"
        isLoading={false}
        onSubmitStep={() => {}}
        ruling={{ ruling: 'DENIED', outcome_text: 'Denied', score: 55 }}
      />
    );

    expect(screen.getByText("Judge's Ruling")).toBeInTheDocument();
    expect(screen.getByText('"Denied"')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the submitted closing argument when locked', () => {
    render(
      <ArgumentSection
        isLocked
        isJuryTrial
        onSubmit={() => {}}
        submittedText="The defense rests."
      />
    );

    expect(screen.getByText('The defense rests.')).toBeInTheDocument();
  });
});
