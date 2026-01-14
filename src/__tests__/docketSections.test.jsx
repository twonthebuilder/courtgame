import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ArgumentSection from '../components/docket/ArgumentSection';
import MotionSection from '../components/docket/MotionSection';

globalThis.React = React;

describe('docket section submitted text rendering', () => {
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

    expect(screen.getByText('"Suppress evidence"')).toBeInTheDocument();
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
