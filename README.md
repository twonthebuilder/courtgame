# Pocket Court

**An LLM-adjudicated legal strategy game where every case is unique.**

[![PR CI](https://github.com/twonthebuilder/courtgame/actions/workflows/ci-pr.yml/badge.svg)](https://github.com/twonthebuilder/courtgame/actions/workflows/ci-pr.yml)
[![Full CI](https://github.com/twonthebuilder/courtgame/actions/workflows/ci-full.yml/badge.svg)](https://github.com/twonthebuilder/courtgame/actions/workflows/ci-full.yml)

![PocketCourt](https://github.com/user-attachments/assets/8025cd3f-1b34-421f-b616-9b799b0c23b8)

---

## What Is This?

Pocket Court is a courtroom simulator that uses AI to create procedurally generated legal cases with emergent difficulty. You play as defense or prosecution, strike jurors, file pre-trial motions, present closing arguments, and receive verdicts from an AI judge and jury whose biases affect the outcome.

**No two cases are the same.** Judge philosophies, jury compositions, and evidence combinations create thousands of possible scenarios.

---

## Core Mechanics

### **1. The Living Docket**
- The game is played from the docket, and it evolves in real time
- Every action updates and saves it (struck jurors and striken evidence are crossed out).
- Every case is a docket, every docket is saved to your profile

### **2. Pre-Trial Motions**
- File motions to suppress evidence or dismiss charges
- Judge rules based on their judicial philosophy (textualist, reformer, etc.)
- Successful motions set up your trial strategy
- **Weight: 20% of final score**

### **3. Jury Selection (Voir Dire)**
- 8 jurors in the pool, each with hidden biases
- Strike 2 jurors strategically (prosecution strikes 2 as well)
- Final jury of 4-6 people with varying sympathies
- **Crucially:** Not all cases have juries. Bench trials skip this step entirely.

### **4. Trial Arguments**
- Present closing arguments to judge + jury (or just judge in bench trials)
- Judge scores legal soundness (45% weight)
- Jury scores persuasiveness (35% weight)
- Both audiences must be convinced

### **5. Verdict**
- Judge delivers ruling + detailed opinion
- Jury explains their reasoning (in jury trials)
- Scores 100+ unlock legendary achievements (with overflow reason codes when exceeded)
- Cases are saved as a "living docket" you can share
- **Invariant:** If it is not recorded in the docket, it is not true.

---

## Difficulty Modes

- **Silly (Fictional jurisdiction):** Absurdist cases, generous scoring, fun achievements
- **Normal (USA/Canada):** Everyday disputes, realistic scoring, procedural focus
- **Nuance (USA/Canada):** Complex felonies, strict judges, moral ambiguity

---

## Why It's Different

**Most legal games:**
- Have predetermined solutions (Phoenix Wright)
- Are educational tools, not games (law school sims)
- Lack strategic depth (press button to object)

**Pocket Court:**
- Every case is procedurally generated with unique facts, evidence, and witnesses
- Judge philosophies create different win conditions (textualist ≠ reformer)
- Jury psychology matters (strike the insurance adjuster, keep the sympathetic teacher)
- Multi-phase optimization (pre-trial success enables trial dominance)
- You learn real legal concepts without realizing it

---

## Tech Stack

- **Frontend:** React with a modular structure (components, hooks, lib, screens)
- **AI:** **For now** Google Gemini 2.0 Flash (case generation, adjudication, deliberation)
- **State:** React hooks only (no localStorage/sessionStorage)
- **Styling:** Tailwind CSS via PostCSS, with `src/index.css` as the build entry point for global styles and component-specific styles kept co-located.

## **Repo Structure**
```
courtgame/
├── public/
├── src/
├── .gitignore
├── AGENTS.md
├── README.md
├── eslint.config.js
├── index.html
├── package.json
├── vite.config.js
```

---

## Documentation

- [Architecture overview](docs/architecture.md)
- [Gameplay flow](docs/gameplay-flow.md)
- [LLM client notes](docs/llm-client.md)
- [Game state](docs/game-state.md)
- [App shell & run lifecycle](docs/app-shell.md)
- [Counsel notes](docs/counsel-notes.md)
- [Configuration](docs/configuration.md)
- [Markdown rendering](docs/markdown-rendering.md)
- [Motion prompt flow](docs/motion-prompts.md)
- [Sanctions timers](docs/sanctions-timers.md)

---

## Installation
```bash
# Clone repo
git clone https://github.com/twonthebuilder/courtgame.git
cd courtgame

# Install dependencies
npm install

# Add API key
# Create .env file: VITE_GEMINI_API_KEY=your_key_here

# Run locally
npm run dev
```

---

## Testing
```bash
# Full local suite
npm test

# Fast smoke suite (used by PR CI)
npm run test:smoke
```

Tests are deterministic under the shared Vitest setup, which stubs `Math.random` to a fixed value and keeps timer/network behavior explicit in test suites.

## CI & Branch Protection Expectations

GitHub Actions now enforces two levels of checks:

- **PR workflow (`CI - Pull Request`)** runs `npm ci`, `npm run lint`, `npm run test:smoke`, and `npm run build`.
- **Merge workflow (`CI - Full Suite`)** runs `npm ci`, `npm run lint`, `npm run test`, and `npm run build` on pushes to protected branches.

Recommended branch protection settings in GitHub:

1. Add protection for `main` and `moonshots`.
2. Require pull requests before merging.
3. Require status checks to pass before merging, including:
   - `PR checks (lint + smoke + build)`
4. Optionally require up-to-date branches before merging.

This setup keeps PR feedback fast while still running full coverage on merge to active protected branches.

---

## Roadmap

> **Note for future developers:** keep this roadmap updated with every shipped change or merge so it always reflects current gameplay and docs.

### **v17 (Current - `main` build)**
- ✅ Living docket architecture
- ✅ Jury strike mechanics with strike provenance (player/opponent status shown in the pool)
- ✅ Pre-trial motion exchange with rebuttals and structured rulings
- ✅ Bench trials skip jury selection when applicable
- ✅ Multi-phase scoring philosophy (pre-trial 20%, judge 45%, jury 35%; overflow reason codes)
- ✅ Legendary achievements (100+ scores)
- ✅ Markdown rendering in arguments (proper formatting)
- ✅ Mobile optimization (responsive docket)
- ✅ Counsel notes that update on jury lock, motion rulings, and verdicts
- ✅ Sanctions system with warnings, suspensions, public defender assignment, and reinstatement timers
- ✅ Granular motion rulings (issue breakdowns + docket-ready entries + evidence status updates)

### **v18 (Roadmap)**
- [ ] Appeals system (argue that trial judge made legal error)
- [x] Case history browser (see all past cases, win/loss records)
- [ ] Custom case creator (write your own dockets)
- [ ] More judge archetypes (20+ philosophies)

---

## Contributing

This is a solo project for now, but feedback is welcome! Open an issue if you find bugs or have suggestions.

---

## License

MIT License - feel free to fork and experiment.

---

## Acknowledgments

Built using Gemini (Google), ChatGPT Codex (OpenAI), and Claude (Anthropic) through rapid iterative prototyping.

Special thanks to the emergent gameplay gods for making jury psychology actually matter.

---

**Play a case. Get humbled. Learn something.**
