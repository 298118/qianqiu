# Shared AI Development Context

这是 Codex 当前使用的压缩交接板。它只保留接手下一步必须知道的状态、边界、验证入口和内容保护规则；阶段细节请追溯 `docs/DEVELOPMENT_STEPS.md` 顶部归档索引和各专题归档。

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
- Backend: Node.js + Express，当前以 CommonJS JavaScript 为主。S86 已建立渐进 TypeScript 检查地基，`npm run typecheck:server` 覆盖契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver 的首批边界；S87 已完成 route/API response shape 首轮覆盖，`src/contracts/serverContracts.ts` 固定 public response，`src/routes/routeResponses.js` 用局部 `@ts-check` helper 接入大型 route 并运行时拒绝 public `worldState` raw ledger key。不得为了启用类型检查一次性 whole-file `@ts-check` 大型 route 文件，也不得放宽 raw ledger 剥离、Ajv/runtime 校验或服务器裁决。
- Storage: 默认 JSON session files under `data/sessions/`；可选 `STORAGE_ADAPTER=sqlite` 使用本地 `schema_migrations`、`world_sessions`、audit tables、`geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index` 和 `safe_search_index`。SQLite 派生行只从 `world_sessions.world_state_json` 单向修复，不是玩家 API、prompt 或服务器裁决的 raw truth source。
- Roadmap status: S49-S87 已完成并归档或压缩记录。S88 全面系统打磨已从活动台账长表迁出，阶段性归档见 `docs/QIANQIU_POLISHING_ARCHIVE.md`，原规划见 `docs/QIANQIU_POLISHING_ROADMAP.md`；S89.1 已完成 React 玩家可见文案与移动端覆盖层润色，S89.2 已完成 React 视觉矩阵、轻量专题页壳与高清立绘查看器公开说明，S89.3 已完成 React 设置入口、专题文案与错误空态收束，S89.4 已完成 React 首页旧案状态与史册信息密度 polish，S89.5 已完成 React 全局材质、覆盖层过渡与交互反馈 polish，活动台账见 `docs/DEVELOPMENT_STEPS.md`。若继续 S88/S89 残余方向，应继续新开可审查小步骤，而不是把 S88 长流水复制回活动台账。
- Current collaboration: 2026-05-14 起停止 Gemini CLI 协作。后续开发、素材生成/审核、验证、文档同步和 Git 提交由 Codex 负责；用户已授权本仓库使用 Codex 子代理，实施子代理不得提交，提交前复审子代理必须只读。
- Current local `.env`: 可能含用户 provider keys。`.env` 被 Git 忽略，不能打印、复制到文档或提交。

## Core Invariants

- 后续开发和维护不以“最小实现点”或“最小改动点”为目标；在安全边界、默认可运行、内容保护和可审查粒度不受损的前提下，优先交付完整、丰富、功能强大的游戏实现，并把必要的系统、交互、AI、数据、验证和文档一次设计到位。
- 复杂功能必须坚持前后端分离和大步骤拆分：后端/API/数据契约、AI 权限与服务器裁决、前端体验、验证与文档按可审查阶段分步交付；前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息。
- 后端契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver 新增或重构时，应优先使用 TypeScript 或纳入 TypeScript 检查；既有 JavaScript 允许渐进迁移，不得为语言迁移一次性重写大量稳定模块，TS 类型不能替代 Ajv 与服务器 runtime 校验。
- 后端 route/API response shape 新增或重构时，必须对齐 `src/contracts/serverContracts.ts` 或局部 JSDoc typedef，并运行 `npm run typecheck:server`；不得为了启用类型检查一次性 whole-file `@ts-check` 大型 route 文件，也不得放宽安全 projection、raw ledger 剥离、Ajv/runtime 校验或服务器裁决。
- 完整书生路径必须继续可用：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- AI 是《千秋》的核心世界引擎，但只能读取安全 view、生成叙事/建议/proposal 或受限 structured payload；服务器拥有状态边界、时间推进、科举晋级、作弊处罚、官场任免、长期事件、世界实体、世界议程、数据库写入和持久化裁决。
- 游戏规则、数值阈值、时间间隔、概率、UI 限制、fixture 规模和 prompt budget 等可调参数不得散落为 magic numbers / 魔法数字；新增或调整时优先集中到 `src/config/GameConfig.js` 或更贴近领域的 `src/game/*Config.js`，并写清单位、范围和默认值意图。
- 项目内协作文档、路线图、交接记录、领域注释和玩家可见文案优先使用中文。

