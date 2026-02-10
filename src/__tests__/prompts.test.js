import { describe, expect, it } from 'vitest';
import { CASE_TYPES, COURT_TYPES, JURISDICTIONS, SANCTION_STATES } from '../lib/constants';
import {
  getAutoSubmissionPrompt,
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
    const prompt = getGeneratorPrompt(
      'silly',
      JURISDICTIONS.FICTIONAL,
      COURT_TYPES.STANDARD,
      'defense'
    );

    expect(prompt).toContain('**DEFENSE**');
    expect(prompt).toContain('wacky, humorous, and absurd');
    expect(prompt).toContain('Court Type: Standard');
    expect(prompt).toContain('"title": "Case Name"');
  });

  it('adds public defender constraints when sanctioned', () => {
    const prompt = getGeneratorPrompt(
      'normal',
      JURISDICTIONS.MUNICIPAL_NIGHT_COURT,
      COURT_TYPES.NIGHT_COURT,
      'defense',
      {
        state: SANCTION_STATES.PUBLIC_DEFENDER,
        caseType: CASE_TYPES.PUBLIC_DEFENDER,
        expiresAt: '2024-01-01T00:00:00.000Z',
        lockedJurisdiction: JURISDICTIONS.MUNICIPAL_NIGHT_COURT,
      }
    );

    expect(prompt).toContain('Public Defender Mode is in effect');
    expect(prompt).toContain('Jurisdiction is locked to Municipal Night Court');
    expect(prompt).toContain('Court Type: Night Court');
    expect(prompt).toContain('license is restricted');
    expect(prompt).toContain('PUBLIC DEFENDER MODE CONSTRAINTS');
    expect(prompt).toContain('gritty, petty, difficult cases');
    expect(prompt).toContain('hostile, uncooperative');
    expect(prompt).toContain('stacked against the defense');
    expect(prompt).toContain('Courtroom prestige is low');
    expect(prompt).toContain('Achievements and "wins" should be rarer');
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
    expect(motionPrompt).toContain('"breakdown"');
    expect(motionPrompt).toContain('"accountability"');

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
    expect(verdictPrompt).toContain('"accountability"');
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


  it('builds lightweight auto-submission prompts for legit and absurd modes', () => {
    const legitPrompt = getAutoSubmissionPrompt({
      stage: 'motion',
      mode: 'legit',
      playerRole: 'defense',
      caseData: {
        title: 'State v. Example',
        charge: 'Theft',
        facts: ['Fact A'],
        evidence: ['Video'],
      },
      opposingArgument: 'The motion should be denied.',
    });

    expect(legitPrompt).toContain('Stage: PRE-TRIAL MOTION.');
    expect(legitPrompt).toContain('Style: Serious, coherent');
    expect(legitPrompt).toContain('Opposing Counsel Argument: "The motion should be denied."');

    const absurdPrompt = getAutoSubmissionPrompt({
      stage: 'argument',
      mode: 'absurd',
      playerRole: 'prosecution',
      caseData: { title: 'People v. Sample', charge: 'Fraud', facts: [], evidence: [] },
      opposingArgument: '',
    });

    expect(absurdPrompt).toContain('Stage: FINAL ARGUMENT.');
    expect(absurdPrompt).toContain('Style: Chaotic, unhinged');
    expect(absurdPrompt).toContain('None provided yet.');
  });

  it('includes sanction context for judges/counsel but not jury prompts', () => {
    const sanctionContext = {
      state: SANCTION_STATES.SANCTIONED,
      expiresAt: '2024-01-01T00:00:00.000Z',
    };
    const caseData = {
      title: 'State v. Example',
      charge: 'Theft',
      facts: ['Fact'],
      judge: { name: 'Hon. Reed', philosophy: 'Textualist', bias: 'Textualist' },
    };

    const opposingPrompt = getOpposingCounselPrompt(
      caseData,
      'normal',
      'motion_submission',
      'defense',
      '',
      {},
      sanctionContext
    );
    expect(opposingPrompt).toContain('Court Status:');
    expect(opposingPrompt).toContain('license is suspended');

    const judgePrompt = getMotionPrompt(
      caseData,
      'Suppress evidence',
      'Opposing response',
      'normal',
      'defense',
      'prosecution',
      'defense',
      {},
      {},
      sanctionContext
    );
    expect(judgePrompt).toContain('Court Status:');
    expect(judgePrompt).toContain('license is suspended');

    const juryPrompt = getJuryStrikePrompt({ title: 'State v. Example' }, [1, 3], 'defense');
    expect(juryPrompt).not.toContain('Court Status:');
    expect(juryPrompt).not.toContain('license is suspended');
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
