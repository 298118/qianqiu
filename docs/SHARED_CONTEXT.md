# Shared AI Development Context

这是 Codex 当前使用的压缩交接板。它只保留接手下一步必须知道的状态、边界、验证入口和归档位置；阶段细节请追溯 `docs/DEVELOPMENT_STEPS.md` 顶部归档索引、`docs/ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md` 和各专题归档。

## Read First

每次开发会话开始前必须读取：

1. `AGENTS.md` 或 `CLAUDE.md`
2. `docs/SHARED_CONTEXT.md`
3. `docs/QIANQIU_DEVELOPMENT_BRIEF.md`
4. `docs/DEVELOPMENT_STEPS.md`

稳定治理锚点见 `docs/DEVELOPMENT_GOVERNANCE.md`。重写 brief、路线图或交接文档时不得删弱受保护规则，并运行 `npm run check:docs-governance`；完整测试中的 `test/documentationGovernance.test.js` 也会守门。

## Current Snapshot

- Product: browser + Node.js historical simulation text game **Qianqiu / 千秋**。
- Runtime target: `npm install && npm start`，默认 `AI_PROVIDER=mock`，打开 `http://localhost:3000` 即可本地游玩。真实 provider 只作为可选配置，不能成为启动门槛。
- Frontend: React + TypeScript + Vite 在 `client/`，生产构建在 `dist/client/`，Express 默认 `/` 服务 React SPA。React Router Data Mode 管理首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议和设置。旧 `public/index.html`、`public/app.js`、`public/styles.css`、`public/mapPanel.js` 只作迁移参考；`public/assets/`、`public/vendor/`、`public/mapRenderer.js` 继续提供已审核素材和 S72 地图 runtime。
- Backend: Node.js + Express，当前以 CommonJS JavaScript 为主。S86/S87 已完成渐进 TypeScript 检查与 route/API response shape 首轮覆盖；`npm run typecheck:server` 覆盖契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver 的首批边界。不得为大型 route 一次性 whole-file `@ts-check`，也不得放宽 raw ledger 剥离、Ajv/runtime 校验或服务器裁决。
- Storage: 默认 JSON session files under `data/sessions/`；可选 `STORAGE_ADAPTER=sqlite` 使用本地派生表、索引和审计。SQLite 派生行只从 `world_sessions.world_state_json` 单向修复，不是玩家 API、prompt 或服务器裁决的 raw truth source。
- Roadmap status: S49-S88 已完成并归档；S89-S90 React 产品 polish 已整理到 `docs/FRONTEND_PRODUCT_POLISH_ARCHIVE.md`；S89-S92 已完成活动流水已压缩到 `docs/ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md`。活动台账现在只保留当前边界、下一候选步骤和本轮文档维护记录。
- Latest implementation: S92.10 SQLite prompt retrieval 可见性 parity 修复已落地。SQLite prompt retrieval 派生表把服务器已裁定可见的 `role_visible` / `office_visible` 情报传闻 payload 归一为 EvidenceRef allowlist 内的 `actor_visible`，修复 JSON/SQLite visible route and prompt payload parity；不改变 `intelligenceRumorView` 业务可见性、默认 JSON/Mock 路径、AI 路由、provider 默认、tool loop、SQLite schema、route/API、浏览器 UI 或服务器裁决。
- Current collaboration: 2026-05-14 起停止 Gemini CLI 协作。后续开发、素材生成/审核、验证、文档同步和 Git 提交由 Codex 负责；用户已授权本仓库使用 Codex 子代理，实施子代理不得提交，提交前复审子代理必须只读。
- Current local `.env`: 可能含用户 provider keys。`.env` 被 Git 忽略，不能打印、复制到文档或提交。

## Core Invariants

