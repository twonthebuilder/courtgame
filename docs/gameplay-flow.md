# Gameplay Flow

This document outlines the phase order, scoring weights, and where each phase is implemented in the codebase.

## Phase Order (High-Level)

1. **Start** → player selects mode, jurisdiction, and role.
2. **Initialization** → case generation and docket bootstrapping.
3. **Case Info** → case metadata is displayed.
4. **Jury Selection (if jury trial)** → player strikes jurors, opposing counsel responds.
5. **Pre-Trial Motions** → player files a motion, judge rules.
6. **Trial Arguments** → player submits closing argument.
7. **Verdict** → judge (and jury, if applicable) deliver final outcome + score.

## Scoring Weights

Pocket Court uses weighted scoring across phases:

- **Pre-Trial Motion:** 40% weight
- **Judge (Trial Legal Soundness):** 30% weight
- **Jury (Trial Persuasiveness):** 30% weight

The LLM returns a `final_weighted_score` that applies these weights, and the verdict UI uses it to determine achievements.

## Phase-by-Phase Implementation Map

| Phase | UI Entry Point | State/Logic | LLM Prompt |
| --- | --- | --- | --- |
| Start | `components/screens/StartScreen.jsx` | `useGameState` initializes with `gameState = 'start'` | N/A |
| Initialization | `components/screens/InitializationScreen.jsx` | `generateCase` sets `gameState = 'initializing'` | `getGeneratorPrompt` |
| Case Info | `components/docket/CaseHeader.jsx` (inside `PhaseSection`) | `history.case` created in `generateCase` | Case generation prompt |
| Jury Selection | `components/docket/JurySection.jsx` | `toggleStrikeSelection`, `submitStrikes` | `getJuryStrikePrompt` |
| Pre-Trial Motions | `components/docket/MotionSection.jsx` | `submitMotion` stores `history.motion` | `getMotionPrompt` |
| Trial Arguments | `components/docket/ArgumentSection.jsx` | `submitArgument` stores `history.trial` | `getFinalVerdictPrompt` |
| Verdict | `components/docket/VerdictSection.jsx` | `history.trial.verdict` display | Verdict prompt output |

## Bench Trials

If the case generator marks the case as a bench trial (`is_jury_trial = false`), the jury selection phase is skipped. The UI only renders pre-trial motions and trial arguments once the case is generated.