## Content Protection

- API、prompt、浏览器和 SQLite 安全索引只能消费服务器整理后的 projection。不得暴露 raw audit、provider proposal、完整 prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系、raw ledger、SQLite raw/index row 或 hidden raw rows。
- 浏览器只写本地草稿、route/surface 状态或安全设置；不得直接裁决资源、身份、交易、NPC 行动、经济结果、考试晋级、官职任免、地图行动、关系终局、婚姻、弹劾、定罪、背叛或 hidden 信息。
- `topic_draft`、`draftContext`、舆图行动、实体压力、领域后果、经济解释、NPC follow-up 和关系 evidence 都必须由服务器从当前安全 view 重新校验；伪造 refs、raw/provider/prompt/path/key/hidden/SQLite 污染和 visual-only refs 不得进入裁决。
- S73-S79 人物与素材显示必须通过已审核 `portraitRef`、缩略图、低清占位、精简 runtime manifest 和 fallback 使用。不得显示未审核素材、完整 source manifest、本地 artifacts 路径或 provider/key/raw/prompt 字段；AI 生成或第三方视觉资产入 manifest 前必须做视觉审核。

## Implemented Surface

- 书生主线：读书画像、三旬读书计划、备考压力、科场流程/反馈、多级考试、放榜、同年座师网络、授官轨迹、入仕首月差事、回署回执、奏折/朝议裁决、跟进、跨身份回应、续办链路和长期官场后果均由服务器安全 view 暴露。
- 六身份循环：`roleCycleView` 统一皇帝、大臣、将领、地方官、书生、入仕官员当前身份循环，只展开当前身份；非当前身份只显示待任占位。`roleCycleDomainAdjudication` 只接低风险市价、侦察和调粮接缝，并阻断高风险军务词、非当前领域身份和近 3 旬重复提交。
- 领域后果：`domainConsequenceView` 从已裁决 city/military/judicial/NPC economy 安全来源派生公开后果，按当前角色裁剪，并通过 `publicEchoRef` / canonical echo 与月报、world thread、topic surface、topic draft 和下一轮普通回合复核串联。
- NPC/关系：主动来函、后续簿、follow-up resolution、关系行动 trace、人物页交游议题、实体压力、`worldEntityView.recentImpacts` 和史册实体归档均只读消费安全 projection，不创建真实资源/关系/婚姻/弹劾/定罪/背叛结果。
- 资产经济：`economyTraceView` 解释资源、资产、囊箧、交易、委派、市价和 NPC 月账变化；交易、委派、经济 evidence 与普通/SSE/true streaming 回合均走服务器重校验。
- React 状态：route-local session guard、专题层案卷绑定、人物/囊箧/科举/皇榜安全空态、overlay 焦点、移动端/长文本/低动效 polish、route recovery、草稿/session 绑定和 NPC/囊箧 mutation 防串扰已经完成首轮。
- 舆图与素材：PixiJS 地图行动牌和 `map-runtime` draftContext 会由服务器重建 `mapRuntimeView` 复核；NPC 舆图锚点是 visual-only。runtime manifest、assetRegistry 和 browser smoke 守住审核状态、成年立绘、lazy-load budget、重要 NPC 池隔离和完整 source manifest 禁用。
- Provider 验收：no-key runtime fallback、provider long-run 经济 trace 验收和真实 provider 缺 key skip/显式失败边界已经建立首轮。

## Archives And Contracts