- 后续开发和维护不以“最小实现点”或“最小改动点”为目标；在安全边界、默认可运行、内容保护和可审查粒度不受损的前提下，优先交付完整、丰富、功能强大的游戏实现，并把必要的系统、交互、AI、数据、验证和文档一次设计到位。
- 复杂功能必须坚持前后端分离和大步骤拆分：后端/API/数据契约、AI 权限与服务器裁决、前端体验、验证与文档按可审查阶段分步交付；前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息。
- 后端契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver 新增或重构时，应优先使用 TypeScript 或纳入 TypeScript 检查；既有 JavaScript 允许渐进迁移，不得为语言迁移一次性重写大量稳定模块，TS 类型不能替代 Ajv 与服务器 runtime 校验。
- 后端 route/API response shape 新增或重构时，必须对齐 `src/contracts/serverContracts.ts` 或局部 JSDoc typedef，并运行 `npm run typecheck:server`；不得为了启用类型检查一次性 whole-file `@ts-check` 大型 route 文件。
- 完整书生路径必须继续可用：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- AI 是《千秋》的核心世界引擎，但只能读取安全 view、生成叙事/建议/proposal 或受限 structured payload；服务器拥有状态边界、时间推进、科举晋级、作弊处罚、官场任免、长期事件、世界实体、世界议程、数据库写入和持久化裁决。
- 游戏规则、数值阈值、时间间隔、概率、UI 限制、fixture 规模和 prompt budget 等可调参数不得散落为 magic numbers；新增或调整时优先集中到 `src/config/GameConfig.js` 或更贴近领域的 `src/game/*Config.js`，并写清单位、范围和默认值意图。
- 项目内协作文档、路线图、交接记录、领域注释和玩家可见文案优先使用中文。

## Content Protection

- API、prompt、浏览器和 SQLite 安全索引只能消费服务器整理后的 projection。不得暴露 raw audit、provider proposal、完整 prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系、raw ledger、SQLite raw/index row 或 hidden raw rows。
- 浏览器只写本地草稿、route/surface 状态或安全设置；不得直接裁决资源、身份、交易、NPC 行动、经济结果、考试晋级、官职任免、地图行动、关系终局、婚姻、弹劾、定罪、背叛或 hidden 信息。
- `topic_draft`、`draftContext`、舆图行动、实体压力、领域后果、经济解释、NPC follow-up 和关系 evidence 都必须由服务器从当前安全 view 重新校验；伪造 refs、raw/provider/prompt/path/key/hidden/SQLite 污染和 visual-only refs 不得进入裁决。
- S73-S79 人物与素材显示必须通过已审核 `portraitRef`、缩略图、低清占位、精简 runtime manifest 和 fallback 使用。不得显示未审核素材、完整 source manifest、本地 artifacts 路径或 provider/key/raw/prompt 字段；AI 生成或第三方视觉资产入 manifest 前必须做视觉审核。

## Implemented Surface

- 书生主线：读书画像、三旬读书计划、备考压力、科场流程/反馈、多级考试、放榜、同年座师网络、授官轨迹、入仕首月差事、回署回执、奏折/朝议裁决、跟进、跨身份回应、续办链路和长期官场后果均由服务器安全 view 暴露。
- 六身份循环与领域后果：`roleCycleView` 统一皇帝、大臣、将领、地方官、书生、入仕官员当前身份循环；`domainConsequenceView` 从已裁决 city/military/judicial/NPC economy 安全来源派生公开后果，并通过 echo/ref 与月报、world thread、topic surface、topic draft 和下一轮普通回合复核串联。
- NPC/关系/资产经济：主动来函、后续簿、follow-up resolution、关系 action trace、人物页交游议题、实体压力、经济 trace、交易、委派、市价和 NPC 月账都只读安全 projection；真实资源、关系、婚姻、弹劾、定罪、背叛或 hidden 后果仍由服务器裁决。
- React 状态：route-local session guard、专题层案卷绑定、人物/囊箧/科举/皇榜安全空态、overlay 焦点、移动端/长文本/低动效 polish、route recovery、草稿/session 绑定和 NPC/囊箧 mutation 防串扰已经完成首轮。
- 舆图与素材：PixiJS 地图行动牌和 `map-runtime` draftContext 会由服务器重建 `mapRuntimeView` 复核；NPC 舆图锚点是 visual-only。runtime manifest、assetRegistry 和 browser smoke 守住审核状态、成年立绘、lazy-load budget、重要 NPC 池隔离和完整 source manifest 禁用。
- AI v2 地基：S92.1-S92.10 已完成 baseline、旁路 runtime、OpenAI strict adapter、Mock-first tool loop、eval v2、Prompt Registry、EvidenceRef、安全 trace/provider health、public trace feedback 和 SQLite prompt retrieval parity 修复；这些能力尚未接管默认普通回合或服务器裁决。

