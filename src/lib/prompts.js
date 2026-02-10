import { normalizeCourtType, normalizeDifficulty } from './config';
import { CASE_TYPES, COURT_TYPES, SANCTION_STATES } from './constants';

/**
 * Builds the system prompt for generating a new case docket.
 *
 * @param {string} difficulty - Difficulty mode identifier.
 * @param {string} jurisdiction - Jurisdiction name.
 * @param {string} courtType - Court type identifier.
 * @param {string} playerRole - Player role (defense/prosecution).
 * @param {object} [sanctionContext] - Optional sanctions metadata.
 * @param {string} [sanctionContext.state] - Sanctions state identifier.
 * @param {string} [sanctionContext.caseType] - Case type identifier.
 * @param {string} [sanctionContext.expiresAt] - ISO timestamp for sanction expiration.
 * @param {string} [sanctionContext.recentlyReinstatedUntil] - ISO timestamp for reinstatement grace.
 * @param {string} [sanctionContext.lockedJurisdiction] - Locked jurisdiction name.
 * @returns {string} Prompt text for the generator model.
 */

const buildSanctionContextBlock = (sanctionContext = {}) => {
  if (!sanctionContext || Object.keys(sanctionContext).length === 0) return '';
  const {
    state,
    caseType,
    expiresAt,
    recentlyReinstatedUntil,
    lockedJurisdiction,
  } = sanctionContext;
  if (!state || state === SANCTION_STATES.CLEAN) return '';

  const isPublicDefenderMode =
    state === SANCTION_STATES.PUBLIC_DEFENDER || caseType === CASE_TYPES.PUBLIC_DEFENDER;
  const lines = [];

  if (state === SANCTION_STATES.WARNED) {
    lines.push('The court has issued a formal warning for counsel conduct.');
  }
  if (state === SANCTION_STATES.SANCTIONED) {
    lines.push(`Counsel's license is suspended until ${expiresAt || 'further order'}.`);
  }
  if (state === SANCTION_STATES.PUBLIC_DEFENDER) {
    lines.push(
      `Counsel's license is restricted; assignment to the public defender docket lasts until ${
        expiresAt || 'further order'
      }.`
    );
  }
  if (state === SANCTION_STATES.RECENTLY_REINSTATED) {
    lines.push(
      `Counsel is reinstated but remains on probation until ${
        recentlyReinstatedUntil || 'further order'
      }.`
    );
  }
  if (isPublicDefenderMode) {
    lines.push('Public Defender Mode is in effect for this docket.');
  }
  if (lockedJurisdiction) {
    lines.push(`Jurisdiction is locked to ${lockedJurisdiction}.`);
  }

  return `
    Court Status:
    - ${lines.join('\n    - ')}
  `;
};

