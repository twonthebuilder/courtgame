import { describe, expect, it } from 'vitest';
import {
  getFinalVerdictPrompt,
  getGeneratorPrompt,
  getJuryStrikePrompt,
  getMotionDraftPrompt,
  getMotionPrompt,
  getMotionRebuttalPrompt,
} from '../lib/prompts';

describe('prompt builders', () => {
  it('includes the player role and tone in generator prompts', () => {
    const prompt = getGeneratorPrompt('silly', 'Fictional', 'defense');

    expect(prompt).toContain('**DEFENSE**');
    expect(prompt).toContain('wacky, humorous, and absurd');
    expect(prompt).toContain('"title": "Case Name"');
  });

  it('formats the jury strike prompt with role and strike metadata', () => {
    const prompt = getJuryStrikePrompt(
      { title: 'State v. Example' },
      [1, 3],
      'defense'
    );

    expect(prompt).toContain('Case: State v. Example');
    expect(prompt).toContain('Player (defense) struck IDs: [1,3]');
    expect(prompt).toContain('As AI Prosecutor');
  });

  it('renders motion exchange prompts with the expected context', () => {
    const draftPrompt = getMotionDraftPrompt(
      {
        title: 'State v. Example',
        charge: 'Theft',
        facts: [],
        judge: { name: 'Hon. Reed', philosophy: 'Textualist' },
      },
      'regular'
    );

    expect(draftPrompt).toContain('Phase: PRE-TRIAL MOTION.');
    expect(draftPrompt).toContain('Case: State v. Example.');

    const rebuttalPrompt = getMotionRebuttalPrompt(
      { title: 'State v. Example', charge: 'Theft', judge: { name: 'Hon. Reed', philosophy: 'Textualist' } },
      'Suppress evidence',
      'regular'
    );

    expect(rebuttalPrompt).toContain('Phase: PRE-TRIAL MOTION REBUTTAL.');
    expect(rebuttalPrompt).toContain('Motion: "Suppress evidence"');

    const motionPrompt = getMotionPrompt(
      { judge: { name: 'Hon. Reed', bias: 'Textualist' } },
      'Suppress evidence',
      'Opposing response',
      'regular'
    );

    expect(motionPrompt).toContain('Judge Hon. Reed ruling on Pre-Trial Motion.');
    expect(motionPrompt).toContain('Motion: "Suppress evidence"');
    expect(motionPrompt).toContain('Rebuttal: "Opposing response"');

    const verdictPrompt = getFinalVerdictPrompt(
      { is_jury_trial: false, judge: { name: 'Hon. Reed' } },
      { ruling: 'DENIED', score: 42 },
      [],
      'Closing argument',
      'regular'
    );

    expect(verdictPrompt).toContain('Type: BENCH');
    expect(verdictPrompt).toContain('Jury: []');
    expect(verdictPrompt).toContain('Motion Result: DENIED (42)');
  });
});
