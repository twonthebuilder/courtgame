import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import JurySection from '../components/docket/JurySection';

globalThis.React = React;

describe('JurySection', () => {
  it('fires onStrike for each juror tile click', () => {
    const pool = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      name: `Juror ${index + 1}`,
      age: 30 + index,
      job: 'Analyst',
      bias_hint: 'Neutral.',
      status: 'eligible',
    }));
    const onStrike = vi.fn();

    render(
      <JurySection
        pool={pool}
        opponentStrikes={[]}
        onStrike={onStrike}
        myStrikes={[]}
        isLocked={false}
        judgeComment=""
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(8);

    buttons.forEach((button) => {
      fireEvent.click(button, { clientX: 999, clientY: 10 });
    });

    expect(onStrike).toHaveBeenCalledTimes(8);
    pool.forEach((juror, index) => {
      expect(onStrike.mock.calls[index][0]).toBe(juror.id);
    });
  });
});
