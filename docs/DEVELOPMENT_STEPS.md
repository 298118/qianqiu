# 《千秋》第三阶段开发路线图与进度台账

本文件仍是 Codex 与 Claude Code 共同维护的活动路线图与进度台账。

- 第一阶段路线图已归档到 [docs/PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收记录见 [docs/PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段路线图已归档到 [docs/PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收记录见 [docs/PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 本文件从 S30 起记录第三阶段规划与执行。

第三阶段目标是把第二阶段已经跑通的“可持续模拟骨架”推进为更像长期历史生涯模拟器的体验：先修正影响体验和状态边界的地基问题，再补关系可视化、主动 NPC、长期事件、官场结果、科举日历、角色与世界联动、真实 provider 长回合验收和更完整的浏览器验收。

开发规范不变。继续保持 `npm install && npm start` 可运行、Mock 默认可玩、真实 provider 可选、服务器拥有状态边界/科举晋级/作弊处罚/持久化裁决、每个 coherent change 必须更新共享文档并用 Git 提交。

## 1. 使用规则

每次开发开始时：

1. 读取 `AGENTS.md` 或 `CLAUDE.md`。
2. 读取 `docs/SHARED_CONTEXT.md`。
3. 读取 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`。
4. 读取本文件，选择第一个 `TODO` 或 `IN_PROGRESS` 的小步骤。
5. 执行 `git status --short`，确认是否有别人留下的改动。

每次完成一个小步骤时：

1. 把对应步骤状态改为 `DONE`，填写完成日期、工具、提交哈希或当前文档提交说明。
2. 在“进度记录”追加一条记录，写清完成内容、验证命令、风险/遗留和下一步。
3. 更新 `docs/SHARED_CONTEXT.md`，让另一个工具能直接接手。
4. 如果改动影响产品范围、架构、API、状态字段、提示词、设置或验收标准，同步更新 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`、README 或相关架构文档。
5. 运行相关验证命令。
6. 对包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的改动，在暂存和提交前至少委派一个只读子代理审查最终 diff 与验证结果；主代理必须在审查提示词中提供最终 diff 和验证摘要。纯文档低风险改动可以跳过，但要记录原因。
7. 用 Git 提交本次 coherent change。

子代理使用规则不变：

- 用户已明确授权 Codex 和 Claude Code 在本仓库使用子代理；除非后续用户指令收窄或撤销该授权，否则视为长期项目上下文。
- 推荐委派粒度是独立小步骤或文件职责清晰的子步骤，例如一个子代理评估关系 UI 合约，另一个子代理评估浏览器 smoke 覆盖。
- 主代理仍负责拆分方式、审查所有 diff、补齐跨模块文档、运行最终验证、更新本台账与共享上下文，并做唯一 coherent Git 提交。
- 每个实现型子代理提示词都必须禁止 `git add`、`git commit`、`git push` 和创建 PR，必须要求报告改动文件与 focused verification 命令。
- 提交前审查子代理必须只读，只基于主代理提供的 diff 与验证摘要报告风险、遗漏、测试缺口和建议；不得编辑文件、暂存、提交、推送、创建 PR 或运行 Git 命令。

状态值：

- `TODO`：未开始。
- `IN_PROGRESS`：正在做，接手者应先检查工作树和上下文。
- `DONE`：已完成、已验证、已提交。
- `BLOCKED`：被外部条件阻塞，必须写明原因和解除条件。

## 2. 依赖与开源库策略

依赖策略不变：

- 只有当依赖能明显降低复杂度、提升可靠性、改善安全性或带来标准能力时才加入。
- 新增依赖必须记录在本文件对应步骤和 README 中，说明用途。
- 优先选择维护活跃、文档清晰、常用、许可证友好的库。
- 前端继续保持无构建流程，除非本路线图后续明确升级。
- 核心游戏规则、科举晋级、状态边界、作弊惩罚和持久化不能完全交给模型或黑箱库。
- 加依赖后必须验证 `npm install` 和 `npm start`。

## 3. 第三阶段步骤总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S30.1 | DONE | 归档第二阶段路线图，开启第三阶段活动台账，并保持开发规范不变 | 2026-05-06 | Codex | current documentation commit |
| S31.1 | DONE | 修复桌面游戏态布局过窄问题，并扩展 browser smoke 覆盖游戏面板宽度/裁切断言 | 2026-05-06 | Codex + subagent | 0d52d46 |
| S31.2 | DONE | 收紧普通回合的服务器独占字段边界，阻止 provider patch `activeExam`、`characters`、`eventHistory`、`player.examRank`、`player.examHistory` 等字段 | 2026-05-06 | Codex + subagent | f470f78 |
| S31.3 | DONE | 校验开局 role 输入并明确是否允许浏览器直接开局 `official` | 2026-05-06 | Codex + subagent | 9cdbf91 |
| S32.1 | DONE | 定义关系/联系人检查视图契约，让 `relationshipLedger` 从叙事反馈升级为玩家可查看的信息面板 | 2026-05-06 | Codex + subagents | ed83e9c |
| S32.2 | DONE | 实现关系/联系人 UI 与基础浏览器验收，显示人物/派系关系、怨望、立场、近期意图和可见性 | 2026-05-06 | Codex + subagents | cefde6a |
| S32.3 | DONE | 增加主动 NPC/派系请托、施压、求援、背书或索取回报的最小事件循环 | 2026-05-06 | Codex + subagents | 08042a2 |
| S33.1 | DONE | 定义长期事件调度器契约：季节、灾荒、边报、朝争、地方案件链和跨月后果 | 2026-05-06 | Codex + subagents | eb3261b |
| S33.2 | DONE | 实现服务器拥有的长期事件队列，并把事件结果接入 world tick、eventHistory 和可见叙事 | 2026-05-06 | Codex + subagents | eb3261b |
| S33.3 | DONE | 为长期事件增加自动化测试，覆盖触发条件、裁剪、状态边界和完整书生路径不被破坏 | 2026-05-06 | Codex + subagents | eb3261b |
| S34.1 | DONE | 定义官场结果引擎：实授、转任、升迁、外放、降调、弹劾成案和罢黜 | 2026-05-06 | Codex + subagents | current S34 implementation commit |
| S34.2 | DONE | 实现入仕官员年度/阶段性结算，让 `promotionProspect`、`impeachmentRisk` 等指标触发真实职业结果 | 2026-05-06 | Codex + subagents | current S34 implementation commit |
| S34.3 | DONE | 增加官场结果 UI 与测试，确认晋升/降调/弹劾不会绕过服务器裁决 | 2026-05-06 | Codex + subagents | current S34 implementation commit |
| S35.1 | DONE | 定义科举日历化契约：考期窗口、备考月程、路程耗时、错过考期、盘费筹措和师长推荐 | 2026-05-06 | Codex + subagents | current S35 implementation commit |
| S35.2 | DONE | 让同场虚拟考生跨考试持久存在，成为同年、竞争者或后续官场人脉 | 2026-05-06 | Codex + subagents | current S35 implementation commit |
| S35.3 | DONE | 将科举日历与持久竞争者接入前端档案和完整 scholar -> official 回归测试 | 2026-05-06 | Codex + subagents | current S35 implementation commit |
| S36.1 | DONE | 定义角色与世界 tick 深耦合规则：水利影响粮储，战役影响边患/军费，朝廷任免影响地方执行力 | 2026-05-06 | Codex + subagents | current S36 implementation commit |
| S36.2 | DONE | 深化地方官、将领、皇帝和大臣行动对长期世界状态和关系记忆的复合影响 | 2026-05-06 | Codex + subagents | current S36 implementation commit |
| S36.3 | DONE | 为多身份长期联动增加 Mock 平衡测试和浏览器代表旅程 | 2026-05-06 | Codex + subagents | current S36 implementation commit |
| S37.1 | DONE | 制定 keyed real-provider 长回合验收方案，覆盖 OpenAI、DeepSeek、Anthropic/Claude 的历史语气、越权和状态一致性 | 2026-05-06 | Codex + subagents | current S37 implementation commit |
| S37.2 | DONE | 增加可选真实 provider 长回合 smoke/eval 脚本，保持 no-key 环境成功跳过 | 2026-05-06 | Codex + subagents | current S37 implementation commit |
| S38.1 | DONE | 扩展浏览器验收到完整四级科举通关、作弊样例、各身份一回合、桌面/移动视觉回归 | 2026-05-06 | Codex + subagents | 76745b3 |
| S38.2 | DONE | 完成 JSON 存档硬化：session schema envelope、legacy 迁移、原子写入、并发保护、存档列表和未来数据库迁移路径 | 2026-05-06 | Codex + subagents | current S38.2 implementation commit |
| S38.3 | DONE | 实现浏览器存档簿：开局页存档列表、游戏内存档弹窗、切换载入和 browser smoke 覆盖 | 2026-05-06 | Codex + subagent | current S38.3 implementation commit |
| S39.1 | DONE | 修复预阶段审查发现的 CORS、examTrigger、SSE、隐藏关系、冷却、初始年份和 revision 硬化问题 | 2026-05-06 | Codex + subagents | b344217 |

## 4. 分阶段详细步骤

### Phase 30: 路线图归档与第三阶段开启

目标：把第二阶段活动路线图冻结为归档文件，重置本文件为第三阶段活动台账，同时明确开发规范不变。

- S30.1：新增 `docs/PHASE_TWO_ROADMAP_ARCHIVE.md`；重置 `docs/DEVELOPMENT_STEPS.md` 为第三阶段路线图；同步 README、产品 brief 和共享上下文。
- 验证：`git diff --check`、文档 UTF-8 可读性检查、`npm test`。

### Phase 31: 第三阶段地基修复

目标：在扩大模拟深度前，先修正会影响玩家第一印象和状态安全边界的问题。

- S31.1：修复桌面游戏态 `.game-panel` 只占 390px 的布局问题；进入游戏态后应使用可用宽度，并保证书生/身份面板不被裁切。扩展 `scripts/browserSmoke.js`，增加桌面游戏面板最小宽度/占屏比例断言。
- S31.2：普通回合 provider patch 不应能直接写入服务器独占字段。将 `activeExam`、`characters`、`eventHistory`、`player.examRank`、`player.examHistory` 等从普通 provider patch 路径中剥离，必要时保留服务器内部 follow-up patch 专用入口。
- S31.3：对 `/api/game/start` 的 `role` 做显式校验；如果后端支持 `official` 初始角色，应决定前端是否展示该选项并补浏览器 smoke。

### Phase 32: 关系可视化与主动 NPC

目标：让第二阶段建立的关系账本真正成为玩家可理解、可经营、会反过来施压的系统。

- S32.1：定义关系检查视图的数据契约，明确哪些 ledger 字段对玩家可见、如何解释隐藏关系、如何避免泄露不可见 NPC 信息。
- S32.2：实现关系/联系人 UI，展示人物、派系、关系、怨望、立场、近期意图、来源和最近变化；增加桌面/移动浏览器验收。
- S32.3：增加主动 NPC/派系事件最小循环，例如上官派差、同年求援、乡绅施压、副将争功、派系索取回报。NPC 主动事件仍必须由服务器调度，provider 只能建议叙事和有限后果。

### Phase 33: 长期事件调度器

目标：把 world tick 从确定性资源漂移升级为可积累的历史事件年表。

- S33.1：定义长期事件契约，包括季节、灾荒、边报、朝争、地方案件链、触发条件、持续时间、冷却和可见反馈。
- S33.2：实现服务器拥有的事件队列。事件应能读取世界状态、关系账本和最近历史，产出受限 patch、事件说明和后续钩子。
- S33.3：增加测试覆盖事件触发、事件裁剪、状态边界、重复回合稳定性和完整书生主线保护。

### Phase 34: 官场结果引擎

目标：让入仕后不只是仪表增长，而是真的出现任官、调任、升降、弹劾和罢黜。

- S34.1：定义官场结果契约，明确哪些指标、关系和事件会触发实授、转任、升迁、外放、降调、弹劾成案、罢黜或留任。
- S34.2：实现服务器拥有的年度/阶段性官场结算，普通 provider 不得直接授官或罢官。
- S34.3：前端显示官场结果和履历变化；测试覆盖升迁、降调、弹劾、作弊后入仕边界和官方路径不被普通 turn 越权。

### Phase 35: 科举日历与持久竞争者

目标：让科举从“随时取题交卷”升级为更像生涯路径的考期与人脉系统。

- S35.1：定义科举日历契约，包含考期窗口、备考月程、路程耗时、盘费筹措、错过考期、师长推荐和地方名额。
- S35.2：让虚拟同场考生跨考试持久存在，可能成为竞争者、同年、座师线索或后续官场联系人。
- S35.3：将日历与持久竞争者接入考试档案和浏览器路径；保持 Mock 默认可完成完整 scholar -> official 路线。

### Phase 36: 身份与世界联动

目标：让不同身份的选择深度影响长期世界，而不是只改变个人仪表。

- S36.1：定义角色-世界联动契约：地方水利影响粮储和民心，战役影响边患/军费/军心，皇帝任免影响派系和地方执行，大臣弹劾影响官场结果。
- S36.2：实现地方官、将领、皇帝和大臣行动对 world tick、长期事件和关系账本的复合影响。
- S36.3：增加多身份长回合 Mock 平衡测试和代表性浏览器旅程。

### Phase 37: 真实 Provider 长回合验收

目标：确认真实模型不仅能返回 schema-valid JSON，还能在长回合中维持历史语气、状态一致性和越权边界。

- S37.1：制定 keyed provider 长回合验收方案，分 OpenAI、DeepSeek、Anthropic/Claude 记录历史语气、JSON 合约、越权尝试、状态一致性和 streaming 稳定性。
- S37.2：实现可选真实 provider 长回合 smoke/eval 脚本；无 key 环境仍应成功跳过，不进入 `npm test` 默认路径。

### Phase 38: 浏览器与存档验收扩展

目标：让浏览器验收覆盖更完整的实际玩家旅程，并为存档长期演进做准备。

- S38.1：扩展 browser smoke 至完整四级科举通关、作弊样例、皇帝/大臣/将领/地方官/官员各一回合、桌面/移动视觉回归。
- S38.2：完成 JSON 存档硬化，包含 session schema envelope、legacy raw-save 迁移、原子写入、同 session 并发保护、revision、存档列表、清理函数和未来数据库迁移路径。规划与实现基线落点是 [docs/SESSION_STORAGE_MIGRATION_PLAN.md](SESSION_STORAGE_MIGRATION_PLAN.md)，SQLite/托管数据库迁移仍是后续工作。
- S38.3：把 `GET /api/game/saves` 接入浏览器体验。开局页展示最近存档，游戏内状态栏打开存档簿弹窗，载入存档时继续通过 `GET /api/game/state/:sessionId` 读取完整状态并更新 `localStorage["qianqiu.sessionId"]`。扩展 browser smoke 覆盖存档簿载入、去敏和布局溢出。

### Phase 39: 预阶段审查硬化

目标：在进入下一轮功能扩展前，先修复 `docs/PRE_PHASE_CODEBASE_REVIEW_2026-05-06.md` 记录的安全、状态边界、流式显示和存储一致性问题。

- S39.1：收紧默认 CORS，不让任意 Origin 读取本地 API；让普通回合 `examTrigger` 通过 `canEnterExam()` 和考期窗口校验，并保护未交卷的写作考试不被覆盖；修复顶层 SSE 叙事抽取、失败流式文本回滚、隐藏关系笔记泄漏、角色/世界联动冷却、开局年份边界和跨进程 revision 检测。

## 5. 进度记录

按时间倒序追加。每条记录必须让另一个工具看得懂。

模板：

```text
日期：
工具：
步骤：
提交：
完成：
验证：
风险/遗留：
下一步：
```

### 2026-05-06

Tool: Codex

Step: S39.1

Commit: b344217

Completed:
- Compressed `docs/SHARED_CONTEXT.md` into a compact handoff index so future agents can read current architecture, invariants, and S39 scope without scanning the full historical ledger.
- Restricted default CORS in `server.js`: arbitrary origins no longer get browser-readable CORS headers for save/state APIs, while no-`Origin` local calls and configured local app origins remain usable. Extra development origins are now configured with `CORS_ALLOWED_ORIGINS`.
- Hardened ordinary-turn `examTrigger` in `src/routes/game.js`: triggers must pass `canEnterExam()` and `canOpenExamInCalendar()`, bad/null/closed requests return sanitized false triggers, and active writing exams cannot be overwritten.
- Fixed streaming safety: `src/utils/streamingJson.js` extracts only top-level `narrative`, route tests cover nested narrative suppression, and the browser removes pending streamed text if an SSE error arrives before `final_state`.
- Fixed P2 state/storage findings: visible-only relationship summaries filter hidden recent notes, role/world coupling cooldowns are enforced before applying effects, initial years clamp through `stateRules` bounds, and JSON writes reread latest disk revision under a per-session lock before replacing a session file.
- Expanded focused tests for CORS, exam triggers, streaming JSON/SSE, relationship notes, role-world cooldown, initial year clamping, session revision/lock behavior, and browser smoke failed-SSE rollback.
- Fixed the test helper Fetch bad-port table by adding port `4190`, which full-suite CORS coverage exposed.
- Used two implementation subagents for scoped P1 and P2 patches. Neither staged, committed, pushed, or created PRs; main Codex integrated the final diff and documentation.

Verification:
- `node --check` for changed runtime/test scripts including `server.js`, `public/app.js`, `scripts/browserSmoke.js`, `src/routes/game.js`, `src/storage/sessionStore.js`, and focused tests.
- Focused `node --test test\serverCors.test.js test\gameTurnExamTrigger.test.js test\streamingJson.test.js test\streamingTurnRoute.test.js test\relationshipLedger.test.js test\roleWorldCoupling.test.js test\gameStartRole.test.js test\sessionStore.test.js` passed with 55 tests.
- `npm run eval:ai` passed with 6 tests.
- `npm run smoke:provider` skipped successfully because no real-provider keys are configured.
- `npm run smoke:provider:long` skipped successfully because no real-provider keys are configured.
- `npm test` passed with 185 tests after adding the missing Fetch blocked port to the helper.
- `npm run smoke:browser` passed with failed-SSE rollback coverage, complete four-exam scholar-to-official path, cheating sample, representative role-world journeys, and 14 screenshots checked.
- `git diff --check` passed.
- A read-only pre-commit subagent review found no blocking issues. Residual risks noted: the JSON `.lock` file is local-filesystem best effort, failed-SSE rollback is covered by browser smoke rather than a DOM unit test, and configured `CORS_ALLOWED_ORIGINS` entries are still trusted Origins rather than authentication.

Risk/leftover:
- Live real-provider network calls were not run because no provider keys are configured; optional smoke commands skipped as expected.
- The JSON adapter now uses a lightweight local lock file, but SQLite/database storage remains the recommended future path for stronger persistence semantics.

Next:
- After the S39.1 commit hash is recorded, continue with the storage adapter/SQLite boundary or the next long-term simulation depth slice.

Tool: Codex

Step: S38.3

Commit: current S38.3 implementation commit

Completed:
- Added a browser save-list UI on top of the S38.2 redacted `GET /api/game/saves` API.
- `public/index.html` now exposes a start-page `#save-list-panel` and an in-game `#save-list-modal`.
- `public/app.js` fetches and renders redacted save metadata, loads selected saves through `GET /api/game/state/:sessionId`, updates `localStorage["qianqiu.sessionId"]`, refreshes the list after new game creation, and keeps automatic last-session restore compatible.
- `public/styles.css` adds responsive save-list and modal styling using the existing paper/ink/jade/cinnabar UI language.
- `scripts/browserSmoke.js` now verifies the in-game save modal, clean-context start-page save loading, raw storage token non-leakage, and save-list panel/modal overflow. `test/browserSmokeScript.test.js` adds focused save-list helper and layout coverage.
- Used one implementation subagent for focused browser-smoke helper coverage. The subagent only edited `scripts/browserSmoke.js` and `test/browserSmokeScript.test.js`, ran no Git commands, and reported focused verification.

Verification:
- `node --check public\app.js`
- `node --check scripts\browserSmoke.js`
- `node --check test\browserSmokeScript.test.js`
- `node --test test\browserSmokeScript.test.js`
- `npm run smoke:browser`
- Final full-suite verification recorded in this S38.3 commit after documentation updates.

Risk/leftover:
- Save deletion, export/import, and database-backed storage are still future work.
- The browser save list is local-file metadata only; there are still no accounts, cloud saves, or cross-device sync.

Next:
- Continue with a storage adapter/SQLite slice when persistence needs outgrow local JSON, or pivot to the next long-term simulation depth step.

Tool: Codex

Step: S38.2 implementation

Commit: current S38.2 implementation commit

Completed:
- Implemented the first storage hardening slice from `docs/SESSION_STORAGE_MIGRATION_PLAN.md` in `src/storage/sessionStore.js`.
- JSON session files now persist a top-level envelope with `storageSchemaVersion`, `sessionId`, `createdAt`, `updatedAt`, `revision`, redacted metadata, and nested `worldState`; `readSession()` remains route-compatible and returns only `worldState`.
- Legacy raw `worldState` saves are treated as schema `0` and are migrated to the envelope on read; mismatched ids, corrupt JSON, and unsupported future versions now fail clearly.
- `writeSession()` now uses same-directory temp-file-and-rename atomic replacement with best-effort fsync and no leftover same-session `.tmp` file after success.
- Added `mutateSession()` with in-process per-session serialization and revision checks; game and exam mutation routes now use it for turns, exam questions, missed-window writes, and exam submissions.
- Added `GET /api/game/saves` backed by `listSessions()`, returning redacted metadata without full `worldState`, relationship ledgers, hidden contacts, provider config, prompts, or file paths.
- Added storage cleanup helpers (`deleteSession()`, `cleanupSessionTempFiles()`) while keeping browser smoke/test explicit session cleanup behavior intact.
- Expanded `test/sessionStore.test.js` and added `test/gameSavesRoute.test.js` for envelope, legacy migration, mismatch/future-version errors, atomic temp cleanup, save-list redaction/sorting, mutation serialization, and route exposure.
- Used one implementation subagent to write focused storage tests. The subagent only edited `test/sessionStore.test.js`, ran no Git commands, and reported verification.

Verification:
- `node --check src\storage\sessionStore.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check test\sessionStore.test.js`
- `node --check test\gameSavesRoute.test.js`
- `node --test test\sessionStore.test.js test\gameSavesRoute.test.js`
- Focused route checks: `node --test test\gameStartRole.test.js test\gameTurnRelationships.test.js test\gameTurnTick.test.js`
- Focused exam/SSE checks: `node --test test\examTravel.test.js test\examRules.test.js test\streamingTurnRoute.test.js`
- `npm test` passed with 167 tests.
- `npm run smoke:browser` passed with complete four-exam progression, cheating sample, representative role turns, and 14 screenshots checked.
- `git diff --check`

Risk/leftover:
- The in-process queue is intended for one Node process. Cross-process locking and network filesystem semantics remain out of scope until SQLite/database migration.
- `GET /api/game/saves` is API-only; the browser still restores the last `qianqiu.sessionId` from localStorage and does not yet render a save picker.
- SQLite/hosted database adapters are not implemented in this slice.

Next:
- This historical S38.2 next step was superseded by S38.3 for the browser UI path; storage adapter/SQLite remains future work.

Tool: Codex

Step: S38.2

Commit: current S38.2 documentation commit

Completed:
- Added `docs/SESSION_STORAGE_MIGRATION_PLAN.md` as the durable S38.2 plan for storage evolution.
- Recorded the current baseline: raw `worldState` JSON files under `data/sessions/{sessionId}.json`, UUID-like path safety, direct `fs.writeFile()` overwrites, route-level `ensure*` legacy backfills, browser `localStorage` restore, and no save-list/cleanup API yet.
- Defined the future session record envelope with `storageSchemaVersion`, timestamps, `revision`, redacted metadata, and nested `worldState`, while treating current raw JSON files as legacy schema `0`.
- Planned atomic temp-file-and-rename writes, malformed-save handling, per-session mutation serialization, optimistic revision checks, redacted save-list behavior, explicit cleanup/quarantine policy, and a JSON adapter -> SQLite -> optional hosted database migration path.
- Linked the plan from README, architecture notes, product brief, shared context, and this ledger.
- Used a read-only subagent to inspect current storage entrypoints, compatibility risks, documentation placement, and verification expectations; it edited no files and ran no Git commands.

Verification:
- `git diff --check`
- Node.js UTF-8 readability check for `docs/SESSION_STORAGE_MIGRATION_PLAN.md`, README, architecture notes, product brief, this ledger, and shared context.

Risk/leftover:
- S38.2 is documentation-only and intentionally does not add the storage envelope, atomic writes, locks, revision checks, save-list API, or cleanup script yet.
- The current runtime still uses direct JSON overwrites, so overlapping mutations can still lose updates until a later implementation step introduces `mutateSession()` or equivalent route-level serialization.

Next:
- Open/implement the first storage hardening slice from the plan: session record envelope, legacy raw-save migration tests, and atomic JSON writes.

Tool: Codex

Step: S38.1

Commit: 76745b3

Completed:
- Expanded `scripts/browserSmoke.js` so `npm run smoke:browser` completes the full browser-visible Mock exam path: 童试 -> 乡试 -> 会试 -> 殿试 -> 入仕官员.
- The smoke prepares deterministic local session month/readiness before each exam to enter legal calendar windows, then uses the real browser exam button, modal, essay textarea, submit button, result view, archive view, restore path, and mobile layouts.
- Added assertions for every promotion rank, final `official` role, four exam-history records, cleared `activeExam`, seeded office title, final official panel, final mobile archive, and persistent rivals through palace.
- Added an isolated copied-classic cheating browser session that must show `监试黜落` / `疑似照抄`, persist score `0`, keep the player a scholar, and record `severeCheat=true`.
- Kept representative identity coverage by combining the direct official-start/appointment turn with existing magistrate, general, emperor, and minister role-world turns.
- Added browser-smoke helper tests for deterministic per-level essays and exam-level coverage helpers.
- Updated README, architecture notes, browser acceptance, product brief, and shared context for the S38.1 coverage.
- Used two read-only subagents to inspect browser-smoke extension points and deterministic exam/cheating setup; neither edited files or ran Git commands.

Verification:
- `node --check scripts\browserSmoke.js`
- `node --check test\browserSmokeScript.test.js`
- `node --test test\browserSmokeScript.test.js` passed with 21 tests.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s38-1` passed with complete four-exam progression, cheating sample, representative role turns, and 14 screenshots checked.
- `npm test` passed with 155 tests.
- `git diff --check`

Risk/leftover:
- The browser smoke mutates local JSON session fields only as deterministic acceptance setup before exam entry; the actual player-visible exam/result/archive path still runs through the browser and server routes.
- `npm run smoke:browser -- --url` still assumes a local Qianqiu server using this repository's JSON session directory when it needs deterministic exam setup; README, CLI help, and `docs/BROWSER_ACCEPTANCE.md` now state that caveat.
- S38.2 storage migration planning remains open.

Next:
- S38.2: define session schema versioning, atomic writes, concurrent access protection, save-list/cleanup behavior, and the future database migration path.

Tool: Codex

Step: S37.1-S37.2

Commit: current S37 implementation commit

Completed:
- Added `docs/REAL_PROVIDER_ACCEPTANCE.md` as the durable keyed real-provider long-run acceptance record for OpenAI, DeepSeek, and Anthropic/Claude.
- Added `scripts/providerLongRun.js` and `npm run smoke:provider:long` for optional keyed long-run smoke/eval. The script reuses provider key selection/no-key skip behavior, calls real provider factories directly without Mock fallback, runs a repeated scholar scenario with an explicit promotion/office authority probe, checks historical tone, rejects server-owned ordinary-turn patch attempts and illegal/closed exam triggers, applies server boundary/tick/event/career follow-up logic in memory, and writes no session files.
- Added `--turns` and `--stream` support so keyed environments can run longer JSON or adapter-stream checks while keeping no-key local environments successful.
- Added `test/providerLongRunScript.test.js` for no-network helper coverage and exported shared provider-smoke helpers from `scripts/providerSmoke.js`.
- Linked the S37 acceptance record from README and architecture notes, and recorded the S37 behavior in the product brief.
- Used read-only subagents to inspect the provider smoke/streaming implementation and S37 acceptance-document placement; neither edited files or ran Git commands.

Verification:
- `node --check scripts/providerLongRun.js`
- `node --check scripts/providerSmoke.js`
- `node --check test/providerLongRunScript.test.js`
- `node --test test/providerLongRunScript.test.js test/providerSmokeScript.test.js` passed with 15 tests.
- `npm run smoke:provider:long` skipped successfully because no real-provider keys are configured.
- `npm run eval:ai` passed with 6 tests.
- `npm test` passed with 153 tests.
- `git diff --check`

Risk/leftover:
- Keyed network calls were not executed in this no-key workspace.
- The S37 script is adapter-level plus in-memory server-boundary verification; route-level SSE persistence with real providers remains a future keyed acceptance expansion if needed.

Next:
- S38.1: expand browser acceptance to complete four-level exam progression, cheating samples, representative identity turns, and desktop/mobile visual regression.

Tool: Codex

Step: S36.1-S36.3

Commit: current S36 implementation commit

Completed:
- Added `docs/ROLE_WORLD_COUPLING_CONTRACT.md` and `src/game/roleWorldCoupling.js` as the durable/server-owned S36 contract and implementation for magistrate waterworks, general campaigns, emperor appointments, and minister impeachments.
- Seeded `worldState.roleWorldCoupling`, protected it from ordinary provider patches, added compact prompt context, and exposed top-level `roleWorldCouplingView` in game and exam route payloads.
- Wired `/api/game/turn` to run role/world coupling after provider output and active-request handling, before world tick, long-term events, and official career settlement. Coupling state patches use the server-owned patch path without adding another turn count, and social consequences flow through `applyRelationshipChanges()`.
- Added `[联动]` browser narrative feedback with `.role-world-event[data-role-world-kind]` instead of adding another persistent panel.
- Extended `scripts/browserSmoke.js` with direct-start representative role journeys for magistrate, general, emperor, and minister actions, checking both feedback kind and API metric direction.
- Hardened browser smoke start flows so stale `qianqiu.sessionId` localStorage from a prior run cannot hide the initial start form; the later reload/fresh-page restore checks still validate the newly created session.
- Added focused role-world unit/route tests, state-boundary and AI schema/eval coverage, and browser-smoke helper coverage.
- Used read-only subagents for backend order/ownership and browser-smoke placement before implementation; neither edited files or ran Git commands.

Verification:
- `node --check` for changed runtime and test files.
- `node --test test\roleWorldCoupling.test.js test\gameTurnRoleWorldCoupling.test.js test\stateRules.test.js test\aiSchemas.test.js test\aiEvalFixtures.test.js test\browserSmokeScript.test.js` passed with 45 tests.
- `npm run eval:ai` passed with 6 tests.
- `npm test` passed with 145 tests.
- `npm run smoke:provider` skipped successfully because no real-provider keys are configured.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s36` passed with 7 screenshots checked.
- `git diff --check`

Risk/leftover:
- The first S36 coupling rules are deterministic and compact; richer cooldown enforcement, multi-turn campaign chains, appointment policy memory, and deeper interaction with the official-career engine can build on the persisted `recentImpacts` contract later.
- S36 intentionally renders feedback in the narrative stream rather than adding a new permanent panel, so player-facing state inspection still depends on the existing status strip, role panel, relationship panel, long-term feedback, and official-career feedback.

Next:
- S37.1: define keyed real-provider long-run acceptance for historical tone, JSON authority boundaries, state consistency, and streaming stability.

Tool: Codex

Step: S35.1-S35.3

Commit: current S35 implementation commit

Completed:
- Added `docs/EXAM_CALENDAR_CONTRACT.md` and `src/game/examCalendar.js` as the durable/server-owned S35 contract and implementation for exam windows, preparation/travel month summaries, missed-window records, persistent rivals, and palace-exam peer contacts.
- Seeded `worldState.examCalendar`, protected it from ordinary provider patches, and added compact prompt context plus top-level `examCalendarView` and `examRivalView` to game and exam route payloads.
- Updated `/api/exam/question` so new questions check calendar windows before charging travel or calling the provider; missed attempts persist a no-charge missed-window record and return `409`.
- Preserved open calendar snapshots on free-text `examTrigger` requests before world tick advances the month, preventing valid last-window requests from becoming false missed-window errors during browser auto-open.
- Extended entry preparation/history with the calendar snapshot and updated virtual candidates so same-field rivals receive stable `rival-*` ids, carry attempt history, and can become visible official `同年进士` contacts after palace promotion.
- Added browser `#exam-calendar-panel` and `#exam-rival-panel`, calendar details in the writing modal and archive, persistent rival notes on candidate profiles, and browser-smoke layout/assertion coverage.
- Used read-only subagents to inspect backend exam-route/candidate integration and frontend/browser-smoke placement before implementation; neither edited files or ran Git commands.

Verification:
- `node --check` for changed runtime/test files.
- `node --test test/examCalendar.test.js test/examTravel.test.js test/gameTurnTick.test.js test/stateRules.test.js test/browserSmokeScript.test.js` passed with 38 tests.
- `npm run eval:ai` passed with 6 tests.
- `npm test` passed with 136 tests.
- `npm run smoke:provider` skipped successfully because no real-provider keys are configured.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s35` passed with 6 screenshots checked.
- `git diff --check`

Risk/leftover:
- Calendar windows are deterministic and compact; richer historical calendars, jurisdiction-specific quotas, and multi-year exam cycles can build on this contract later.
- The complete Mock scholar -> official path remains supported by setting legal exam months in tests and by browser guidance through the new calendar panel.

Next:
- S36.1: define deeper role/world tick coupling rules.

Tool: Codex

Step: Workflow rule update

Commit: current documentation commit

Completed:
- Added the user-requested pre-commit subagent review gate to `AGENTS.md`, `CLAUDE.md`, `docs/QIANQIU_DEVELOPMENT_BRIEF.md`, this active ledger, and `docs/SHARED_CONTEXT.md`.
- The gate applies before staging or committing coherent changes that include code, tests, runtime behavior, API/schema changes, prompts, or verification tooling.
- Review subagents must be read-only and work from the main agent's provided diff and verification summary; they must not edit files, stage, commit, push, create PRs, or run Git commands.
- Pure documentation-only changes may skip the gate only when low risk, and the skip must be noted in the handoff or final response.

Verification:
- Documentation-only workflow update; verified with `git diff --check`.

Risk/leftover:
- Future agents must still use judgment on low-risk documentation-only skips, but code-affecting commits now have a default review gate.

Next:
- S35.1 remains the next roadmap implementation step.

Tool: Codex

Step: S34.1-S34.3

Commit: current S34 implementation commit

Completed:
- Added `docs/OFFICIAL_CAREER_CONTRACT.md` as the durable S34 contract for persisted official-career state, settlement triggers, outcome types, route ordering, provider authority boundaries, browser selectors, and focused verification.
- Added `src/game/officialCareer.js` as the server-owned official career outcome engine. It normalizes `worldState.officialCareer`, builds `officialCareerView`, summarizes career context for prompts, and settles appointment, transfer, promotion, outpost, demotion, impeachment, punishment, or retention from bounded player meters plus visible relationship context.
- Seeded `worldState.officialCareer` in initial sessions and hardened state boundaries so ordinary provider patches cannot forge `officialCareer`, `officeTitle`, `role`, `roleLabel`, `palaceRank`, or other protected career fields.
- Wired game and exam route payloads to return top-level `officialCareerView`; turn payloads and SSE previews/final states now include `officialCareer: { summary, events, attributeChanges, outcome }`.
- Integrated official career settlement after active requests, world tick, and long-term events. Event history order is provider events, active-request events, world-tick events, long-term-event events, and official-career events.
- Rendered a compact browser `官场履历` panel from `officialCareerView`, added `[官场结算]` narrative feedback, and extended browser smoke to verify direct official start plus deterministic first appointment and official-career panel overflow.
- Added focused unit/route/browser-helper coverage in `test/officialCareer.test.js`, `test/gameTurnOfficialCareer.test.js`, `test/stateRules.test.js`, and `test/browserSmokeScript.test.js`.
- Used two read-only subagents for backend contract/risk inspection and frontend/browser-smoke placement. Neither edited files or ran Git commands.

Verification:
- `node --check` for changed runtime and test files.
- `node --test test/officialCareer.test.js test/gameTurnOfficialCareer.test.js test/officialRole.test.js`
- `node --test test/gameTurnLongTermEvents.test.js test/gameTurnRelationships.test.js test/gameTurnTick.test.js`
- `npm run eval:ai`
- `npm test` passed with 129 tests.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s34` passed with 6 screenshots checked.
- `npm run smoke:provider` skipped successfully because no real-provider keys are configured.
- `git diff --check`

Risk/leftover:
- The outcome rules are deterministic and intentionally compact; richer office ladders, emperor/minister interventions, and deeper role/world coupling remain S36 work.
- `outpost` currently keeps the broad `official` role while changing posting/title instead of switching to the separate direct-start `magistrate` role.

Next:
- S35.1: define the exam calendarization contract for exam windows, preparation months, travel time, missed periods, funding, and teacher recommendations.

Tool: Codex

Step: S33.1-S33.3

Commit: eb3261b

Completed:
- Added `docs/LONG_TERM_EVENTS_CONTRACT.md` as the durable S33 scheduler contract for persisted state, route order, output payloads, authority boundaries, implemented event families, and focused verification.
- Added `src/game/longTermEvents.js` as the server-owned deterministic long-term scheduler. It normalizes `worldState.longTermEvents`, schedules/cools down active events, resolves cross-month effects, returns a player-facing `longTermEventView`, and summarizes active events for prompts without giving providers write authority.
- Seeded `worldState.longTermEvents` in initial sessions and hardened the ordinary provider boundary so provider `statePatch` cannot forge `activeNpcRequest` or `longTermEvents`.
- Wired `/api/game/turn` to run long-term events after active requests and after world tick has advanced the calendar, then append event history in provider -> active-request -> world-tick -> long-term-event order.
- Added top-level `longTermEventView` to game and exam route payloads, plus `longTermEvents` feedback in JSON/SSE turn payloads. The browser now renders scheduler feedback as `[大势]` narrative lines.
- Added focused scheduler and route coverage in `test/longTermEvents.test.js` and `test/gameTurnLongTermEvents.test.js`, plus a state-rule boundary assertion.
- Used two read-only subagents for S33 integration/test-scope inspection. Neither edited files or ran Git commands.

Verification:
- `node --check` for changed runtime and test files.
- `node --test test/longTermEvents.test.js`
- `node --test test/gameTurnLongTermEvents.test.js`
- `node --test test/stateRules.test.js`
- `node --test test/gameTurnTick.test.js test/gameTurnRelationships.test.js test/activeNpcRequests.test.js test/worldTick.test.js`
- `npm test` passed with 119 tests.
- `npm run smoke:provider` skipped successfully because no real-provider keys are configured.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s33` passed with 5 screenshots checked.
- `git diff --check`

Risk/leftover:
- S33 intentionally exposes long-term events as narrative feedback, not a separate browser panel.
- Event selection is deterministic and deliberately small; richer event chains, annual official outcomes, exam calendarization, and role/world coupling remain later roadmap phases.

Next:
- S34.1: define the official career outcome engine contract for appointment, transfer, promotion, demotion, impeachment, punishment, and retention.

Tool: Codex

Step: S32.3

Commit: 08042a2

Completed:
- Added `src/game/activeRequests.js` as the server-owned active NPC/faction request loop, with scheduling, normalization, visible-target filtering, response classification, expiry, and player-facing `activeNpcRequestView` rendering.
- Added `worldState.activeNpcRequest` to initial state and wired game/exam route payloads to return top-level `activeNpcRequestView`; turn payloads also return `activeNpcRequestEvents`.
- Integrated active request handling in `/api/game/turn` after provider state patches and provider relationship suggestions, before world tick. Event history now appends provider events, active-request events, then world-tick events.
- Rendered a compact browser `#active-request-panel` / `来函` card from `activeNpcRequestView`, with stable `data-request-*` attributes and no raw hidden-ledger scanning.
- Extended browser smoke to assert active request target id/type/kind/status, required ask/stakes/due/hint fields, hidden target/text non-leakage, and horizontal overflow across desktop, restored, fresh-page, and mobile journeys.
- Added focused active-request unit tests, route tests for scheduling/resolution/provider-forged request rejection, browser-smoke helper tests, and updated world-tick event trimming expectations for the new event order.
- Used two read-only subagents for backend order/ownership and frontend/browser-smoke placement. Neither edited files or ran Git commands.

Verification:
- `node --check src/game/activeRequests.js`
- `node --check src/routes/game.js`
- `node --check src/routes/exam.js`
- `node --check public/app.js`
- `node --check scripts/browserSmoke.js`
- `node --check test/activeNpcRequests.test.js`
- `node --check test/gameTurnRelationships.test.js`
- `node --check test/browserSmokeScript.test.js`
- `node --check test/gameTurnTick.test.js`
- Focused `node --test` runs for active requests, relationship turns, browser-smoke helpers, and world-tick ordering passed.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s32-3` passed with 5 screenshots checked.
- `npm test` passed with 111 tests.
- `git diff --check`

Risk/leftover:
- S32.3 intentionally schedules only one minimal active request at a time. It is not yet a long-horizon event queue, faction campaign system, or multi-request inbox.
- Active requests currently draw from visible relationship entries and use deterministic server-owned outcomes; richer scheduling criteria can build on this in S33.

Next:
- S33.1: define the long-term event scheduler contract for seasonal, disaster, border, court, and local case chains.

Tool: Codex

Step: S32.2

Commit: cefde6a

Completed:
- Rendered the `relationshipView` contract in the scholar/role panel as a player-facing `#relationship-panel`, combining visible contacts and factions without reading the raw ledger as the normal UI path.
- Added stable DOM selectors and data attributes for visible contact id/type plus numeric relationship and resentment values, while keeping hidden contacts/factions out of rendered text.
- Localized the default contact names, stance, network source, and recent intent text into compact Chinese UI phrases so raw provider/mock enum strings do not dominate the panel.
- Added responsive CSS for the relationship grid and tightened the game/action layout so the expanded panel stays visible on desktop and mobile.
- Extended `scripts/browserSmoke.js` to assert relationship panel contents, hidden-entry leaks, relationship updates after a Mock scholar turn, direct official-start relationship visibility, and relationship-panel horizontal overflow.
- Added browser-smoke helper tests for expected/missing/hidden relationship entries and relationship-panel overflow.
- Used two read-only subagents for frontend placement and browser-smoke acceptance inspection. Neither edited files or ran Git commands.

Verification:
- `node --check public/app.js`
- `node --check scripts/browserSmoke.js`
- `node --check test/browserSmokeScript.test.js`
- `node --test test/browserSmokeScript.test.js`
- `node --test test/relationshipLedger.test.js test/gameTurnRelationships.test.js test/mockRelationshipReactions.test.js`
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s32-2`
- `npm test` passed with 102 tests.
- `git diff --check`

Risk/leftover:
- The browser panel now consumes `relationshipView`; the raw ledger is still present in `worldState` route payloads for compatibility and developer inspection.
- Browser smoke covers representative scholar, restored, mobile, and direct-official starts, but a complete four-exam browser playthrough remains planned for S38.1.

Next:
- S32.3: add the first server-scheduled active NPC/faction request or pressure loop using the relationship ledger as input.

Tool: Codex

Step: S32.1

Commit: ed83e9c

Completed:
- Added `buildRelationshipInspectionView(worldState)` in `src/game/relationships.js` as the player-facing relationship/contact inspection contract.
- The view exposes only visible contacts and factions, adds relationship/resentment bands, keeps `role`, `networkSource`, `recentIntent`, and `lastUpdatedTurn`, and omits hidden ids, names, counts, placeholders, and hidden-entry notes.
- Added top-level `relationshipView` payloads to game start, game state reads, game turns, exam question payloads, and exam submit payloads so S32.2 UI can render the view without reading the raw ledger directly.
- Expanded relationship tests for visible-only views, role visibility, hidden-note filtering, and route-level turn payloads.
- Used two read-only subagents: one inspected the S32.1 ledger/view contract and one inspected S32.2 UI/browser-smoke placement. Neither edited files or ran Git commands.

Verification:
- `node --check src/game/relationships.js`
- `node --check src/routes/game.js`
- `node --check src/routes/exam.js`
- `node --check test/relationshipLedger.test.js`
- `node --test test/relationshipLedger.test.js test/gameTurnRelationships.test.js`
- Focused `node --test test/relationshipLedger.test.js test/gameTurnRelationships.test.js test/examTravel.test.js` passed with 16 tests.
- `npm test` passed with 100 tests.
- `git diff --check`

Risk/leftover:
- The raw `worldState.relationshipLedger` remains in current route payloads for compatibility with existing tests and developer inspection. Player-facing browser code should consume `relationshipView`; future response redaction can be considered after S32 UI stabilizes.
- S32.1 does not render the relationship panel yet.

Next:
- S32.2: implement the relationship/contact UI inside the existing role panel and extend desktop/mobile browser smoke around `relationshipView`.

Tool: Codex

Step: S31.3

Commit: 9cdbf91

Completed:
- Added an explicit start-role enum in `src/game/initialState.js` and normalized missing/blank roles to `scholar`.
- Rejected unsupported non-empty roles before session creation so `/api/game/start` returns 400 instead of persisting arbitrary `player.role` values.
- Decided direct `official` starts are supported because initial state, Mock role loops, and frontend role-panel rendering already cover 入仕官员 gameplay.
- Added the `official` option to the browser start form.
- Extended `scripts/browserSmoke.js` to fail if any supported role option is missing and to verify a direct official browser start/readback in an isolated context.
- Added focused start-role API/unit tests and browser smoke helper coverage.
- Used a read-only subagent inspection for S31.3 role-flow verification; the subagent did not edit files or run Git commands.

Verification:
- `node --check src/game/initialState.js`
- `node --check scripts/browserSmoke.js`
- `node --check test/gameStartRole.test.js`
- `node --check test/browserSmokeScript.test.js`
- Focused `node --test test/gameStartRole.test.js test/browserSmokeScript.test.js test/officialRole.test.js` passed with 19 tests.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s31-3` passed with direct official-start coverage and 5 screenshots checked.
- `npm test` passed with 97 tests.
- `git diff --check`

Risk/leftover:
- Direct `official` browser start is now covered, but broader role-loop browser journeys for all roles remain planned for S38.1.
- S31.3 does not change the required scholar -> official progression path; it only exposes the already-supported official loop as a direct start option.

Next:
- S32.1: define the relationship/contact inspection view contract.

Tool: Codex

Step: S31.2

Commit: f470f78

Completed:
- Removed ordinary provider access to `activeExam`, `characters`, `eventHistory`, `player.examRank`, and `player.examHistory` from the turn schema and prompt allowed-key guidance.
- Split `src/game/stateRules.js` into provider-facing and server-owned patch key sets; default `applyStatePatch()` now ignores server-owned fields unless `allowServerOwnedPatchKeys: true` is passed.
- Updated game turn world tick integration to opt into server-owned `year/month` patching without adding a second turn count.
- Converted AI eval ordinary-turn authority fixtures from schema-valid policy risks into schema rejection fixtures.
- Added state-rule, schema, route-level, AI eval, and world tick tests for the new boundary.
- Reviewed and integrated the scoped test-only subagent patch; the subagent did not run Git commands.

Verification:
- `node --check src/game/stateRules.js`
- `node --check src/ai/schemas.js`
- `node --check src/routes/game.js`
- `node --check src/ai/prompts.js`
- `node --check test/stateRules.test.js`
- `node --check test/aiSchemas.test.js`
- `node --check test/aiEvalFixtures.test.js`
- `node --check test/gameTurnRelationships.test.js`
- Focused `node --test` coverage for state rules, AI schemas, AI eval fixtures, game turn relationships, and world tick passed with 23 tests.
- `npm run eval:ai` passed with 6 tests.
- `npm test` passed with 92 tests.

Risk/leftover:
- No runtime blockers found in focused verification.
- S31.2 intentionally does not decide direct start roles; S31.3 remains responsible for `/api/game/start` role validation and browser exposure of `official`.

Next:
- S31.3: validate `/api/game/start` role input and document whether direct `official` starts are allowed.

Tool: Codex

Step: S31.1

Commit: 0d52d46

Completed:
- Added an `.app-shell--game-active` layout mode so the hidden start panel no longer leaves the desktop grid locked to the old 390px first column.
- Kept `.game-panel` shrink-safe with `min-width: 0` while allowing it to occupy the available desktop app width after entering or restoring a game.
- Extended `scripts/browserSmoke.js` with desktop game-panel width/share assertions and role-panel horizontal clipping checks.
- Added focused browser smoke helper tests for the narrow desktop panel regression and mobile compatibility.
- Reviewed the scoped subagent patch before integration; the subagent did not run Git commands.

Verification:
- `node --check public/app.js`
- `node --check scripts/browserSmoke.js`
- `node --check test/browserSmokeScript.test.js`
- `node --test test/browserSmokeScript.test.js` passed with 10 tests.
- `npm run smoke:browser -- --screenshots artifacts/browser-smoke/s31-1` passed with 5 screenshots checked.
- `npm test` passed with 89 tests.
- `git diff --check`

Risk/leftover:
- No runtime blockers remain for S31.1.
- S31.1 covers the current desktop width/cropping regression; broader full-journey browser coverage remains planned for S38.1.

Next:
- S31.2: tighten ordinary turn provider patch boundaries for server-owned fields.

Tool: Codex

Step: S30.1

Commit: current documentation commit

Completed:
- Added `docs/PHASE_TWO_ROADMAP_ARCHIVE.md` as the frozen second-phase roadmap archive.
- Reset this file as the third-phase active roadmap and progress ledger.
- Preserved the mandatory workflow, Git discipline, Mock-default requirement, provider-optional requirement, server-owned state/rules boundary, and subagent delegation rules.
- Seeded third-phase work from the phase-two acceptance candidates and the latest implementation assessment: layout hardening, provider patch boundaries, role validation, relationship UI, active NPCs, long-horizon events, official outcomes, exam calendar, role/world coupling, keyed provider acceptance, broader browser journeys, and storage migration planning.

Verification:
- `git diff --check`
- UTF-8 readability check for `docs/DEVELOPMENT_STEPS.md`, `docs/PHASE_TWO_ROADMAP_ARCHIVE.md`, README, product brief, and shared context through Node.js.
- `npm test` passed with 87 tests.

Risk/leftover:
- This step is planning-only and does not change runtime behavior.
- S31.1 should be the first implementation step because the desktop game layout can currently render too narrow after the start panel is hidden.
- S31.2 should follow soon after because ordinary provider patches still allow some fields that should be server-owned in ordinary turns.

Next:
- S31.1: repair desktop game layout and expand browser smoke layout assertions.
