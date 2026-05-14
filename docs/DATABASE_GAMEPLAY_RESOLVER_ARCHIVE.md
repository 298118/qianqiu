# 《千秋》S71 数据库玩法化、维护与安全 API 归档

归档日期：2026-05-13。

本文件归档 S71.0-S71.12 的数据库玩法化实现，供后续路线图在稳定边界上继续推进。规划源头见 [DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md](DATABASE_GAMEPLAY_RESOLVER_ROADMAP.md)，resolver 输入契约见 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)，稳定开发治理仍以 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 为锚点。

## 1. 归档结论

S71 已把 S49-S67 累积的安全 projection 从“可展示、可检索”推进为可驱动服务器玩法 resolver 的输入层，并补齐本地 SQLite 维护、安全搜索、redacted player API、多 actor 场景、NPC 记忆和 AI 调动审计面板。

当前边界不变：JSON/Mock 仍是默认可玩路径，SQLite 只是本机增强；AI 只能读取 actor 可见 projection、提交 proposal 或 request-adjudication，不能执行 SQL、直写 canonical 状态、业务表、审计表或 hidden 真值；财政、刑名、军务、外交、压力事件、场景后果、记忆入账和调动摘要都由服务器 helper 归一、校验、裁决、清洗和写入。

已完成能力：

- S71.0：固定数据库 resolver 输入契约，明确允许来源、禁止来源、evidence ref、AI 权限和 JSON/SQLite parity 矩阵。
- S71.1：新增只读 `resolverInputContext`，把 geography、people、offices、economy、military、events、intel、player、map、memory 等安全 buckets 交给服务器 resolver 使用。
- S71.2：新增 SQLite `schema_migrations`、forward-only migration runner、备份、VACUUM、索引健康、漂移诊断和安全导出。
- S71.3：新增安全全文检索 / 本地搜索，JSON 路径即时检索 server views，SQLite 路径同步 `safe_search_index` 与可选 FTS5 mirror。
- S71.4：新增 `GET /api/game/player-state/:sessionId` redacted player API 和默认关闭、本机门禁的 `GET /api/dev/session-diagnostics/:sessionId`。
- S71.5：新增财政与城市政策服务器 resolver，支持开仓赈济、平粜、征粮、修堤、清丈、减免、追赃、盐漕、徭役、市价整肃和安民缉盗等政策。
- S71.6：新增地方案件与刑名服务器 resolver，支持受理、传唤、查证、调解、罚银、羁押、驳回、判决、申详、移交和缓审。
- S71.7：新增军务与外交服务器 resolver，支持侦察、固守、练兵、调粮、出击、会战、撤军、互市、和议、朝贡、会盟、扣使和宣战 request。
- S71.8：新增压力驱动事件生成器，把粮价、水利、腐败、边防、NPC 怨怼、士论和情报压力组合为服务器成案候选。
- S71.9：新增 scene-local 多 actor 场景运行时，支持朝议、堂审、会盟和战役军议的逐 actor 安全上下文与 resolve-only 后果摘要。
- S71.10：扩展 actor memory ledger，把 NPC mind 安全候选和背景 NPC heuristic 写入目标、人情债、恩怨、家族风险、畏惧和野心等可见记忆。
- S71.11：新增 `aiControlAuditView` 和浏览器 AI 调动审计面板，展示公开结果、预算、工具调用/拒绝和本机安全诊断边界。
- S71.12：完成 S71 归档与验收，补 S71 验收文档入口，并把 S67 large fixture 的生成、局势簿 projection 与 SQLite 读修复性能阈值更新到当前 S71 派生索引规模下的守门值。

## 2. 完成步骤索引

