# AGENTS.md for Pocket Court (`courtgame` Repo)
This file provides Codex with a complete understanding of how to interact with the Pocket Court project. Codex should use this document as its operating manual for building features, fixing bugs, and maintaining a coherent structure.

## Project Overview
Pocket Court is an LLM-adjudicated legal strategy game where players:
1. Select a mode, jurisdiction, and a role (example; silly mode, fictional juristiction, and defense or prosecution)
2. Strike jurors strategically
3. File pre-trial motions
4. Present closing arguments
5. Receive verdicts from AI judge + jury

**Core Philosophy:**
- Emergent difficulty through judge/jury variance (not scripted)
- Educational without being preachy (learn by doing)
- Replayable through combinatorial possibility space (judges × juries × cases)
- Living docket architecture (entire case is one continuous document)

**What makes this different from other legal games:**
- No predetermined solutions (every case is unique)
- Multi-phase gameplay (jury selection → pre-trial → trial)
- Context-aware scoring (judge philosophy + jury composition affect outcomes)

## Game Design Constraints

### Judge Profiles
- Must include: background, philosophy, known biases
- Philosophy types: Textualist, Reformer, Pragmatist, Originalist, Legal Realist
- Biases should affect scoring (e.g., textualists dock points for policy arguments)

### Jury Archetypes
- Each juror needs: name, age, occupation, bias description
- Bias should be actionable (e.g., "skeptical of corporations" → affects deliberation)
- Pool size: 8 jurors, 2 strikes per side = 4-6 seated

### Scoring System
- Pre-trial: 40% weight (motion practice)
- Judge (trial): 30% weight (legal soundness)
- Jury (trial): 30% weight (persuasiveness)
- Legendary threshold: 100+ total score (rare, requires excellence in all phases)

### Difficulty Modes
- **Silly** (Fictional jurisdiction): Absurdist cases, generous scoring (80-100 range)
- **Normal** (USA/Canada): Procedural cases, moderate scoring (70-90 range)
- **Nuance** (USA/Canada): Complex felonies, strict scoring (60-90 range, 95+ is exceptional)

### Content Generation Rules
- Cases must be internally consistent (no blatantly contradictory facts, though some nuance is okay.)
- Evidence should support multiple interpretations (enable strategic choice)
- Opposing counsel should hint at prosecution/plaintiff strategy

## General Guidelines
-   **Code Style:** Adhere to the project's ESLint and Prettier configurations. If none exist, implement them.
-   **Documentation:** All public functions, classes, and components require detailed comments. If none exist, or some are poorly done, document them.
-   **Testing:** New features and bug fixes must include corresponding unit and integration tests. If none exist, or some are poorly done, fix them.
-   **Commit Messages:** Follow Conventional Commits specification.

## Testing Instructions
-   Ensure **all** tests pass before finalizing a PR.
-   Ensure tests **actually do something** (not just placeholders that automatically pass, I'm watching you!)

## Documentation and Observability
-   Codex should prioritize **clarity of system behavior,** and **rigourous documentation.**   
-   All non-trivial features must be accompanied by in-code comments or API-accessible diagnostics that explain their purpose and behavior.  
-   When creating new systems, include a brief description of their logic and thresholds, especially if tied to gameplay feedback (e.g. hallucinations, spiral triggers, sanity modifiers), **and create an accompanying doc file in `/docs/`.**

## Branches
-   Most iteration will be done on the `moonshots` branch.
-   The `main` branch is the main, stable version that `moonshots` (if they work) eventually merges with.
-   The `main(backup)` (if it exists) is usually a version 1-2 updates before `main` branch to isolate and fix any lingering bugs.
-   The `OGmain` is a nuclear-level backup containing nothing. (Back to the very beginning, just in case.)
-   That's my personal naming convention (inspired by Brin & Page), if those files don't exist yet, you're just early. Any new branches will be documented as/if they come. 


## Final Principles
-   Stick to the `README.md` and `AGENTS.md` files, and ultimately its vision and end goals.
-   Always explain fixes in plain English unless explicitly told not too.
