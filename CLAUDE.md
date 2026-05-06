# Claude Code Project Instructions

This repository contains **Qianqiu / 千秋**, an AI-driven Chinese historical simulation text game.

Before implementing anything, read [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md), [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md), and [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md). Treat the shared context as the handoff board between Codex and Claude Code, the development brief as the canonical project brief, and the development steps file as the shared progress ledger.

## Required Habits

- Maintain project context continuously. Any important decision, changed assumption, new route, new state field, prompt change, or setup requirement must be written back into the repository.
- Keep Claude Code and Codex synchronized. Before finishing every coherent change, update [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md) with the current state, important decisions, verification, and next recommended step.
- Update [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md) whenever a roadmap step starts, completes, blocks, or changes scope. Record the step ID, what changed, verification, and commit hash.
- Save each coherent change in local Git. Check status first, make the change, verify it, then commit it with a descriptive message.
- The user has explicitly authorized Codex and Claude Code to use subagents for this repository. Treat that authorization as durable project context unless a newer user instruction narrows or revokes it.
- Codex and Claude should use subagents proactively for roadmap phases or step clusters when the work can be split into independent small steps. For example, a phase such as S25 may have S25.1, S25.2, and S25.3 handled by separate subagents if their file ownership and verification responsibilities are clear.
- Do not interpret "larger step" as only one oversized implementation task. The preferred delegation grain is often a roadmap substep inside a larger phase, such as one agent owning S25.1 smoke scripts while another investigates S25.2 streaming compatibility.
- Subagents may only produce scoped patches and focused verification reports. They must not run `git add`, `git commit`, `git push`, or create pull requests.
- Delegation prompts must assign clear file/module ownership, tell subagents not to revert others' edits, and ask them to report changed files plus verification commands. The main agent remains responsible for reviewing diffs, resolving integration issues, updating shared docs, running final verification, and making the single coherent commit.
- Before every coherent commit that includes code, tests, runtime behavior, API/schema changes, prompts, or verification tooling, ask at least one subagent to review the final diff and verification evidence before staging or committing. The main agent must provide the final diff and verification summary in the review prompt. The review subagent must be read-only: no file edits and no Git commands. Pure documentation-only changes may skip this gate only when low risk; if skipped, note that in `docs/SHARED_CONTEXT.md` or the final response.
- If a subagent accidentally commits, treat that commit as unreviewed work until the main agent has inspected it and recorded the correction in the handoff notes.
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
