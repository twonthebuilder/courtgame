# Motion Prompt Flow

Pocket Court keeps motion-related LLM instructions centralized in `src/lib/prompts.js` so the game state hook only wires inputs and outputs.

## Opposing Counsel Prompt Builder

`getOpposingCounselPrompt` assembles the system prompt for the AI-controlled submission in the pre-trial motion exchange. The builder:

- Accepts the phase (`motion_submission` or `rebuttal_submission`), the opposing role, and the current difficulty.
- Reuses case metadata (charge, facts, judge philosophy) so the AI keeps context consistent with the docket.
- Injects the motion text only for the rebuttal phase, ensuring the response explicitly addresses the defense motion.

## Motion Ruling Prompt Context

`getMotionPrompt` now includes role context alongside the motion and rebuttal texts. This ensures the judge model knows:

- Which side filed the motion and rebuttal.
- Which role the player is currently taking.

The ruling prompt still returns a structured JSON payload with the ruling, explanation, and score so the motion phase can flow into trial scoring.
