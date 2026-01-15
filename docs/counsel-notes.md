# Counsel Notes Behavior

## Overview
Counsel Notes are a single, short (1–2 sentences, ≤160 characters) internal posture line that updates at key milestones. The note is **not** a public ruling or argument; it is a counsel POV reaction that avoids spoilers and judge voice.

## Update Milestones
- **Jury seated (voir dire locked):** Derived from the seated jurors’ bias hints. If no usable hints are available, the note falls back to a brief role-based line.
- **Pre-trial motion ruling locked:** Derived from the ruling outcome (granted/denied/partially granted) and whether it was our motion or the opponent’s.
- **Final verdict:** Derived from the final ruling and the player role (defense/prosecution).

## Fallback Logic
If a milestone does not provide enough context, a deterministic fallback string is used to avoid empty notes. The fallback includes:
- Player role
- Motion outcome (if known)
- Verdict outcome (if known)

## Constraints
- **Length:** Maximum of 160 characters.
- **Voice:** Counsel POV (“We are…”, “We need…”), no judge phrasing.
- **Content:** Posture flavor only, no spoilers or argument content.