export const getGeneratorPrompt = (
  difficulty,
  jurisdiction,
  courtType,
  playerRole,
  sanctionContext = {}
) => {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const normalizedCourtType = normalizeCourtType(courtType ?? COURT_TYPES.STANDARD);
  let tone = '';
  if (normalizedDifficulty === 'silly') tone = 'wacky, humorous, and absurd. Think cartoons.';
  else if (normalizedDifficulty === 'normal') {
    tone = 'mundane, everyday disputes. Traffic, small contracts.';
  } else if (normalizedDifficulty === 'nuance') {
    tone = 'complex, serious, morally ambiguous crimes.';
  }
  const caseType = sanctionContext.caseType ?? CASE_TYPES.STANDARD;
  const isPublicDefenderMode =
    sanctionContext.state === SANCTION_STATES.PUBLIC_DEFENDER ||
    caseType === CASE_TYPES.PUBLIC_DEFENDER;
  const courtTypeLabelMap = {
    [COURT_TYPES.NIGHT_COURT]: 'Night Court',
    [COURT_TYPES.SUPREME_COURT]: 'Supreme Court',
    [COURT_TYPES.STANDARD]: 'Standard',
  };
  const courtTypeLabel = courtTypeLabelMap[normalizedCourtType] ?? normalizedCourtType;
  const courtTypeGuidance = (() => {
    if (normalizedCourtType === COURT_TYPES.NIGHT_COURT) {
      return `
    NIGHT COURT CONSTRAINTS:
    - Focus on gritty, petty disputes suited for a late-night municipal docket.
    - The docket is crowded and resources are strained.
    - Keep stakes low-to-mid but messy, with procedural frictions.
    `;
    }
    if (normalizedCourtType === COURT_TYPES.SUPREME_COURT) {
      return `
    SUPREME COURT CONSTRAINTS:
    - High-stakes, precedent-setting disputes with constitutional or national impact.
    - Cases should feel appellate or landmark in scope.
    - Emphasize big-picture legal principles and institutional stakes.
    `;
    }
    return '';
  })();
  const sanctionStatusBlock = buildSanctionContextBlock({
    ...sanctionContext,
    lockedJurisdiction: sanctionContext.lockedJurisdiction ?? jurisdiction,
  });
  const sanctionsGuidance = isPublicDefenderMode
    ? `
    PUBLIC DEFENDER MODE CONSTRAINTS:
    - Generate gritty, petty, difficult cases suited for a municipal night court docket.
    - The client should be hostile, uncooperative, or distrustful of counsel.
    - Client reliability is compromised: evasive answers, missed meetings, or shifting recollections.
    - Evidence should be stacked against the defense (more inculpatory than exculpatory).
    - Courtroom prestige is low; procedural hurdles are higher and paperwork is unforgiving.
    - Achievements and "wins" should be rarer and harder-earned.
    `
    : '';

  return `
    You are a creative legal scenario generator. Player is **${playerRole.toUpperCase()}**.
    Jurisdiction: ${jurisdiction}.
    Court Type: ${courtTypeLabel}.
    Case Type: ${caseType}.
    ${sanctionStatusBlock}
    Narrative tone should be ${tone}
    ${sanctionsGuidance}
    ${courtTypeGuidance}
    
    1. DETERMINE TRIAL TYPE:
    - If case is minor/mundane -> is_jury_trial = false (Bench Trial).
    - If case is crime/tort/public interest -> is_jury_trial = true.
    
    2. JURY POOL (Generate 8 regardless, used only if jury trial):
    - Name, age, job, and a HIDDEN BIAS.
    
    Return ONLY valid JSON:
    {
      "title": "Case Name",
      "defendant": "Name",
      "charge": "Charge",
      "is_jury_trial": boolean,
      "judge": { "name": "Name", "philosophy": "Style", "background": "History", "bias": "Bias" },
      "jurors": [
        {"id": 1, "name": "Name", "age": 30, "job": "Job", "bias_hint": "Public description", "hidden_bias": "Secret bias"}
      ],
      "facts": ["Fact 1", "Fact 2", "Fact 3"],
      "witnesses": [{"name": "Name", "role": "Role", "statement": "Statement"}],
      "evidence": ["Item 1", "Item 2"],
      "opposing_counsel": {
        "name": "Name",
        "age_range": "Optional age range",
        "bio": "Background and reputation",
        "style_tells": "Notable courtroom habits or tactics",
        "current_posture": "What they're signaling about this case"
      }
    }
  `;
};

/**
 * Builds the system prompt for the opponent's jury strikes.
 *
 * @param {object} caseData - Case metadata and jury pool.
 * @param {number[]} playerStrikes - Juror IDs struck by the player.
 * @param {string} playerRole - Player role (defense/prosecution).
 * @returns {string} Prompt text for the jury strike model.
 */
export const getJuryStrikePrompt = (caseData, playerStrikes, playerRole) => {
  const opponentRole = playerRole === 'defense' ? 'Prosecutor' : 'Defense Attorney';
  const jurorList = JSON.stringify(caseData.jurors ?? []);
  return `
    Phase: VOIR DIRE. Case: ${caseData.title}.
    Jurors (use these exact IDs): ${jurorList}.
    Player (${playerRole}) struck IDs: ${JSON.stringify(playerStrikes)}.
    
    As AI ${opponentRole}, strike 2 jurors who hurt YOUR case.
    Docket rule: If it is not recorded in the docket, it is not true.
    Do not introduce jurors, facts, or entities not present in the docket inputs.
    
    Return ONLY valid JSON:
    {
      "opponent_strikes": [id1, id2],
      "opponent_reasoning": "Why the AI struck these jurors.",
      "seated_juror_ids": [list of remaining ids],
      "judge_comment": "Judge's brief comment on the final jury."
    }
  `;
};

/**
 * Builds the system prompt for drafting the initial pre-trial motion.
 *
 * @param {object} caseData - Case metadata including judge profile.
 * @param {string} difficulty - Difficulty mode identifier.
 * @returns {string} Prompt text for the motion drafting model.
 */
