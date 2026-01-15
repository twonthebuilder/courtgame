# AGENTS.md for Pocket Court (`courtgame` repo)

This file defines how Codex should operate when working in this repository.
It is an operational contract, not a design document.

Codex should treat this file as a stable source of truth for:
- scope control
- safety behavior
- planning output format
- execution discipline

Game mechanics, tuning, and design canon live in `README.md` and `/docs/`.
If there is a conflict, AGENTS.md governs behavior; design docs govern content.

---

## Project Identity

Pocket Court is a legal strategy game built through iterative development.
Codex’s role is to assist with implementation, refactoring, and bug fixing
under the constraints defined in this document.

---

## Scope & Execution Rules

- Prefer **locality-first reasoning**.
  Identify the smallest relevant subsystem before scanning or changing code.
- Do not refactor unrelated files or systems unless explicitly requested.
- Do not introduce new dependencies unless explicitly requested.

---

## Ambiguity & Safety Protocol (Non-Negotiable)

- **No guessing.**
  If a request is fuzzy, underspecified, or unsafe to execute as written,
  do not proceed with implementation.

- When declining, respond with:
  1. The specific ambiguity or risk
  2. The minimum missing information
  3. A revised, tightly-scoped prompt the user can reuse

- Treat identifiers (filenames, paths, modules, functions, branches) as **high-risk**:
  - If an identifier does not exist, search for close matches
  - If a close match exists, pause and request confirmation
  - Do not create new artifacts that appear to be typos unless explicitly confirmed

- Plain-English prose may be auto-corrected.
  Identifiers must always be confirmed.

---

## Planning Output Contract

- When asked to plan, produce a **structured sequence of actionable tasks**,
  not a prose explanation or roadmap.

- When a current state (A) and desired state (B) are provided,
  explicitly frame the plan as steps to move **A → B**.

- Use the user’s contract words when present
  (e.g. “actionable tasks”, “deliverables”, “A → B”).

---

## Code & Test Discipline

- Adhere to existing ESLint / Prettier configurations if present.
  If missing, recommend adding them, but do not implement unless asked.

- New features and bug fixes must include tests **only for the code touched**.
  Do not refactor unrelated tests unless explicitly requested.

---

## Definition of Done

A task is complete when:
- The project builds / runs successfully
- Relevant tests pass
- Changes are limited to the requested scope

---

## Branching Conventions

- Most experimental work occurs on the `moonshots` branch.
- `main` is the stable branch.
- Backup branches may exist for recovery purposes.

Respect existing branch structure unless instructed otherwise.

---

## Documentation Expectations

- Prioritize clarity of system behavior over cleverness.
- Non-trivial systems must include:
  - in-code comments explaining intent
  - or accompanying documentation in `/docs/`

---

## Final Principle

AGENTS.md governs **how** work is done.  
README.md and `/docs/` govern **what** is being built.

If uncertain, default to safety, locality, and asking for clarification.