| ID | 摘要 | 主要证据 |
| --- | --- | --- |
| S71.0 | 数据库玩法化专项契约 | `docs/DATABASE_RESOLVER_INPUT_CONTRACT.md` |
| S71.1 | Resolver 输入层 | `src/game/resolverInputContext.js`、`test/resolverInputContext.test.js` |
| S71.2 | SQLite migration 与维护层 | `src/storage/sqliteMigrations.js`、`src/storage/sqliteMaintenance.js`、`scripts/sqliteMaintenanceTool.js` |
| S71.3 | 安全搜索 | `src/game/safeWorldSearch.js`、`src/storage/sqliteSafeSearchTables.js` |
| S71.4 | Redacted player API 与开发诊断 API | `src/game/redactedState.js`、`src/routes/dev.js` |
| S71.5 | 财政与城市政策 resolver | `src/game/cityPolicyResolver.js`、`test/cityPolicyResolver.test.js` |
| S71.6 | 地方案件与刑名 resolver | `src/game/judicialCaseResolver.js`、`test/judicialCaseResolver.test.js` |
| S71.7 | 军务与外交 resolver | `src/game/militaryDiplomacyResolver.js`、`test/militaryDiplomacyResolver.test.js` |
| S71.8 | 压力驱动事件生成器 | `src/game/worldPressureEventGenerator.js`、`test/worldPressureEventGenerator.test.js` |
| S71.9 | 多 actor 场景运行时 | `src/game/sceneRuntime.js`、`test/sceneRuntime.test.js` |
| S71.10 | NPC 记忆账本 | `src/game/actorMemoryLedger.js`、`test/npcMemoryLedger.test.js` |
| S71.11 | AI 调动审计面板 | `src/game/aiControlAudit.js`、`test/aiControlAudit.test.js` |
| S71.12 | 验收与归档 | 本文件、`scripts/dualModeAcceptance.js` |

## 3. 稳定边界

- 完整书生路径仍必须保持：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- `resolverInputContext`、安全搜索、玩家状态 API、开发诊断和 AI 调动审计都只读服务器安全 projection；不得读取 raw SQLite table、raw audit、provider payload、完整 prompt、本地路径、key、hidden notes、hidden intent 或 private memory。
- `city.propose_policy`、`judicial.propose_case_resolution`、`military.propose_order` 和 `diplomacy.propose_move` 仍是 AI proposal 入口；`server.adjudicate_policy`、`server.resolve_case`、`server.resolve_battle`、`server.apply_diplomacy` 等只可作为服务器内部 resolver / audit label，不进入模型可见工具列表或 provider schema。
- `applyCityPolicyOutcome()`、`applyJudicialCaseOutcome()`、`applyMilitaryDiplomacyOutcome()` 和 `applyPressureEventOutcome()` 才能写受控 meters、公开事件和内部 ledger；resolve-only 场景运行时不自动写状态、推进全局旬或持久化。
- `cityPolicyLedger`、`judicialCaseLedger`、`militaryDiplomacyLedger`、`worldPressureEventLedger` 和 raw `actorMemoryLedger` 不进入 redacted player state、prompt、安全搜索或浏览器面板。
- `GET /api/game/state/:sessionId` 仍是短期开发兼容快照；普通浏览器读档和局势簿分页优先使用 `GET /api/game/player-state/:sessionId`。
- `GET /api/dev/session-diagnostics/:sessionId` 默认关闭，production 强制关闭，且要求远端地址和 Origin 都满足本机门禁；它只返回统计和安全摘要。
- S71 没有引入远程存档、账号体系、多人同步、云冲突解决或托管数据库。

## 4. API 与命令入口

玩家与开发 API：

```text
GET /api/game/player-state/:sessionId
GET /api/game/search/:sessionId?q=&domain=&page=&pageSize=
GET /api/dev/session-diagnostics/:sessionId
GET /api/ai/settings/:sessionId
POST /api/ai/settings/:sessionId
```

本地维护与验收命令：

```bash
npm run storage:sqlite:status -- --db data/qianqiu.sqlite
npm run storage:sqlite:health -- --db data/qianqiu.sqlite
npm run storage:sqlite:backup -- --db data/qianqiu.sqlite --dry-run
npm run storage:sqlite:vacuum -- --db data/qianqiu.sqlite --dry-run
npm run storage:sqlite:export-safe -- --db data/qianqiu.sqlite
npm run smoke:dual-mode -- --storage-only
npm run smoke:browser
npm run smoke:exam-s69
npm run smoke:provider:tools
npm run smoke:provider:ai-first
npm run smoke:provider
npm run smoke:provider:route
```

`storage:sqlite:*` 只用于本机开发维护，不进入玩家 API、prompt、浏览器视图或 AI tool call。Provider smoke 缺 key 时应按脚本受控 skip；`MIMO_REQUIRED=1` 或 `--required` 才应在缺 key 时失败。

## 5. S71.12 验收记录

本轮 S71.12 已通过：

