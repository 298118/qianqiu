# Legacy Claude Code Project Instructions

This repository contains **Qianqiu / 千秋**, an AI-driven Chinese historical simulation text game.

2026-05-14 起，按用户要求，本仓库后续开发全部由 Codex 负责；Claude Code 不再作为协作开发者参与。保留本文件只是为了让误读旧入口的工具看到同一条 Codex-only 规则。

Before implementing anything, read [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md), [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md), and [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md). Treat the shared context as the Codex handoff board, the development brief as the canonical project brief, and the development steps file as the shared progress ledger.

Stable development governance is protected in [docs/DEVELOPMENT_GOVERNANCE.md](docs/DEVELOPMENT_GOVERNANCE.md). Do not delete or weaken those rules when rewriting roadmap or handoff documents; `npm run check:docs-governance` and `npm test` guard the protected content.

## Required Habits

- Maintain project context continuously. Any important decision, changed assumption, new route, new state field, prompt change, or setup requirement must be written back into the repository.
- Keep future Codex sessions synchronized. Before finishing every coherent change, update [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md) with the current state, important decisions, verification, and next recommended step.
- Update [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md) whenever a roadmap step starts, completes, blocks, or changes scope. Record the step ID, what changed, verification, and commit hash.
- Save each coherent change in local Git. Check status first, make the change, verify it, then commit it with a descriptive message.
- The user has explicitly authorized Codex to use subagents for this repository. Treat that authorization as durable project context unless a newer user instruction narrows or revokes it.
- Codex should use subagents proactively for roadmap phases or step clusters when the work can be split into independent small steps. For example, a phase such as S25 may have S25.1, S25.2, and S25.3 handled by separate subagents if their file ownership and verification responsibilities are clear.
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
- 复杂功能必须坚持前后端分离和大步骤拆分：后端/API/数据契约、AI 权限与服务器裁决、前端体验、验证与文档应按可审查阶段分步交付；前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息。
- 后端契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver 新增或重构时，优先使用 TypeScript 或纳入 TypeScript 检查；既有 JavaScript 渐进迁移，不为语言迁移一次性重写稳定模块，TS 类型不能替代 Ajv 与服务器 runtime 校验。
- 后端 route/API response shape 新增或重构时，必须对齐 `src/contracts/serverContracts.ts` 或局部 JSDoc typedef，并运行 `npm run typecheck:server`；不得为了启用类型检查一次性 whole-file `@ts-check` 大型 route 文件，也不得放宽安全 projection、raw ledger 剥离、Ajv/runtime 校验或服务器裁决。
- AI is the core world engine of **Qianqiu**, not a replaceable decoration. Whenever gameplay, data domains, roles, offices, events, panels, or prompt retrieval are added, define AI read scope, actor intelligence, tool permissions, proposal boundaries, server adjudication, audit records, and Mock/no-key fallback.
- Never trust raw model output. Validate JSON and apply state updates through server-side rules.
- 项目内面向协作和玩家的输出尽量使用中文，尤其是文档、交接记录、路线图台账、领域逻辑注释和玩家可见文案；只有代码标识符、API、第三方术语、命令输出或外部工具清晰度需要时再使用英文。
- Keep future agents informed. Do not rely on conversation history for durable project knowledge.

## Collaboration Notes

- Prefer focused, incremental commits over large mixed changes.
- Update README or the development brief whenever setup, behavior, or architecture changes.
- When adding gameplay, make it work in Mock mode first, then wire real AI providers.
- When adding AI prompts, document the intended JSON schema and fallback behavior near the prompt code.
- When touching exam logic, verify progression, ranking, anti-cheat, and persistence together.
