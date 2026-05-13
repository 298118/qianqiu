# S71 数据库玩法化、维护与安全 API 规划

本文承接 S49-S67 本地数据库与超大动态世界内容归档，以及 S70 AI prompt / tool / actor 编排归档。目标是把现有“安全索引 / projection / 局势簿”继续推进为真正驱动玩法的服务器 resolver 输入，同时补齐本地数据库维护、全文检索、redacted API、AI actor 角色卡、压力事件、场景推演、NPC 记忆和 AI 调动可观测性。S71.0 已将 resolver 输入边界收束为 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)，S71.1 已按该契约落地只读 `resolverInputContext` 初版，S71.2 已落地本地 SQLite migration/maintenance 初版，S71.3 已落地安全全文检索，S71.4 已落地 redacted player API 与本机开发诊断 API，S71.5 已落地财政与城市政策服务器 resolver，S71.6 已落地地方案件与刑名服务器 resolver；后续玩法 resolver 应优先复用该输入层、本地维护工具、玩家/诊断分层和 proposal-only 领域工具边界。

## 1. 台账位置建议

本规划最初用于避免 S71 插队 S69/S70；当前 S68-S69 科举深化与 S70 AI 编排均已归档，S71 可以按本路线图顺序正式推进。

推荐放置顺序：

1. **S69.3-S69.6 已完成科举授官与归档**：书生主线制度深化已迁入科举归档。
2. **S70.1-S70.14 已完成 AI prompt / tool / actor / AI-first 验收与归档**：prompt 分层、工具协议、`game_ai_tools` registry、权限检查、审计 hook、Mock runner、真实 provider smoke、月报、跳时、记忆和地图接口已具备。
3. **S71 作为 S70 之后的数据库玩法化专项**：把数据库 projection 输入正式接入财政、地方政策、战役、外交、案件、事件链、全文检索、维护工具和安全 API。

如果后续开发需要并行，S71.1/S71.2/S71.3 这类文档、维护和检索基础可在 S70.3 完成后先行；但任何会调用 AI tool、保存 hidden 私档或改变玩法裁决的实现，必须等 S70 工具协议和权限层落地。

职责口径固定：S70 做 prompt、工具协议、actor 权限、场景编排和 Mock/provider 基础能力；S71 做数据库 projection 驱动的玩法 resolver、维护层、安全检索、redacted API 和面板化落地。

## 2. 核心原则

- JSON/Mock 默认可玩不变；SQLite 仍是本机增强，不引入远程存档、账号、多人与云同步。
- 数据库行可以成为服务器 resolver 的输入，但不能成为 AI 的写入口。AI 只能读取服务器 projection、提交 proposal 或 request-adjudication。
- 玩法 resolver 写入仍走服务器 helper、schema、clamp、visibility filter、adapter transaction、事件档案和审计。
- SQLite 派生表继续从 `world_sessions.world_state_json` 与服务器 view 单向修复；raw `geo_*`、`people_*`、`office_*`、`event_archive_index` 和 `prompt_retrieval_index` 不反向改写 canonical 状态。
- hidden 私档、资产真数、邻国虚实、考官私意、密档事件链和 hidden intent 不得写入当前玩家 state route；先做 redacted API 与角色视野分层，再谈 hidden 私档。
- 新增任何工具、resolver、维护命令、搜索索引、浏览器面板或诊断 API，都必须补 AI 权限边界、Mock/no-key fallback、JSON/SQLite parity、hidden-token 与越权红队。

## 3. S71 子步骤建议

| ID | 目标 | 主要产物 | 验收重点 |
| --- | --- | --- | --- |
| S71.0 | 专项契约与接入点 | 本文件、[DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)、brief/context/AI 矩阵补充、resolver 输入清单 | 不改运行时；明确 S70 依赖、S71 边界、禁止源和测试矩阵 |
| S71.1 | 数据库作为玩法 resolver 输入 | `resolverInputContext` 契约与初版实现；城市/国家/NPC/官职/事件/情报 projection 到 resolver 的只读输入 | 已落地；resolver 不读 raw table；AI 不能写输入；JSON/SQLite 输入 parity |
| S71.2 | 本地 schema migration 与维护层 | `schema_migrations`、维护命令、备份、VACUUM、索引健康、数据库体积提示 | 已落地；dry-run 不改库；输出不泄漏路径/key/hidden；Windows/Node SQLite 可用 |
| S71.3 | 安全全文检索 / 本地搜索 | 已落地：`safeWorldSearch`、`safe_search_index` / 可选 FTS5 镜像、`GET /api/game/search/:sessionId` | 只索引玩家可见 projection；查询和 snippet 有 cap；污染行可修复 |
| S71.4 | Redacted player API 与开发诊断 API | 已落地：`redactedState`、`GET /api/game/player-state/:sessionId`、`GET /api/dev/session-diagnostics/:sessionId`、前端读档切换 | hidden 私档前置条件；普通 UI 不拿完整 raw state |
| S71.5 | 财政与城市政策 resolver | 已落地：`cityPolicyResolver`、`cityPolicyResolverConfig`、`city.propose_policy` policy enum 扩展、domain tool bridge | 从城市/经济 projection 取输入；AI 只给政策 proposal，server 内部裁决后才写受控 meters |
| S71.6 | 地方案件与刑名 resolver | 已落地：`judicialCaseResolver`、`judicialCaseConfig`、`judicial.propose_case_resolution` action enum 扩展、domain tool bridge | 证据不足能拒绝；县令不越权；公开案牍只显示可见证据摘要 |
| S71.7 | 军务与外交 resolver | 侦察、固守、调粮、练兵、会战、朝贡、互市、和议、宣战 proposal | 兵粮、地形、情报可信度和授权检查；AI 不能直接开战/议和 |
| S71.8 | 压力驱动事件生成器 | 从粮价、水利、腐败、边防、NPC 怨怼、财政缺口生成事件候选 | 服务器成案；冷却/概率配置集中；hidden 不泄漏 |
| S71.9 | 多 actor 场景运行时 | 朝议、堂审、会盟、战役 scene-local time；多 actor 发言和提案 | 场景不乱推全局旬；每个 actor 只见自身视野 |
| S71.10 | NPC 记忆账本 | 高显著 NPC 记忆、人情债、恩怨、家族风险、目标；背景 NPC heuristic | 记忆可解释、可裁剪、可审计；不全量 LLM 调用 |
| S71.11 | AI 调动审计面板 | 工具调用摘要、拒绝原因、成本、public result、hidden-safe 开发诊断 | 不显示 raw prompt、raw proposal、key、本地路径、hidden ledger |
| S71.12 | S71 验收与归档 | JSON/SQLite parity、Mock/no-key、provider smoke、browser smoke、归档 | 完整书生路径和 S69 成果不回退 |

