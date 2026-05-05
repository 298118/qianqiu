# Claude Code Project Instructions

This repository contains **Qianqiu / 千秋**, an AI-driven Chinese historical simulation text game.

Before implementing anything, read [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md) and [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md). Treat the shared context as the handoff board between Codex and Claude Code, and the development brief as the canonical project brief for architecture, scope, gameplay, AI contracts, and development discipline.

## Required Habits

- Maintain project context continuously. Any important decision, changed assumption, new route, new state field, prompt change, or setup requirement must be written back into the repository.
- Keep Claude Code and Codex synchronized. Before finishing every coherent change, update [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md) with the current state, important decisions, verification, and next recommended step.
- Save each coherent change in local Git. Check status first, make the change, verify it, then commit it with a descriptive message.
- Keep the project immediately runnable with:

```bash
npm install
npm start
```

- The app must run at `http://localhost:3000` by default.
- Mock AI mode must remain fully playable without API keys.
- OpenAI, DeepSeek, and Claude integrations must be optional provider adapters.
- Preserve the full scholar-to-official gameplay path.
- Never trust raw model output. Validate JSON and apply state updates through server-side rules.
- Keep future agents informed. Do not rely on conversation history for durable project knowledge.

## Collaboration Notes

- Prefer focused, incremental commits over large mixed changes.
- Update README or the development brief whenever setup, behavior, or architecture changes.
- When adding gameplay, make it work in Mock mode first, then wire real AI providers.
- When adding AI prompts, document the intended JSON schema and fallback behavior near the prompt code.
- When touching exam logic, verify progression, ranking, anti-cheat, and persistence together.