export const getMotionDraftPrompt = (caseData, difficulty) => `
    Phase: PRE-TRIAL MOTION.
    Role: Defense Attorney.
    Case: ${caseData.title}.
    Charge: ${caseData.charge}.
    Facts: ${JSON.stringify(caseData.facts)}
    Judge: ${caseData.judge.name} (${caseData.judge.philosophy}).
    Difficulty: ${normalizeDifficulty(difficulty)}.
    Docket rule: If it is not recorded in the docket, it is not true.
    Do not introduce facts, evidence, or entities not present in the docket inputs.
    
    Draft a concise motion to Dismiss or Suppress Evidence.
    
    Return JSON:
    {
      "text": "Motion text"
    }
`;

/**
 * Builds the system prompt for drafting the rebuttal to a pre-trial motion.
 *
 * @param {object} caseData - Case metadata including judge profile.
 * @param {string} motionText - The defense motion text to rebut.
 * @param {string} difficulty - Difficulty mode identifier.
 * @returns {string} Prompt text for the rebuttal drafting model.
 */
export const getMotionRebuttalPrompt = (caseData, motionText, difficulty) => `
    Phase: PRE-TRIAL MOTION REBUTTAL.
    Role: Prosecutor.
    Case: ${caseData.title}.
    Charge: ${caseData.charge}.
    Motion: "${motionText}"
    Judge: ${caseData.judge.name} (${caseData.judge.philosophy}).
    Difficulty: ${normalizeDifficulty(difficulty)}.
    Docket rule: If it is not recorded in the docket, it is not true.
    Do not introduce facts, evidence, or entities not present in the docket inputs.
    
    Draft a concise rebuttal responding to the motion.
    
    Return JSON:
    {
      "text": "Rebuttal text"
    }
`;

/**
 * Builds the system prompt for opposing counsel to draft a motion or rebuttal.
 *
 * @param {object} caseData - Case metadata including judge profile.
 * @param {string} difficulty - Difficulty mode identifier.
 * @param {'motion_submission' | 'rebuttal_submission'} phase - Motion exchange phase.
 * @param {'defense' | 'prosecution'} opponentRole - Opposing counsel role.
 * @param {string} [motionText] - Motion text to rebut when in rebuttal phase.
 * @param {object} [sanctionContext] - Optional sanctions metadata.
 * @returns {string} Prompt text for the opposing counsel model.
 */
const buildVisibilityContextLine = (visibilityContext = {}) => {
  if (!visibilityContext || Object.keys(visibilityContext).length === 0) return '';
  return `Visibility Context (judge + counsel only): ${JSON.stringify(visibilityContext)}.`;
};

export const getOpposingCounselPrompt = (
  caseData,
  difficulty,
  phase,
  opponentRole,
  motionText = '',
  visibilityContext = {},
  sanctionContext = {}
) => {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const roleLabel = opponentRole === 'defense' ? 'Defense Attorney' : 'Prosecutor';
  const isMotionPhase = phase === 'motion_submission';
  const visibilityLine = buildVisibilityContextLine(visibilityContext);
  const sanctionStatusBlock = buildSanctionContextBlock(sanctionContext);
  const isSanctionedMode = [SANCTION_STATES.SANCTIONED, SANCTION_STATES.PUBLIC_DEFENDER].includes(
    sanctionContext.state
  );
  const prosecutionGuidance =
    roleLabel === 'Prosecutor' && isSanctionedMode
      ? `
    Prosecution Expectation: The defense is on a short leash; press procedural rigor and deterrence.
    `
      : '';
  const baseContext = `
    Phase: PRE-TRIAL MOTION.
    Role: ${roleLabel}.
    Case: ${caseData.title}.
    Charge: ${caseData.charge}.
    Facts: ${JSON.stringify(caseData.facts)}
    Judge: ${caseData.judge.name} (${caseData.judge.philosophy}).
    Difficulty: ${normalizedDifficulty}.
    ${sanctionStatusBlock}
    ${visibilityLine}
    Docket rule: If it is not recorded in the docket, it is not true.
    Do not introduce facts, evidence, or entities not present in the docket inputs.
    ${prosecutionGuidance}
  `;

  if (isMotionPhase) {
    return `
      ${baseContext}
      Draft a concise motion to Dismiss or Suppress Evidence.

      Return JSON:
      {
        "text": "Motion text"
      }
    `;
  }

  return `
    ${baseContext}
    Motion: "${motionText}"

    Draft a concise rebuttal responding to the motion.

    Return JSON:
    {
      "text": "Rebuttal text"
    }
  `;
};

