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
| S49.4 | TODO | 事件日志与 AI proposal 审计：记录模型建议、服务器接受/拒绝和最终应用事件 |  |  |  |
| S50.1 | TODO | 静态天下与邻国种子契约：国家、城市、路线、边境、官署辖区和初始可见性 |  |  |  |
| S50.2 | TODO | per-session 国家/城市实例化与 prompt projection，先不替代现有 worldState 指标 |  |  |  |
| S51.1 | TODO | NPC、家族、资产、田产、关系和可见性 schema 契约 |  |  |  |
| S51.2 | TODO | 桥接当前 `characters`、`relationshipLedger`、active requests 与 NPC/关系表 |  |  |  |
| S52.1 | TODO | 官职、官署、任所、城市辖区、考成和调任记录的数据库契约 |  |  |  |
| S52.2 | TODO | 地方官/入仕官员任所与城市数据联动，保持服务器任免裁决 |  |  |  |
| S53.1 | TODO | 检索式 prompt context assembler：按角色视野读取国家、城市、NPC、官职、事件摘要 |  |  |  |
| S53.2 | TODO | 浏览器信息面板规划：天下格局、任所地理、人物谱牒、官职簿、事件档案 |  |  |  |

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
- `$env:AI_PROVIDER='mock'; npm test`
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

目标：

- 增加 append-only `event_log`，记录关键状态变化、来源模块、时间戳、年月旬、scene cadence、可见性和 session revision。
- 增加 `ai_change_proposals`，保存模型提出的结构化建议、schema 校验结果、服务器接受/拒绝原因和最终应用事件 id。
- 普通 provider 仍只返回受限 JSON；所有 proposal 都由服务器模块转换成可写事务。
- 日志服务于调试、回放、prompt 检索和未来“事件档案” UI，不替代当前 state snapshot。

验收：

- provider 越权 proposal 不写入业务状态，只进入审计记录并标记拒绝。
- 日志不泄漏 API key、本地文件路径或隐藏信息到玩家视图。
- 保存失败不能留下半写状态。

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
