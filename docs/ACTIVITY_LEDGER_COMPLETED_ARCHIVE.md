# 《千秋》已完成活动台账压缩归档

本文件是 `docs/DEVELOPMENT_STEPS.md` 已移出完成流水的压缩索引，不再保存逐日完整记录。旧长流水曾用于追溯 S73-S78 的实施细节；2026-05-20 按用户要求再次压缩，避免未来 Codex 会话重复读取已经归档到专题文档、Git history 和共享上下文的长上下文。

当前接手仍优先阅读：

1. `AGENTS.md`
2. `docs/SHARED_CONTEXT.md`
3. `docs/QIANQIU_DEVELOPMENT_BRIEF.md`
4. `docs/DEVELOPMENT_STEPS.md`

需要细节时按本文件索引打开专题归档、对应提交或当轮 `docs/SHARED_CONTEXT.md` 记录；不要把本文件当作新的活动路线图入口。

## 压缩原则

- 本文件只保留已经完成、已经验证、已经迁出活动台账的关键事实：范围、边界、验证锚点和追溯入口。
- 不再重复稳定治理规则；治理以 `docs/DEVELOPMENT_GOVERNANCE.md`、`AGENTS.md` 和 `docs/DEVELOPMENT_STEPS.md` 受保护段落为准。
- 不再展开每个子步骤的完整实现流水；专题细节以专题归档和 Git commit diff 为准。
- 后续若再次迁出完成流水，应追加一条压缩记录或新建更贴近主题的专题归档，而不是把长表复制回本文件。

## 完成阶段索引

