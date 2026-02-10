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
- The current evidence docket (IDs, descriptions, and admissibility status).

The ruling prompt returns a structured JSON payload with a machine-readable `decision` object, scoring, and required
`evidence_status_updates` entries so admissibility decisions flow into the docket and the trial phase without relying on prose parsing.

## Motion Ruling Payload Schema (Final)

All fields below are required unless explicitly marked optional.

- `ruling`: `"GRANTED" | "DENIED" | "PARTIALLY GRANTED"`.
- `decision`: object with `{ ruling, dismissal, opinion }` used for all dismissal/state transitions.
  - `decision.ruling`: `"granted" | "denied" | "partially_granted" | "dismissed"`.
  - `decision.dismissal.isDismissed`: boolean terminal flag.
  - `decision.dismissal.withPrejudice`: boolean prejudice flag when dismissed.
  - `decision.opinion`: judge reasoning text used for display only.
- `outcome_text`: mirrored explanation string (same text as `decision.opinion`) for display compatibility.
- `score`: number (0-100).
- `evidence_status_updates`: array of `{ id, status }` entries covering **every** evidence ID in the docket.
  - `id` must reference an evidence entry in the docket.
  - `status` is `"admissible" | "suppressed"`.
- `breakdown`: `MotionRulingBreakdown` object.

### MotionRulingBreakdown

`breakdown.issues` is required:

- `id`: stable issue identifier (unique within the ruling).
- `label`: short issue label for headings.
- `disposition`: `"GRANTED" | "DENIED" | "PARTIALLY GRANTED"`.
- `reasoning`: concise reasoning grounded in docket facts.
- `affectedEvidenceIds?`: optional array of evidence IDs impacted by the issue (must exist in the docket).

`breakdown.docket_entries` is required. Each entry is treated as docket-ready text to append to the
motion ruling section alongside the primary ruling summary.

## Motion Ruling Docket Diff Rules

When a motion ruling is applied to the docket, the client computes a diff with the following rules:

- Evidence updates are **normalized** and applied to the current evidence list; entries must exist in the docket.
- Any evidence IDs referenced in `evidence_status_updates` or `breakdown.issues[].affectedEvidenceIds`
  must exist in the docket, or the ruling is rejected.
- Docket entries are built from `breakdown.docket_entries` plus an auto-generated summary line
  (`RULING: <DISPOSITION> - "<outcome_text>"`), which is stored in `history.motion.ruling.docket_entries`.