## 4. Resolver 输入分层

S71.1 已新增一个明确的 resolver 输入层，避免各玩法模块随意读取 raw ledger 或 raw SQLite table。字段、允许来源、禁止来源、evidence ref、AI 权限和 JSON/SQLite parity 验收以 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md) 为准；本节只保留路线图摘要。

推荐形态：

```text
buildResolverInputContext(worldState, options)
  identity: player role / actor profile / scene type
  geography: capped city/country/frontier metrics
  people: relevant NPC / family / relationship rows
  offices: relevant office/posting/docket/assessment rows
  economy: fiscal, grain, market and debt pressure rows
  military: frontier, garrison, supply and diplomatic pressure rows
  events: recent public event archive and unresolved thread rows
  intel: role-visible rumors with confidence and source labels
  safety: source views, caps, hidden filtering, generatedAt revision
```

规则：

- resolver 输入只从 server view、safe prompt retrieval source、event archive safe rows 或受控 fixture projection 生成。
- 输入对象必须带 `sourceView`、`visibility`、`confidence`、`relatedRefs`、`generatedAtTurn` 和 caps 元数据。
- resolver 只能把输入当作证据和压力来源，不能把 SQLite 派生表当作 canonical truth。
- 输入污染探针必须覆盖 raw table 名、`world_state_json`、`event_log`、`ai_change_proposals`、本地路径、key、hidden notes、hidden intent 和完整 prompt 片段。

## 5. 数据库维护层

S71.2 的维护层已先做成本地命令，不改变默认启动方式：

- `schema_migrations`：记录本地 SQLite schema 版本、迁移 id、应用时间、校验摘要和失败原因。早期 `CREATE TABLE IF NOT EXISTS` 仍保留，但新增/变更表已有 migration runner 入口。
- `storage:sqlite:status`：输出表数量、索引数量、session 数、迁移状态、派生表漂移摘要和数据库体积；输出必须脱敏。
- `storage:sqlite:backup`：用 SQLite `VACUUM INTO` 生成本地备份，默认不覆盖；路径不进入 JSON 输出、游戏 API、prompt 或 browser。
- `storage:sqlite:vacuum`：在显式命令下执行 WAL checkpoint、`VACUUM` 与 `PRAGMA optimize`，支持 `--dry-run`。
- `storage:sqlite:health`：检查缺表、缺索引和基础 index health；contentHash 漂移通过派生表 drift status 汇总。
- `storage:sqlite:export-safe`：只导出统计、索引健康和派生表漂移摘要，不导出 hidden/raw/provider proposal。

验收已覆盖 dry-run 不创建数据库、缺 `node:sqlite` 时受控 skip、Windows/WSL 路径与 key 脱敏、损坏/缺失派生行可由 `world_state_json -> server view` 漂移探针发现。

## 6. 安全全文检索

S71.3 已落地安全全文检索初版。JSON 路径由 `src/game/safeWorldSearch.js` 从服务器安全 view 即时生成搜索行；SQLite 路径由 `src/storage/sqliteSafeSearchTables.js` 同步 `safe_search_index`，当前 Node SQLite 支持 FTS5 时额外维护 `safe_search_fts`，不支持时使用本地 `LIKE` fallback，不新增外部依赖。

索引范围：

- 可索引：`worldGeographyView` 的地名/公开摘要、`worldPeopleView` 的可见人物/关系摘要、`officialPostingsView` 的公开官职/任所摘要、`localAffairsDocketView` 案牍、`militaryDiplomacyView` 军务报告、`economicFiscalView` 财赋报告、`eventArchiveView` 公开事件、`intelligenceRumorView` 角色可见传闻、`historicalEventArchiveView.publicChains`。
- 不索引：内部审计、provider 原始响应、完整 prompt、hidden notes、hidden intent、资产真数、未公开关系、密档链、数据库路径、key。

推荐接口：

```text
GET /api/game/search/:sessionId?q=&domain=&page=&pageSize=

searchSafeWorldIndex(worldState, {
  query,
  domains,
  role,
  actorId,
  page,
  pageSize,
  sourceViews
})
```

搜索结果只返回 safe snippet、sourceView、sourceId、domain、visibility、confidence、relatedRefs 和可跳转的 route view ref，不返回内部行。敏感查询会 `queryRejected`，pageSize 最大 25；SQLite 读档会用内容 hash 修复 `safe_search_index` 同 id/同 revision 污染，FTS mirror 也按 canonical index 重建。

## 7. Redacted API 前置

S71.4 是 hidden 私档真正落地前的硬门槛。

建议拆分：

- `GET /api/game/state/:sessionId` 短期保持开发兼容，但新增 `?view=player` 或新 route 返回 redacted player state。
- `GET /api/game/player-state/:sessionId`：只返回玩家可见 state、route views、information panel、可见事件档案和安全 metadata。
- `GET /api/dev/session-diagnostics/:sessionId`：仅本地开发使用，返回脱敏统计、表健康、resolver 输入摘要、工具调用统计；默认不返回 raw hidden，不暴露 key/path/prompt。
- hidden 私档模块只能在 redacted player API 和 hidden-token smoke 完成后启动。

这样后续才能保存 NPC hidden intent、邻国真实虚实、资产真数、考官私意和密档事件链，而不会被普通本地玩家 UI 或 prompt 误读。