| 范围 | 压缩摘要 | 追溯入口 |
| --- | --- | --- |
| 第一阶段 | 浏览器 + Node.js 可玩纵切与基础验收。 | [PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)、[PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md) |
| 第二阶段 | 本地验收、Mock 默认可玩和基础路线保护。 | [PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)、[PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md) |
| 第三阶段 | S31-S39.1 长期模拟骨架、关系、NPC、事件、官场、科举、浏览器与存档硬化。 | [PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md) |
| 第四阶段 | S40-S47.2 AI 连接、prompt pack、World Threads、AI 权限矩阵、World Entities、依赖治理和 provider/browser 验收。 | [PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)、[FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md) |
| S48 | 时间专项：普通自由行动改为一旬一回合，月末只在下旬进入下月上旬时完整结算。 | [TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md) |
| S49-S67 | 本地数据库基础、SQLite 业务表、双模式验收、大世界内容、prompt 检索、局势簿分页和 large fixture 规模验收。 | [LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md) |
| S68-S69 | 科举制度、读书账本、老师点评、科场流程、多考官阅卷、榜单荣誉、同年座师、授官轨迹和 Provider/Mock 验收。 | [IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md) |
| S70 | AI prompt/tool/actor/多模型路由、AI 设置、官职月报、跳时、记忆、地图接口、provider AI-first smoke 和 JSON/SQLite parity。 | [AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md) |
| S71 | 数据库 gameplay resolver、安全检索、redacted player API、财政/刑名/军务外交 resolver、压力事件、多 actor 场景、NPC 记忆和 AI 调动审计。 | [DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md) |
| S72 | PixiJS 水墨地图、地图素材、局势簿联动、水墨动效、浏览器验收和安全回归。 | [PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md) |
| S73-S77 | 前端水墨重构：素材体系、React/Vite 默认入口、首页/全局 shell、身份/考试/放榜/舆图/人物页面、安全/性能/可访问性和总验证。 | [FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md) |
| S78 | 官署专题玩法化：六类专题三栏工作台、`topicSurfaceView`、AI/Mock 拟稿、安全证据白名单和草稿-only 边界。 | `docs/DEVELOPMENT_STEPS.md` 历史记录、Git history |
| S79 | 前端修复、194 张 recovered 女性高清立绘入库、runtime manifest 刷新和只读高清立绘查看器。 | `docs/DEVELOPMENT_STEPS.md` 历史记录、Git history |
| S80 | 服务端全局 AI 设置、设置页/印匣共享矩阵、保存状态反馈、provider key 可用性提示和旧 session 设置入口兼容。 | `docs/DEVELOPMENT_STEPS.md` 历史记录、Git history |
| S81-S85 | NPC、资产、储物、交易、委派、经济 tick、NPC 主动来函、论道/切磋/求爱/婚姻扩展位和总验收。 | [NPC_INVENTORY_SYSTEM_ARCHIVE.md](NPC_INVENTORY_SYSTEM_ARCHIVE.md) |
| S86 | 后端 TypeScript 渐进迁移首轮，建立 server typecheck/probe、contracts、runtime guards 和高风险模块选择性 `@ts-check`。 | [TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md](TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md) |
| S87 | route/API response shape 首轮覆盖，固定 game/exam/AI/inventory/NPC/trade/delegation public response，并以局部 helper 守住 raw ledger 剥离。 | [TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md) |
| S88 | 全面系统打磨阶段性归档：书生主线、六身份循环、官场/领域后果、NPC/关系、经济解释、React 状态、PixiJS 舆图、视觉立绘和 provider 验收首轮。 | [QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md) |
| S89.1-S89.68 | React 产品 polish、玩家可见术语清洗、route 空态/读法深化、材质动效、CSS 预算、CSS token/surface/keyframe 语义化和首页 token 收敛。 | [FRONTEND_PRODUCT_POLISH_ARCHIVE.md](FRONTEND_PRODUCT_POLISH_ARCHIVE.md)、本文件“S89 压缩归档”、`docs/DEVELOPMENT_STEPS.md` 归档前 Git history、实现提交至 `948f59a0` |
| S90.1-S90.4 | React 产品级前端 polish 续轮：CSS 启动预算恢复、route 样式拆分、跨页读法深化、囊箧/史册/朝议深层读卷和专题层材料/证据/草稿读法。 | [FRONTEND_PRODUCT_POLISH_ARCHIVE.md](FRONTEND_PRODUCT_POLISH_ARCHIVE.md)、本文件“S90 压缩归档”、提交 `5d96bb4f`、`fd0c8be7` |
| S91.1-S91.18 | 前端全局“读法 / 校阅 / 候复”收束：设置、首页、主卷、人物、囊箧、科举、皇榜、舆图、史册、朝议、身份循环、专题层、领域后果与证据空态。 | 本文件“S91 压缩归档”、迁出前 `docs/DEVELOPMENT_STEPS.md` Git history、实现提交 `38463a07` 至 `bd588f33` |
| S92.1-S92.10 | AI 编排 v2 基础：baseline、旁路 runtime、ProviderAdapter strict、Mock-first tool loop、eval v2、Prompt Registry、EvidenceRef、安全 trace/provider health、前端 public trace debug 与 SQLite prompt retrieval parity 修复。 | [AI_ORCHESTRATION_V2_ROADMAP.md](AI_ORCHESTRATION_V2_ROADMAP.md)、[AI_V2_BASELINE_REPORT.md](AI_V2_BASELINE_REPORT.md)、本文件“S92 压缩归档”、迁出前 `docs/DEVELOPMENT_STEPS.md` Git history |

## S73-S78 历史台账压缩

旧完整流水主要记录 S73-S78，每个子步骤的详细验证命令和复审结论已由 Git 历史与专题归档承接。本节只保留接手时仍可能需要的锚点。

