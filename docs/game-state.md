# Game State Transitions

This document explains how Pocket Court manages client-side state, including the
screen flow and the living docket phases.

## State Shape

The game state hook centralizes the following fields:

- `gameState`: UI routing state (`start`, `initializing`, `playing`).
- `history`: Living docket data for the current case.
- `config`: Player-selected configuration (`role`, `difficulty`, `jurisdiction`).
- `loadingMsg`: Short-lived status messages for async actions.
- `error`: Last fatal error message, used to return the player to start.
- `copied`: UI flag for the “Copy Docket” button feedback.

### History Structure

- `history.case`: Generated case payload (facts, judge, jurors, etc.).
- `history.jury`:
  - `skipped`: `true` when the case is a bench trial.
  - `pool`, `myStrikes`, `opponentStrikes`, `seatedIds`, `comment`, `locked` when jury is active.
- `history.motion`: `text`, `ruling`, `locked`.
- `history.trial`: `text`, `verdict`, `locked`.
- **Invariant:** Only juror IDs recorded in the docket may be referenced.

## Screen Flow (`gameState`)

1. **`start` → `initializing`**
   - Trigger: `generateCase(role, difficulty, jurisdiction)`.
   - Side effects: resets `error`, stores `config`.
2. **`initializing` → `playing`**
   - Trigger: case generation succeeds and `history` is initialized.
3. **`initializing` → `start`**
   - Trigger: case generation fails.
   - Side effects: `error` is set to an explanatory message.
4. **Any → `start`**
   - Trigger: `resetGame()` from the navbar or “Start New Case” button.
   - Side effects: clears `loadingMsg`, `error`, and `copied` UI flags.

## Living Docket Phase Transitions

### Jury Selection

- **Select strikes**
  - Trigger: `toggleStrikeSelection(id)`.
  - Rules: toggles a juror ID, enforces a 2-strike maximum.
- **Submit strikes**
  - Trigger: `submitStrikes(strikes)`.
  - Transition: `history.jury.locked` becomes `true` and `history.motion.locked` remains `false`.

### Motions

- **Submit motion**
  - Trigger: `submitMotion(text)`.
  - Transition: `history.motion.locked` becomes `true`, and `history.trial.locked` resets to `false`.

### Trial / Verdict

- **Submit argument**
  - Trigger: `submitArgument(text)`.
  - Transition: `history.trial.locked` becomes `true` and stores the verdict payload.

### Copy Docket

- **Copy full docket**
  - Trigger: `handleCopyFull()`.
  - Side effects: writes the full docket summary to the clipboard, toggles `copied` for 2 seconds.

## Loading & Error Handling

- `loadingMsg` is set before async calls and cleared on completion.
- Any failure during API calls sets `error` and clears `loadingMsg`.
- Case generation failures return the UI to `start` so the player can retry.