## 8. 玩法 Resolver 方向

### 财政与城市政策

输入：`economicFiscalView`、`worldGeographyView.cities`、`localAffairsDocketView`、`officialPostingsView.assessmentRecords`、`worldEntityView`。

动作：征粮、开仓、平粜、修堤、清丈、减免、追赃、调拨、赈济、盐漕整顿。

服务器裁决：财政余量、粮储、市价、民心、腐败、士绅阻力、上级授权、季节灾害和执行链。AI 只提交 `city.propose_policy` 或 `office.propose_memorial`。

### 地方案件与刑名

输入：案牍 projection、NPC 关系、家族势力、城市治安、胥吏/士绅压力、证据链。

动作：受理、传唤、查证、羁押、调解、判决、申详、驳回、移交。

服务器裁决：证据可信度、律例边界、辖区、职权、民情、关系压力和后续怨怼。AI 可以生成堂审发言和判决 proposal，但不能直接定罪或公开 hidden 证据。

### 军务与外交

输入：`militaryDiplomacyView`、边镇/驻军/粮道、邻国关系、情报可信度、府库粮储、将领声望。

动作：侦察、固守、练兵、调粮、出击、撤军、议和、朝贡、互市、扣使、威慑、宣战 request。

服务器裁决：军需、地形、士气、授权、外交后果、财政压力、情报可信度和朝局阻力。AI 不能直接改战争状态、外交关系或战役胜负。

### 压力事件生成器

输入：城市粮价高 + 水利差 + 腐败高；边防紧张 + 粮道差 + 邻国继承风险；NPC 怨怼高 + 家族风险；科举不公传闻 + 士林压力等。

输出：事件候选、涉事人物、地点、公开摘要、hidden 后果引用、resolver 建议和冷却键。

服务器决定是否成案、何时公开、影响哪些 meter、是否写事件档案。

## 9. AI Actor、场景与记忆

S70 会定义 actor profile 和工具协议，S71 负责把它们用在数据库玩法上。

AI actor 角色卡最少包含：

- `actorId`、`actorType`、`authorityTier`、`role`、`officeId`、`jurisdictionRefs`
- `visibleScopes`、`allowedToolGroups`、`forbiddenToolGroups`
- `goals`、`riskTolerance`、`loyalty`、`ambition`、`resentments`、`obligations`
- `memoryRefs`、`recentPublicMemory`、`privateMemoryRef`
- `budgetPolicy`、`mockPolicy`、`cooldowns`

场景运行时：

- 朝议：大臣、御史、皇帝围绕政令/弹章/财政/边事发言。
- 堂审：原告、被告、证人、胥吏、士绅、县令围绕证据和律例推进。
- 会盟：使节、礼官、边将、翻译围绕贡礼、互市、边界和人质谈判。
- 战役：将领、军需、侦骑、地方官围绕地形、兵粮、士气和情报行动。

NPC 记忆账本：

- 高显著 NPC 可有长期记忆、人情债、恩怨、家族风险、师门/同年关系和当前目标。
- 背景 NPC 不全量调用模型，使用服务器启发式和批处理事件。
- 记忆摘要进入 prompt 时必须 capped；private memory 先等 redacted API 完成。

## 10. AI 调动审计面板

S71.11 的面板可以让开发者和玩家理解 AI 参与世界的方式，但必须分层：

- 玩家可见：本回合有哪些公开奏报、事件、提案被采纳、哪些政策/案件/战事有公开后果。
- 开发诊断：tool name、actor、status、拒绝原因、耗时、token/cost 摘要、applied event id。
- 禁止显示：raw prompt、raw provider proposal、hidden ledger、hidden intent、key、本地路径、数据库原始行和完整 SQL。

浏览器实现应只读 route view 或 dev diagnostics safe projection，不扫描 raw `worldState`、raw audit 或 SQLite 表。

## 11. 后续 Codex 开发执行规则

S71 后续开发应按“一个子步骤一个 coherent change”的粒度推进。每一步开始前仍先读 `AGENTS.md`、`docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md` 和 `docs/DEVELOPMENT_STEPS.md`，再检查 `git status --short`。S69 正在开发时不要穿插实现 S71 运行时代码；若只补文档或调研资料，也要在共享上下文写明“不改变 S69 节奏”。

开发节奏建议：

1. S71.0 只做契约和接口清单，不改运行时。
2. S71.1-S71.4 先做基础设施：resolver input、migration/maintenance、安全搜索、redacted API。
3. S71.5-S71.8 再做玩法 resolver：财政/城市、刑名、军务外交、压力事件。
4. S71.9-S71.11 接 AI actor 场景、NPC 记忆和审计面板。
5. S71.12 做验收、归档和台账压缩。

每个实现步骤必须同步：

- `docs/DEVELOPMENT_STEPS.md`：开始时可标 `IN_PROGRESS`，完成后标 `DONE` 并写验证。
- `docs/SHARED_CONTEXT.md`：写当前状态、重要边界、验证、下一步。
- `docs/QIANQIU_DEVELOPMENT_BRIEF.md` 或相关契约：若 API、状态字段、工具协议、依赖或验收变了必须同步。
- `docs/AI_CONTROL_AUDIT_MATRIX.md`：凡新增 AI 可读摘要、工具、proposal、resolver、审计或浏览器面板，都要检查并更新。

代码改动提交前必须请只读子代理复审最终 diff 和验证证据；纯文档低风险改动可以跳过，但要在共享上下文或最终回复说明。子代理不得 `git add`、`git commit`、`git push` 或创建 PR。

## 12. 依赖与资料准备

### 12.1 运行依赖

优先不新增 npm 依赖。当前项目已经有：

- Node.js + Express plain JavaScript。
- `node:sqlite` 用于本地 SQLite adapter；如果当前 Node runtime 不支持 `node:sqlite`，SQLite 相关命令必须受控 skip 或给出可读错误。
- `ajv` 用于 JSON schema 校验。
- `playwright-core` 仅作 browser smoke。

S71 各步默认依赖现有能力：

