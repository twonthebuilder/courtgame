# Game State Transitions

This document explains how Pocket Court manages client-side state, including the
screen flow and the living docket phases.

## State Shape

The game state hook centralizes the following fields:

- `gameState`: UI routing state (`start`, `initializing`, `playing`).
- `history`: Living docket data for the current case.
- `config`: Player-selected configuration (`role`, `difficulty`, `jurisdiction`).
- `loadingMsg`: Short-lived status messages for async actions.
- `error`: Last fatal error message surfaced in the docket UI when applicable.
- `copied`: UI flag for the “Copy Docket” button feedback.

## Persisted Profile & Run History

Client-side persistence tracks metadata only. Docket text, arguments, and full case content
are not stored by default; only high-level run metadata and sanctions summaries are retained.

### PlayerProfile (Local Storage)

`PlayerProfile` captures long-lived player metadata:

- `schemaVersion`: profile schema version identifier.
- `createdAt`, `updatedAt`: ISO timestamps for the profile lifecycle.
- `sanctions`: snapshot of the current sanctions state (no docket text).
- `pdStatus`: public defender assignment window (`startedAt`, `expiresAt`) when applicable.
- `reinstatement`: grace window snapshot (`until`) when applicable.
- `stats`: aggregated totals (`runsCompleted`, `verdictsFinalized`).
- `achievements`: list of awarded achievements with timestamps and optional run linkage.

### RunHistory (Local Storage)

`RunHistory` stores a capped list of run metadata:

- `schemaVersion`: run history schema version identifier.
- `createdAt`, `updatedAt`: ISO timestamps for history lifecycle.
- `runs`: array of run entries including `id`, `startedAt`, `endedAt`, `jurisdiction`,
  `difficulty`, `playerRole`, `caseTitle`, `judgeName`, `outcome`, `score`, and
  `achievementId`.

### Schema Versioning, Migration, and Reset Rules

- Both profile and run history records include `schemaVersion`. On mismatch, the stored
  data is reset to defaults and a warning is logged.
- If stored JSON fails to parse, persistence resets to defaults.
- Player profiles perform a one-time migration of legacy sanctions state into the v1
  profile when no modern profile exists. If legacy data is unreadable, defaults are restored.

### Recidivism Window Pruning

- Sanctions state normalization clears `recidivismCount` when the cooldown window has
  elapsed since `lastMisconductAt`.
- Any completed warning, sanction, or reinstatement window also resets `recidivismCount`
  back to zero during normalization.

### History Structure

- `history.case`: Generated case payload (facts, judge, jurors, etc.). Evidence entries are
  stored as docket items with IDs and admissibility status (`admissible` or `suppressed`).
- `history.jury`:
  - `skipped`: `true` when the case is a bench trial.
  - `pool`, `myStrikes`, `opponentStrikes`, `seatedIds`, `comment`, `locked` when jury is active.
  - `pool` jurors retain a stable `status` (`eligible`, `struck_by_player`, `struck_by_opponent`,
    `seated`) with optional `status_history` to record transitions.
- `history.motion`: `text`, `ruling`, `locked`.
- `history.trial`: `text`, `verdict`, `locked`.
- `history.sanctions`: list of explicit, docketed judicial acknowledgments with a visibility flag for in-world rendering.
- **Invariant:** Only juror IDs recorded in the docket may be referenced.
- **Invariant:** Evidence admissibility is controlled in the docket; evidence is marked
  `suppressed` rather than removed.
- **Invariant:** If it is not recorded in the docket, it is not true.

## Screen Flow (`gameState`)

1. **`start` → `initializing`**
   - Trigger: `generateCase(role, difficulty, jurisdiction)`.
   - Side effects: resets run-local UI flags, stores `config`.
2. **`initializing` → `playing`**
   - Trigger: case generation succeeds and `history` is initialized.

## App Shell Flow (Main Menu → Run → Post-Run)

- **`Run` → `PostRun`**
  - Trigger: terminal disposition (dismissal, mistrial, or verdict).
  - Side effects: `RUN_ENDED` event emitted to the app shell with an outcome payload
    containing the final disposition and sanctions snapshot.
- **`Run` → `PostRun`**
  - Trigger: `resetGame()` invoked from the run shell.
  - Side effects: `RUN_ENDED` event emitted to the app shell; run-local state is reset
    when the next case is generated.

## Living Docket Phase Transitions

### Jury Selection

- **Select strikes**
  - Trigger: `toggleStrikeSelection(id)`.
  - Rules: toggles a juror ID, enforces a 2-strike maximum.
- **Submit strikes**
  - Trigger: `submitStrikes(strikes)`.
  - Transition: `history.jury.locked` becomes `true` and `history.motion.locked` remains `false`.
  - Jurors are never removed from the pool; each juror status moves from `eligible` to
    `struck_by_player`, `struck_by_opponent`, or `seated` based on the strike outcome. The
    `status_history` array records each transition.

### Motions

- **Submit motion**
  - Trigger: `submitMotion(text)`.
  - Transition: `history.motion.locked` becomes `true`, and `history.trial.locked` resets to `false`.
- **Ruling updates evidence**
  - Trigger: `requestMotionRuling()`.
  - Transition: `history.case.evidence` statuses update based on the ruling payload.

### Trial / Verdict

- **Submit argument**
  - Trigger: `submitArgument(text)`.
  - Transition: `history.trial.locked` becomes `true` and stores the verdict payload.

### Copy Docket

- **Copy full docket**
  - Trigger: `handleCopyFull()`.
  - Side effects: writes the full docket summary to the clipboard, toggles `copied` for 2 seconds.

## Sanction Acknowledgment Rules

- Sanctions and conduct acknowledgments only exist when the judge explicitly records them in `history.sanctions`.
- UI warnings, validation rejections, or inferred misconduct do not create docket entries unless the judge acknowledges them on the record.
- The `visibility` field controls whether the acknowledgment is shown in-world, sealed, or kept internal.

## Loading & Error Handling

- `loadingMsg` is set before async calls and cleared on completion.
- Any failure during API calls sets `error` and clears `loadingMsg`.
- Case generation failures return the UI to `start` so the player can retry.
