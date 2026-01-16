import { describe, expect, it } from 'vitest';
import {
  getFinalVerdictPrompt,
  getGeneratorPrompt,
  getJuryStrikePrompt,
  getMotionDraftPrompt,
  getMotionPrompt,
  getOpposingCounselPrompt,
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
      'normal'
    );

    expect(draftPrompt).toContain('Phase: PRE-TRIAL MOTION.');
    expect(draftPrompt).toContain('Case: State v. Example.');

    const rebuttalPrompt = getMotionRebuttalPrompt(
      { title: 'State v. Example', charge: 'Theft', judge: { name: 'Hon. Reed', philosophy: 'Textualist' } },
      'Suppress evidence',
      'normal'
    );

    expect(rebuttalPrompt).toContain('Phase: PRE-TRIAL MOTION REBUTTAL.');
    expect(rebuttalPrompt).toContain('Motion: "Suppress evidence"');

    const motionPrompt = getMotionPrompt(
      {
        judge: { name: 'Hon. Reed', bias: 'Textualist' },
        evidence: [{ id: 1, text: 'Security footage', status: 'admissible' }],
      },
      'Suppress evidence',
      'Opposing response',
      'normal',
      'defense',
      'prosecution',
      'defense'
    );

    expect(motionPrompt).toContain('Judge Hon. Reed ruling on Pre-Trial Motion.');
    expect(motionPrompt).toContain('Player Role: defense');
    expect(motionPrompt).toContain('Motion (defense): "Suppress evidence"');
    expect(motionPrompt).toContain('Rebuttal (prosecution): "Opposing response"');
    expect(motionPrompt).toContain('evidence_status_updates');

    const verdictPrompt = getFinalVerdictPrompt(
      { is_jury_trial: false, judge: { name: 'Hon. Reed' } },
      { ruling: 'DENIED', score: 42 },
      [],
      'Closing argument',
      'normal'
    );

    expect(verdictPrompt).toContain('Type: BENCH');
    expect(verdictPrompt).toContain('Jury: []');
    expect(verdictPrompt).toContain('Motion Result: DENIED (42)');
  });

  it('builds opposing counsel prompts for both motion and rebuttal phases', () => {
    const baseCase = {
      title: 'State v. Example',
      charge: 'Theft',
      facts: ['Fact'],
      judge: { name: 'Hon. Reed', philosophy: 'Textualist' },
    };

    const motionPrompt = getOpposingCounselPrompt(baseCase, 'normal', 'motion_submission', 'defense');
    expect(motionPrompt).toContain('Role: Defense Attorney.');
    expect(motionPrompt).toContain('Draft a concise motion');

    const rebuttalPrompt = getOpposingCounselPrompt(
      baseCase,
      'normal',
      'rebuttal_submission',
      'prosecution',
      'Suppress evidence'
    );
    expect(rebuttalPrompt).toContain('Role: Prosecutor.');
    expect(rebuttalPrompt).toContain('Motion: "Suppress evidence"');
    expect(rebuttalPrompt).toContain('Draft a concise rebuttal');
  });

  it('normalizes legacy difficulty identifiers before rendering prompts', () => {
    const prompt = getMotionDraftPrompt(
      {
        title: 'State v. Legacy',
        charge: 'Theft',
        facts: [],
        judge: { name: 'Hon. Reed', philosophy: 'Textualist' },
      },
      'regular'
    );

    expect(prompt).toContain('Difficulty: normal.');
  });
});
