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
6. 用 Git 提交本次 coherent change。

子代理使用规则不变：

- 用户已明确授权 Codex 和 Claude Code 在本仓库使用子代理；除非后续用户指令收窄或撤销该授权，否则视为长期项目上下文。
- 推荐委派粒度是独立小步骤或文件职责清晰的子步骤，例如一个子代理评估关系 UI 合约，另一个子代理评估浏览器 smoke 覆盖。
- 主代理仍负责拆分方式、审查所有 diff、补齐跨模块文档、运行最终验证、更新本台账与共享上下文，并做唯一 coherent Git 提交。
- 每个实现型子代理提示词都必须禁止 `git add`、`git commit`、`git push` 和创建 PR，必须要求报告改动文件与 focused verification 命令。

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
| S32.2 | DONE | 实现关系/联系人 UI 与基础浏览器验收，显示人物/派系关系、怨望、立场、近期意图和可见性 | 2026-05-06 | Codex + subagents | current S32.2 commit |
| S32.3 | TODO | 增加主动 NPC/派系请托、施压、求援、背书或索取回报的最小事件循环 |  |  |  |
| S33.1 | TODO | 定义长期事件调度器契约：季节、灾荒、边报、朝争、地方案件链和跨月后果 |  |  |  |
| S33.2 | TODO | 实现服务器拥有的长期事件队列，并把事件结果接入 world tick、eventHistory 和可见叙事 |  |  |  |
| S33.3 | TODO | 为长期事件增加自动化测试，覆盖触发条件、裁剪、状态边界和完整书生路径不被破坏 |  |  |  |
| S34.1 | TODO | 定义官场结果引擎：实授、转任、升迁、外放、降调、弹劾成案和罢黜 |  |  |  |
| S34.2 | TODO | 实现入仕官员年度/阶段性结算，让 `promotionProspect`、`impeachmentRisk` 等指标触发真实职业结果 |  |  |  |
| S34.3 | TODO | 增加官场结果 UI 与测试，确认晋升/降调/弹劾不会绕过服务器裁决 |  |  |  |
| S35.1 | TODO | 定义科举日历化契约：考期窗口、备考月程、路程耗时、错过考期、盘费筹措和师长推荐 |  |  |  |
| S35.2 | TODO | 让同场虚拟考生跨考试持久存在，成为同年、竞争者或后续官场人脉 |  |  |  |
| S35.3 | TODO | 将科举日历与持久竞争者接入前端档案和完整 scholar -> official 回归测试 |  |  |  |
| S36.1 | TODO | 定义角色与世界 tick 深耦合规则：水利影响粮储，战役影响边患/军费，朝廷任免影响地方执行力 |  |  |  |
| S36.2 | TODO | 深化地方官、将领、皇帝和大臣行动对长期世界状态和关系记忆的复合影响 |  |  |  |
| S36.3 | TODO | 为多身份长期联动增加 Mock 平衡测试和浏览器代表旅程 |  |  |  |
| S37.1 | TODO | 制定 keyed real-provider 长回合验收方案，覆盖 OpenAI、DeepSeek、Anthropic/Claude 的历史语气、越权和状态一致性 |  |  |  |
| S37.2 | TODO | 增加可选真实 provider 长回合 smoke/eval 脚本，保持 no-key 环境成功跳过 |  |  |  |
| S38.1 | TODO | 扩展浏览器验收到完整四级科举通关、作弊样例、各身份一回合、桌面/移动视觉回归 |  |  |  |
| S38.2 | TODO | 制定存档迁移规划：session schema 版本、原子写入、并发保护、存档列表和未来数据库迁移路径 |  |  |  |

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
- S38.2：制定存档迁移规划，包含 session schema 版本、原子写入、并发保护、存档列表、清理策略和未来数据库迁移路径。

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

Step: S32.2

Commit: current S32.2 commit

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