| 范围 | 完成内容 | 关键边界 |
| --- | --- | --- |
| S73.0-S73.2 | 固定前端水墨重构任务书、多页 React Router 决策、视觉资产指南、UI manifest schema 和素材台账。 | 后续前端只能通过已审核 manifest/runtime manifest 与安全 `portraitRef` 使用素材。 |
| S73.3-S73.8 | 生成并审核 UI 材质、首页资产、场景插画、身份背景、立绘风格基准、动效与 fallback 包。 | AI/第三方视觉资产入库前必须做视觉审核；未审核素材不可进入 runtime。 |
| S73.9-S73.10 | 建立素材 QA、立绘矩阵、玩家池、通用 NPC、重要 NPC、状态/场景锚点、年轻女性补充与单张高清覆盖。 | 全量立绘池不得一次性加载；重要 NPC 专属池不得被通用头像随机抽取。 |
| S74.0-S74.7 | React + TypeScript + Vite 默认入口、Express history fallback、安全 API client、Zustand 会话/UI store、surface registry、asset registry 和 S72 地图桥。 | 旧 `public/` 原生前端只作迁移参考；普通读档走 `player-state`，不读 raw state/dev diagnostics。 |
| S75.1-S75.10 | 首页画卷、开局表单、朱印反馈、右上角印匣、案卷读档、继续本局、显示偏好、底部奏折和只读快捷建议。 | 快捷建议只写行动草稿；显示偏好只存本地白名单，不进入 canonical state。 |
| S76.1-S76.12 | 主游戏壳、六类身份面板、科举考试全屏、放榜全屏、独立舆图页、人物谱牒、专题 surface 扩展位和 S76 总验收。 | 前端只读安全 projection 和草稿入口，不裁决考试、官职、军务、财政、案件、地图移动或人物 hidden 真值。 |
| S77.1-S77.8 | 默认入口确认、browser smoke 扩展、视觉像素、安全污染防线、资源预算、可访问性/字体系统、归档和 S73-S77 总验证。 | browser smoke 守护 DOM/storage/runtime manifest/截图名安全字段；完整书生科举链由 `smoke:exam-s69` 持续保护。 |
| S78 | 官署专题真实材料、证据 ref、AI/Mock 草稿和写入底部奏折闭环。 | `topic_draft` 不提交普通回合、不推进时间、不调用 resolver、不写 canonical state；真实后果仍由服务器回合裁决。 |

## S89 压缩归档

2026-05-27 按用户要求将 S89 完成流水从活动台账迁出。详细逐步记录不再复制到当前必读上下文；需要逐项追溯时查看迁出前的 `docs/DEVELOPMENT_STEPS.md` Git history 和对应实现提交。

| 范围 | 完成内容 | 关键边界 |
| --- | --- | --- |
| S89.1-S89.19 | React 玩家可见术语、移动端覆盖层、视觉矩阵、轻量专题页壳、设置/错误空态、首页旧案状态、人物/立绘查看器、舆图、史册、朝议、科举、皇榜、囊箧/账解读法等 polish。 | 前端只消费安全 view 与本地草稿；不新增后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、manifest 字段或服务器裁决权。 |
| S89.20-S89.36 | CSS 预算瘦身、重复规则折叠、JS 分包预算稳定、覆盖层纵深、人物/舆图/首页/科举/皇榜/主卷/朝议材质动效和跨页追踪读法。 | 保持 route/local 状态和 browser-draft-only 边界；地图 layout、visual-only effect、NPC anchor 和证据 hint 不得变成真实裁决事实。 |
| S89.37-S89.63 | CSS token 与可访问性渐进重构、结构 selector 收敛、静态 surface utility 接入、共享纸面状态 token 化、状态色 token 化、基础控件/壳 token 化和 motion keyframe 语义化。 | 不删除仍有源码命中的业务 selector，不改变 React DOM、className、`data-polish-*` 历史 marker、数据流、API/schema、AI 权限、prompt、provider、存档或 manifest。 |
| S89.64-S89.68 | 首页背景、开卷案桌、朱印、样卷入口、开卷路径、旧案状态、身份选项和立绘选择态 token 化/复用。 | 最新 CSS source 聚合长度约 199987 bytes，距离 200000 bytes guard 余量极小；后续 CSS 需先考虑瘦身、合并或物理拆文件。 |

S89 最新完整验证锚点来自 S89.68：focused scaffold、组合 CSS canary、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（99 tests）、`npm run typecheck:client`、串行 Vitest（6 files / 134 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、直接 `node scripts/clientSmoke.js` 和 `npm test`（1213 tests）均通过。

## S90 压缩归档

2026-05-29 按用户要求将 S90 完成流水从活动台账迁出。S90 仍可通过 [FRONTEND_PRODUCT_POLISH_ARCHIVE.md](FRONTEND_PRODUCT_POLISH_ARCHIVE.md) 追溯专题全貌；本节只保留接手需要的范围和边界。

