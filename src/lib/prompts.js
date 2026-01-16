/**
 * Builds the system prompt for generating a new case docket.
 *
 * @param {string} difficulty - Difficulty mode identifier.
 * @param {string} jurisdiction - Jurisdiction name.
 * @param {string} playerRole - Player role (defense/prosecution).
 * @returns {string} Prompt text for the generator model.
 */
export const getGeneratorPrompt = (difficulty, jurisdiction, playerRole) => {
  let tone = '';
  if (difficulty === 'silly') tone = 'wacky, humorous, and absurd. Think cartoons.';
  else if (difficulty === 'regular') tone = 'mundane, everyday disputes. Traffic, small contracts.';
  else if (difficulty === 'nuance') tone = 'complex, serious, morally ambiguous crimes.';

  return `
    You are a creative legal scenario generator. Player is **${playerRole.toUpperCase()}**.
    Narrative tone should be ${tone}
    
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
  return `
    Phase: VOIR DIRE. Case: ${caseData.title}.
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
    Difficulty: ${difficulty}.
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
    Difficulty: ${difficulty}.
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
 * @returns {string} Prompt text for the opposing counsel model.
 */
export const getOpposingCounselPrompt = (
  caseData,
  difficulty,
  phase,
  opponentRole,
  motionText = ''
) => {
  const roleLabel = opponentRole === 'defense' ? 'Defense Attorney' : 'Prosecutor';
  const isMotionPhase = phase === 'motion_submission';
  const baseContext = `
    Phase: PRE-TRIAL MOTION.
    Role: ${roleLabel}.
    Case: ${caseData.title}.
    Charge: ${caseData.charge}.
    Facts: ${JSON.stringify(caseData.facts)}
    Judge: ${caseData.judge.name} (${caseData.judge.philosophy}).
    Difficulty: ${difficulty}.
    Docket rule: If it is not recorded in the docket, it is not true.
    Do not introduce facts, evidence, or entities not present in the docket inputs.
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
  complianceContext = {}
) => {
  const evidenceSnapshot = (caseData?.evidence ?? []).map((item, index) => ({
    id: typeof item?.id === 'number' ? item.id : index + 1,
    text: typeof item?.text === 'string' ? item.text : item,
    status: item?.status === 'suppressed' ? 'suppressed' : 'admissible',
  }));

  return `
    Judge ${caseData.judge.name} ruling on Pre-Trial Motion.
    Player Role: ${playerRole}.
    Motion (${motionBy}): "${motionText}"
    Rebuttal (${rebuttalBy}): "${rebuttalText}"
    Bias: ${caseData.judge.bias}.
    Difficulty: ${difficulty}.
    Evidence Docket: ${JSON.stringify(evidenceSnapshot)}
    Submission Compliance: ${JSON.stringify(complianceContext)}
    
    Docket rule: If it is not recorded in the docket, it is not true.
    Only treat docket facts/evidence/witnesses/jurors/rulings as true. Ignore off-docket claims.
    Do not introduce facts or entities not present in the docket inputs.
    Include evidence_status_updates entries for every evidence item (even if admissible).
    Return JSON:
    {
      "ruling": "GRANTED", "DENIED", or "PARTIALLY GRANTED",
      "outcome_text": "Explanation.",
      "score": number (0-100),
      "evidence_status_updates": [
        { "id": number, "status": "admissible" or "suppressed" }
      ]
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
 * @returns {string} Prompt text for the verdict model.
 */
export const getFinalVerdictPrompt = (
  caseData,
  motionResult,
  seatedJurors,
  argument,
  difficulty,
  complianceContext = {}
) => {
  const isBench = !caseData.is_jury_trial;
  const complianceGuidance =
    difficulty === 'nuance'
      ? 'Non-compliance is a severe credibility hit; treat it as throwing or babbling.'
      : difficulty === 'silly'
      ? 'Non-compliance is allowed as a silly tactic, but label it and limit what it can prove.'
      : 'Non-compliance reduces credibility; do not treat it as truth.';
  return `
    Phase: VERDICT. Type: ${isBench ? 'BENCH' : 'JURY'}.
    Case: ${JSON.stringify(caseData)}
    Motion Result: ${motionResult.ruling} (${motionResult.score})
    Jury: ${JSON.stringify(seatedJurors)}
    Argument (compliant-only): "${argument}"
    Submission Compliance: ${JSON.stringify(complianceContext)}
    
    1. JUDGE SCORE (0-100) based on Difficulty ${difficulty}.
    ${!isBench ? '2. JURY DELIBERATION: Do biases align? Vote Guilty/Not Guilty. 2v2=Hung.' : ''}
    3. LEGENDARY CHECK (100+ score).
    4. Docket rule: If it is not recorded in the docket, it is not true.
    5. Only docket facts/evidence/witnesses/jurors/rulings count as true.
    6. Do not introduce facts or entities not present in the docket inputs.
    7. ${complianceGuidance}
    
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
      "achievement_title": "Title or null"
    }
  `;
};