- 当前活动台账：[DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md)。
- S88 阶段性归档：[QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)，原规划：[QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)。
- S86/S87 类型归档：[TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md](TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md)、[TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md)。
- S81-S85 NPC/资产归档：[NPC_INVENTORY_SYSTEM_ARCHIVE.md](NPC_INVENTORY_SYSTEM_ARCHIVE.md)。
- S73-S77 前端归档：[FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)。
- 数据库与世界内容归档：[LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)、[DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)。
- AI 权限矩阵：[AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md)。

## Current Work Note

2026-05-24：S89.5 完成 React 全局材质、覆盖层过渡与交互反馈 polish，实现提交 `b3237606ffa3abc7fbeb396d89c5c9eb8605f8f9`。主壳、顶栏/右上角印匣、专题层 drawer/modal/surface、高清立绘查看器、舆图行动面板和设置目录已补 S89.5 材质/覆盖层/交互反馈标记；`scripts/clientSmoke.js` 新增 `assertS895MaterialFeedbackPolish()`，源码 canary 覆盖材质样式、低动效禁用、地图草稿反馈、立绘查看器、设置目录和污染词守门。

舆图页新增本地 `lastWrittenMapDraftId`，只在玩家把 runtime 选择、行动牌或公开近事写入主卷行动草稿后，把对应行标为 `data-draft-state="written"` 形成短反馈；切换案卷会清空。该状态不进入服务器、不扩大 `draftContext`、不复核 evidence、不裁决地图行动。浏览器仍只能消费安全 view 与本地 UI 草稿，不能把地图 layout、visual-only effect、NPC anchor、runtime manifest 元数据或 draftContext 变成真实任务、资源、关系、婚姻、弹劾、定罪、背叛、考试、官职或 hidden 裁决。

本轮只改 React 前端、前端样式、客户端 smoke/source canary、前端测试和验收文档；不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。

本轮验证结果：

- 已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、`git diff --check`。
- `npm run test:client` 本机命中已知 Vitest fork worker 启动超时：5 files / 126 tests 已通过，未见断言失败；已用 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` 通过同一客户端套件（6 files / 129 tests）。
- 已通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`；最终预算输出为 `CSS 97.5 KiB`，仍在硬性预算内。
- `npm run smoke:browser:visual` 在 240s 限时内已完成 runtime manifest QA、client build 和 budget，但进入 `clientSmoke.js` 后超时；随后直接运行 `node scripts/clientSmoke.js --screenshots artifacts/browser-visual-matrix` 通过，覆盖 S89.5 首页材质、印匣/低动效覆盖层、地图草稿反馈、高清立绘查看器、设置目录和安全污染守门，并写出 `artifacts/browser-visual-matrix`。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`。提交前只读子代理首轮发现空 keyframes 与 `.mapEventList` 写入反馈样式缺口；本轮已改为真实短动画、行动/事件共享写入反馈与低动效覆盖，并强化 browser smoke/source canary。最终只读复审已通过，未发现阻断问题。实现提交后的哈希回填仅修改 `docs/DEVELOPMENT_STEPS.md` 与本文件，属于低风险纯文档改动，跳过子代理复审。

## Next Recommended Step

若继续前端产品化打磨，建议新开 S89.6 或 S90，优先做移动端长文本二轮审查、地图 tooltip/筛选动效进一步细化、史册右侧空白区域跨列信息密度压缩，或把 S89 系列 polish 归档为前端产品化阶段小结。若转向系统深度，优先候选包括更深关系后果、真实 keyed provider 长跑证据和视觉素材 QA 消费层巡检。

无论下一步是什么，都必须继续从安全 view 重建 evidence，保持 proposal-only、browser-draft-only 和服务器裁决，不让浏览器 task、地图 layout、visual-only effect、NPC anchor、runtime manifest 元数据、world entity impact/recent impact、交游 evidence、world thread 或 draftContext 变成真实任务队列、资源结算器、关系/婚姻/弹劾/定罪/背叛裁决器。
