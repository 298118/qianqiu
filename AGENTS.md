# Codex Project Instructions

This repository is the browser + Node.js historical simulation text game **Qianqiu / 千秋**.

Always read [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md), [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md), and [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md) before planning or editing. The shared context is the handoff board between Codex and Claude Code; the development brief is the source of truth for product goals, architecture, data contracts, and delivery standards; the development steps file is the shared progress ledger.

## Mandatory Workflow

- Preserve context on every meaningful change: update the development brief, README, inline comments, or a short note in the relevant file when behavior, API shape, setup, or assumptions change.
- Keep Codex and Claude Code synchronized: update [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md) before finishing every coherent change, including the current state, important decisions, verification, and the next recommended step.
- Update [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md) whenever a roadmap step starts, completes, blocks, or changes scope. Record the step ID, what changed, verification, and commit hash.
- Use Git for every coherent local change. Before editing, check `git status --short`; after editing and verification, commit with a clear message.
- Do not leave useful work only in chat. If a decision matters for future Codex or Claude Code sessions, write it into the repo.
- Keep the game runnable with `npm install && npm start` and available at `http://localhost:3000`.
- Default to Mock AI mode for local playability. Real model providers must remain optional through `.env`.
- Do not break the complete scholar path: scholar -> child exam -> provincial exam -> metropolitan exam -> palace exam -> official.
- Validate AI JSON before applying it to game state. The server, not the model, is responsible for state boundaries, promotion rules, anti-cheat penalties, and persistence.
- Keep changes small and reviewable. Avoid unrelated refactors while implementing a feature.
- If tests or manual verification cannot be run, record that explicitly in the final response and, when appropriate, in the relevant project notes.

## Coding Preferences

- Backend: Node.js + Express, plain JavaScript, adapter-based AI providers.
- Frontend: plain HTML/CSS/JS, no build step unless a later documented decision changes this.
- Storage: JSON files under `data/sessions/` for early development.
- UI tone: classical Chinese historical atmosphere, readable first, ornamental second.
- Comments: explain prompts, state transitions, anti-cheat logic, and non-obvious schema decisions.