/**
 * Builds the system prompt for a pre-trial motion ruling.
 *
 * @param {object} caseData - Case metadata including judge profile.
 * @param {string} motionText - Defense motion text.
 * @param {string} rebuttalText - Prosecution rebuttal text.
 * @param {string} difficulty - Difficulty mode identifier.
 * @param {'defense' | 'prosecution'} motionBy - Role that filed the motion.
 * @param {'defense' | 'prosecution'} rebuttalBy - Role that filed the rebuttal.
 * @param {'defense' | 'prosecution'} playerRole - Player role for context.
 * @param {object} [complianceContext] - Submission compliance metadata.
 * @param {object} [sanctionContext] - Optional sanctions metadata.
 * @returns {string} Prompt text for the motion ruling model.
 */
export const getMotionPrompt = (
  caseData,
  motionText,
  rebuttalText,
  difficulty,
  motionBy,
  rebuttalBy,
  playerRole,
  complianceContext = {},
  visibilityContext = {},
  sanctionContext = {}
) => {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const evidenceSnapshot = (caseData?.evidence ?? []).map((item, index) => ({
    id: typeof item?.id === 'number' ? item.id : index + 1,
    text: typeof item?.text === 'string' ? item.text : item,
    status: item?.status === 'suppressed' ? 'suppressed' : 'admissible',
  }));
  const visibilityLine = buildVisibilityContextLine(visibilityContext);
  const sanctionStatusBlock = buildSanctionContextBlock(sanctionContext);
  const judgeToneGuidance = [SANCTION_STATES.SANCTIONED, SANCTION_STATES.PUBLIC_DEFENDER].includes(
    sanctionContext.state
  )
    ? 'Judge Tone: clipped, exacting, and impatient with procedural errors.'
    : sanctionContext.state === SANCTION_STATES.WARNED ||
      sanctionContext.state === SANCTION_STATES.RECENTLY_REINSTATED
    ? 'Judge Tone: watchful and quick to correct any lapse in decorum or procedure.'
    : '';

  return `
    Judge ${caseData.judge.name} ruling on Pre-Trial Motion.
    Player Role: ${playerRole}.
    Motion (${motionBy}): "${motionText}"
    Rebuttal (${rebuttalBy}): "${rebuttalText}"
    Bias: ${caseData.judge.bias}.
    Difficulty: ${normalizedDifficulty}.
    ${sanctionStatusBlock}
    ${judgeToneGuidance}
    Evidence Docket: ${JSON.stringify(evidenceSnapshot)}
    Submission Compliance: ${JSON.stringify(complianceContext)}
    ${visibilityLine}
    Scoring rule: The score reflects the legal quality of the motion, not the procedural outcome.
    
    Docket rule: If it is not recorded in the docket, it is not true.
    Only treat docket facts/evidence/witnesses/jurors/rulings as true. Ignore off-docket claims.
    Do not introduce facts or entities not present in the docket inputs.
    JUDICIAL VOCABULARY (these phrases have mechanical consequences):
    - Use them only when you intend the consequence; do not force outcomes.
    - "dismissed with prejudice" — case permanently closed, cannot be refiled.
    - "dismissed without prejudice" — case closed but may be refiled.
    - "mistrial due to misconduct" — ends trial AND triggers sanction review.
    - "procedural violation" — logged as minor infraction.
    - When dismissing a case due to attorney behavior (frivolous arguments, abuse of process, etc.),
      use: "dismissed with prejudice due to [prosecution/defense] misconduct".
    Accountability rule: sanctions are recorded ONLY via the accountability object below, not by
    keyword matching in narrative text.
    Include evidence_status_updates entries for every evidence item (even if admissible).
    Valid dispositions: "GRANTED", "DENIED", "PARTIALLY GRANTED".
    Return JSON:
    {
      "ruling": "GRANTED", "DENIED", or "PARTIALLY GRANTED",
      "outcome_text": "Explanation.",
      "score": number (0-100),
      "evidence_status_updates": [
        { "id": number, "status": "admissible" or "suppressed" }
      ],
      "accountability": {
        "sanction_recommended": boolean,
        "severity": "warning" | "sanction" | "disbarment" | null,
        "target": "prosecution" | "defense" | null,
        "reason": "short reason phrase" | null
      },
      "breakdown": {
        "issues": [
          {
            "id": "string",
            "label": "short label",
            "disposition": "GRANTED", "DENIED", or "PARTIALLY GRANTED",
            "reasoning": "Concise reasoning grounded in docket facts.",
            "affectedEvidenceIds": [number]
          }
        ],
        "docket_entries": ["string"]
      }
    }
  `;
};