| 范围 | 完成内容 | 关键边界 |
| --- | --- | --- |
| S90.1-S90.2 | 首页、主卷、舆图/史册、人物/囊箧、科举/皇榜和移动端样式迁到页面级 import；`global.css` 收束为 token/base/shell/controls/overlay/motion 启动样式图；跨页读法、错误空态、设置/印匣、专题层、舆图/人物/科举/皇榜体验完成产品级 polish。 | 不新增依赖或素材，不请求完整 manifest，不硬编码本地路径，不改变 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决。 |
| S90.3 | 新增 [FRONTEND_PRODUCT_POLISH_ARCHIVE.md](FRONTEND_PRODUCT_POLISH_ARCHIVE.md)，把 S89.1-S89.68 与 S90.1/S90.2/S90.4 整理为专题归档。 | 纯文档归档，低风险跳过提交前子代理复审。 |
| S90.4 | 囊箧“四读”账解索引、史册“由史册成题”、朝议“材料入席”和 `SurfaceHost` 材料/证据/草稿读法完成。 | 浏览器仍只消费安全 view、本地草稿和页面/专题状态，不裁决资源、交易、任免、赏罚、定罪、战和、关系或 hidden 信息。 |

S90 主要验证锚点：client typecheck、React scaffold canary、App Vitest、client build/budget、browser smoke、docs governance、`git diff --check` 和 `npm test`（S90.4 记录为 1215 tests）。实施/复审子代理均未提交、未推送、未创建 PR。

## S91 压缩归档

2026-05-29 按用户要求将 S91 完成流水从活动台账迁出。S91 的共同目标是把前端各页面的“读法 / 校阅 / 候复”变成玩家可扫读的安全状态说明：所有读法只从现有安全 view、route 状态和本地草稿/选择派生，不回显正文，不新增浏览器裁决权。

| 范围 | 完成内容 | 关键边界 |
| --- | --- | --- |
| S91.1-S91.7 | 设置/AI 来源、首页开卷、主卷行止、人物往来、囊箧移置、科举落墨和皇榜题名读法完成；移动端溢出、旧案串扰、交卷后读法和榜名选择安全守门同步补齐。 | 只改 React 前端读法、CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema、AI 权限、依赖、素材、存档字段、prompt 能力或服务器裁决。 |
| S91.8-S91.14 | 舆图图层、史册拟稿、朝议专题草稿、入仕月报、皇帝御案、六身份循环和 `SurfaceHost` 专题层候复校阅完成。 | 浏览器只消费安全 projection、本地草稿和专题状态；草稿写入只表示“候主卷回批”，不推进时间、不裁决资源、官职、关系、交易、定罪或 hidden 信息。 |
| S91.15-S91.18 | 领域后果追踪校阅、史册议程/月报互证、领域后果范围上限口径、专题层单行 live status 和证据空态完成；旧案列表等待加固，避免 smoke 自动刷新误判。 | 后果、凭据、互证、证据勾选和候复播报都不得变成真实任务队列、资源结算器、任免/赏罚/定罪/战和/关系裁决器。 |

S91 主要验证锚点：每步均有 client typecheck、React scaffold source canary、聚焦或完整 App Vitest、client build/budget、browser smoke、docs governance、`git diff --check` 和逐步增长的 `npm test`；S91.18 最新记录为 `npm test` 1233 tests。提交前只读复审按代码改动执行；纯文档补记哈希时按低风险规则跳过额外复审并记录。

## S92 压缩归档

2026-05-29 按用户要求将 S92.1-S92.10 完成流水从活动台账迁出。S92 的共同目标是建立 AI 编排 v2 的安全旁路地基，不直接接管默认普通回合、真实 provider、route/API、存档、SQLite schema、浏览器 UI 或服务器裁决。

