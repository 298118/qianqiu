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
- Roadmap status: S49-S88 已完成并归档；S89.1-S89.68 已从活动台账迁出并压缩到 `docs/ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md`，S89-S90 React 产品 polish 已进一步整理到 `docs/FRONTEND_PRODUCT_POLISH_ARCHIVE.md`。活动台账现在只保留当前边界、下一候选步骤和本轮文档维护记录。
- Latest implementation: S91.2 首页开卷校阅与旧案入口 polish 已完成。首页开卷表单新增 `s91-2-home-opening-reader` 四读校阅，从既有表单状态、runtime 画像 registry、旧案目录 loading/error/ready/empty 和本地开卷状态派生题名、立绘、自定背景字数、旧案架和朱印候复边界；自定背景只显示字数不回显全文。为守住窄屏 smoke，同步修正人物/囊箧 route 与 mobile 样式导入顺序，并在移动端关闭人物/囊箧列表按钮伸出伪元素，避免装饰造成按钮内部 overflow。仍不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。
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
- Provider 验收：no-key runtime fallback、provider long-run 经济 trace 验收和真实 provider 缺 key skip/显式失败边界已经建立首轮。

## Archives And Contracts

- 当前活动台账：[DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md)。
- 已完成活动台账压缩索引：[ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。
- S88 阶段性归档：[QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)，原规划：[QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)。
- S89-S90 React 产品 polish 归档：[FRONTEND_PRODUCT_POLISH_ARCHIVE.md](FRONTEND_PRODUCT_POLISH_ARCHIVE.md)。
- S86/S87 类型归档：[TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md](TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md)、[TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md)。
- S81-S85 NPC/资产归档：[NPC_INVENTORY_SYSTEM_ARCHIVE.md](NPC_INVENTORY_SYSTEM_ARCHIVE.md)。
- S73-S77 前端归档：[FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)。
- 数据库与世界内容归档：[LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)、[DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)。
- AI 权限矩阵：[AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md)。

## Current Work Note

2026-05-27：S91.2 首页开卷校阅与旧案入口 polish 已完成。首页开卷表单新增 `data-polish-home-reader="s91-2-home-opening-reader"` 的“题名 / 立绘 / 旧案 / 朱印”四读校阅，只从现有 React 表单状态、runtime 画像 registry 可用性与已选立绘、旧案目录状态、开局 loading/error 和年份校验派生；自定背景只显示字数，不回显玩家输入全文，旧案只说明公开案卷目录状态，朱印只说明新卷候主卷回批。样式放在 `routes/home.css`，移动端通过 `mobile-layout.css` 单列；browser smoke 新增桌面/移动首页断言。验证中发现既有人物/囊箧移动端按钮装饰伪元素会撑大内部滚动尺寸，已将 `PeoplePage` / `InventoryPage` 改为先导入 route 样式再导入 mobile override，并在 `mobile-people-inventory.css` 的窄屏规则里关闭列表按钮装饰伪元素、允许仓储标签换行，`test/reactClientScaffold.test.js` 加顺序和移动端规则守门。边界：只改 React 前端读法、CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决；浏览器仍只消费安全 view、本地表单/草稿和页面状态。已通过 `node --test test/reactClientScaffold.test.js`（103 tests）、`npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-2-home-opening-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1217 tests）；首次完整 `npm run smoke:browser -- --screenshots artifacts/s91-2-home-opening-reader-smoke` 因 360 秒外层超时中断，随后直接重跑同一 browser smoke 脚本本体通过。提交前只读复审代理 `019e69c3-4e58-7680-852f-41db1761356d` 未发现新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力、服务器裁决越界或自定背景全文回显；非阻塞提醒为 browser smoke 读取 `gridTemplateColumns` 但未显式断言移动端单列，当前已有移动端横向 overflow smoke 与 source canary 守住规则。

2026-05-27：S91.1 设置/AI 来源状态读法 polish 已完成。右上角印匣“推演设置”面板新增 `data-polish-ai-source="s91-1-ai-source-reader"` 的“底本 / 接通 / 候复”三格读法，说明本地样例 no-key 可玩、真实来源接通或缺 key、未保存改动、可呈候复事项和工具辅佐次数；设置失败时只显示候载与固定中文提示，不补造外部来源或回显底层诊断。样式放在共享 `overlays-surfaces.css`，移动端通过 `mobile-layout.css` 单列。边界：只改 React 前端读法、CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决；浏览器仍只消费既有安全 settings view、本地偏好/草稿和专题状态。已通过 `node --test test/reactClientScaffold.test.js`（102 tests）、`npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（75 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run check:docs-governance`、`git diff --check`、`npm test`（1216 tests）和 `npm run smoke:browser -- --screenshots artifacts/s91-1-ai-source-reader-smoke`。首次 browser smoke 因新文案包含“未保存”导致既有 Playwright 文本选择器严格匹配到两处而失败，改为“尚待落印”后重跑通过；提交前只读复审代理 `019e690f-e043-7a01-ab07-787e14e514dc` 未发现阻塞问题，非阻塞提醒为污染词检查主要覆盖可见文本而非所有 DOM 属性、未载入/空来源口径仍保持粗粒度 fallback。

2026-05-27：S90.3 S89/S90 前端 polish 专题归档已完成。新增 `docs/FRONTEND_PRODUCT_POLISH_ARCHIVE.md`，把 S89.1-S89.68 与 S90.1/S90.2/S90.4 的 React 产品 polish、玩家可见读法、CSS 架构/token/keyframe/surface 收敛、安全守门、验证锚点和追溯入口整理为专题归档；同步 `docs/DEVELOPMENT_STEPS.md` 和 `docs/ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md`。本轮纯文档归档，不改运行时代码、前端行为、后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决；按低风险纯文档规则跳过提交前子代理复审。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。提交随本次 coherent change 完成，最终哈希见 Git history 和本轮回复。

2026-05-27：S90.4 囊箧、史册、朝议深层读卷 polish 已完成。囊箧页新增 `s90-4-inventory-ledger-index` 的“囊箧四读”，只从安全囊箧、资源、资产、凭证、经济 trace、容器与物件列表整理账面/仓储/物件/流转读法，并过滤污染账解；史册页新增 `s90-4-archive-court-reader` 的“由史册成题”，把归档、旁证、成题与候复边界放在公开追踪前；朝议页新增同标记的“材料入席”，提示材料、人物、专题与不定终局；`SurfaceHost` 专题层新增材料/证据/草稿读法，样式放在共享 overlay CSS 而非单一路由 CSS。实施子代理 `019e686e-06c0-7a11-aa91-9e44529016d9` 提交 patch 报告但未提交、未推送、未创建 PR；提交前只读复审代理 `019e68b1-028f-7bd1-961c-1be6b44bf40e` 已复审最终 diff 和验证证据，未发现阻塞问题。边界：不新增 route/API/schema/AI 权限/依赖/素材，不请求完整 manifest，不硬编码本地路径，不改变 provider、prompt、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决；浏览器仍只消费安全 view、本地草稿和页面/专题状态。已通过 `node --test test/reactClientScaffold.test.js`（101 tests）、`npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（74 tests）、`npm run build:client`、`npm run budget:client`、`npm run check:docs-governance`、`git diff --check`、`npm test`（1215 tests）和 `npm run smoke:browser -- --screenshots artifacts/s90-4-polish-smoke`。一次与全量 `npm test` 并行的 browser smoke 因首页 `networkidle` 超时失败，单独重跑同命令通过，失败未命中 S90.4 断言。提交随本次 coherent change 完成，最终哈希见 Git history 和本轮回复。

2026-05-27：S90.1/S90.2 React 产品级前端 polish 已完成并提交 `5d96bb4f`。首页、主卷、舆图/史册、人物/囊箧、科举/皇榜和对应移动端样式已迁到页面级 import，保留 `global.css` 作为 token/base/shell/controls/overlay/motion 启动样式图；`test/reactClientScaffold.test.js` 继续用产品样式全集守住历史 selector，同时新增全局启动样式预算守门。体验 polish 覆盖舆图读图指引、地点状态、路线暗示、掌中 tooltip 操作，人物详情“来函 / 礼法 / 交易 / 委派”读法、人物卡候回音提示、高清立绘“画卷三读”、科举入场-落墨-候批、皇榜题名-同年座师-授官过渡，以及右上角印匣/设置、专题层 loading/error/empty/selected 状态、错误空态和基础控件反馈。边界：不新增依赖或素材，不请求完整 manifest，不硬编码本地路径，不改变后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决；浏览器仍只消费安全 view、已审核 runtime 资产引用和本地偏好/草稿/专题状态。S90.1/S90.2 已通过完整验证，记录见 `docs/DEVELOPMENT_STEPS.md` 和 Git history。

2026-05-27：按用户要求压缩当前上下文并归档活动台账已完成项。本轮仅维护文档：`SHARED_CONTEXT.md` 改为接手摘要，`DEVELOPMENT_STEPS.md` 移出 S89.1-S89.68 的 DONE 长表与逐项流水，`ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md` 增加 S89 压缩归档。运行时代码、前端行为、后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 和服务器裁决均未改变。低风险纯文档改动，按项目规则跳过提交前子代理复审。已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。

## Next Recommended Step

可继续 CSS 预算后续瘦身，或按具体页面/route 新开下一轮 polish 小步骤；若继续首页/开卷方向，应只围绕现有开卷表单、旧案目录、runtime 画像 registry 和玩家可见安全读法，不新增 provider 能力、存档字段或服务器裁决面。

无论下一步是什么，都必须继续从安全 view 重建 evidence，保持 proposal-only、browser-draft-only 和服务器裁决，不让浏览器 task、地图 layout、visual-only effect、NPC anchor、runtime manifest 元数据、world entity impact/recent impact、交游 evidence、world thread 或 draftContext 变成真实任务队列、资源结算器、关系/婚姻/弹劾/定罪/背叛裁决器。
