# App Shell & Run Lifecycle

This document describes the top-level shell states that wrap the run experience and the transition rules between them. The app shell is responsible for navigation; the game state hook only emits lifecycle events.

## App Shell States (4)

1. **MainMenu**
   - Entry point for the application.
   - Player selects “Play” to move into setup.
2. **SetupHub**
   - Player chooses role, difficulty, jurisdiction, and court type.
   - Displays any setup errors and the current sanctions snapshot.
3. **Run**
   - Hosts the docket UI and calls `useGameState` for run orchestration.
   - This state owns the run HUD, docket, and debug overlay mount point.
4. **PostRun**
   - Displays the final outcome and run summary.
   - Provides entry points to start a new case or return to the main menu.

## Transition Rules

- **MainMenu → SetupHub**
  - Trigger: user presses “Play” in `MainMenu`.
- **SetupHub → Run**
  - Trigger: user presses “Start” and the shell receives the selected setup payload.
  - Side effects: `startPayload` is stored and passed into `RunShell`.
- **Run → PostRun**
  - Trigger: `useGameState` emits `RUN_ENDED` (terminal disposition or explicit reset).
  - Side effects: shell clears `startPayload`, stores `runOutcome`, and mounts `PostRun`.
- **Run → MainMenu**
  - Trigger: user exits the run shell (navbar title click).
  - Side effects: shell clears run metadata and returns to the menu.
- **PostRun → SetupHub**
  - Trigger: user selects “New Case.”
- **PostRun → MainMenu**
  - Trigger: user selects “Main Menu.”
- **SetupHub (recover)**
  - Trigger: `useGameState` emits `start_failed`.
  - Side effects: shell returns to setup with an error message so the player can retry.

## `useGameState` Event Contract (No Navigation)

`useGameState` does **not** navigate or own the app shell state. It emits run lifecycle events that the shell interprets:

- `sanctions_sync`: informs the shell of the latest sanctions snapshot.
- `start_failed`: informs the shell that case generation failed and setup should resume.
- `RUN_ENDED`: informs the shell that the run has reached a terminal disposition or reset.

The app shell is the sole owner of screen transitions between MainMenu, SetupHub, Run, and PostRun.

## Debug Overlay Ownership & Fail-Closed Requirement

- The app shell owns the Debug Overlay mount point and only renders it during the **Run** state.
- The Debug Overlay must fail closed: if debug mode is disabled or the debug store is unavailable, it renders nothing and should not block gameplay.
- Debug UI state is cleared on shell transitions away from **Run**.

## Mobile Layout Constraints & Shell Expectations

- The shell should keep the **Run** experience in a single-column layout on small screens.
- Primary action controls must remain reachable without horizontal scrolling; avoid fixed widths that
  exceed the viewport.
- Docket sections should remain vertically scrollable while preserving the action footer visibility.
- Shell-level navigation (MainMenu, SetupHub, PostRun) must avoid dense multi-column layouts and keep
  critical actions within thumb reach.