| 范围 | 完成内容 | 关键边界 |
| --- | --- | --- |
| S92.1-S92.3 | 新增 AI 编排 v2 路线图与 baseline；建立旁路 `AiTaskRuntime`、ProviderAdapter 合约、预算、trace、fallback；新增 OpenAI ProviderAdapter strict structured output 兼容层和 response normalizer。 | 默认 provider facade、`/api/game/turn`、prompt、tool 权限、存档、SQLite、浏览器 UI 和服务器裁决不切换；真实 provider 仍需 strict opt-in 与 schema validation。 |
| S92.4-S92.6 | 新增 Mock-first agentic tool loop、provider-visible tool list/result projector、AI Eval v2 场景回放、Prompt Registry v2、prompt doctor 和 world_turn/topic_draft pack metadata。 | Tool call 只能得到 read/proposal/request_adjudication 的 bounded public result；proposal/request_adjudication 不写 canonical state、SQLite、事件档案、官职、榜单、判决、军令、赏罚或审计成案结果。 |
| S92.7-S92.10 | EvidenceRef resolver/ranker 和 prompt retrieval safety gate 完成；public trace/provider health 固定字段与 failure taxonomy 完成；前端“推演回声” public trace/反馈入口完成；SQLite prompt retrieval 将已裁定可见的 `role_visible` / `office_visible` 情报传闻归一为 `actor_visible`，修复 JSON/SQLite visible route and prompt payload parity。 | EvidenceRef 只从最终安全 rows 生成 `public` / `player_visible` / `actor_visible` 引用；public trace/feedback 不暴露 raw prompt、provider payload、`worldState`、`statePatch`、key、base URL、本地路径、raw SQLite row、hidden/private refs 或内部 `server.*`。 |

S92 最新完整验证锚点来自 S92.10：`node --check src/storage/sqlitePromptRetrievalTables.js`、`node --test test/sqlitePromptRetrieval.test.js`（10 tests）、`node --test test/dualModeAcceptanceScript.test.js`（8 tests）、`npm run eval:ai`、`npm run eval:ai:v2`、`npm run typecheck:server`、`npm run check:docs-governance` 和 `npm test`（1294 tests）均通过。若继续推进 S92 后续，优先新开小步做 `/api/game/turn` 的 `AI_RUNTIME_V2=shadow` 旁路记录设计，或把 EvidenceRef 接入 topic/tool proposal allowlist；不得直接把默认普通回合切到 v2。

## 验证锚点

已完成台账迁出时保留的主要验证锚点：

- S77.8 前端水墨重构总验证：`npm test`、`npm run typecheck:client`、`npm run test:client`、`npm run build:client`、`npm run smoke:browser -- --screenshots artifacts/s77-frontend-ink`、`npm run smoke:exam-s69`、`npm run smoke:dual-mode -- --storage-only`、docs governance、documentation governance 和 `git diff --check`。
- S78 官署专题：focused topic surface / topic draft / AI settings / prompt schema tests、client typecheck/Vitest/build、React browser smoke、完整 `npm test`、docs governance、documentation governance 和 diff check。
- S79-S80 验证锚点仍在 `docs/DEVELOPMENT_STEPS.md` 归档前 Git history 中；S81-S85 验证锚点见 [NPC_INVENTORY_SYSTEM_ARCHIVE.md](NPC_INVENTORY_SYSTEM_ARCHIVE.md)，S90-S92 验证锚点见本文件对应压缩归档。

## 稳定边界摘要

- `npm install && npm start` 应保持默认 Mock 可玩，并打开 `http://localhost:3000`。
- 完整书生路径必须继续可用：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- React 前端只能消费安全 API/view、AI 设置 view、地图 runtime view、考试安全快照、已审核 `portraitRef` 和 runtime manifest。
- AI 是核心世界引擎，但只能提交结构化建议、受限 patch 或 proposal；服务器拥有状态边界、资源/交易/NPC 行动、考试晋级、官职任免、经济结果、持久化和可见性裁决。
- 本地 JSON 仍是默认存储；SQLite 只做本机派生表、索引、审计和可修复 projection，不引入远程、账号、多人或云端语义。

## 后续维护规则

1. 新完成步骤先写入 `docs/DEVELOPMENT_STEPS.md` 近期记录。
2. 阶段完成后优先写专题归档，例如 `*_ARCHIVE.md`，把设计、API、AI 边界、验证和遗留风险收束到主题文档。
3. 若再需要压缩活动台账，只追加短表和追溯入口；避免复制完整旧台账、完整命令输出或重复治理段落。
