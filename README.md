# Pocket Court

**An LLM-adjudicated legal strategy game where every case is unique.**

---

## What Is This?

Pocket Court is a courtroom simulator that uses AI to create procedurally generated legal cases with emergent difficulty. You play as defense or prosecution, strike jurors, file pre-trial motions, present closing arguments, and receive verdicts from an AI judge and jury whose biases affect the outcome.

**No two cases are the same.** Judge philosophies, jury compositions, and evidence combinations create thousands of possible scenarios.

---

## Core Mechanics

### **1. Jury Selection (Voir Dire)**
- 8 jurors in the pool, each with hidden biases
- Strike 2 jurors strategically (prosecution strikes 2 as well)
- Final jury of 4-6 people with varying sympathies

### **2. Pre-Trial Motions**
- File motions to suppress evidence or dismiss charges
- Judge rules based on their judicial philosophy (textualist, reformer, etc.)
- Successful motions set up your trial strategy
- **Weight: 40% of final score**

### **3. Trial Arguments**
- Present closing arguments to judge + jury (or just judge in bench trials)
- Judge scores legal soundness (30% weight)
- Jury scores persuasiveness (30% weight)
- Both audiences must be convinced

### **4. Verdict**
- Judge delivers ruling + detailed opinion
- Jury explains their reasoning (in jury trials)
- Scores 100+ unlock legendary achievements
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
- [Configuration](docs/configuration.md)

---

## Installation
```bash
# Clone repo
git clone https://github.com/antwon99/courtgame.git
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
npm test
```

Tests are deterministic under the shared Vitest setup, which stubs `Math.random` to a fixed value and keeps timer/network behavior explicit in test suites.

---

## Roadmap

### **v15 (Current - GitHub Launch)**
- ✅ Living docket architecture
- ✅ Jury strike mechanics
- ✅ Pre-trial motion practice
- ✅ Multi-phase scoring (pre-trial 40%, judge 30%, jury 30%)
- ✅ Legendary achievements (100+ scores)

### **v16 (Planned)**
- [ ] Judge/jury strike details (show who struck whom)
- [ ] Granular motion rulings (✅/❌ breakdown with reasoning)
- [ ] Markdown rendering in arguments (proper formatting)
- [ ] Mobile optimization (responsive docket)

### **v17 (Future)**
- [ ] Appeals system (argue that trial judge made legal error)
- [ ] Case history browser (see all past cases, win/loss records)
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

Built in collaboration with Gemini (Google), ChatGPT Codex (OpenAI), and Claude (Anthropic) through rapid iterative prototyping.

Special thanks to the emergent gameplay gods for making jury psychology actually matter.

---

**Play a case. Get humbled. Learn something. - Claude**