## Archives And Contracts

- 当前活动台账：[DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md)。
- 已完成活动台账压缩索引：[ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。
- S88 阶段性归档：[QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)，原规划：[QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)。
- S89-S90 React 产品 polish 归档：[FRONTEND_PRODUCT_POLISH_ARCHIVE.md](FRONTEND_PRODUCT_POLISH_ARCHIVE.md)。
- S86/S87 类型归档：[TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md](TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md)、[TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md)。
- S81-S85 NPC/资产归档：[NPC_INVENTORY_SYSTEM_ARCHIVE.md](NPC_INVENTORY_SYSTEM_ARCHIVE.md)。
- S73-S77 前端归档：[FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)。
- 数据库与世界内容归档：[LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)、[DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)。
- AI v2 路线图与 baseline：[AI_ORCHESTRATION_V2_ROADMAP.md](AI_ORCHESTRATION_V2_ROADMAP.md)、[AI_V2_BASELINE_REPORT.md](AI_V2_BASELINE_REPORT.md)。
- AI 权限矩阵：[AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md)。

## Current Work Note

2026-05-29：按用户要求压缩当前上下文并归档活动台账已完成项。本轮仅维护文档：`SHARED_CONTEXT.md` 保留接手摘要、关键边界、AI v2 最新状态和下一步；`DEVELOPMENT_STEPS.md` 移出 S90.1-S92.10 的 DONE 长表、逐项验证锚点和近期流水；`ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md` 增加 S90、S91、S92 压缩归档。运行时代码、前端行为、后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 和服务器裁决均未改变。低风险纯文档改动，按项目规则跳过提交前子代理复审。验证：`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`。最新代码验证仍以 S92.10 为锚点：`npm test` 1294/1294 pass，AI eval v1/v2、server typecheck 和 SQLite prompt retrieval parity 聚焦测试均已通过。

## Next Recommended Step

可按 [AI_ORCHESTRATION_V2_ROADMAP.md](AI_ORCHESTRATION_V2_ROADMAP.md) 继续后续 AI v2 增强：优先做 `/api/game/turn` 的 `AI_RUNTIME_V2=shadow` 旁路记录设计，或把 S92.7 EvidenceRef 进一步接入 tool proposal validation / topic draft allowlist，或把 S92.3 ProviderAdapter 模式扩展到 Anthropic/DeepSeek/MiMo。若继续把 S92.4 tool loop 接入 runtime，必须先走 shadow 或测试旁路，不要直接切默认 `/api/game/turn`；继续沿用 Mock-first、public trace、provider health 分类、budget、fallback、Ajv validation、strict opt-in、proposal-only、stable EvidenceRef 和 server-owned resolver 边界，不新增默认 provider 写权、存档字段或服务器裁决面。

无论下一步是什么，都必须继续从安全 view 重建 evidence，保持 proposal-only、browser-draft-only 和服务器裁决，不让浏览器 task、地图 layout、visual-only effect、NPC anchor、runtime manifest 元数据、world entity impact/recent impact、交游 evidence、world thread 或 draftContext 变成真实任务队列、资源结算器、关系/婚姻/弹劾/定罪/背叛裁决器。
