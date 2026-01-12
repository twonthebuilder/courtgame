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
      "opposing_statement": "Opening statement"
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
 * Builds the system prompt for a pre-trial motion ruling.
 *
 * @param {object} caseData - Case metadata including judge profile.
 * @param {string} argument - Player's motion text.
 * @param {string} difficulty - Difficulty mode identifier.
 * @returns {string} Prompt text for the motion ruling model.
 */
export const getMotionPrompt = (caseData, argument, difficulty) => `
    Judge ${caseData.judge.name} ruling on Pre-Trial Motion.
    Motion: "${argument}"
    Bias: ${caseData.judge.bias}.
    Difficulty: ${difficulty}.
    
    Return JSON:
    {
      "ruling": "GRANTED", "DENIED", or "PARTIALLY GRANTED",
      "outcome_text": "Explanation.",
      "score": number (0-100)
    }
`;

/**
 * Builds the system prompt for the final verdict phase.
 *
 * @param {object} caseData - Full case data for scoring context.
 * @param {object} motionResult - Motion ruling outcome and score.
 * @param {object[]} seatedJurors - Jurors seated for trial.
 * @param {string} argument - Player's closing argument.
 * @param {string} difficulty - Difficulty mode identifier.
 * @returns {string} Prompt text for the verdict model.
 */
export const getFinalVerdictPrompt = (caseData, motionResult, seatedJurors, argument, difficulty) => {
  const isBench = !caseData.is_jury_trial;
  return `
    Phase: VERDICT. Type: ${isBench ? 'BENCH' : 'JURY'}.
    Case: ${JSON.stringify(caseData)}
    Motion Result: ${motionResult.ruling} (${motionResult.score})
    Jury: ${JSON.stringify(seatedJurors)}
    Argument: "${argument}"
    
    1. JUDGE SCORE (0-100) based on Difficulty ${difficulty}.
    ${!isBench ? '2. JURY DELIBERATION: Do biases align? Vote Guilty/Not Guilty. 2v2=Hung.' : ''}
    3. LEGENDARY CHECK (>100 score).
    
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
