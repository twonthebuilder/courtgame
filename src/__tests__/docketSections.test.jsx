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
        onSubmit={() => {}}
        submittedText="Suppress evidence"
        ruling={{ ruling: 'GRANTED', outcome_text: 'Granted', score: 88 }}
      />
    );

    expect(screen.getByText('"Suppress evidence"')).toBeInTheDocument();
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
