# 《千秋》数据库专项开发路线图与进度台账

本文件是 Codex 与 Claude Code 共同维护的当前活动路线图与进度台账。第四阶段已经完成并归档；S48 时间专项也已归档到 [docs/TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。自 S49 起，当前重点切换为本地动态世界数据库专项：先规划和隔离持久化边界，再逐步承载国家/邻国、城市、NPC、官职、事件和 AI proposal 审计等大量动态数据。当前范围只考虑本地 SQLite / 本地文件持久化增强，不规划远程存档、账号体系、多人同步或云端数据库。

- 第一阶段路线图已归档到 [docs/PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收记录见 [docs/PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段路线图已归档到 [docs/PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收记录见 [docs/PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段路线图已归档到 [docs/PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段路线图已归档到 [docs/PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度仍可在 [docs/FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md) 追溯。
- S48 时间专项已归档到 [docs/TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)；当前活动步骤不再维护 S48 细节，只继承其年月旬和 scene-local time 契约。

## 1. 开发规范继承

<!-- GOVERNANCE_REQUIRED_START -->

开发规范不变。继续保持：

- 稳定开发治理锚点见 [docs/DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md)；重写路线图或交接文档时不得删弱其中的必守规则，并运行 `npm run check:docs-governance`。
- `npm install && npm start` 可运行，默认打开 `http://localhost:3000`。
- Mock AI 默认完整可玩，真实 provider 只作为可选配置。
- 完整书生路径不得破坏：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- AI 只能生成叙事、题目、评分建议、关系建议和受限 `statePatch`；服务器继续拥有时间推进、状态边界、科举晋级、作弊处罚、官场任免、长期事件、世界实体、世界议程、数据库写入和持久化裁决。
- 项目内协作文档、路线图、交接记录、领域注释和玩家可见文案优先使用中文。
- 每个 coherent change 必须更新 `docs/SHARED_CONTEXT.md`，必要时同步 README、产品 brief、架构/契约文档，并用 Git 提交。
- 关键决策不能只留在聊天记录里；会影响后续 Codex 或 Claude Code 接手的内容必须写入仓库文档。

### 子代理使用规则

- 用户已明确授权 Codex 和 Claude Code 在本仓库使用子代理；除非后续用户指令收窄或撤销，否则视为长期项目上下文。
- 对路线图阶段或步骤簇，应在可拆分为独立小步骤时主动使用子代理；不要把“较大步骤”理解为只能交给一个超大实现任务，优先按 `Sxx.y` 这类可审查粒度拆分。
- 子代理实施任务必须有清晰职责边界和文件/模块归属；多个实施子代理并行时，写入范围应尽量互不重叠。
- 每个实施子代理提示词必须明确：不得运行 `git add`、`git commit`、`git push` 或创建 PR；不得回滚他人改动；最终报告列出改动文件和验证命令。
- 子代理只产出受限 patch 与聚焦验证报告；主代理负责整合、最终验证、共享文档同步和唯一的连贯提交。
- 包含代码、测试、运行时行为、API/schema、提示词或验证工具变化的提交，暂存和提交前必须委派至少一个只读子代理审查最终 diff 与验证证据。主代理需向复审子代理提供 diff 与验证摘要；复审子代理只报告风险、遗漏、测试缺口和建议，不得编辑文件，也不得运行 Git 命令。
- 低风险纯文档改动可跳过子代理复审，但必须在 `docs/SHARED_CONTEXT.md` 或最终回复说明。
- 如果子代理意外创建提交，主代理必须把它视为未复审工作：检查 diff 和测试，在交接记录中说明事故，并避免继续让该子代理提交。

每次开发开始时：

1. 读取 `AGENTS.md` 或 `CLAUDE.md`。
2. 读取 `docs/SHARED_CONTEXT.md`。
3. 读取 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`。
4. 读取本文件，选择第一个 `TODO` 或 `IN_PROGRESS` 的小步骤。
5. 执行 `git status --short`，确认是否有别人留下的改动。

每次完成一个小步骤时：

1. 把对应步骤状态改为 `DONE`，填写完成日期、工具和提交说明或哈希。
2. 在“进度记录”追加一条记录，写清完成内容、验证命令、风险/遗留和下一步。
3. 更新 `docs/SHARED_CONTEXT.md`。
4. 如果改动影响产品范围、架构、API、状态字段、提示词、设置或验收标准，同步更新 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`、README 或相关契约文档。
5. 确认新增文档、交接记录、路线图条目、领域逻辑注释和玩家可见文案优先使用中文；确需保留英文时应是代码/API/协议/第三方术语、命令输出或外部工具清晰度所需。
6. 运行相关验证命令。
7. 对非低风险纯文档改动执行只读子代理提交前审查。
8. 用 Git 提交本次 coherent change。

状态值：

- `TODO`：未开始。
- `IN_PROGRESS`：正在做，接手者应先检查工作树和上下文。
- `DONE`：已完成、已验证、已提交或随当前文档提交完成。
- `BLOCKED`：被外部条件阻塞，必须写明原因和解除条件。

## 2. 依赖、插件与开源参考策略

数据库专项继续继承 S46.1 的依赖、插件与开源参考治理。后续新增或升级 `package.json` 依赖、开发工具、外部服务 SDK、Codex/Claude 插件工作流或开源参考时，必须先按 [依赖、插件与开源参考治理](DEPENDENCY_PLUGIN_GOVERNANCE.md) 记录和验证。

- 依赖或插件必须明显降低复杂度、提升可靠性、改善安全性、改善浏览器体验或提供成熟标准能力。
- 记录必须说明用途、运行入口、测试覆盖、替代方案、许可证、维护状态、安全/隐私影响、Mock/no-key 影响、文档落点和回滚策略。
- 优先选择维护活跃、文档清晰、常用、许可证友好的库；参考开源项目时记录借鉴点，不复制不明来源的大段实现。
- 前端继续保持无构建流程，除非本路线图或后续明确步骤批准升级。
- 核心游戏规则、时间推进、科举晋级、状态边界、作弊惩罚、官职任免和持久化不能完全交给模型或黑箱库。
- 加依赖后必须验证 `npm install`、`npm start` 和对应测试。
- 涉及 AI 可读摘要、server-owned ledger、浏览器面板或 provider 验收时，同步检查 [docs/AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md) 是否需要更新。

<!-- GOVERNANCE_REQUIRED_END -->

## 3. 数据库专项总目标

数据库专项的目标不是立刻把本地 JSON 存档推倒重来，而是给《千秋》的长期世界模拟建立可扩展、可审计、可检索的动态数据底座。

核心原则：

- **本地数据库范围**：数据库专项只规划本地 SQLite 与本机导入导出；远程存档、账号体系、多人世界、云同步和托管数据库不进入当前路线图。
- **JSON 默认仍可玩**：在 adapter 与 SQLite 原型成熟前，`data/sessions/*.json` 仍是默认存储路径，`npm install && npm start` 与 Mock 模式不依赖数据库。
- **先边界，后迁移**：先抽 storage adapter 和 contract tests，再做可选 SQLite session row + JSON `world_state`；最后才按需求拆国家、城市、NPC、官职、关系和事件表。
- **混合模型**：保留整份 `worldState` snapshot 便于读档和调试，同时新增 append-only event log 与 AI proposal audit，支持回放、检索、复盘和调错。
- **AI 不写库**：AI 不能执行 SQL、不能直接写业务表、不能绕过服务器事务。AI 只能提交 schema-valid proposal，由服务器校验、裁决、写库并记录接受/拒绝原因。
- **可见性优先**：prompt 和浏览器只读取服务器 projection，不读 raw table；隐藏信息、未公开关系、暗线、内库数值和开发诊断不得直接暴露。
- **继承时间契约**：数据库记录必须支持 S48 的年月旬、月末结算、`worldTick.cadence` 和 scene-local time，尤其是事件日志和官职任所履历。

详见 [docs/DYNAMIC_WORLD_DATABASE_PLAN.md](DYNAMIC_WORLD_DATABASE_PLAN.md)。

## 4. 步骤总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S49.1 | DONE | 形成动态世界数据库总体规划：架构边界、数据域、AI proposal、SQLite 迁移阶段 | 2026-05-07 | Codex + read-only subagent | `e3808df`、`990f7d3` |
| S49.2 | DONE | 抽象 storage adapter 接口，保持 JSON 为默认实现，补 adapter contract tests | 2026-05-07 | Codex + read-only subagents | `2e15e13` |
| S49.3 | DONE | 本地 SQLite 原型：一行一 session，保留 JSON `world_state`，以可选 env 开启，不做远程/账号/多人 | 2026-05-07 | Codex + read-only subagents | `22217e0` |
| S49.4 | DONE | 事件日志与 AI proposal 审计：记录模型建议、服务器接受/拒绝和最终应用事件 | 2026-05-07 | Codex + read-only subagents | `092de20` |
| S50.1 | DONE | 静态天下与邻国种子契约：国家、城市、路线、边境、官署辖区和初始可见性 | 2026-05-07 | Codex + read-only subagents | `45f9b65` |
| S50.2 | DONE | per-session 国家/城市实例化与 prompt projection，先不替代现有 worldState 指标 | 2026-05-07 | Codex + read-only subagents | `b0ced01` |
| S51.1 | DONE | NPC、家族、资产、田产、关系和可见性 schema 契约 | 2026-05-07 | Codex + read-only subagents | `418077b` |
| S51.2 | DONE | 桥接当前 `characters`、`relationshipLedger`、active requests 与 NPC/关系表 | 2026-05-07 | Codex + read-only subagents | `8ed984a` |
| S52.1 | DONE | 官职、官署、任所、城市辖区、考成和调任记录的数据库契约 | 2026-05-07 | Codex + read-only subagents | `4ce6d0e` |
| S52.2 | DONE | 地方官/入仕官员任所与城市数据联动，保持服务器任免裁决 | 2026-05-07 | Codex + read-only subagents | `4599869` |
| S53.1 | DONE | 检索式 prompt context assembler：按角色视野读取国家、城市、NPC、官职、事件摘要 | 2026-05-07 | Codex + read-only subagents | `1268c04` |
| S53.2 | DONE | 浏览器信息面板规划：天下格局、任所地理、人物谱牒、官职簿、事件档案 | 2026-05-07 | Codex + read-only subagents | `b89882a` |
| S53.3 | DONE | 浏览器信息面板前端接线基础：缓存 S50-S52 view 并建立 tab/面板壳 | 2026-05-07 | Codex + read-only subagents | `89e73c2` |
| S53.4 | TODO | 天下格局与任所地理面板：地理、任所、辖区、路线和压力摘要 |  |  |  |
| S53.5 | TODO | 人物谱牒与官职簿面板：人物/家产关系、官署官职、任命考成迁转 |  |  |  |
| S53.6 | TODO | 事件档案安全 projection 与浏览器面板 |  |  |  |

## 5. 实施规划

### S49.1：动态世界数据库规划

状态：DONE。

范围：

- 新增 `docs/DYNAMIC_WORLD_DATABASE_PLAN.md`，综合本会话对“动态数据库”的需求：国家/邻国、财政、军事、国威、外交、NPC、玩家、官职、城市、事件和 AI 修改建议。
- 明确可行性：中长期可行且值得做，但短期不应一次性替换 JSON。
- 明确迁移路线：storage adapter -> SQLite session row -> event log / AI proposal audit -> 业务表拆分 -> prompt/UI projection。
- README、架构、产品 brief、路线图和 shared context 已同步规划入口。

验证：

- `npm run check:docs-governance`
- `git diff --check`

### S49.2：Storage Adapter

状态：DONE。

目标：

- 定义 `sessionStore` 的 adapter 边界，让路由不直接依赖 JSON 文件细节。
- JSON adapter 作为默认实现，行为与现有 `src/storage/sessionStore.js` 保持一致。
- 增加 contract tests：创建、读取、保存、revision 冲突、legacy 归一化、metadata 脱敏、损坏文件跳过和并发写入保护。
- 不引入 SQLite 依赖，不改变 route payload，不改变存档格式。

完成：

- `src/storage/sessionStore.js` 现在是路由面对的 storage facade，继续导出 `readSession()`、`writeSession()`、`mutateSession()`、`listSessions()`、`readSessionRecord()`、`deleteSession()`、`cleanupSessionTempFiles()` 等既有 API。
- 原 JSON 文件、envelope、legacy 迁移、atomic temp rename、lock、revision、save-list 和 temp cleanup 实现迁入 `src/storage/jsonSessionAdapter.js`，并由默认 adapter 继续提供。
- 新增 `test/sessionStoreAdapterContract.test.js`，以 adapter contract 口径覆盖 route-compatible read/write、legacy raw save 迁移、存档簿脱敏与损坏文件跳过、expectedRevision 冲突、并发 `mutateSession`、`skipWrite` 和 `errorAfterWrite` 语义。
- README、架构文档、产品 brief 和 session storage migration plan 已同步：S49.2 只完成 adapter 边界，SQLite 仍是 S49.3 的可选本地原型，不进入远程/账号/多人范围。

验收：

- Mock 开局、读档、普通回合、考试和存档簿行为不变。
- `GET /api/game/saves` 仍只返回脱敏 metadata。
- 完整书生路径不受影响。

验证：

- `node --check src\storage\jsonSessionAdapter.js`
- `node --check src\storage\sessionStore.js`
- `node --check test\sessionStoreAdapterContract.test.js`
- `node --test test\sessionStoreAdapterContract.test.js test\sessionStore.test.js test\gameSavesRoute.test.js`
- `node --test test\gameTurnTick.test.js test\streamingTurnRoute.test.js test\examSceneTime.test.js test\examProgressRoute.test.js test\gameSavesRoute.test.js test\sessionStoreAdapterContract.test.js test\sessionStore.test.js`
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，299 项通过
- `git diff --check`

### S49.3：SQLite Session Row 原型

状态：DONE。

目标：

- 评估 SQLite 实现方式，优先不新增 npm 原生依赖；若必须新增第三方依赖，再按 `docs/DEPENDENCY_PLUGIN_GOVERNANCE.md` 完整记录。
- 新增可选 adapter：`STORAGE_ADAPTER=sqlite`；默认仍为 JSON。
- 最小表只保存 `world_sessions`：`session_id`、`revision`、metadata、JSON `world_state`、created/updated 时间。
- 提供从 JSON 到 SQLite 的开发脚本或导入接口，但不自动删除 JSON。
- 不新增远程存档、账号、多人同步、云备份或托管数据库配置。

完成：

- 新增 `src/storage/sessionRecord.js`，把 storage schema version、安全 session id、metadata 重建、legacy/raw 归一化、save-list 脱敏和公开 skipped reason 抽成 JSON/SQLite 共用 helper。
- 新增 `src/storage/sqliteSessionAdapter.js`，使用 Node.js 标准库 `node:sqlite` 创建本地 `world_sessions` 表，一行一 session，保留 JSON `world_state_json`，并用 SQLite transaction + revision 检查复用 adapter contract。
- `src/storage/sessionStore.js` 支持 `STORAGE_ADAPTER=json|sqlite`；默认仍为 JSON，SQLite adapter 懒加载，旧 `.env` 和默认 `npm start` 不需要数据库。
- `.env.example`、`.gitignore` 和 `src/config/env.js` 增加 `STORAGE_ADAPTER` / `SQLITE_DATABASE_PATH` 说明与本地 SQLite 文件忽略规则。
- 新增 `scripts/importJsonSessionsToSqlite.js` 与 `npm run storage:import:sqlite`，可从默认 JSON 存档簿导入 SQLite；默认跳过已存在 row，不删除 JSON 原档。
- `test/sessionStoreAdapterContract.test.js` 重构为 JSON/SQLite 同跑的 adapter contract；JSON 独有的 raw legacy 和坏 JSON 跳过仍保留专项断言。
- JSON adapter 的 atomic rename 增加短暂 `EPERM`/`EBUSY` 重试，降低 Windows 并行测试或本机索引器短暂占用导致的误报，同时保留同目录 temp rename 协议。
- README、架构文档、产品 brief、session storage migration plan 和动态数据库规划已同步 S49.3 的可选本地 SQLite 边界。

依赖/插件记录：

- 名称：Node.js `node:sqlite`
- 类型：Node.js 标准库，不写入 `package.json`
- 版本或范围：本地验证运行时为 Node `v24.13.1`；官方 Node 24 文档列出 `DatabaseSync`
- 是否使用 `latest` 及理由：不适用
- 引入步骤：S49.3
- 负责人/工具：Codex
- 用途：本地 SQLite session row adapter，一行一 session，保留 JSON `world_state`
- 替代的手写逻辑或人工流程：避免新增第三方 SQLite 原生包、postinstall 或 Windows 编译链
- 影响范围：server / tests / storage / docs / tooling
- 许可证：随 Node.js 运行时提供；本仓库未复制第三方 SQLite npm 包
- 维护状态：Node 官方文档提供 `node:sqlite`，当前仍需注意运行时版本差异；adapter 在缺失时只影响显式 SQLite 模式
- 安全与隐私：无网络、密钥、遥测、postinstall 或 npm 二进制；数据库路径不进入 prompt、浏览器或 save-list payload
- 备选方案：`better-sqlite3`、`sqlite3` 或继续 JSON adapter；本轮因标准库可用而不新增依赖
- Mock/no-key 影响：无；默认 JSON + Mock 仍可玩
- 安装与运行影响：`npm install` 不变；显式 `STORAGE_ADAPTER=sqlite` 需要运行时提供 `node:sqlite`
- 验证命令：见本节验证列表
- 回滚策略：删除 `sqliteSessionAdapter.js`、导入脚本、env 文档和 `STORAGE_ADAPTER=sqlite` 分支；默认 JSON adapter 可直接继续工作
- 文档落点：README、架构文档、产品 brief、session storage migration plan、dynamic database plan、shared context、本台账
- 决策：接受标准库 SQLite 原型，不新增第三方依赖
- 后续复查：S49.4 若写事件日志/AI proposal 表，需要继续检查 AI 权限矩阵和 SQLite 事务边界

验收：

- JSON 与 SQLite adapter 跑同一批 contract tests。
- SQLite 关闭时项目仍可用 `npm start` 启动并默认使用 JSON。
- 路由响应和前端行为保持兼容。

验证：

- `node --check src\storage\sessionRecord.js`
- `node --check src\storage\jsonSessionAdapter.js`
- `node --check src\storage\sqliteSessionAdapter.js`
- `node --check src\storage\sessionStore.js`
- `node --check scripts\importJsonSessionsToSqlite.js`
- `node --check test\sessionStoreAdapterContract.test.js`
- `node --test test\sessionStoreAdapterContract.test.js`，20 项通过
- `node --test test\sessionStore.test.js test\gameSavesRoute.test.js`，19 项通过
- `$env:STORAGE_ADAPTER='sqlite'; $env:SQLITE_DATABASE_PATH='data/test-route-storage.sqlite'; node --test test\gameSavesRoute.test.js`，1 项通过
- `node --test test\gameTurnRoleWorldCoupling.test.js test\gameTurnTick.test.js test\sessionStore.test.js test\sessionStoreAdapterContract.test.js`，49 项通过
- `node --test test\gameTurnTick.test.js test\streamingTurnRoute.test.js test\examSceneTime.test.js test\examProgressRoute.test.js test\gameSavesRoute.test.js test\sessionStoreAdapterContract.test.js test\sessionStore.test.js`，55 项通过
- `$env:STORAGE_ADAPTER='sqlite'; $env:SQLITE_DATABASE_PATH='data/test-route-turn-storage.sqlite'; node --test test\gameTurnTick.test.js`，8 项通过
- `node scripts\importJsonSessionsToSqlite.js --db data\test-import.sqlite`，临时库导入 47 个当前本地 JSON 存档，0 skipped，随后删除临时库
- `$env:AI_PROVIDER='mock'; $env:STORAGE_ADAPTER='json'; node -e ".../api/health..."`，返回 `{"ok":true,"aiProvider":"mock"}`
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，311 项通过
- `git diff --check`

### S49.4：事件日志与 AI Proposal 审计

状态：DONE。实现/文档提交：`092de20 feat: add local audit logs for AI proposals`；本哈希回填为低风险纯文档 follow-up。

目标：

- 增加 append-only `event_log`，记录关键状态变化、来源模块、时间戳、年月旬、scene cadence、可见性和 session revision。
- 增加 `ai_change_proposals`，保存模型提出的结构化建议、服务器审查结果、服务器接受/拒绝原因和最终应用事件 id。
- 普通 provider 仍只返回受限 JSON；所有 proposal 都由服务器模块转换成可写事务。
- 日志服务于调试、回放、prompt 检索和未来“事件档案” UI，不替代当前 state snapshot。

完成：

- 新增 `src/storage/sessionAudit.js`，统一审计记录 schema、UUID、安全 session id、年月旬/revision 默认值、秘密和路径脱敏、隐藏/敏感 key 截断。
- JSON adapter 新增本地 sidecar：`data/audit/{sessionId}.event-log.jsonl` 与 `data/audit/{sessionId}.ai-proposals.jsonl`，并通过 `.gitignore` 忽略。
- SQLite adapter 新增本地 `event_log` 与 `ai_change_proposals` 表；`writeSession()` / `mutateSession()` 可在同一 adapter 语义下写 session snapshot 和审计记录。JSON sidecar 是诊断性尽力追加，追加失败不让已提交 session 变成 route failure；SQLite 模式保持 session row 与审计表同事务写入。
- `sessionStore` adapter contract 新增 `appendAuditEvent()`、`appendAiProposal()`、`listAuditEvents()`、`listAiProposals()`，JSON/SQLite 同跑 contract tests。
- 新增 `src/game/audit.js`，把开局、普通回合、考试取题、考试局部推进、交卷评分转成脱敏审计摘要；普通回合会记录 provider 提案、服务器接受的 state delta、关系/考试触发接受数、拒绝原因和应用事件 id。
- `src/routes/game.js` 与 `src/routes/exam.js` 通过 `mutateSession()` context 排队审计记录，不直接打开 JSON 文件或执行 SQL。成功流式回合会记录审计；已发可见叙事后失败的流式调用仍不写状态也不写审计；`context.skipWrite` 会丢弃排队审计，保持“本次不持久化”的旧语义。
- 新增 `test/auditRoute.test.js`，覆盖 provider 越权 proposal 被审计但不写业务状态、流式失败不落审计、考试评分 proposal 被服务器榜单/晋级裁决覆盖。
- Hooke follow-up 只读复审确认 JSON sidecar 尽力追加与 `skipWrite` 审计丢弃修复已闭环，未发现新的 P0/P1/P2 blocker。

验收：

- provider 越权 proposal 不写入业务状态，只进入审计记录并标记拒绝。
- 日志不泄漏 API key、本地文件路径或隐藏信息到玩家视图。
- SQLite 保存失败不能留下 session/audit 半写状态；JSON sidecar 追加失败不让已成功保存的 session 请求失败或重试。

验证：

- `node --check src\storage\sessionAudit.js`
- `node --check src\storage\jsonSessionAdapter.js`
- `node --check src\storage\sqliteSessionAdapter.js`
- `node --check src\game\audit.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check test\auditRoute.test.js`
- `node --check test\sessionStoreAdapterContract.test.js`
- `node --test test\auditRoute.test.js`，3 项通过
- `node --test test\sessionStoreAdapterContract.test.js`，23 项通过
- `node --test test\streamingTurnRoute.test.js test\aiControlRedTeam.test.js`，9 项通过
- `node --test test\gameTurnTick.test.js test\gameTurnRelationships.test.js test\gameTurnExamTrigger.test.js`，16 项通过
- `node --test test\examTravel.test.js`，6 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，317 项通过
- `git diff --check`

风险/遗留：

- JSON 模式的审计 sidecar 与 session JSON 不是同一个物理文件；adapter 会在 session 写入成功后尽力追加审计，追加失败不会让 route 报错或让 SSE fallback 二次结算。SQLite 模式在本地 transaction 中写入表。后续若要强审计原子性或跨进程分析，应优先使用 SQLite 模式。
- 审计记录当前为本地开发/调试 API，不暴露给玩家路由；未来“事件档案” UI 必须只读取服务器 projection。
- S49.4 不拆国家、城市、NPC、官职、关系等业务表；下一步进入 S50 静态天下与邻国种子契约。

### S50.1：静态天下与邻国种子契约

状态：DONE。实现/文档提交：`45f9b65 feat: add world geography seed contract`；本哈希回填为低风险纯文档 follow-up。

目标：

- 新增静态地理 seed/catalog，先固定本国、邻国、区域、城市、路线、边境压力面和官署辖区，不直接改写每局动态状态。
- 给每类 seed 标注初始可见性：`public`、`role_visible`、`rumor`、`hidden`。
- 提供归一化、引用校验和隐藏过滤 view，供 S50.2 per-session 实例化和后续 prompt projection 复用。
- 不新增 SQLite 业务表，不替代现有 `worldState` 顶层指标，不把全量地理塞进 prompt，不新增浏览器面板。

当前实现：

- 新增 `src/game/worldGeographySeeds.js`，默认 seed `late-ming-north-china` 覆盖大明、关外满洲政权、漠南蒙古诸部、朝鲜、琉球；北京、南京、苏州、杭州、济南、开封、太原、大同、山海关、盛京、汉城、广州等城市；京杭漕运、黄河河防、边报驿路、山海关辽东通道、东南海道；辽东、漠南、朝鲜贡道、南海朝贡边境；以及吏部、户部、兵部、礼部、都察院、布政司、按察司、府州县辖区。
- 新增 `docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md`，明确 S50.1 只做静态 catalog 和初始可见性，S50.2 再做 per-session 国家/城市实例化与 prompt projection。
- 新增 `test/worldGeographySeeds.test.js`，覆盖默认 seed 范围、officialCatalog bureau 引用、hidden route/frontier 过滤、legacy normalization clamp、悬空引用校验和默认 seed 深拷贝。
- README、架构文档、产品 brief、AI 权限矩阵同步该契约和边界。

验证：

- `node --check src\game\worldGeographySeeds.js`
- `node --check test\worldGeographySeeds.test.js`
- `node --test test\worldGeographySeeds.test.js test\officialCatalog.test.js`，13 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，324 项通过
- `git diff --check`

风险/遗留：

- S50.1 不写 `worldState.worldGeography`；如果 S50.2 新增动态 ledger，必须补 schema/stateRules/prompt/route 测试来挡住 provider 伪造写入。
- `buildWorldGeographySeedView()` 当前不是 route view，只是后续 projection 起点；浏览器“天下格局/任所地理”属于 S53。

### S50.2：每局国家/城市实例化与 Prompt Projection

状态：DONE。实现/文档提交：`b0ced01 feat: instantiate world geography ledger`；本哈希回填为低风险纯文档 follow-up。

目标：

- 从 S50.1 静态 seed 实例化每局 `worldState.worldGeography`，覆盖国家、区域、城市、路线、边境压力面和官署辖区。
- 构造服务器过滤后的 `worldGeographyView`，供游戏/考试路由返回；隐藏行、`hiddenNotes` 和 hidden nested refs 不进入 view。
- 在 `compactWorldState()` 中加入 capped `worldGeography` prompt 摘要，避免把全量地理 seed 塞进模型。
- 明确 `worldGeography` 为 server-owned ledger：provider 不能通过 `statePatch` 写入。
- 先不新增浏览器地理面板，不拆 SQLite 国家/城市业务表，不替代既有顶层 `worldState` 指标。

当前实现：

- 新增 `src/game/worldGeography.js`，提供 `createInitialWorldGeographyState()`、`normalizeWorldGeographyState()`、`ensureWorldGeographyState()`、`buildWorldGeographyView()` 和 `summarizeWorldGeographyForPrompt()`。
- 新局在 `src/game/initialState.js` 写入 `worldState.worldGeography`；旧档在游戏/考试路由 ensure 时自动补账本。
- 地理账本从当前 `publicOrder`、`taxRate`、`grainReserve`、`borderThreat`、官场 `bureauId` 等顶层状态刷新轻量压力快照，但不成为新的财政、外交或战争裁决来源。
- `src/routes/game.js` 与 `src/routes/exam.js` 返回 `worldGeographyView`；SSE `state_preview` 也包含该 view。现有 payload 仍为开发兼容返回完整本地 `worldState`，后续浏览器面板必须读取 view 而不是 raw ledger。
- `src/ai/prompts.js` 把 capped `worldGeography` summary 放入所有 opening/turn/exam/grading prompt 输入；书生视角不暴露 `role_visible` 的朝贡/官署辖区行。
- `src/ai/promptPacks.js`、`src/game/stateRules.js`、`src/ai/schemas.js`、`src/ai/providers/remoteHelpers.js` 和 `scripts/providerLongRun.js` 的边界测试都覆盖 provider 伪造 `statePatch.worldGeography`。
- 新增 `test/worldGeography.test.js` 与 `test/gameTurnWorldGeography.test.js`，并扩展 prompt/schema/state/remote/provider/exam/red-team 测试。

验证：

- `node --check src\game\worldGeography.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check scripts\providerLongRun.js`
- `node --test test\worldGeographySeeds.test.js test\worldGeography.test.js test\gameTurnWorldGeography.test.js test\prompts.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js test\examTravel.test.js test\aiControlRedTeam.test.js`，68 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，338 项通过
- `git diff --check`
- 提交前只读复审 Bacon 未发现阻塞问题；非阻塞建议是后续可补“多次 ensure 后自定义地理扩展行仍保留并可见”的回归测试。

风险/遗留：

- 当前 `role_visible` 只做粗身份过滤：书生不可见，入仕官员/皇帝/大臣/将领/地方官可见。S53 检索式 context assembler 可以再细分到官署、任所、路引和人脉来源。
- 路由为保持现有开发兼容仍返回完整本地 `worldState`；浏览器和模型不得读取 raw `worldState.worldGeography` 作为展示/上下文来源。
- S50.2 不做浏览器地理面板、不拆 SQLite 业务表、不让 World Entities/Threads 直接读取地理账本；后续 S53/S52 可再联动。

### S51.1：NPC、家族、资产、田产、关系和可见性 Schema 契约

状态：DONE。实现/文档提交：`418077b feat: add world people schema contract`；提交前只读复审 Erdos 与 Boyle 未发现阻塞问题。

目标：

- 新增人物域 schema 契约，覆盖未来 `npcs`、`households`、`assets`、`estates`、`relationships` 与可见性枚举。
- 提供独立 normalization / view / prompt summary helper，先不写 `worldState.worldPeople`，不改变 route payload，不新增浏览器面板，不建 SQLite 业务表。
- 保留现有 `characters`、`relationshipLedger`、`activeNpcRequest` 与 `relationshipChanges` 语义，S51.2 再桥接。
- 确认普通 provider 不能通过 `statePatch` 新造 NPC、公开隐藏家产、直接写人物/田产/关系表。

当前实现：

- 新增 `src/game/worldPeopleSchemas.js`，提供 `normalizeWorldPeopleSchemaBundle()`、`buildWorldPeopleSchemaView()`、`summarizeWorldPeopleSchemaForPrompt()` 和 `canSeeWorldPeopleRow()`。
- 新增 `docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md`，定义 NPC、家族、资产、田产、关系字段、数值范围、`public/role_visible/relationship_visible/rumor/hidden` 可见性、hidden notes/intent 边界和 nested 引用裁剪。
- 新增 `test/worldPeopleSchemas.test.js`，覆盖归一化 clamp、隐藏行过滤、可见行 nested hidden refs 裁剪、书生/官员/关系可见性、prompt cap、assets prompt cap 和 provider `statePatch.worldPeople` 越权拒绝。
- README、架构文档、产品 brief、动态数据库规划和 AI 权限矩阵同步 S51.1 边界。

验证：

- `node --check src\game\worldPeopleSchemas.js`
- `node --check test\worldPeopleSchemas.test.js`
- `node --test test\worldPeopleSchemas.test.js test\relationshipLedger.test.js test\activeNpcRequests.test.js`，21 项通过
- `node --test test\stateRules.test.js test\aiSchemas.test.js test\prompts.test.js test\aiControlRedTeam.test.js`，29 项通过
- `node --test test\gameTurnRelationships.test.js test\examTravel.test.js test\sessionStore.test.js test\sessionStoreAdapterContract.test.js`，51 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，343 项通过
- `git diff --check`
- 提交前只读复审 Erdos 未发现 P0/P1/P2 blocker；其非阻塞建议是 prompt 摘要补 assets cap 和后续明确 view `generatedAtTurn` 语义。已补 assets cap 与 hidden asset prompt 测试。
- 提交前只读复审 Boyle 复查 assets prompt cap，未发现 hidden owner/hidden asset 泄漏路径。

风险/遗留：

- S51.1 只定义 standalone schema/helper；还没有 `worldState.worldPeople`、route view、browser 人物/家产面板或 SQLite 业务表。
- `relationshipChanges` 仍只支持既有可见 `character` / `faction` 目标；S51.2 若扩展到新人物/关系表，必须保留可见目标、delta、clamp 和服务器裁决。
- 后续桥接时尤其要防可见 NPC/家族引用 hidden patron、hidden estate、hidden asset 导致 id 泄漏。

### S51.2：当前人物与关系桥接

状态：DONE。实现/文档提交：`8ed984a feat: bridge world people ledger`；提交前只读复审 Singer 未发现阻塞问题。本哈希回填为低风险纯文档 follow-up。

目标：

- 新增 server-owned `worldState.worldPeople`，把当前 `characters`、`relationshipLedger` 和 active requests 桥接到 S51.1 的 NPC/关系 schema。
- 路由与 prompt 只读取服务器生成的可见投影：`worldPeopleView` 和 capped `worldPeople` prompt summary。
- 保持既有 `relationshipView`、`activeNpcRequestView`、provider `relationshipChanges` 和完整书生科举路径不变。
- 不新增浏览器人物谱牒/家产面板，不拆 SQLite NPC/关系业务表，不让 provider 写 `worldPeople`。

当前实现：

- 新增 `src/game/worldPeople.js`，提供 `createInitialWorldPeopleState()`、`ensureWorldPeopleState()`、`normalizeWorldPeopleState()`、`buildWorldPeopleView()` 和 `summarizeWorldPeopleForPrompt()`。
- 新局、普通回合、SSE 预览/最终 payload、读档、考试取题和交卷都接入 `worldPeopleView`；`src/ai/prompts.js` 的 `compactWorldState()` 追加可见 `worldPeople` 摘要。
- 当前桥接只存安全可见投影：legacy 隐藏人物、自定义 hidden rows、`hiddenNotes`、`hiddenIntent` 不进入 raw `worldState.worldPeople`，以免既有 route 仍返回完整本地 `worldState` 时泄漏未来私密人物库。
- 可见 NPC id 复用旧 `characters` id；玩家与 NPC / faction 的桥接关系使用 `rel-player-npc-*` 与 `rel-player-faction-*`；active request 只作为关系 `recentNotes` 中的可见请托提示，不接管其生命周期。
- `worldPeople` 加入 server-owned patch 边界；AI schema、stateRules、remote normalization、provider long-run、audit redaction、red-team 和 eval fixtures 都覆盖 provider 伪造人物表写入。
- README、架构文档、产品 brief、动态数据库规划、人物契约、AI 权限矩阵、真实 provider acceptance 和 shared context 同步 S51.2 边界。

验证：

- `node --check src\game\worldPeople.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check src\ai\prompts.js`
- `node --check scripts\providerLongRun.js`
- `node --check test\worldPeopleBridge.test.js`
- `node --test test\worldPeopleBridge.test.js test\worldPeopleSchemas.test.js test\gameTurnRelationships.test.js test\prompts.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js test\auditRoute.test.js test\aiControlRedTeam.test.js test\aiEvalFixtures.test.js`，72 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，348 项通过
- `git diff --check`
- 提交前只读复审 Singer 未发现 P0/P1/P2 blocker；确认 `worldPeople` 只保存可见 projection，route/exam 不替换旧关系/请托视图，provider/remote/long-run 不能写 `worldPeople`，audit 会脱敏相关 proposal。

风险/遗留：

- 当前 route 兼容层仍返回完整本地 `worldState`，所以 S51.2 有意不在 `worldState.worldPeople` 中保存隐藏私密人物/家产档案；未来若要建完整 NPC 私密库，应先拆玩家 API 或增加 raw state redaction。
- 当前不新增 browser people panel；浏览器若将来展示人物谱牒，应读取 `worldPeopleView`，不能读 raw `worldState.worldPeople`。
- `relationshipChanges` 仍只允许 provider 建议既有 `character` / `faction` 可见目标；新增 NPC/家族/资产/田产业务写入必须作为后续 server-owned proposal 裁决来设计。

### S52.1：官职、官署、任所、城市辖区、考成和迁转记录数据库契约

状态：DONE。实现/文档提交：`4ce6d0e feat: add official posting schema contract`；只读探索子代理 Pascal 已完成 S52.1 勘察，提交前只读复审 Averroes 未发现阻塞问题。本哈希回填为低风险纯文档 follow-up。

目标：

- 新增官职任所 schema 契约，覆盖未来 `bureaus`、`offices`、`cityJurisdictions`、`postings`、`assessmentRecords`、`transferRecords`。
- 沿用 `officialCatalog` 的 `bureauId` / `officeId` 和 S50 地理 `cityId` / `regionId` / `jurisdictionId` 引用，避免另造官职或地理体系。
- 提供独立 normalization / view / prompt summary helper，先不写 `worldState.officialPostings`，不改变 route payload，不新增浏览器面板，不建 SQLite 业务表。
- 确认普通 provider 不能通过 `statePatch` 直接写官职任所 ledger、任命记录、考成记录或迁转记录。

当前实现：

- 新增 `docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md`，定义官署、官职、任所辖区、任命、考成和迁转记录字段、数值范围、`public/role_visible/office_visible/relationship_visible/rumor/hidden` 可见性、hidden notes 边界和 nested 引用裁剪。
- 新增 `src/game/officialPostingSchemas.js`，提供 standalone `normalizeOfficialPostingSchemaBundle()`、`buildOfficialPostingSchemaView()`、`summarizeOfficialPostingSchemaForPrompt()` 和 `canSeeOfficialPostingRow()`。
- 新增 `test/officialPostingSchemas.test.js`，覆盖归一化 clamp、隐藏行过滤、可见行 nested hidden refs 裁剪、书生/官员/同署可见性、prompt cap、现有 `officialCatalog` 行可作为静态 seed，以及 provider `statePatch.officialPostings` 越权拒绝。
- `officialPostings` 加入未来 server-owned patch 边界；AI schema、stateRules、remote normalization、provider long-run 和 red-team 测试覆盖 provider 伪造写入。
- README、架构文档、产品 brief、动态数据库规划、AI 权限矩阵和 shared context 同步 S52.1 边界。
- 提交前只读复审 Averroes 未发现 P0/P1/P2 blocker；确认 `officialPostingSchemas` 不泄漏 hidden notes/recentNotes，nested hidden refs 裁剪覆盖内部官署/官职/辖区/任命/考成/迁转引用，`officialPostings` 未接入 route/UI/SQLite，provider 边界覆盖 schema、remote normalization、stateRules、provider long-run 和 red-team。其非阻塞提醒是 S52.2 真正接入 per-session ledger 时应补跨域地理引用过滤测试。

验证：

- `node --check src\game\officialPostingSchemas.js`
- `node --check test\officialPostingSchemas.test.js`
- `node --check src\game\stateRules.js`
- `node --check scripts\providerLongRun.js`
- `node --test test\officialPostingSchemas.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js test\aiControlRedTeam.test.js`，37 项通过
- `node --test test\officialPostingSchemas.test.js test\officialCatalog.test.js test\officialCareer.test.js test\worldGeography.test.js test\worldPeopleSchemas.test.js`，33 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，354 项通过
- `git diff --check`

风险/遗留：

- S52.1 只定义 standalone schema/helper；还没有 `worldState.officialPostings`、route view、browser 官职簿/任所地理面板、prompt 接入或 SQLite 业务表。
- 未来 S52.2 写 per-session posting ledger 时，必须保持 `player.officeTitle`、`officialCareer.currentPosting`、新增 `officeId/currentPostingId` 一致，避免标题和 id 错配。
- 当前 route 兼容层仍返回完整本地 `worldState`；未来若要保存 hidden 官员私档、密札考成或未公开调任风声，应先做 route raw-state redaction 或单独玩家 projection API。
- 城市财政、治安、水利、案牍、士绅与官场差事联动由 S52.2 先接入可见 projection；S52.1 不替代 `officialCareer` 的服务器任免裁决。

### S52.2：地方官/入仕官员任所与城市数据联动

状态：DONE。实现/文档提交：`4599869 feat: bridge official postings to city data`；只读探索子代理 Sartre 已梳理 S52.2 桥接方案，提交前只读复审 Feynman 未发现 P0/P1/P2 blocker。本哈希回填为低风险纯文档 follow-up。

目标：

- 新增每局 `worldState.officialPostings` 可见 projection，把 S52.1 schema/helper 接入运行时。
- 从 `officialCatalog`、`officialCareer`、地方官 role state 和 S50 `worldGeographyView` 派生官署、官职、城市辖区、当前任所、考成摘要和迁转记录。
- 让 game/exam/SSE/read-state route 返回 `officialPostingsView`，让 prompt 读取 capped `officialPostings` 摘要。
- 保持 `officialCareerView`、任命/调任/考成/处分裁决和完整科举入仕路径不变；不新增浏览器官职簿/任所地理面板，不新增 SQLite 官职业务表。

完成：

- 新增 `src/game/officialPostings.js`，提供 `createInitialOfficialPostingsState()`、`ensureOfficialPostingsState()`、`buildOfficialPostingsView()` 和 prompt summary wrapper。
- `src/game/initialState.js` 初始化 `worldState.officialPostings`；game route、SSE preview/final、read-state、exam question/submit 和 provider long-run 都会在返回前 ensure 该 projection。
- `officialPostingsView` 暴露可见 catalog bureaus/offices、由可见城市与官署辖区派生的 `cityJurisdictions`、玩家当前 posting、考成摘要，以及由服务器 `officialCareer.careerHistory` 派生的迁转记录。
- `worldState.officialPostings` 当前只保存 hidden-filtered 可见 projection，因为开发兼容 route 仍返回完整本地 `worldState`；hidden geography refs、hidden notes、密札考成和未公开调任不会进入 raw projection、route view 或 prompt 摘要。
- `stateRules` 的明显官职 `player.position` 伪造过滤扩展到地方官，避免 provider 把地方官软位置写成中央官名后被任所 bridge 误读为授官。
- `compactWorldState()` 新增 capped `officialPostings`；prompt pack 边界和本地审计脱敏同步把 `officialPostings`、`postings`、`assessmentRecords`、`transferRecords` 视为 server-owned / sensitive。
- 新增 `test/officialPostings.test.js` 和 `test/gameTurnOfficialPostings.test.js`，覆盖直接 official 任所、地方官任所与城市指标联动、hidden geography 裁剪、career-history 迁转派生、旧档补齐、provider 伪造拒绝，以及 SSE/route payload。
- README、架构文档、产品 brief、动态数据库规划、官职任所契约、官场契约、AI 权限矩阵、真实 provider 验收和 shared context 同步 S52.2 边界。

验证：

- `node --check src\game\officialPostings.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check src\ai\prompts.js`
- `node --check scripts\providerLongRun.js`
- `node --check test\officialPostings.test.js`
- `node --check test\gameTurnOfficialPostings.test.js`
- `node --test test\officialPostings.test.js test\gameTurnOfficialPostings.test.js`，9 项通过
- `node --test test\prompts.test.js test\providerLongRunScript.test.js test\stateRules.test.js test\auditRoute.test.js test\aiControlRedTeam.test.js`，37 项通过
- `node --test test\officialPostingSchemas.test.js test\gameTurnOfficialCareer.test.js test\gameTurnWorldGeography.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\officialCatalog.test.js test\officialCareer.test.js`，42 项通过
- `npm run check:docs-governance`
- `node --test test\officialPostings.test.js test\gameTurnOfficialPostings.test.js test\stateRules.test.js`，15 项通过
- `$env:AI_PROVIDER='mock'; npm test`，365 项通过
- `git diff --check`
- 提交前只读复审 Feynman 未发现 P0/P1/P2 blocker；其 P3 文档提醒已收尾：不再暗示 `officialPostingsView.currentPosting` 字段，并把复审状态写入 shared context。

风险/遗留：

- `officialPostingsView` 是当前 UI/prompt 契约；浏览器暂不显示官职簿/任所地理面板，后续 S53 信息面板或 context assembler 必须读取服务器 view。
- S52.2 不保存 hidden 官员私档或未公开调任；如果后续要保存完整 hidden ledger，必须先拆玩家 API 或增加 raw `worldState` redaction。
- 该 projection 不决定授官；`player.officeTitle`、`officialCareer.currentPosting` 和 `officialPostingsView.postings[]` 中的 `posting-player-current` 仍由服务器官场系统同步。

下一步：

- S53.1：检索式 prompt context assembler，按角色视野读取国家、城市、NPC、官职、事件摘要。

### S53.1：检索式 prompt context assembler

状态：DONE。实现/文档提交：`1268c04`；只读探索子代理 Boole 已梳理 prompt/view 契约、raw ledger 避免清单、测试重点和文档落点。提交前只读复审 Poincare 发现 2 个 P2，均已在 staging 前修复并补回归测试；Poincare 复核确认无 P0/P1/P2 阻塞。

目标：

- 新增 prompt context assembler，把普通 prompt 动态上下文的可见摘要集中到单一入口。
- 按任务、玩家行动和身份视野，从国家、城市、路线、边境、NPC、关系、官署、官职、任所、考成、迁转、世界实体、世界议程、长期事件和最近事件中选取 ranked/capped context。
- 保持 provider schema、prompt pack 稳定前缀、JSON 默认存储、SQLite 本地-only 范围和服务器任免/事件/数据库写入裁决不变。
- 不新增浏览器信息面板，不新增 SQLite 业务表，不读取 raw audit sidecar 或 SQLite 审计表。

完成：

- 新增 `src/ai/promptContextAssembler.js`，提供 `assemblePromptContext()` 和 `buildRankedRetrievalContext()`。前者保留现有 `relationshipLedger`、`examCalendar`、`worldGeography`、`worldPeople`、`officialPostings`、`worldEntities`、`worldThreads`、`longTermEvents`、`officialCareer`、`roleWorldCoupling` 等 capped prompt summary 字段；后者新增 `retrievalContext` ranked index。
- `retrievalContext` 从服务器可见 projection 和 prompt summary helper 取材：`worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`worldThreadView`、`longTermEventView`、`worldEntityView` 和可见 `eventHistory` 字符串。它按当前任务/玩家行动和角色信息加权，同时保留固定 caps。
- `src/ai/prompts.js` 改为通过 `assemblePromptContext()` 构造动态 world state；opening、ordinary turn、exam question 和 grading 都传入 task，ordinary turn 额外传入玩家行动。`retrievalContext` 仍只进入 task input，不进入 `promptPacks.js` 稳定前缀。
- 修复提交前复审发现的两个问题：`worldEntities` / `worldThreads` 的关联人物标签现在会过滤隐藏 relationship character，不再把隐藏人物名带入可见实体/议题摘要；中文行动检索会展开 CJK 片段，让“核查漕运账册”能命中“漕运”路线。
- 新增 `test/promptContextAssembler.test.js`，覆盖 assembler 兼容字段、hidden row/ref/audit-like 字段过滤、书生角色不可见外交/官署辖区、动作匹配排序当前地理/任所，以及最近事件 cap。
- 扩展 `test/prompts.test.js`，确认普通回合 prompt 包含 S53 `retrievalContext`，且动态玩家名/行动仍不进入 stable instructions。
- 架构文档、产品 brief、AI 权限矩阵和 shared context 同步 S53.1 边界。

验证：

- `node --check src\ai\promptContextAssembler.js`
- `node --check src\ai\prompts.js`
- `node --check test\promptContextAssembler.test.js`
- `node --check src\game\worldEntities.js`
- `node --check src\game\worldThreads.js`
- `node --test test\promptContextAssembler.test.js test\prompts.test.js`，19 项通过
- `node --test test\worldEntities.test.js test\worldThreads.test.js`，13 项通过
- Poincare 只读复核运行 `node --test test\promptContextAssembler.test.js test\prompts.test.js test\worldEntities.test.js test\worldThreads.test.js`，32 项通过，确认无 P0/P1/P2 阻塞
- `node --test test\promptContextAssembler.test.js test\prompts.test.js test\worldGeography.test.js test\worldPeopleSchemas.test.js test\officialPostingSchemas.test.js test\worldEntities.test.js test\worldThreads.test.js`，51 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，370 项通过
- `git diff --check`

风险/遗留：

- `retrievalContext` 是 provider-only prompt 对象，不是浏览器 UI contract；S53.2 的天下格局、任所地理、人物谱牒、官职簿和事件档案面板仍必须读取 route 返回的服务器 view。
- 当前不读取 raw audit sidecar / SQLite 审计表；未来若做审计检索或事件档案 UI，必须先新增 sanitized projection、分页权限和 hidden-token corpus。
- 现有 route 仍为本地开发兼容返回完整 `worldState`；未来若保存真正 hidden NPC/官员/地理私档，仍需先做玩家 API 脱敏或 raw-state redaction。

下一步：

- S53.2：浏览器信息面板规划，明确天下格局、任所地理、人物谱牒、官职簿和事件档案的 route view 来源、hidden 过滤和验收范围。

### S53.2：浏览器信息面板规划

状态：DONE。规划提交：`b89882a`。只读探索子代理 Parfit 梳理了当前 route view、前端面板入口、browser smoke helper 和后续 UI 风险；只读文档探索子代理 Mendel 梳理了文档落点、权限矩阵边界和后续拆步。该步骤为低风险纯文档规划，不改 runtime，跳过提交前只读复审；验证见下。

目标：

- 固定“天下格局、任所地理、人物谱牒、官职簿、事件档案”五类信息面板的数据来源、非目标、隐藏过滤和验收方向。
- 明确后续浏览器 UI 必须读取 route payload 中的 player-facing view，而不是 raw `worldState` ledger 或 S53.1 provider-only `retrievalContext`。
- 把事件档案列为高风险面板：实现前必须先新增服务器 `eventArchiveView` 或等价 sanitized projection，不得直接读取 JSON/SQLite audit payload。
- 将 S53.2 规划拆成后续实现步骤 S53.3-S53.6，保持每步可审查、可验证。

完成：

- 新增 `docs/BROWSER_INFORMATION_PANEL_PLAN.md`，记录当前 view/UI 现状、五类面板的数据源表、事件档案安全要求、UI 设计方向、建议 selector、后续拆步和验收清单。
- `docs/ARCHITECTURE.md` 增补浏览器信息面板规划契约，说明后续面板只读 `worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`worldEntityView`、`worldThreadView`、`longTermEventView`、`officialCareerView` 等 route view。
- `docs/AI_CONTROL_AUDIT_MATRIX.md` 增补浏览器信息面板边界：AI 不直接控制 DOM，不复用 `retrievalContext` 给 UI，事件档案不得读 raw audit。
- `docs/BROWSER_ACCEPTANCE.md` 增补 S53.2 planned browser surface，列出未来 smoke selector、hidden-token corpus、响应式溢出和事件档案 projection 验收。
- README、产品 brief、shared context 同步 S53.2 规划入口和下一步 S53.3。

验证：

- `npm run check:docs-governance`
- `git diff --check`

风险/遗留：

- `#scholar-panel` 已有面板较多，S53.3 起必须用 tab/segmented control 或折叠策略控制信息密度，避免叙事区和行动区被挤压。
- 事件档案当前缺专门安全 view；S53.6 必须先做 `eventArchiveView` 或等价服务器 projection，再实现 UI。
- `officialCareerView` 与 `officialPostingsView` 存在语义重叠；后续“官场档案”继续承载个人仕途结算，“官职簿/任所地理”只做簿册和地理查阅。

下一步：

- S53.3：浏览器信息面板前端接线基础，先缓存 S50-S52 相关 view 并建立 tab/面板壳，不急着铺满五类内容。

### S53.3：浏览器信息面板前端接线基础

状态：DONE。实现提交：`89e73c2`。只读探索子代理 Leibniz 梳理了 `public/app.js`、`public/index.html` 和 `public/styles.css` 的挂载点、缓存变量和布局约束；只读探索子代理 Mencius 梳理了 `scripts/browserSmoke.js` / `test/browserSmokeScript.test.js` 的 metrics、hidden-token 和 helper 验收模式。提交前只读复审 Boyle 未发现 P0/P1/P2 blocker；其 P3 提醒“隐藏 tab 文本扫描不应只依赖 `innerText`”已收口为信息面板 smoke 快照读取 `textContent`。

目标：

- 在浏览器端缓存 S50-S52 已由 route 返回的 `worldGeographyView`、`worldEntityView`、`worldPeopleView` 和 `officialPostingsView`，继续保留既有 `longTermEventView`、`worldThreadView`、`officialCareerView` 等缓存。
- 建立一个紧凑的 `#information-panel` tab/segmented shell，预留 `#world-geography-panel`、`#posting-geography-panel`、`#world-people-panel`、`#official-postings-panel` 和 `#event-archive-panel`。
- 只显示安全计数和卷宗状态，不渲染国家/城市/路线/人物/官职细卡，不读取 raw ledger 或 S53.1 provider-only `retrievalContext`。
- 事件档案只保留禁用入口；没有 `eventArchiveView` 前不得读取 raw `eventHistory`、JSON/SQLite audit、provider proposal、prompt、本地路径或 key。

完成：

- `public/app.js` 新增 S50-S52 view 缓存，改用 `renderPayloadWorldState(payload)` 统一从开局、读档、普通回合、SSE final、考试取题/推进/交卷 payload 接入 view。
- `public/app.js` 新增 `renderInformationPanelShell()` 和五个子面板 selector；四个非事件面板只读 route view 计数，事件档案 tab 禁用。
- `public/styles.css` 新增 `.information-panel`、tab、页面和计数区样式，保持 `#scholar-panel` 全宽、紧凑、可换行且不需要横向滚动。
- `scripts/browserSmoke.js` 新增信息面板 shell helper、tab 切换验收、event archive disabled-before-projection 检查和 `informationPanel*` 横向溢出 metrics。
- `test/browserSmokeScript.test.js` 增加 helper 失败用例与信息面板溢出用例。
- README、产品 brief、架构文档、browser acceptance、AI 权限矩阵和 shared context 同步 S53.3 边界。

验证：

- `node --check public\app.js`
- `node --check scripts\browserSmoke.js`
- `node --check test\browserSmokeScript.test.js`
- `node --test test\browserSmokeScript.test.js`
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm run smoke:browser`
- `$env:AI_PROVIDER='mock'; npm test`
- `git diff --check`

风险/遗留：

- S53.3 只完成壳和验收骨架；天下格局/任所地理内容仍在 S53.4，人物谱牒/官职簿内容仍在 S53.5。
- 事件档案仍无安全 server projection；S53.6 必须先新增 `eventArchiveView` 或等价 sanitized projection。
- 后续内容实现必须继续控制 `#scholar-panel` 信息密度，尤其移动端和直接 official 开局。

下一步：

- S53.4：实现“天下格局”和“任所地理”细面板，继续只读 `worldGeographyView` 与 `officialPostingsView`。

## 6. 数据域规划

数据库专项需要承载的数据域如下。每个域都先定义契约和 projection，再决定是否拆表；不要为了“有数据库”而提前建过度复杂的表。

### 国家与邻国

建议字段：

- 基本：`countryId`、国号、政体、君主/摄政、首都、疆域层级、文化/宗教/制度标签。
- 财政：国库、岁入、岁出、债务、税源结构、盐铁/商税/田赋、赈济能力、币制稳定。
- 军事：总兵力、精锐兵、军心、补给、边防、将领池、海防/骑兵/火器等能力标签。
- 国威：威望、正统性、朝贡影响、士林评价、民心、边疆控制、天灾舆情。
- 外交：对玩家国家的友好、敌意、信任、威慑、贸易、边境摩擦、盟约、朝贡、通婚/质子、战争理由。
- 情报：已知/传闻/隐藏分层，玩家未接触的邻国暗流不直接进 prompt。

### 城市、地方与道路

建议字段：

- 行政：国家、省/道/府/州/县、上级辖区、治所、所属官署、任所可用官职。
- 民政：人口、户籍质量、治安、民心、士绅影响、宗族压力、诉讼积压、疫病/灾荒。
- 财政：田赋、商税、粮仓、水利、工役、市场、盐漕节点、债务或拖欠。
- 军防：城防、卫所、驻军、边患、山贼/海盗压力、补给线。
- 文教：书院、贡院、名师、科举风气、学派、人脉入口。
- 地理：道路、河运、驿站、距离、季节通行风险、邻国边城关系。

### NPC、家族与资产

建议字段：

- 基本：姓名、字/号、年龄、籍贯、身份、官职、派系、可见身份、当前地点。
- 能力与性格：学识、政务、武略、财技、清誉、野心、胆量、忠诚、好恶、秘密倾向。
- 财富：现银、债务、商号、田产、宅第、书院/宗祠资助、可动用资源。
- 家庭：父母、配偶、子女、姻亲、门生、同年、主仆、家族声望、继承压力。
- 关系：与玩家/派系/城市/官署的好感、信任、恩怨、欠情、把柄、隐秘关系。
- 视野：玩家已知、公文可见、传闻可见、私密、隐藏五层。

### 玩家主角

建议字段：

- 身份路径：当前 role、科名、官职、任所、衙门、品级、履历、调任/丁忧/处分记录。
- 身体与心性：健康、疲劳、心态、压力、名节、清望、贪腐风险。
- 学问与技能：经义、文章、策论、政务、律例、财政、兵事、外交、交涉。
- 经济：现金、俸禄、债务、田产、宅院、书籍、礼物、家计压力。
- 关系：师友、同年、上官、下属、门生、家族、敌对者、隐藏暗线。
- 视野缓存：玩家当前可知的国家、城市、NPC、官署和事件摘要，供 prompt 和 UI 使用。

### 官职、官署与任所

建议字段：

- 官职目录：`officeId`、官名、品级、衙门、职责、任职资格、典型任所、风险、考成指标。
- 任命记录：任命来源、起任年月旬、预计考成月、任所城市、上官/同僚/下属。
- 地方官：城市财政、治安、诉讼、水利、赋役、士绅、灾荒、文教与任所事件直接关联。
- 中枢官：衙门积案、派系压力、奏疏、考成、荐举、弹劾、皇命与跨部门协作。
- 武职：驻地、兵额、军饷、军心、战备、边患、补给线、军功与败绩。

### 事件、记录与场景

建议字段：

- 事件：事件 id、来源模块、发生年月旬、scene cadence、地点、参与者、公开/隐藏级别、摘要、后果。
- 世界议程：长期线程、目标、期限单位、风险、相关国家/城市/NPC/实体、已解决记录。
- 场景：考试、廷议、堂审、战斗、旅途、差事收束等局部阶段和参与者。
- 审计：AI proposal、服务器校验、接受/拒绝原因、应用事务、异常回滚。

## 7. 风险与默认决策

- 不立即强制新增第三方数据库依赖；S49.3 已优先使用 Node.js 标准库 `node:sqlite` 做可选本地原型，默认 JSON 仍可用。
- 不规划远程存档、账号体系、多人同步、云端冲突解决或托管数据库；`session_id` 只表示本机不同存档。
- 不让 AI 直接写 SQL、表名或业务字段；AI proposal 必须经过 schema 和服务器模块。
- 不把 raw database 暴露给 prompt 或浏览器；只暴露 server-built projection。
- 不把国家、城市、NPC、官职等业务表一次性拆完；先以 JSON snapshot 保持可玩，再按查询痛点拆表。
- 不改变完整书生路径、Mock 默认可玩、真实 provider 可选、无构建前端和服务器拥有状态边界。
- 数据库迁移涉及新增依赖、schema、prompt 摘要或浏览器面板时，必须同步检查 `docs/AI_CONTROL_AUDIT_MATRIX.md`、README、产品 brief、架构文档和 shared context。
- 隐藏信息要在数据库层、projection 层和 prompt 层都标记；不能只靠前端隐藏。

## 8. 进度记录

### 2026-05-07

工具：Codex；只读探索子代理 Sartre；提交前只读复审 Feynman

步骤：S52.2

提交：`4599869 feat: bridge official postings to city data`

完成：

- 新增 `src/game/officialPostings.js`，把 S52.1 官职任所 schema/helper 接入每局 `worldState.officialPostings` 可见 projection。
- 新局、普通回合、SSE、读档、考试取题和交卷都会 ensure `officialPostings` 并返回 `officialPostingsView`；prompt compact state 新增 capped `officialPostings` 摘要。
- 当前玩家是入仕官员时，projection 按 `officialCareer.currentPosting` / `player.officeTitle` 对齐官职目录；当前玩家是地方官时，projection 将本地衙门职责映射到可见城市辖区和城市动态指标。
- 服务器 `officialCareer.careerHistory` 派生迁转记录，`officialCareerView` 仍是任免与考成权威；provider 不能通过 `statePatch.officialPostings` 写官职任所账本。
- raw `worldState.officialPostings` 只保存 hidden-filtered 可见 projection，避免既有 route 返回完整 `worldState` 时泄漏 hidden geography refs、密札考成或未公开调任。
- `stateRules` 的明显官职 `player.position` 伪造过滤扩展到地方官；`officialPostings` 对地方官任所使用知县/本地衙门口径，不把 provider 软位置误读成任命。
- `scripts/providerLongRun.js`、prompt pack 边界、本地 audit redaction、red-team 和 state/provider 测试同步 S52.2 server-owned 边界。
- README、架构文档、产品 brief、动态数据库规划、官职任所契约、官场契约、AI 权限矩阵、真实 provider 验收和 shared context 同步 S52.2 状态。
- Sartre 只读梳理了 S52.2 方案：以 `officialPostings.js` 做桥接，不改 `officialCareerView`，不新增 UI/SQLite 表；重点验证旧档补齐、direct official、magistrate、route/SSE/prompt 和 hidden geography 裁剪。子代理未编辑文件，未运行 Git 命令。

验证：

- `node --check src\game\officialPostings.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check src\ai\prompts.js`
- `node --check scripts\providerLongRun.js`
- `node --check test\officialPostings.test.js`
- `node --check test\gameTurnOfficialPostings.test.js`
- `node --test test\officialPostings.test.js test\gameTurnOfficialPostings.test.js`，9 项通过
- `node --test test\prompts.test.js test\providerLongRunScript.test.js test\stateRules.test.js test\auditRoute.test.js test\aiControlRedTeam.test.js`，37 项通过
- `node --test test\officialPostingSchemas.test.js test\gameTurnOfficialCareer.test.js test\gameTurnWorldGeography.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\officialCatalog.test.js test\officialCareer.test.js`，42 项通过
- `npm run check:docs-governance`
- `node --test test\officialPostings.test.js test\gameTurnOfficialPostings.test.js test\stateRules.test.js`，15 项通过
- `$env:AI_PROVIDER='mock'; npm test`，365 项通过
- `git diff --check`
- 提交前只读复审 Feynman 未发现 P0/P1/P2 blocker；其 P3 文档提醒已收尾：不再暗示 `officialPostingsView.currentPosting` 字段，并把复审状态写入 shared context。

风险/遗留：

- S52.2 不新增浏览器官职簿/任所地理面板，不新增 SQLite 官职业务表，也不把 hidden 官员私档保存到 raw route state。
- 当前 `officialPostingsView` 只解释官职任所与可见城市指标的关系；城市财政、治安、水利、案牍、士绅与具体官场差事的深层结算仍由后续世界系统逐步接入。
- 后续 S53.1 context assembler 应读取 `officialPostingsView` / prompt summary，而不是 raw `worldState.officialPostings`。
- 本哈希回填为低风险纯文档 follow-up，跳过额外提交前子代理复审；验证 `npm run check:docs-governance` 与 `git diff --check`。

下一步：

- S53.1：检索式 prompt context assembler，按角色视野读取国家、城市、NPC、官职、事件摘要。

### 2026-05-07

工具：Codex；只读探索子代理 Pascal；提交前只读复审 Averroes

步骤：S52.1

提交：`4ce6d0e feat: add official posting schema contract`

完成：

- 新增 `docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md`，固定官署、官职、任所辖区、任命、考成和迁转记录的数据库契约。
- 新增 `src/game/officialPostingSchemas.js`，提供归一化、可见 view、prompt summary 和 `office_visible` / role / relationship 可见性判定；引用 `officialCatalog` 官署/官职 id，并为 S50 地理 id 留出辖区落点。
- 新增 `test/officialPostingSchemas.test.js`，覆盖 clamp、hidden rows/notes 过滤、nested hidden refs 裁剪、prompt cap、`officialCatalog` seed 兼容和 provider 直接写 `officialPostings` 的拒绝路径。
- `officialPostings` 加入 future server-owned patch 边界；`stateRules`、AI schema、remote normalization、provider long-run 和 red-team 测试同步拒绝普通 provider 伪造官职任所账本。
- README、架构文档、产品 brief、动态数据库规划、AI 权限矩阵和 shared context 同步 S52.1 边界。
- Pascal 只读梳理了 S52.1 应参考的 `officialCatalog` / `officialCareer` / `worldGeography` / `worldPeopleSchemas` 模式、id/visibility/server-owned 边界、建议文件清单和 P0/P1/P2 风险；子代理未编辑文件，未运行 Git 命令。
- Averroes 执行提交前只读复审，未发现 P0/P1/P2 blocker；确认 hidden notes/recentNotes 不进 view/prompt、内部 nested hidden refs 被裁剪、`officialPostings` 未接入 route/UI/SQLite、provider 边界完整。其非阻塞提醒是 S52.2 接入 per-session ledger 时补 `cityId` / `routeIds` / `frontierZoneIds` 对 `worldGeographyView` 可见集的跨域裁剪测试。

验证：

- `node --check src\game\officialPostingSchemas.js`
- `node --check test\officialPostingSchemas.test.js`
- `node --check src\game\stateRules.js`
- `node --check scripts\providerLongRun.js`
- `node --test test\officialPostingSchemas.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js test\aiControlRedTeam.test.js`，37 项通过
- `node --test test\officialPostingSchemas.test.js test\officialCatalog.test.js test\officialCareer.test.js test\worldGeography.test.js test\worldPeopleSchemas.test.js`，33 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，354 项通过
- `git diff --check`
- 提交前只读复审 Averroes 额外复跑 `node --test test\officialPostingSchemas.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js test\aiControlRedTeam.test.js`，37 项通过；`git diff --check` 通过。

风险/遗留：

- S52.1 不写每局 `worldState.officialPostings`，不改变 `officialCareerView`，不新增浏览器官职簿/任所地理面板，不建 SQLite 业务表；该运行时桥接已由 S52.2 接续。
- S52.2 接入 per-session projection 时必须补 route/prompt hidden-token 探针，并保证 `player.officeTitle`、`officialCareer.currentPosting`、`officeId/currentPostingId` 不错配；该风险已在 S52.2 测试中覆盖 direct official、magistrate、route/SSE 和 hidden geography 裁剪。
- 城市动态指标与地方官任所的第一层可见联动已由 S52.2 完成，深层差事结算仍留给后续世界系统。
- 本哈希回填为低风险纯文档 follow-up，跳过额外提交前子代理复审；验证 `npm run check:docs-governance` 与 `git diff --check`。

下一步：

- 已由 S52.2 接续：地方官/入仕官员任所与城市数据联动，保持服务器任免裁决。

### 2026-05-07

工具：Codex；只读探索子代理 Hume；提交前只读复审 Singer

步骤：S51.2

提交：`8ed984a feat: bridge world people ledger`

完成：

- 新增 `src/game/worldPeople.js`，把当前 `characters`、`relationshipLedger` 和 active request 可见请托桥接为 server-owned `worldState.worldPeople` 可见投影。
- 游戏开局、普通回合、SSE、读档、考试取题和交卷返回 `worldPeopleView`；prompt 输入新增 capped `worldPeople` 摘要。
- 桥接层保留旧 `relationshipView`、`activeNpcRequestView`、`relationshipChanges` 和书生科举路径，不新增浏览器人物/家产面板，不建 SQLite 业务表。
- 为避免既有 raw `worldState` route 泄漏未来私密人物库，本步骤只存可见投影，并主动丢弃 hidden legacy/custom rows、`hiddenNotes` 和 `hiddenIntent`。
- `worldPeople` 加入普通回合 server-owned patch 边界；schema、stateRules、remote normalization、provider long-run、audit redaction、red-team 和 eval fixtures 覆盖 provider 伪造写入。
- README、架构文档、产品 brief、动态数据库规划、人物契约、AI 权限矩阵、真实 provider acceptance 和 shared context 同步 S51.2 边界。
- Hume 只读梳理了 `worldPeople` 推荐落点、route/exam/prompt/provider-long-run 集成点、旧关系/请托契约和 raw route 泄漏风险；子代理未编辑文件，未运行 Git 命令。

验证：

- `node --check src\game\worldPeople.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check src\ai\prompts.js`
- `node --check scripts\providerLongRun.js`
- `node --check test\worldPeopleBridge.test.js`
- `node --test test\worldPeopleBridge.test.js test\worldPeopleSchemas.test.js test\gameTurnRelationships.test.js test\prompts.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js test\auditRoute.test.js test\aiControlRedTeam.test.js test\aiEvalFixtures.test.js`，72 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，348 项通过
- `git diff --check`
- 提交前只读复审 Singer 未发现 P0/P1/P2 blocker，并额外运行同一组 focused `node --test`，72 项通过；Singer 未编辑文件，未运行 Git 命令。

风险/遗留：

- S51.2 的 `worldState.worldPeople` 是 bridge projection，不是完整私密 NPC 数据库；未来隐藏人物、家族、资产和田产若要入库，应先做 route raw-state redaction 或单独玩家 projection API。
- `worldPeopleView` 当前不接浏览器面板；S53 信息面板或 context assembler 可再读取它。
- 本步骤不扩大本地数据库范围，不引入远程/账号/多人，不让 AI 写 SQL 或人物业务表。
- 本哈希回填为低风险纯文档 follow-up，跳过额外提交前子代理复审；验证 `npm run check:docs-governance` 与 `git diff --check`。

下一步：

- S52.1：官职、官署、任所、城市辖区、考成和调任记录的数据库契约。

### 2026-05-07

工具：Codex；只读探索子代理 Halley；提交前只读复审 Erdos、Boyle

步骤：S51.1

提交：`418077b feat: add world people schema contract`

完成：

- 新增 `docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md`，固定人物、家族、资产、田产、关系和可见性 schema 契约，明确 S51.1 不写 `worldState.worldPeople`、不改 route payload、不新增 UI、不建 SQLite 业务表。
- 新增 `src/game/worldPeopleSchemas.js`，提供 standalone `normalizeWorldPeopleSchemaBundle()`、`buildWorldPeopleSchemaView()`、`summarizeWorldPeopleSchemaForPrompt()` 和 `canSeeWorldPeopleRow()`，用于归一化、隐藏过滤、nested hidden refs 裁剪和 capped prompt 摘要。
- 新增 `test/worldPeopleSchemas.test.js`，覆盖归一化 clamp、hidden notes/intent 不进 view/prompt、书生/官员/关系可见性、可见行引用隐藏人物/家产裁剪、provider `statePatch.worldPeople` 越权拒绝和 `applyStatePatch()` 忽略。
- README、架构文档、产品 brief、动态数据库规划、AI 权限矩阵和 shared context 同步 S51.1 边界。
- Halley 只读梳理了当前 `characters`、`relationshipLedger`、active requests、玩家资产字段、测试风险和 S51.1 推荐落点；子代理未编辑文件，未运行 Git 写命令。
- 提交前只读复审 Erdos 未发现 P0/P1/P2 blocker；其非阻塞建议是 prompt 摘要补 assets cap 和后续明确 view `generatedAtTurn` 语义。已补 assets cap 与 hidden asset prompt 测试。
- 提交前只读复审 Boyle 复查 assets prompt cap，未发现 hidden owner/hidden asset 泄漏路径。

验证：

- `node --check src\game\worldPeopleSchemas.js`
- `node --check test\worldPeopleSchemas.test.js`
- `node --test test\worldPeopleSchemas.test.js test\relationshipLedger.test.js test\activeNpcRequests.test.js`，21 项通过
- `node --test test\stateRules.test.js test\aiSchemas.test.js test\prompts.test.js test\aiControlRedTeam.test.js`，29 项通过
- `node --test test\gameTurnRelationships.test.js test\examTravel.test.js test\sessionStore.test.js test\sessionStoreAdapterContract.test.js`，51 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，343 项通过
- `git diff --check`

风险/遗留：

- 本步骤仍不新增每局人物状态、浏览器人物谱牒/家产面板、SQLite NPC 业务表或 prompt 接入；S51.2 才桥接当前 `characters`、`relationshipLedger` 和 active requests。
- 后续桥接时必须保留现有 `relationshipChanges` 的可见目标、delta、clamp、隐藏过滤和服务器裁决，不得让 AI 新造隐藏联系人或直接写 NPC 资产。

下一步：

- 完成提交前只读复审并提交；随后 S51.2：桥接当前 `characters`、`relationshipLedger`、active requests 与 NPC/关系表。

### 2026-05-07

工具：Codex；只读探索子代理 Schrodinger；提交前只读复审 Bacon

步骤：S50.2

提交：`b0ced01 feat: instantiate world geography ledger`

完成：

- 新增 `src/game/worldGeography.js`，把 S50.1 静态地理 seed 实例化为每局 server-owned `worldState.worldGeography`，并提供归一化、旧档补齐、轻量压力快照刷新、`worldGeographyView` 与 prompt summary。
- 新局创建、游戏回合、SSE、读档、考试取题/推进/交卷都接入 `worldGeographyView`；prompt 输入新增 capped `worldGeography` 摘要。
- `worldGeography` 加入普通回合 server-owned patch 边界；schema、remote normalization、stateRules、provider long-run 和 red-team 测试覆盖 provider 伪造写入。
- README、架构文档、产品 brief、动态数据库规划、AI 权限矩阵、地理契约和 shared context 同步 S50.2 边界。

验证：

- `node --check src\game\worldGeography.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check scripts\providerLongRun.js`
- `node --test test\worldGeographySeeds.test.js test\worldGeography.test.js test\gameTurnWorldGeography.test.js test\prompts.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js test\examTravel.test.js test\aiControlRedTeam.test.js`，68 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，338 项通过
- `git diff --check`
- 提交前只读复审 Bacon 未发现阻塞问题；确认 provider/remote/long-run 不能写 `worldGeography`、view/prompt hidden 过滤、旧档归一化和路由契约均符合 S50.2 目标。

风险/遗留：

- `worldGeographyView` 是当前 UI/prompt 契约；完整本地 `worldState` 仍随既有 route payload 返回，不应作为浏览器地理面板来源。
- S50.2 不新增浏览器面板、SQLite 国家/城市业务表或 World Entities/Threads 地理联动；下一步进入 S51.1 NPC、家族、资产、田产、关系和可见性 schema 契约。
- 本哈希回填为低风险纯文档 follow-up，跳过额外提交前子代理复审；验证 `npm run check:docs-governance` 与 `git diff --check`。

下一步：

- S51.1：NPC、家族、资产、田产、关系和可见性 schema 契约。

### 2026-05-07

工具：Codex；只读探索子代理 Pascal；提交前只读复审 Maxwell

步骤：S50.1

提交：`45f9b65 feat: add world geography seed contract`

完成：

- 新增 `src/game/worldGeographySeeds.js`，提供默认静态地理 seed `late-ming-north-china`、归一化、引用校验、隐藏过滤 view 和防御性副本。
- 默认 seed 覆盖本国、邻国/藩属、区域、城市、路线、边境压力面和官署辖区，并给每行标注 `public`、`role_visible`、`rumor` 或 `hidden` 初始可见性。
- 新增 `docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md`，明确 S50.1 只做静态 catalog，不写 per-session 动态状态、不接 prompt、不新增 UI、不建 SQLite 业务表。
- 新增 `test/worldGeographySeeds.test.js`，覆盖默认种子范围、officialCatalog bureau 引用、hidden route/frontier/引用过滤、legacy normalization、悬空引用校验和默认副本隔离。
- README、架构文档、产品 brief、动态数据库规划、AI 权限矩阵和 shared context 同步 S50.1 边界。

验证：

- `node --check src\game\worldGeographySeeds.js`
- `node --check test\worldGeographySeeds.test.js`
- `node --test test\worldGeographySeeds.test.js test\officialCatalog.test.js`，13 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，324 项通过
- `git diff --check`

风险/遗留：

- Maxwell 提交前复审发现 P2：可见地理行引用 hidden route/frontier 时，view helper 可能泄漏 hidden id。已修复为按可见 id 集合裁剪引用数组，并补回归测试。其 P3 开封区划建议也已处理：新增河南区域并把开封挂到 `region-henan`。
- S50.1 不新增 `worldState.worldGeography`，因此本轮没有 provider patch 面；S50.2 接入 per-session ledger/prompt projection 时必须补 server-owned patch 拒绝、hidden geography 不进 prompt/route view 和 projection cap 测试。
- `buildWorldGeographySeedView()` 只是后续 projection 起点，当前不由 route 或 browser 调用。

下一步：

- S50.2：per-session 国家/城市实例化与 prompt projection，先不替代现有顶层 `worldState` 指标。

### 2026-05-07

工具：Codex；只读探索子代理 Boyle

步骤：S49.1

提交：`e3808df docs: plan dynamic world database`；`990f7d3 docs: backfill dynamic database plan hash`

完成：

- 新增 `docs/DYNAMIC_WORLD_DATABASE_PLAN.md`，详细规划动态世界数据库的可行性、架构边界、数据域、最小表结构、迁移阶段和 AI/server 权限。
- 结论是中长期可行且值得做，但短期不应一次性替换当前 JSON 存档；推荐先做 storage adapter，再做 SQLite session row + JSON `world_state` 原型，再加事件日志和 AI proposal 审计，最后选择性拆国家/邻国、城市、NPC、家族、官职、关系、场景和世界实体表。
- 明确 AI 不能直接写数据库、执行 SQL 或拥有业务表写权限；AI 只能提交结构化建议，服务器通过 schema、白名单、clamp、隐藏过滤、领域规则和事务写入裁决。
- README、架构文档、产品 brief、路线图和 shared context 已同步该规划入口。
- Boyle 审查了当前 JSON/session/worldState 边界，确认短期 JSON 仍能支撑，数据库应从 adapter 与 SQLite 原型开始；子代理未编辑文件，未运行 Git 写命令。

验证：

- `npm run check:docs-governance`
- `git diff --check`

风险/遗留：

- S49.1 为低风险纯文档规划，不改运行时代码、不新增依赖、不改变存档格式。
- S49.2 才开始抽 storage adapter；S49.3 若引入 SQLite 依赖，必须按依赖治理记录版本、许可证、安装影响、Mock/no-key 影响和回滚策略。

下一步：

- 开始 S49.2：抽 storage adapter 接口和 contract tests，保持 JSON 为默认实现。

### 2026-05-07

工具：Codex；提交前只读复审 Carver

步骤：S49.1 文档切换 follow-up

提交：`c2e31f3 docs: start local database roadmap`

完成：

- 新增 `docs/TIME_SPECIALTY_ROADMAP_ARCHIVE.md`，把 S48 时间专项主要成果、验收和遗留方向从活动台账归档。
- 将 `docs/DEVELOPMENT_STEPS.md` 从时间专项活动台账改为本地数据库专项活动台账，并保留治理保护块、子代理规则、依赖治理入口、AI/server 权限边界和中文输出规则。
- 综合本会话数据库需求，明确国家/邻国、城市、NPC、玩家、官职、事件、场景和 AI proposal 审计的数据域规划。
- 根据用户最新范围，明确当前只考虑本地数据库，不做远程存档、账号体系、多人同步或云端数据库。
- 当前变更为纯文档，但因涉及路线图重写和内容保护，提交前仍执行只读复审。

验证：

- `npm run check:docs-governance`
- `git diff --check`
- 只读复审 Carver：首轮发现 P2“验证记录仍写成待运行”，已修正；未发现 P0/P1，治理保护块、活动路线图一致性和本地-only 数据库边界均确认无 blocker。

风险/遗留：

- 本步骤不改运行时代码、不新增依赖、不改变存档格式。
- 下一步仍是 S49.2 storage adapter；不要直接进入 SQLite 业务表拆分。

### 2026-05-07

工具：Codex；只读探索子代理 Godel；提交前只读复审 Dewey

步骤：S49.2

提交：`2e15e13 feat: add session storage adapter`

完成：

- 抽出 storage adapter 边界：`src/storage/sessionStore.js` 保持为路由使用的 facade；默认 JSON 实现迁入 `src/storage/jsonSessionAdapter.js`。
- 保持当前 JSON envelope、legacy raw save 迁移、上旬默认、metadata 脱敏、atomic temp rename、同 session 队列、本地 lock、revision 冲突、存档列表和 temp cleanup 行为不变。
- 新增 `test/sessionStoreAdapterContract.test.js`，用未来 SQLite adapter 也应满足的 contract 覆盖创建/读取、迁移、脱敏、损坏文件跳过、revision 冲突、并发 mutation、`skipWrite` 与 `errorAfterWrite`。
- 同步 README、架构文档、产品 brief 和 `docs/SESSION_STORAGE_MIGRATION_PLAN.md`，明确 S49.2 只完成 adapter，S49.3 才进入本地 SQLite 原型；不新增依赖，不涉及远程存档、账号、多人或云端数据库。
- Godel 只读检查了 storage API/route/test 契约，提醒保留 `mutateSession` 的 `skipWrite` 与 `errorAfterWrite` 语义；子代理未编辑文件，未运行 Git 写命令。
- Dewey 执行提交前只读复审，未发现 P0/P1/P2 blocker；其 P3 文档建议已补充 `docs/SESSION_STORAGE_MIGRATION_PLAN.md` 示例中的 `tenDayPeriod` 字段。复审子代理未编辑文件，未运行 Git 命令。

验证：

- `node --check src\storage\jsonSessionAdapter.js`
- `node --check src\storage\sessionStore.js`
- `node --check test\sessionStoreAdapterContract.test.js`
- `node --test test\sessionStoreAdapterContract.test.js test\sessionStore.test.js test\gameSavesRoute.test.js`，27 项通过
- `node --test test\gameTurnTick.test.js test\streamingTurnRoute.test.js test\examSceneTime.test.js test\examProgressRoute.test.js test\gameSavesRoute.test.js test\sessionStoreAdapterContract.test.js test\sessionStore.test.js`，43 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，299 项通过
- `git diff --check`

风险/遗留：

- 本步骤没有新增 SQLite 依赖，也没有引入 `STORAGE_ADAPTER` 环境切换；默认仍是本地 JSON。
- JSON adapter 的文件锁仍只保证正常本地文件系统上的本机写入协调；S49.3 需要用 SQLite transaction/`revision` 条件更新复用同一 contract。
- S49.3 做 SQLite 时应把当前 JSON adapter contract tests 抽成可复用 suite，让 JSON 与 SQLite adapter 同跑同一组行为断言。

下一步：

- 已由 S49.3 接续：评估并记录本地 SQLite 实现方式，新增可选 SQLite session row adapter，默认 JSON 路径保持不变。

### 2026-05-07

工具：Codex；只读探索子代理 Pasteur；提交前只读复审 Averroes

步骤：S49.3

提交：`22217e0 feat: add optional sqlite session storage`

完成：

- 新增共享 `src/storage/sessionRecord.js`，让 JSON 与 SQLite 共用 session envelope、metadata、legacy normalization、save-list redaction 和公开 skipped reason。
- 新增 `src/storage/sqliteSessionAdapter.js`，使用 Node.js `node:sqlite` 标准库创建本地 `world_sessions` 表，一行一 session，保存 metadata/revision/timestamps 与 JSON `world_state_json`。
- `src/storage/sessionStore.js` 支持 `STORAGE_ADAPTER=json|sqlite`；默认 JSON 不变，SQLite 懒加载，显式 SQLite 模式可用 `SQLITE_DATABASE_PATH` 指定本地数据库。
- 新增 JSON -> SQLite 开发导入脚本 `scripts/importJsonSessionsToSqlite.js` 和 `npm run storage:import:sqlite`；导入不会删除 JSON 原档。
- `test/sessionStoreAdapterContract.test.js` 改为 JSON/SQLite 同跑 contract，覆盖 route-compatible read/write、tenDayPeriod normalization、save-list redaction、revision conflict、concurrent `mutateSession`、`skipWrite`、`errorAfterWrite` 和 delete；JSON 专项继续覆盖 raw legacy 和 corrupt JSON skip。
- JSON adapter 的 atomic rename 增加短暂 `EPERM`/`EBUSY` 重试，降低 Windows 并行测试或本机索引器短暂占用导致的误报，同时保留同目录 temp rename 协议。
- `.env.example`、`.gitignore`、README、架构文档、产品 brief、session storage migration plan 和 dynamic database plan 已同步可选本地 SQLite 边界。
- Pasteur 只读检查了 storage facade、JSON adapter、contract tests、route 兼容、依赖治理与文档落点，确认核心风险在 env 懒加载、revision/transaction、同跑 contract 和路径污染；子代理未编辑文件，未运行 Git 写命令。
- Averroes 执行提交前只读复审，未发现 P0/P1/P2 blocker；额外验证了默认 JSON 路径不会加载 SQLite、两个 SQLite adapter 实例指向同一临时库时 stale revision 会 409、route/list payload 未暴露 DB 路径/raw state/隐藏关系。复审子代理未编辑文件，未运行 Git 命令。

验证：

- `node --check src\storage\sessionRecord.js`
- `node --check src\storage\jsonSessionAdapter.js`
- `node --check src\storage\sqliteSessionAdapter.js`
- `node --check src\storage\sessionStore.js`
- `node --check scripts\importJsonSessionsToSqlite.js`
- `node --check test\sessionStoreAdapterContract.test.js`
- `node --test test\sessionStoreAdapterContract.test.js`，20 项通过
- `node --test test\sessionStore.test.js test\gameSavesRoute.test.js`，19 项通过
- `$env:STORAGE_ADAPTER='sqlite'; $env:SQLITE_DATABASE_PATH='data/test-route-storage.sqlite'; node --test test\gameSavesRoute.test.js`，1 项通过
- `node --test test\gameTurnRoleWorldCoupling.test.js test\gameTurnTick.test.js test\sessionStore.test.js test\sessionStoreAdapterContract.test.js`，49 项通过
- `node --test test\gameTurnTick.test.js test\streamingTurnRoute.test.js test\examSceneTime.test.js test\examProgressRoute.test.js test\gameSavesRoute.test.js test\sessionStoreAdapterContract.test.js test\sessionStore.test.js`，55 项通过
- `$env:STORAGE_ADAPTER='sqlite'; $env:SQLITE_DATABASE_PATH='data/test-route-turn-storage.sqlite'; node --test test\gameTurnTick.test.js`，8 项通过
- `node scripts\importJsonSessionsToSqlite.js --db data\test-import.sqlite`，临时库导入 47 个当前本地 JSON 存档，0 skipped，随后删除临时库
- `$env:AI_PROVIDER='mock'; $env:STORAGE_ADAPTER='json'; node -e ".../api/health..."`，返回 `{"ok":true,"aiProvider":"mock"}`
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，311 项通过
- `git diff --check`

风险/遗留：

- `node:sqlite` 在当前 Node 24 运行时可用，但显式 SQLite 模式要求运行时支持该标准库；旧 Node 可继续使用默认 JSON，SQLite contract 在缺失 `node:sqlite` 时会跳过。
- 首次全量并行 `npm test` 在 JSON atomic rename 处复现过既有 Windows `EPERM` 抖动；本步骤补了短重试后，失败 focused 用例和后续全量并行 `npm test` 均通过。
- S49.3 只做 session row，不做 event log、AI proposal audit、业务表拆分、远程存档、账号或多人。
- 下一步 S49.4 应追加事件日志和 AI proposal 审计，并同步检查 AI 权限矩阵。

下一步：

- S49.4：事件日志与 AI proposal 审计，记录模型建议、服务器接受/拒绝和最终应用事件。

### 2026-05-07

工具：Codex；只读探索子代理 Bacon；提交前只读复审 Hooke

步骤：S49.4

提交：`092de20 feat: add local audit logs for AI proposals`

完成：

- 新增 adapter 级审计契约：`appendAuditEvent()`、`appendAiProposal()`、`listAuditEvents()`、`listAiProposals()`。
- JSON adapter 追加本地 `data/audit/*.jsonl` sidecar；SQLite adapter 追加 `event_log` 与 `ai_change_proposals` 表。两者共用 `src/storage/sessionAudit.js` 的 schema、脱敏、路径/key 隐藏和安全 session id 规则。
- `mutateSession()` context 新增 `appendAuditEvent()` / `appendAiProposal()` 队列；路由通过 context 排队审计记录，保持 JSON/SQLite adapter 边界。Hooke 提交前复审发现 JSON sidecar 写后失败可能导致 SSE fallback 二次结算、`skipWrite` 仍写审计的语义风险；已改为 JSON sidecar 尽力追加且追加失败不抛给 route，`skipWrite` 丢弃审计队列，并补 contract tests。
- 新增 `src/game/audit.js`，为开局、普通回合、考试取题、考试局部推进和交卷评分生成脱敏审计摘要。普通回合记录 provider proposal、服务器接受的 state delta、拒绝原因、最终应用事件 id；考试评分记录模型分数与服务器反作弊/榜单/晋级裁决。
- 新增 `test/auditRoute.test.js`，覆盖 provider 越权 proposal 只入审计不写业务状态、流式失败不写状态/审计、考试评分 proposal 被服务器裁决覆盖。
- README、架构文档、产品 brief、session storage migration plan、dynamic database plan、shared context 和本台账同步 S49.4 本地审计边界。
- Bacon 只读探索了普通回合、考试、storage adapter、测试和泄漏风险 hook 点，建议把审计 API 放在 adapter contract 并通过 `mutateSession()` context 统一消费；子代理未编辑文件，未运行 Git 命令。
- Hooke 提交前只读复审首轮发现 JSON sidecar 写后失败可能导致 SSE fallback 二次结算、`skipWrite` 仍写审计的语义风险；修复后 follow-up 复审确认无 P0/P1/P2 blocker。剩余风险是 JSON sidecar 非事务性，已记录为默认 JSON 的诊断性取舍。

验证：

- `node --check src\storage\sessionAudit.js`
- `node --check src\storage\jsonSessionAdapter.js`
- `node --check src\storage\sqliteSessionAdapter.js`
- `node --check src\game\audit.js`
- `node --check src\routes\game.js`
- `node --check src\routes\exam.js`
- `node --check test\auditRoute.test.js`
- `node --check test\sessionStoreAdapterContract.test.js`
- `node --test test\auditRoute.test.js`，3 项通过
- `node --test test\sessionStoreAdapterContract.test.js`，23 项通过
- `node --test test\streamingTurnRoute.test.js test\aiControlRedTeam.test.js`，9 项通过
- `node --test test\gameTurnTick.test.js test\gameTurnRelationships.test.js test\gameTurnExamTrigger.test.js`，16 项通过
- `node --test test\examTravel.test.js`，6 项通过
- `npm run check:docs-governance`
- `$env:AI_PROVIDER='mock'; npm test`，317 项通过
- `git diff --check`

风险/遗留：

- JSON sidecar 审计记录和 session JSON 不是同一物理事务；JSON 模式在 session 成功后尽力追加审计，sidecar 追加失败不让已提交回合报错或重试。SQLite 模式可在本地 transaction 中保存 session row 与审计表。默认 JSON 仍优先保证本地可玩和旧存档兼容。
- 审计记录是本地调试/未来检索底座，不是玩家 API；未来事件档案 UI 必须读取服务器 projection，不能直接暴露 raw audit payload。
- 下一步 S50.1：静态天下与邻国种子契约。
