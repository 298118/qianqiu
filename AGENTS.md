# Codex Project Instructions

This repository is the browser + Node.js historical simulation text game **Qianqiu / 千秋**.

Always read [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md), [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md), and [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md) before planning or editing. The shared context is the handoff board between Codex and Claude Code; the development brief is the source of truth for product goals, architecture, data contracts, and delivery standards; the development steps file is the shared progress ledger.

## Mandatory Workflow

- Preserve context on every meaningful change: update the development brief, README, inline comments, or a short note in the relevant file when behavior, API shape, setup, or assumptions change.
- Keep Codex and Claude Code synchronized: update [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md) before finishing every coherent change, including the current state, important decisions, verification, and the next recommended step.
- Update [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md) whenever a roadmap step starts, completes, blocks, or changes scope. Record the step ID, what changed, verification, and commit hash.
- Use Git for every coherent local change. Before editing, check `git status --short`; after editing and verification, commit with a clear message.
- The user has explicitly authorized Codex to use subagents for this repository. Treat that authorization as durable project context unless a newer user instruction narrows or revokes it.
- Use subagents proactively for roadmap phases or step clusters when the work can be split into independent small steps. For example, a phase such as S25 may have S25.1, S25.2, and S25.3 handled by separate subagents if their file ownership and verification responsibilities are clear.
- Do not interpret "larger step" as only one oversized implementation task. The preferred delegation grain is often a roadmap substep inside a larger phase, such as one agent owning S25.1 smoke scripts while another investigates S25.2 streaming compatibility.
- Subagents may only produce scoped patches and focused verification reports. They must not commit, push, or create pull requests; Codex reviews, integrates, verifies, updates shared docs, and makes the final coherent commit.
- Every subagent prompt for implementation work must explicitly say: do not run `git add`, `git commit`, `git push`, or create PRs; do not revert others' edits; list changed files and verification commands in the final report.
- Before every coherent commit that includes code, tests, runtime behavior, API/schema changes, prompts, or verification tooling, ask at least one subagent to review the final diff and verification evidence before staging or committing. The main agent must provide the final diff and verification summary in the review prompt. The review subagent must be read-only: no file edits and no Git commands. Pure documentation-only changes may skip this gate only when low risk; if skipped, note that in `docs/SHARED_CONTEXT.md` or the final response.
- If a subagent accidentally creates a commit, Codex must treat it as unreviewed work: inspect the diff and tests, document the mistake in the handoff notes, and avoid further subagent commits. Do not let accidental commit authorship replace Codex's final review responsibility.
- Do not leave useful work only in chat. If a decision matters for future Codex or Claude Code sessions, write it into the repo.
- Keep the game runnable with `npm install && npm start` and available at `http://localhost:3000`.
- Default to Mock AI mode for local playability. Real model providers must remain optional through `.env`.
- Do not break the complete scholar path: scholar -> child exam -> provincial exam -> metropolitan exam -> palace exam -> official.
- Validate AI JSON before applying it to game state. The server, not the model, is responsible for state boundaries, promotion rules, anti-cheat penalties, and persistence.
- 项目内面向协作和玩家的输出尽量使用中文，尤其是文档、交接记录、路线图台账、解释领域行为的注释和玩家可见文案；只有代码标识符、API、第三方术语、命令输出或外部工具清晰度需要时再使用英文。
- Keep changes small and reviewable. Avoid unrelated refactors while implementing a feature.
- If tests or manual verification cannot be run, record that explicitly in the final response and, when appropriate, in the relevant project notes.

## Coding Preferences

- Backend: Node.js + Express, plain JavaScript, adapter-based AI providers.
- Frontend: plain HTML/CSS/JS, no build step unless a later documented decision changes this.
- Storage: JSON files under `data/sessions/` for early development.
- UI tone: classical Chinese historical atmosphere, readable first, ornamental second.
- Comments: explain prompts, state transitions, anti-cheat logic, and non-obvious schema decisions.