- migration、维护、FTS/status/backup 优先基于 `node:sqlite`、`node:fs`、`node:path`、`node:crypto`。
- 安全搜索优先评估 SQLite FTS5；若不可用，先做 `LIKE` / token fallback，不立刻加 `better-sqlite3`、`sqlite3`、Lunr、FlexSearch 或其他搜索库。
- AI 工具运行时依赖 S70 的 `game_ai_tools` registry、actor profile、tool envelope、audit hook 和 Mock runner；S71 不重新发明工具协议。

若确需新增依赖，先按 [DEPENDENCY_PLUGIN_GOVERNANCE.md](DEPENDENCY_PLUGIN_GOVERNANCE.md) 记录：用途、替代方案、许可证、维护状态、安全影响、Mock/no-key 影响、测试和回滚策略。未经治理，不要为了 FTS、迁移或 UI 面板引入新框架。

### 12.2 项目内资料

S71 开发主要使用已有项目资料，不需要先做大规模外部资料收集：

- 数据库与内容归档：`docs/LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md`。旧分卷归档和 S60 内容契约文件只作为历史跳转页保留。
- AI 权限：`docs/AI_ORCHESTRATION_ROADMAP.md`、`docs/AI_CONTROL_AUDIT_MATRIX.md`、后续 S70 产出的 prompt/tool/actor 契约。
- 当前安全 projection：`worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`historicalEventArchiveView`、`intelligenceRumorView`、`eventArchiveView`、`informationPanelPageView`。
- 当前 SQLite 派生层：`src/storage/sqliteSessionAdapter.js`、`sqliteGeographyTables.js`、`sqlitePeopleTables.js`、`sqliteOfficialPostingTables.js`、`sqliteEventArchiveTables.js`、`sqlitePromptRetrievalTables.js`。
- 当前维护工具样式：`scripts/sqliteGeographyTool.js`、`scripts/auditEventArchiveTool.js`、`scripts/importJsonSessionsToSqlite.js`。

### 12.3 玩法资料

为避免空泛，S71 每个玩法 resolver 需要整理一页以内的“领域资料笔记”，优先写入对应契约或 config 注释，不把资料塞进 prompt：

- 财政城市：钱粮、仓储、平粜、赈济、清丈、水利、盐漕、徭役、士绅阻力、上级考成。
- 刑名案件：受理、传唤、证据、口供、保甲/胥吏、调解、申详、驳回、移交、判决后果。
- 军务外交：兵粮、士气、地形、边报、侦察、守御、练兵、会战、互市、朝贡、和议、宣战授权。
- 朝议/堂审/会盟/战役：每类 scene 的参与者、结束条件、可见证据、能提出的 proposal 和服务器裁决点。
- NPC 记忆：恩怨、人情债、师门、同年、家族风险、官场派系、目标、衰减与可见性。

外部历史资料可以作为设计参考，但不能复制长篇版权文本进仓库。若引用具体制度说明，优先用公版史料、学术/博物馆/百科类可核验资料，并在文档中只写简要设计转译；S71 验收不依赖联网。

### 12.4 测试资料

每步至少准备这些 fixture：

- `small`：默认 Mock 书生路径，可快速跑单测。
- `medium`：含多城市、多 NPC、多官职、多案牍、多事件链。
- `large`：沿用 S60-S67 scale fixture，验证 resolver input、搜索、维护和信息面板性能。
- `hidden-canary`：包含 `hiddenNotes`、`hiddenIntent`、`event_log`、`ai_change_proposals`、本地路径、key 形状、raw prompt 形状、raw table 名称。
- `authority-redteam`：书生宣战、县令调边军、将领擅自开战、皇帝无证杀臣、AI 夹带 SQL、工具伪造已执行结果。

## 13. S71 逐步开发任务书

### S71.0：专项契约与接入点

前置依赖：S70.14 完成后正式启动；若提前做，只限文档和接口清单。

需要资料：本文件、S70 prompt/tool/actor 契约、S49-S67 数据库归档、AI 权限矩阵、当前 route view 清单。

具体实现：

- 把本文件升级为正式执行契约，确认 S71 不绕 S70 工具协议。
- 新增或固定 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)，建立 `resolverInputContext` 字段清单、允许来源、禁止源清单、evidence ref 和测试矩阵。
- 在 `docs/DEVELOPMENT_STEPS.md` 保持 S71.0-S71.12 的 ID、目标和前后依赖。
- 在 `docs/AI_CONTROL_AUDIT_MATRIX.md` 固定 S71 权限：AI 只读 projection、只提 proposal/request-adjudication、服务器 resolver 写库。

建议产物：

- `docs/DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md` 本文件。
- `docs/DATABASE_RESOLVER_INPUT_CONTRACT.md`，作为后续实现前的细 schema 与边界契约。

验收：

- `npm run check:docs-governance`
- `git diff --check`
- 文档中明确本地 only、redacted API 前置、hidden 不回填普通 state route、AI 不直写 DB。

### S71.1：数据库作为玩法 resolver 输入

前置依赖：S71.0；S70.3 之后可先做无 AI 调用版本。

当前状态：已完成初版实现。`src/game/resolverInputConfig.js` 集中 schema version、domain cap、字符 cap、source allowlist、敏感 token 和 actor read-domain 映射；`src/game/resolverInputContext.js` 从既有 server view 构造 capped evidence buckets，导出 `buildResolverInputContext()`、`filterResolverInputForActor()`、`summarizeResolverInputForAudit()`、`createResolverEvidenceRefs()` 和 `assertResolverInputSafe()`；`test/resolverInputContext.test.js` 覆盖 schema/caps、actor visibility、hidden/raw 污染、medium fixture cap 与 JSON/SQLite adapter parity。

需要资料：所有 route view builder、`sqlitePromptRetrievalTables.js` 的 compact row 逻辑、S60-S67 fixture、hidden-canary。

具体实现：

- 新增 `src/game/resolverInputContext.js`：
  - `buildResolverInputContext(worldState, options)`
  - `filterResolverInputForActor(context, actorProfile)`
  - `summarizeResolverInputForAudit(context)`
  - `createResolverEvidenceRefs(context)`
- 新增 `src/game/resolverInputConfig.js`：每类输入的数量 cap、字符 cap、优先级、默认可信度、压力权重。
- 输入来源只允许 server view / safe retrieval rows / public event archive；禁止直接读 raw SQLite table、`world_state_json`、`event_log`、`ai_change_proposals`、raw prompt、hidden ledger。
- 输出对象按领域分组：`geography`、`people`、`offices`、`economy`、`military`、`events`、`intel`、`player`、`map`、`memory`、`safety`。
- 每条证据带 `sourceView`、`sourceId`、`visibility`、`confidence`、`relatedRefs`、`generatedAtTurn`。

测试：

- `test/resolverInputContext.test.js`
- JSON 与 SQLite adapter 同一 session 输入一致。
- hidden-canary 不进入 context、audit summary、prompt retrieval。
- 大 fixture 下 context size 和构建耗时有基线。

验收功能：

- 财政、刑名、军务、外交、事件生成器后续都能只拿这个 context 开工。
- resolver 不需要知道当前是 JSON 还是 SQLite。

### S71.2：本地 schema migration 与维护层

前置依赖：S71.1；不依赖 AI provider。

当前状态：已完成初版实现。`src/storage/sqliteMigrations.js` 提供 `initializeSchemaMigrationsTable()`、`listAppliedMigrations()`、`applyPendingMigrations()` 和 `assertMigrationIntegrity()`；`schema_migrations` 由 SQLite adapter 初始化，migration runner 支持 dry-run 不写库、checksum mismatch 阻断、单 migration 事务、失败不落 applied、forward-only 和破坏性迁移显式备份确认。`src/storage/sqliteMaintenance.js` 提供数据库状态、索引健康、派生表漂移、备份、VACUUM 和安全诊断导出；`scripts/sqliteMaintenanceTool.js` 与 package scripts 提供 `storage:sqlite:status|health|backup|vacuum|export-safe`。本步不新增玩家 route、浏览器面板、AI provider 行为、FTS 搜索索引或玩法 resolver。

需要资料：`sqliteSessionAdapter.js` 初始化逻辑、现有 `CREATE TABLE IF NOT EXISTS`、`sqliteGeographyTool.js` 命令结构、Node `node:sqlite` PRAGMA 支持。

具体实现：

- 新增 `src/storage/sqliteMigrations.js`：
  - `initializeSchemaMigrationsTable(db)`
  - `listAppliedMigrations(db)`
  - `applyPendingMigrations(db, migrations, options)`
  - `assertMigrationIntegrity(db)`
- 新增表 `schema_migrations`，字段建议：`migration_id`、`schema_version`、`applied_at`、`checksum`、`status`、`error_summary`。
- 将新表/索引变更走 migration runner；旧 `CREATE TABLE IF NOT EXISTS` 保留作首次启动兜底，但新能力不继续散落。
- 迁移失败策略必须固定：单个 migration 在事务内执行；checksum mismatch 直接阻断并提示人工检查；失败的 migration 不得标记为 applied；破坏性迁移前建议先执行本地备份；早期只支持 forward-only migration，不做自动 down migration；重复运行同一 migration 必须幂等且不改变数据。
- 新增 `src/storage/sqliteMaintenance.js`：
  - `getSqliteDatabaseStatus(db)`
  - `getSqliteIndexHealth(db)`
  - `getDerivedTableDriftStatus(db, sessionId)`
  - `backupSqliteDatabase(databasePath, options)`
  - `vacuumSqliteDatabase(databasePath, options)`
  - `exportSafeSqliteDiagnostics(db, options)`
- 新增 `scripts/sqliteMaintenanceTool.js`，并在 `package.json` 增加脚本：
  - `storage:sqlite:status`
  - `storage:sqlite:health`
  - `storage:sqlite:backup`
  - `storage:sqlite:vacuum`
  - `storage:sqlite:export-safe`

测试：

- `test/sqliteMigrations.test.js`
- `test/sqliteMaintenanceTool.test.js`
- dry-run 不创建/修改数据库。
- migration 幂等、checksum mismatch 阻断、事务回滚、失败不落 applied、forward-only 行为和破坏性迁移前备份提示。
- 缺 `node:sqlite` 时命令受控 skip 或返回可读错误。
- 输出不包含真实本地路径、key、raw prompt、hidden/private 字段。

验收功能：

- 开发者能知道当前 SQLite 体积、表/索引是否齐全、派生表是否漂移、是否需要 `VACUUM`。
- 备份和导出只在本地命令行使用，不进入玩家 API。

### S71.3：安全全文检索 / 本地搜索

前置依赖：S71.2；可在没有 S70 AI 工具时先做 UI/route 检索。

需要资料：`prompt_retrieval_index` 结构、FTS5 可用性探测、`informationPanelPageView` 分页逻辑、hidden-canary。

具体实现：

- 新增 `src/storage/sqliteSafeSearchTables.js`：
  - `detectSqliteFts5Support(db)`
  - `initializeSafeSearchTables(db)`
  - `syncSafeSearchTables(db, record)`
  - `searchSafeSearchTables(db, sessionId, query, options)`
  - `repairSafeSearchTablesForRecord(db, record)`
- 若 FTS5 可用，建 `safe_search_fts`；若不可用，建普通 `safe_search_index` 并走 token/LIKE fallback。
- 新增 `src/game/safeWorldSearch.js`：
  - `searchSafeWorldIndex(worldState, options)`
  - `normalizeSearchQuery(query)`
  - `buildSafeSearchSnippet(row, query)`
- 可选新增 route：`GET /api/game/search/:sessionId?q=&domain=&page=&pageSize=`，只返回玩家可见 snippet 和 source ref。
- 结果字段：`domain`、`sourceView`、`sourceId`、`title`、`snippet`、`confidence`、`visibility`、`relatedRefs`、`routeViewRef`。

测试：

- `test/sqliteSafeSearch.test.js`
- `test/safeWorldSearch.test.js`
- FTS5 available/unavailable 两套路径。
- 查询 raw table 名、key 形状、hidden 字段不能返回内容。
- page/pageSize/query length 有 cap。

验收功能：

- 玩家能搜索人物、城市、事件、奏报、传闻、官职摘要。
- AI prompt 若使用搜索，只能拿 capped safe snippet，不拿 raw row。

### S71.4：Redacted player API 与开发诊断 API

状态：已实现。当前代码入口为 `src/game/redactedState.js`、`src/routes/game.js` 的 `/player-state/:sessionId` 和 `src/routes/dev.js` 的 `/session-diagnostics/:sessionId`。

前置依赖：S71.3；真正 hidden 私档功能必须等本步完成后才能启动。

需要资料：现有 `/api/game/state/:sessionId` 返回结构、浏览器读取路径、save-list 脱敏规则、hidden-canary。

具体实现：

- 已新增 `src/game/redactedState.js`：
  - `buildPlayerVisibleState(worldState, options)`
  - `buildPlayerStateEnvelope(recordOrWorldState, options)`
  - `buildDeveloperDiagnostics(recordOrWorldState, options)`
  - `redactDiagnosticValue(value)`
  - `redactPlayerRouteViews(value)`：S71.4 额外用于清洗 legacy route views。
- 已新增 route：
  - `GET /api/game/player-state/:sessionId`：普通玩家可见 state 与 route views。
  - `GET /api/dev/session-diagnostics/:sessionId`：仅本机开发诊断，返回统计、resolver input 摘要、搜索/SQLite 健康、AI 工具摘要。
- 开发诊断 route 必须默认关闭或仅在 `NODE_ENV !== "production"` 且 `ENABLE_DEV_DIAGNOSTICS=true` 时启用；同时要求远端地址为 loopback，并限制为无 `Origin` 或本机 localhost/loopback Origin，复用本地 CORS allowlist，并在测试中覆盖默认不可访问、production 不可访问和开启后仍只返回脱敏统计。
- 短期保留 `GET /api/game/state/:sessionId` 作为开发兼容 route，但文档标注它不能承载 future hidden 私档。
- 浏览器读档和局势簿分页已改为优先读取 player-state；debug 面板未来只能读取 diagnostics 安全 projection。

测试：

- `test/redactedState.test.js`
- `test/gamePlayerStateRoute.test.js`
- `test/devDiagnosticsRoute.test.js`
- hidden-canary 不进 player-state；diagnostics 只显示脱敏统计；诊断 route 默认关闭、production 关闭、远端 loopback 与 Origin 门禁生效。

验收功能：

- 后续可以安全保存 NPC hidden intent、邻国真实虚实、资产真数、考官私意和密档链，而普通 UI/prompt 不会误读。

### S71.5：财政与城市政策 resolver

状态：已实现（提交 `3cca9bd`）。`src/game/cityPolicyResolver.js` 和 `src/game/cityPolicyResolverConfig.js` 已提供首版服务器裁决；普通 S70 domain tool runner 仍 pending-only，服务器可通过 `resolveCityPolicyFromDomainTool()` 桥接 `city.propose_policy` proposal 做内部裁决。

前置依赖：S71.1、S71.4；AI 参与需等 S70 `game_ai_tools` 可用。

需要资料：`economicFiscalView`、`worldGeographyView`、`localAffairsDocketView`、`officialPostingsView`、财政城市资料笔记。

具体实现：

- 新增 `src/game/cityPolicyResolver.js`：
  - `normalizeCityPolicyProposal(proposal)`
  - `validateCityPolicyAuthority(worldState, proposal, context)`
  - `resolveCityPolicy(worldState, proposal, options)`
  - `applyCityPolicyOutcome(worldState, outcome, auditContext)`
  - `buildCityPolicyPublicEvent(outcome)`
- 新增 `src/game/cityPolicyResolverConfig.js`：政策类型、资源消耗、压力权重、冷却、最大收益/反噬。
- 支持政策：征粮、开仓、平粜、赈济、修堤、清丈、减免、追赃、盐漕整顿、徭役调整。
- S70 工具接入时模型可请求工具建议：
  - `city.propose_policy`
  - `office.propose_memorial`
- `server.adjudicate_policy` 只能作为服务器内部 resolver bridge / audit label，不得出现在模型可见 tool list、MCP `tools/list`、provider function schema 或玩家可伪造的 tool call 中；AI 若需要裁决，只能提交 policy proposal 或 request-adjudication。
- 服务器裁决输入：财政余量、粮储、市价、民心、腐败、士绅阻力、季节灾害、官职权限、辖区、上级授权。
- 当前实现写入：受控 `treasury` / `grainReserve` / `publicOrder` / `taxRate` / `corruption`、玩家官声/考成相关字段、公开 `eventHistory` 摘要和内部 `cityPolicyLedger`。`cityPolicyLedger` 不进入 redacted player state；拒绝 outcome 不改 `worldState`。

测试：

- `test/cityPolicyResolver.test.js`
- `test/cityPolicyAuthority.test.js`
- `test/cityPolicyHiddenRedaction.test.js`
- `test/cityPolicyDomainToolBridge.test.js`
- Mock/no-key deterministic proposal path。

验收功能：

- 政策会真实改变受控 meter 或生成后续事件，而不是只写一段态势文字。
- 越权政策拒绝并写审计：书生征粮、县令跨省调粮、AI 直接改 treasury 都失败。

### S71.6：地方案件与刑名 resolver

状态：已实现（提交 `4d93b2d`）。`src/game/judicialCaseResolver.js` 和 `src/game/judicialCaseConfig.js` 已提供首版服务器裁决；普通 S70 domain tool runner 仍 pending-only，服务器可通过 `resolveJudicialCaseFromDomainTool()` 桥接 `judicial.propose_case_resolution` proposal 做内部裁决。

前置依赖：S71.1、S71.4、S70 工具协议。

需要资料：`localAffairsDocketView`、`worldPeopleView`、`relationshipView`、城市治安和官职辖区、刑名资料笔记。

具体实现：

- 新增 `src/game/judicialCaseResolver.js`：
  - `normalizeCaseProposal(proposal)`
  - `buildCaseEvidenceContext(worldState, caseId, options)`
  - `validateCaseAuthority(worldState, proposal, context)`
  - `resolveJudicialCase(worldState, proposal, options)`
  - `applyJudicialCaseOutcome(worldState, outcome, auditContext)`
- 新增 `src/game/judicialCaseConfig.js`：证据可信度、惩罚范围、关系反噬、胥吏阻力、申详条件。
- 当前实现支持动作：受理、传唤、查证、调解、罚银、羁押、驳回、判决、申详、移交、缓审。
- 工具建议：
  - `judicial.propose_case_resolution`（已扩展 `caseAction` enum，并可由服务器内部 bridge 裁决）
  - `judicial.request_case_adjudication`（仍为后续建议；若新增为模型可见工具，必须另补 registry/schema/权限测试）
- 当前实现写入：受控 `publicOrder` / `corruption` / `treasury`、玩家刑名考成相关字段、公开 `eventHistory` 摘要和内部 `judicialCaseLedger`。罚银、羁押和判决必须至少引用一条可见案牍证据，不能只凭人物或泛事件材料定案；`judicialCaseLedger` 不进入 redacted player state；拒绝 outcome 不改 `worldState`。
- 当前公开案牍：`publicDocket` / `publicEvent` 只显示可见证据摘要和处置结果，不公开 evidence ref、raw proposal、hidden 证据、完整 audit 或内部 ledger。

测试：

- `test/judicialCaseResolver.test.js`
- `test/judicialCaseAuthority.test.js`
- `test/judicialCaseEvidenceRedaction.test.js`
- `test/judicialCaseDomainToolBridge.test.js`

验收功能：

- 证据不足可以拒绝定罪。
- 惩罚性处置缺少可见案牍证据时拒绝。
- 县令不能判超出辖区的大案；高官也要有制度路径。
- hidden 证据不直接公开，公开端只显示可见证据摘要。

### S71.7：军务与外交 resolver

前置依赖：S71.1、S71.4、S70 工具协议。

需要资料：`militaryDiplomacyView`、`worldGeographyView`、`economicFiscalView`、`intelligenceRumorView`、军务外交资料笔记。

具体实现：

- 新增 `src/game/militaryDiplomacyResolver.js`：
  - `normalizeMilitaryProposal(proposal)`
  - `normalizeDiplomacyProposal(proposal)`
  - `validateMilitaryAuthority(worldState, proposal, context)`
  - `validateDiplomacyAuthority(worldState, proposal, context)`
  - `resolveCampaignOrDefense(worldState, proposal, options)`
  - `resolveDiplomaticMove(worldState, proposal, options)`
- 新增 `src/game/militaryDiplomacyResolverConfig.js`：兵粮权重、士气、地形、情报可信度、外交反噬、授权门槛。
- 支持动作：侦察、固守、练兵、调粮、出击、撤军、会战、朝贡、互市、扣使、议和、威慑、宣战 request。
- 工具建议：
  - `military.propose_order`
  - `military.request_campaign_adjudication`
  - `diplomacy.propose_move`
  - `diplomacy.request_treaty_adjudication`

测试：

- `test/militaryDiplomacyResolver.test.js`
- `test/militaryDiplomacyAuthority.test.js`
- `test/militaryDiplomacyIntelConfidence.test.js`

验收功能：

- AI 不能直接改战争状态、边境归属、外交关系或战役胜负。
- 低可信边报只能降低/提高风险，不能被当作确定事实。
- 军事/外交后果进入事件档案和公开摘要。

### S71.8：压力驱动事件生成器

前置依赖：S71.1、S71.5-S71.7 至少部分可用。

需要资料：经济、城市、案件、军务、关系、情报 view；S70 事件生成器规划；large fixture。

职责边界：S70.6 负责 actor 事件 proposal、工具 envelope、Mock/provider 基础和权限语义；S71.8 负责把数据库 projection 落成实际压力信号采集、冷却、概率、成案 resolver 和事件档案写入，不重新定义 S70 工具协议。

具体实现：

- 新增 `src/game/worldPressureEventGenerator.js`：
  - `collectWorldPressureSignals(worldState, context)`
  - `scorePressureEventCandidate(signal, options)`
  - `generatePressureEventCandidates(worldState, options)`
  - `resolvePressureEventCandidate(worldState, candidate, auditContext)`
- 新增 `src/game/worldPressureEventConfig.js`：组合规则、冷却键、概率、阈值、优先级、最大事件数。
- 压力组合示例：
  - 粮价高 + 水利差 + 腐败高 -> 民变/逃荒/士绅请愿。
  - 边防紧张 + 粮道差 + 邻国继承风险 -> 边报/使节/试探入寇。
  - NPC 怨怼高 + 家族风险 -> 告发/请托/报复。
  - 科场不公传闻 + 士林压力 -> 清议/联名上书。
- AI 可为候选写细节；服务器决定是否成案、何时公开、影响哪些 meter。

测试：

- `test/worldPressureEventGenerator.test.js`
- `test/worldPressureEventCooldown.test.js`
- `test/worldPressureEventHiddenRedaction.test.js`

验收功能：

- 事件来自数据库压力，不是纯随机段子。
- 同一压力不会每旬刷屏；有冷却和优先级。
- hidden/private 信号只产生 public 端倪或 private ref，不泄漏真值。

### S71.9：多 actor 场景运行时

前置依赖：S70 actor/tool runtime、S71.1、S71.4、至少一个玩法 resolver。

需要资料：S70 actor profile、scene contract、朝议/堂审/会盟/战役资料笔记。

具体实现：

- 新增 `src/game/sceneRuntime.js`：
  - `createScene(worldState, sceneSpec, options)`
  - `buildSceneActorContext(scene, actorProfile, resolverInput)`
  - `runSceneRound(worldState, scene, options)`
  - `collectSceneProposals(sceneRound)`
  - `resolveSceneOutcome(worldState, scene, proposals, auditContext)`
- 新增 `src/game/sceneRuntimeConfig.js`：场景类型、最大轮次、actor 数量、工具预算、超时、结束条件。
- 场景类型：朝议、堂审、会盟、战役。
- 使用 scene-local time，不自动推进全局旬。
- 每个 actor 只能读取自己的 actor-visible context；同场不同 actor 可见信息不同。

测试：

- `test/sceneRuntime.test.js`
- `test/sceneActorVisibility.test.js`
- `test/sceneRuntimeMock.test.js`

验收功能：

- 多 actor 发言和 proposal 能被服务器收束为一个或多个 resolver 结果。
- 玩家能追问/选择/压制，但不能通过叙事绕过裁决。

### S71.10：NPC 记忆账本

前置依赖：S70 memory 设计、S71.4 redacted API、S71.9 场景运行时。

需要资料：`worldPeopleView`、relationship ledger、examNetwork、eventArchive、S70 memory contract。

具体实现：

- 新增或扩展 `src/game/actorMemoryLedger.js`：
  - `buildActorMemoryView(worldState, actorId, options)`
  - `proposeActorMemoryUpdate(actorId, proposal, options)`
  - `applyActorMemoryUpdate(worldState, memoryUpdate, auditContext)`
  - `decayActorMemoryLedger(worldState, options)`
  - `summarizeActorMemoryForPrompt(worldState, actorId, options)`
- 新增 `src/game/actorMemoryConfig.js`：显著度、记忆类型、可见性、衰减、最大条数、prompt cap。
- 记忆类型：事实记忆、人情债、恩怨、师门/同年、家族风险、主观印象、当前目标、恐惧/野心。
- 背景 NPC 走 heuristic 批处理，高显著 NPC 才走 LLM proposal。

测试：

- `test/actorMemoryLedger.test.js`
- `test/actorMemoryVisibility.test.js`
- `test/actorMemoryPromptSummary.test.js`

验收功能：

- 重要 NPC 会记住玩家长期行为，并影响后续请托、弹劾、帮助、报复。
- private memory 不进普通 player-state、prompt 或搜索。

### S71.11：AI 调动审计面板

前置依赖：S70 tool audit hook、S71.4 diagnostics、S71.5-S71.10 至少有若干工具/场景可展示。

需要资料：`event_log`、`ai_change_proposals`、S70 tool audit schema、public app 当前信息面板。

具体实现：

- 新增 `src/game/aiToolAuditView.js`：
  - `buildAiToolAuditPublicView(worldState, auditRows, options)`
  - `buildAiToolAuditDeveloperView(record, auditRows, options)`
  - `redactToolAuditPayload(payload)`
- 新增 route 或并入 diagnostics：
  - 玩家可见：公开工具结果、采纳/拒绝摘要、关联事件。
  - 开发可见：tool name、actor、status、拒绝原因、耗时、token/cost 摘要、applied event id。
- 前端在 `public/app.js` / `public/styles.css` 增加“AI 调动”或“世界引擎审计”面板，默认显示玩家可见层。

测试：

- `test/aiToolAuditView.test.js`
- `test/aiToolAuditRoute.test.js`
- `test/publicAppSource.test.js`
- hidden-token UI smoke。

验收功能：

- 玩家能理解 AI 提了什么、服务器为何接受/拒绝、公开后果是什么。
- 不显示 raw prompt、raw proposal、hidden ledger、key、本地路径或 SQL。

### S71.12：S71 验收与归档

前置依赖：S71.1-S71.11 完成。

需要资料：所有 S71 测试结果、browser smoke、dual-mode smoke、provider smoke、子代理复审报告。

具体实现：

- 新增 `docs/DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md`，归档 S71 完成范围、设计边界、命令、API、测试和遗留。
- 压缩 `docs/DEVELOPMENT_STEPS.md` 中的长实现记录，只保留索引和后续方向。
- 更新 `docs/SHARED_CONTEXT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md`、`docs/DYNAMIC_WORLD_DATABASE_PLAN.md`、`docs/ARCHITECTURE.md`、README。
- 如有新 scripts，README 写明本地使用方式和不提交数据库文件。

验收命令建议：

- `npm run check:docs-governance`
- `node --test test/resolverInputContext.test.js test/redactedState.test.js test/safeWorldSearch.test.js`
- `node --test test/cityPolicyResolver.test.js test/judicialCaseResolver.test.js test/militaryDiplomacyResolver.test.js`
- `node --test test/worldPressureEventGenerator.test.js test/sceneRuntime.test.js test/actorMemoryLedger.test.js test/aiToolAuditView.test.js`
- `npm run smoke:dual-mode`
- `npm run smoke:browser`
- provider smoke 按 S70 契约执行；缺 key 时明确 skip。

最终验收：

- JSON/SQLite parity 通过。
- Mock/no-key 可走完整书生路径和至少一个政策/案件/事件 resolver 样例。
- hidden-token、越权工具、raw table、prompt/key/path 泄漏测试通过。
- S69 科举成果不回退，`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` 不破坏。

## 14. 验收清单

- `npm run check:docs-governance`
- 相关 `node --test`：resolver input、SQLite migration/maintenance、safe search、redacted API、AI tool registry、event generator、scene runtime、NPC memory、audit panel。
- JSON/SQLite parity：相同 session 下 resolver 输入、公开结果、事件档案和 prompt retrieval 一致。
- Mock/no-key：不用真实 provider 也能跑政策、案牍、战役/外交 proposal 的 deterministic 路径。
- hidden-token：raw table、raw audit、hidden notes、hidden intent、private memory、key、本地路径、完整 prompt、provider proposal 原文不进 UI/prompt/search/export。
- 越权红队：书生调用皇帝诏令、县令宣战、将领擅自出兵、皇帝无证杀臣、AI 夹带 SQL/raw table update/raw state patch、critic/safety 直接裁决。
- 性能：large fixture 下 resolver input、safe search、event generator、information panel 和 SQLite maintenance 有明确基线与门槛。
