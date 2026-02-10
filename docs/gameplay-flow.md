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

- **Pre-Trial Motion:** 20% weight
- **Judge (Trial Legal Soundness):** 45% weight
- **Jury (Trial Persuasiveness):** 35% weight

The LLM returns a `final_weighted_score` that applies these weights, and the verdict UI uses it to determine achievements.
Procedural outcomes (dismissals, suppressions, delays, JNOVs) are reported separately and do not change merit scores.
If the weighted score exceeds 100, the verdict payload includes an overflow reason code and explanation; the UI shows the normalized 0–100 base score alongside the overflow note.

## Docket Compliance Rules

- Scoring, verdicts, and judge rationale are only valid when they align with the living docket.
- Off-docket facts or references are treated as non-compliant and cannot be accepted as truth.
- Submissions that cite suppressed evidence or missing docket IDs are recorded as non-compliant and may be rejected.

## Sanction Acknowledgments (Explicit + Docketed)

Sanction-related acknowledgments only exist when the judge explicitly records them in structured output. The game uses `history.sanctions` entries to render in-world acknowledgments (public, sealed, or internal).

**Triggers (create a docketed acknowledgment):**
- The judge sets `accountability.sanction_recommended = true` in the ruling/verdict JSON output.
- The judge supplies `accountability.severity`, `accountability.target`, and `accountability.reason` to record the entry.

- Motion dismissals now resolve from `history.motion.ruling.decision.dismissal` booleans, not opinion keyword parsing.
- With-prejudice dismissals auto-apply a disbarment-level accountability entry (public defender consequence).
- Without-prejudice dismissals auto-apply a warning-level accountability entry (minor penalty).

**Non-triggers (do not create a sanction entry):**
- Player misplays, low scores, or adverse verdicts without explicit judicial acknowledgment.
- Model-inferred misconduct that is not declared in `accountability`.
- UI warnings or validation rejections that are not accompanied by a judge's docketed statement.

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