/**
 * Builds the system prompt for the final verdict phase.
 *
 * @param {object} caseData - Full case data for scoring context.
 * @param {object} motionResult - Motion ruling outcome and score.
 * @param {object[]} seatedJurors - Jurors seated for trial.
 * @param {string} argument - Player's closing argument.
 * @param {string} difficulty - Difficulty mode identifier.
 * @param {object} [complianceContext] - Submission compliance metadata.
 * @param {object} [sanctionContext] - Optional sanctions metadata.
 * @returns {string} Prompt text for the verdict model.
 */
export const getFinalVerdictPrompt = (
  caseData,
  motionResult,
  seatedJurors,
  argument,
  difficulty,
  complianceContext = {},
  sanctionContext = {}
) => {
  const normalizedDifficulty = normalizeDifficulty(difficulty);
  const isBench = !caseData.is_jury_trial;
  const complianceGuidance =
    normalizedDifficulty === 'nuance'
      ? 'Non-compliance is a severe credibility hit; treat it as throwing or babbling.'
      : normalizedDifficulty === 'silly'
      ? 'Non-compliance is allowed as a silly tactic, but label it and limit what it can prove.'
      : 'Non-compliance reduces credibility; do not treat it as truth.';
  const sanctionStatusBlock = buildSanctionContextBlock(sanctionContext);
  const narrativeGuidance = [SANCTION_STATES.SANCTIONED, SANCTION_STATES.PUBLIC_DEFENDER].includes(
    sanctionContext.state
  )
    ? 'Narrative Framing: Emphasize accountability, punishment, and the court reasserting order.'
    : sanctionContext.state === SANCTION_STATES.RECENTLY_REINSTATED
    ? 'Narrative Framing: Balance accountability with cautious redemption for reinstated counsel.'
    : '';
  return `
    Phase: VERDICT. Type: ${isBench ? 'BENCH' : 'JURY'}.
    Case: ${JSON.stringify(caseData)}
    Motion Result: ${motionResult.ruling} (${motionResult.score})
    Jury: ${JSON.stringify(seatedJurors)}
    Argument (compliant-only): "${argument}"
    Submission Compliance: ${JSON.stringify(complianceContext)}
    ${sanctionStatusBlock}
    ${narrativeGuidance}
    
    1. JUDGE SCORE (0-100) based on Difficulty ${normalizedDifficulty}.
    ${!isBench ? '2. JURY DELIBERATION: Do biases align? Vote Guilty/Not Guilty. 2v2=Hung.' : ''}
    3. WEIGHTS: Pre-Trial 20%, Judge 45%, Jury 35% (jury score is 0 for bench trials).
    4. MERIT SCORING: Procedural outcomes (dismissed/suppressed/delayed/JNOV) must NOT change merit scores.
    5. LEGENDARY CHECK (100+ score).
    6. Docket rule: If it is not recorded in the docket, it is not true.
    7. Only docket facts/evidence/witnesses/jurors/rulings count as true.
    8. Do not introduce facts or entities not present in the docket inputs.
    9. JUDICIAL VOCABULARY (these phrases have mechanical consequences):
       - Use them only when you intend the consequence; do not force outcomes.
       - "dismissed with prejudice" — case permanently closed, cannot be refiled.
       - "dismissed without prejudice" — case closed but may be refiled.
       - "mistrial due to misconduct" — ends trial AND triggers sanction review.
       - "procedural violation" — logged as minor infraction.
       - When dismissing a case due to attorney behavior (frivolous arguments, abuse of process, etc.),
         use: "dismissed with prejudice due to [prosecution/defense] misconduct".
    10. Accountability rule: sanctions are recorded ONLY via the accountability object below, not by
        keyword matching in narrative text.
    11. ${complianceGuidance}
    12. If final_weighted_score exceeds 100, include overflow_reason_code and overflow_explanation.
    
    Return JSON:
    {
      "jury_verdict": "Guilty/Not Guilty/Hung/NA",
      "jury_reasoning": "Reasoning...",
      "jury_score": number (or 0 if N/A),
      "judge_score": number,
      "judge_opinion": "Opinion...",
      "final_ruling": "Outcome",
      "is_jnov": boolean,
      "final_weighted_score": number,
      "overflow_reason_code": "CODE or null",
      "overflow_explanation": "Short explanation or null",
      "achievement_title": "Title or null",
      "accountability": {
        "sanction_recommended": boolean,
        "severity": "warning" | "sanction" | "disbarment" | null,
        "target": "prosecution" | "defense" | null,
        "reason": "short reason phrase" | null
      }
    }
  `;
};
