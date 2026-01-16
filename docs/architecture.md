# Architecture Overview

Pocket Court is organized around a single React app entry point, a small set of screen-level components, and focused modules for state, domain logic, and LLM integration. This document summarizes what each folder is responsible for and how to extend it.

## Folder Layout

```
src/
  components/
    docket/   # Docket-phase UI sections (case header, jury, motions, verdict)
    layout/   # Shell/layout primitives (headers, paper container, phase wrapper)
    screens/  # Full-screen entry states (start, initialization)
    ui/       # Small, reusable UI building blocks (loading view, etc.)
  hooks/      # React hooks that orchestrate stateful game behavior
  lib/        # LLM client, prompts, config, and shared utilities/types
  data/       # Static data files used by the app (if any)
  assets/     # Images, icons, or other static assets
  __tests__/  # Unit/integration tests
```

## Styling

Tailwind CSS is compiled through the PostCSS pipeline, with `src/index.css` as the entry point that imports Tailwind layers and shared global styles. Keep component-specific styles colocated with the relevant UI in `components/`, and avoid reintroducing monolithic stylesheet files.

## Screens

**Responsibility:** Screens are top-level routes/entry points that control the full page view before the docket is shown.

- Use screens for states that replace the entire app shell (e.g., start or initialization).
- Keep screen components lightweight; defer orchestration to `hooks/` and UI primitives in `components/`.

## Components

**Responsibility:** Components represent reusable UI sections inside the main docket and layout primitives.

### `components/docket/`
- Owns the “living docket” sections and domain-specific UI.
- Examples: case header, jury selection, motions, trial argument, verdict summary.

### `components/layout/`
- Layout wrappers and shared structural elements (paper container, phase wrapper, action footer).
- Use these to keep the docket consistently styled across phases.

### `components/ui/`
- Small, reusable widgets (loading states, icons, badges, etc.).

### `components/screens/`
- Full-page splash/transition states (start, initialization).

## Hooks

**Responsibility:** Hooks manage orchestration, async flows, and shared state.

- `useGameState` owns the central state machine for the game (start → initializing → playing) and wires UI actions to LLM calls.
- New gameplay logic should live here first; screens/components should stay presentation-focused.

## Lib

**Responsibility:** `lib/` holds domain logic, LLM integrations, and type definitions.

- `llmClient.js` handles network calls and structured JSON parsing.
- `prompts.js` defines system prompts per phase.
- `config.js` centralizes difficulty and default settings.
- `types.js` documents the data model returned from the LLM.
- `api.js` and `clipboard.js` provide small utility helpers.
- **Invariant:** If it is not recorded in the docket, it is not true.

## How to Add a New Phase or Screen

1. **Define prompts & parsing:** add a prompt in `lib/prompts.js` and validation in `lib/llmClient.js`/`types.js`.
2. **Add state handlers:** extend `useGameState` to request data, store results, and lock/unlock phases.
3. **Build UI:** create a new component in `components/docket/` or `components/screens/`.
4. **Wire it up:** update `App.jsx` to render the new component at the correct phase.