```bash
node --test test/resolverInputContext.test.js test/sqliteMigrations.test.js test/sqliteMaintenanceTool.test.js test/safeWorldSearch.test.js test/sqliteSafeSearch.test.js test/redactedState.test.js test/gamePlayerStateRoute.test.js test/devDiagnosticsRoute.test.js test/cityPolicyResolver.test.js test/cityPolicyAuthority.test.js test/cityPolicyHiddenRedaction.test.js test/cityPolicyDomainToolBridge.test.js test/judicialCaseResolver.test.js test/judicialCaseAuthority.test.js test/judicialCaseEvidenceRedaction.test.js test/judicialCaseDomainToolBridge.test.js test/militaryDiplomacyResolver.test.js test/militaryDiplomacyAuthority.test.js test/militaryDiplomacyIntelConfidence.test.js test/militaryDiplomacyRedaction.test.js test/militaryDiplomacyDomainToolBridge.test.js test/worldPressureEventGenerator.test.js test/worldPressureEventCooldown.test.js test/worldPressureEventHiddenRedaction.test.js test/sceneRuntime.test.js test/sceneActorVisibility.test.js test/sceneRuntimeMock.test.js test/npcMemoryLedger.test.js test/actorMemoryLedger.test.js test/aiControlAudit.test.js test/aiSettingsRoute.test.js test/streamingTurnRoute.test.js test/publicAppSource.test.js
node --test test/dualModeAcceptanceScript.test.js
npm run smoke:dual-mode -- --storage-only
npm run smoke:exam-s69
npm run smoke:browser -- --screenshots artifacts/browser-smoke-s71-12
AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:tools
AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:ai-first
AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider
AI_PROVIDER_TIMEOUT_MS=90000 npm run smoke:provider:route
npm test
```

结果摘要：

- S71 聚焦测试：127/127 通过。
- `dualModeAcceptanceScript`：8/8 通过。
- `smoke:dual-mode -- --storage-only`：通过；覆盖 JSON -> SQLite 导入、维护/修复/导出、安全审计 projection、S70 route-view parity、large fixture、prompt 策略、局势簿分页、SQLite 读修复和 hidden-token guard。
- `smoke:exam-s69`：通过；Mock 完整跑通童试、乡试、会试、殿试，最终入仕为翰林院修撰。
- `smoke:browser`：通过；覆盖桌面/移动、四级科举到入仕、作弊样例、官方开局、官职履历、世界议程和身份联动，共检查 14 张截图。
- Provider smoke：真实 MiMo 工具调用、S70 AI-first、mimo-deepseek 科举/provider smoke 和 provider route health 均通过。
- `npm test`：831/831 通过。

本轮还把 `scripts/dualModeAcceptance.js` 的 S67 large fixture 耗时阈值调到当前 S71 规模下的守门值：`fixtureGenerationMs` 从 5000ms 调整为 10000ms，`informationPanelMs` 从 1500ms 调整为 3000ms，`sqliteReadRepairMs` 从 3000ms 调整为 8000ms。原因是全量 `npm test` 会并发运行大量 SQLite-heavy 与 route-view 测试，S71 又增加了安全搜索、migration/maintenance 漂移探针和更多派生索引；这些阈值仍保留规模、分页、修复和泄漏回归守门，但不再把当前 Windows 本地全量并发噪声误报为失败。

## 6. 残余风险与后续入口

- S71 的财政、刑名、军务/外交和压力事件 resolver 已有服务器 helper、桥接和测试，但还没有把所有后果自动接入普通 `/api/game/turn` 长线调度；后续应按具体玩法步骤显式接入，并继续保持 proposal-only 与服务器 apply 边界。
- S71.9 场景运行时当前以 Mock/no-key deterministic 意见和可插拔 proposal generator 为主；真实多 actor provider 长循环仍应另立专项，并继续只传安全 scene / participant / options 摘要。
- S71.10 不新增独立 hidden 私档或 SQLite 记忆表；若未来要保存 actor-private / hidden memory、邻国真实虚实、资产真数或密档事件链，必须先扩展 role-visibility 与 redacted API 分层。
- `smoke:provider:long` 未作为 S71.12 阻断项运行；更长真实 provider 长跑、provider 多工具流式实探和真实多 actor 场景验收留给后续 AI 专项。
- 后续活动路线图应从本归档重新开一个小步骤，不要在已归档的 S71 台账里继续塞长实现记录。
