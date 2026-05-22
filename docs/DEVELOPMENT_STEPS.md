# 《千秋》活动路线图与进度台账

本文件是 Codex 当前维护的压缩活动路线图与进度台账。它只保留接手下一步所必需的治理规则、当前状态、最新验证口径和近期完成节点；已完成流水不在这里展开。

需要追溯已迁出的完成流水时阅读 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md) 的压缩索引；该文件不再保存完整逐日长流水，专题细节优先阅读对应归档和 Git history：

- 第一阶段：[PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段：[PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段：[PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段：[PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度见 [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)。
- S48 时间专项：[TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S67 本地数据库基础、SQLite 业务表、双模式验收、超大动态世界内容与 S60 内容契约：[LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)。
- S68-S69 科举、读书、评卷、榜单、同年座师、授官和 Provider/Mock 验收：[IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)，制度契约见 [IMPERIAL_EXAM_SYSTEM_CONTRACT.md](IMPERIAL_EXAM_SYSTEM_CONTRACT.md)。
- S70 AI prompt/tool/actor/多模型路由、AI 设置、官职月报、跳时、记忆、地图接口、provider AI-first smoke 和 JSON/SQLite parity：[AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md)。
- S71 数据库玩法化、维护、安全检索、redacted player API、财政/刑名/军务外交服务器 resolver、压力事件、多 actor 场景、NPC 记忆账本、AI 调动审计和验收：[DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)，resolver 输入契约见 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)。
- S72 PixiJS 水墨地图：[PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)，运行时契约见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)，素材台账见 [MAP_ASSET_LEDGER.md](MAP_ASSET_LEDGER.md)。
- S73-S77 前端水墨重构、React/Vite 默认入口、首页/全局 shell、身份/考试/放榜/舆图/人物页面、立绘管线、安全/性能/可访问性和总验证：[FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，素材台账见 [FRONTEND_ASSET_LEDGER.md](FRONTEND_ASSET_LEDGER.md)。
- S81-S85 NPC、资产、储物、交易、委派、经济、NPC 主动性和礼法扩展位：[NPC_INVENTORY_SYSTEM_ARCHIVE.md](NPC_INVENTORY_SYSTEM_ARCHIVE.md)，规划见 [NPC_INVENTORY_SYSTEM_ROADMAP.md](NPC_INVENTORY_SYSTEM_ROADMAP.md)，契约见 [NPC_INVENTORY_SYSTEM_CONTRACT.md](NPC_INVENTORY_SYSTEM_CONTRACT.md)。
- S86 后端 TypeScript 渐进迁移与 Rust 使用边界：规划见 [TYPESCRIPT_BACKEND_MIGRATION_ROADMAP.md](TYPESCRIPT_BACKEND_MIGRATION_ROADMAP.md)，完成归档见 [TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md](TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md)。
- S87 后端 route/API 响应类型覆盖：规划见 [TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ROADMAP.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ROADMAP.md)，完成归档见 [TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md)。
- S88 全面系统打磨路线图：规划见 [QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)。

2026-05-14 起，按用户要求停止与 Gemini CLI 共同开发；后续开发全部由 Codex 负责。远程存档、账号体系、多人同步、云端冲突解决和托管数据库不进入当前规划。

## 1. 开发规范继承

<!-- GOVERNANCE_REQUIRED_START -->

开发规范不变。继续保持：

- 稳定开发治理锚点见 [docs/DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md)；重写路线图或交接文档时不得删弱其中的必守规则，并运行 `npm run check:docs-governance`。
- `npm install && npm start` 可运行，默认打开 `http://localhost:3000`。
- Mock AI 默认完整可玩，真实 provider 只作为可选配置。
- 完整书生路径不得破坏：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
- 后续开发和维护不以“最小实现点”或“最小改动点”为目标；在安全边界、默认可运行、内容保护和可审查粒度不受损的前提下，优先交付完整、丰富、功能强大的游戏实现，并把必要的系统、交互、AI、数据、验证和文档一次设计到位。
- 复杂功能必须坚持前后端分离和大步骤拆分：后端/API/数据契约、AI 权限与服务器裁决、前端体验、验证与文档应按可审查阶段分步交付；前端不得代替服务器裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息。
- 后端契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver 新增或重构时，应优先使用 TypeScript 或纳入 TypeScript 检查；既有 JavaScript 允许渐进迁移，不得为语言迁移一次性重写大量稳定模块，TS 类型也不能替代 Ajv 与服务器 runtime 校验。
- 后端 route/API response shape 新增或重构时，必须对齐 `src/contracts/serverContracts.ts` 或局部 JSDoc typedef，并运行 `npm run typecheck:server`；不得为了启用类型检查一次性 whole-file `@ts-check` 大型 route 文件，也不得放宽安全 projection、raw ledger 剥离、Ajv/runtime 校验或服务器裁决。
- AI 是《千秋》的核心世界引擎，不是可替换装饰；新增玩法、数据域、角色、官署、事件、面板或 prompt 检索时，必须设计 AI 的读取范围、角色智能、工具权限、proposal 边界、服务器裁决、审计记录和 Mock/no-key 降级。
- AI 可以生成叙事、题目、评分建议、关系建议、受限 `statePatch`，或通过身份受限的领域工具提交 structured proposal / tool call；AI 不得执行 SQL，不得直接写 canonical 状态、业务表或审计表。服务器继续拥有时间推进、状态边界、科举晋级、作弊处罚、官场任免、长期事件、世界实体、世界议程、数据库写入和持久化裁决。
- 游戏规则、数值阈值、时间间隔、概率、UI 限制、fixture 规模和 prompt budget 等可调参数不得散落为魔法数字；新增或调整时优先集中到具名配置模块，例如 `src/config/GameConfig.js` 或更贴近领域的 `src/game/*Config.js`，并写清单位、范围和默认值意图。
- 项目内协作文档、路线图、交接记录、领域注释和玩家可见文案优先使用中文。
- 每个 coherent change 必须更新 `docs/SHARED_CONTEXT.md`，必要时同步 README、产品 brief、架构/契约文档，并用 Git 提交。
- 关键决策不能只留在聊天记录里；会影响后续 Codex 接手的内容必须写入仓库文档。

### 子代理使用规则

- 用户已明确授权 Codex 在本仓库使用子代理；除非后续用户指令收窄或撤销，否则视为长期项目上下文。
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

当前专项继续继承 S46.1 的依赖、插件与开源参考治理。后续新增或升级 `package.json` 依赖、开发工具、外部服务 SDK、Codex 工作流或开源参考时，必须先按 [依赖、插件与开源参考治理](DEPENDENCY_PLUGIN_GOVERNANCE.md) 记录和验证。

- 依赖或插件必须明显降低复杂度、提升可靠性、改善安全性、改善浏览器体验或提供成熟标准能力。
- 记录必须说明用途、运行入口、测试覆盖、替代方案、许可证、维护状态、安全/隐私影响、Mock/no-key 影响、文档落点和回滚策略。
- 优先选择维护活跃、文档清晰、常用、许可证友好的库；参考开源项目时记录借鉴点，不复制不明来源的大段实现。
- 前端以 React + TypeScript + Vite 的 `client/` 源码和 `dist/client/` 构建产物为默认交付入口；后续框架或构建链调整必须先进入活动路线图和依赖治理记录。
- 核心游戏规则、时间推进、科举晋级、状态边界、作弊惩罚、官职任免和持久化不能完全交给模型或黑箱库。
- 加依赖后必须验证 `npm install`、`npm start` 和对应测试。
- 涉及 AI 可读摘要、server-owned ledger、浏览器面板或 provider 验收时，同步检查 [docs/AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md) 是否需要更新。

<!-- GOVERNANCE_REQUIRED_END -->

## 3. 当前边界与归档索引

必须继续保护的边界：

- JSON adapter 继续是默认路径，Mock 模式继续完整可玩。
- SQLite 模式只表示本机不同存档，不引入远程、账号、多人或云端语义。
- AI 可以通过身份受限领域工具提交 proposal 或 request-adjudication，但不能执行 SQL，不能直接写 canonical 状态、业务表或审计表，也不能把 tool call 伪装成已经发生的世界事实。
- API、prompt 和浏览器只读服务器整理后的 projection；不得暴露 raw audit、provider proposal、完整 prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系或 hidden raw rows。
- S60-S67 的 hidden 私档、资产真数、密档事件链和隐藏情报真值没有回填当前 raw route `worldState`；后续若保存真正 hidden 私档，必须先设计玩家 API redaction 和 prompt role-visibility 分层。
- S73-S79 人物与素材显示必须通过已审核 `portraitRef`、缩略图、低清占位、精简 runtime manifest 和 fallback 使用；不得显示未审核素材、不得硬编码本地路径、不得一次性拉取全量立绘池。

## 4. 活动路线图总览

当前进入 S88 全面系统打磨专项。总路线图见 [QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)，覆盖完整书生主线、多身份循环、官场与世界后果、AI 世界引擎、NPC/关系、资产经济、React 前端、PixiJS 地图、视觉立绘、后端类型安全和 Mock/真实 provider 验收。S88 继续沿用 S86/S87 的渐进 TypeScript 路线，不做全仓重写，不对大型 route 文件 whole-file `@ts-check`。

| ID | 状态 | 目标 | 范围 / 下一步 |
| --- | --- | --- | --- |
| S88.0 | DONE | 系统打磨路线图与边界复核 | 已新增 `docs/QIANQIU_POLISHING_ROADMAP.md`，把用户要求的全面打磨拆为 S88.1-S88.12 小步骤，并确认当前工作树仅有未跟踪 `npm-start.log` / `npm-start.err.log`，不纳入本轮提交。 |
| S88.1 | DONE | AI remote helper/provider public-safe envelope | 已把 `remoteHelpers` 的 prompt task、provider requester、validated payload 纳入 `npm run typecheck:server`，并为 AI connection public response、provider fallback 日志、诊断错误和玩家/审计安全出口增加 raw provider/prompt/key/path 脱敏与 forbidden field contract。 |
| S88.2 | DONE | SQLite derived row builder 类型边界 | 已覆盖 `SqliteWorldSessionRow`、`SqlitePromptRetrievalRow`、`SqliteSafeSearchIndexRow`、prompt/safe repair status、maintenance safe diagnostics 和首批 row builder JSDoc/TS contract；派生表继续只从 `world_sessions.world_state_json` 单向修复。 |
| S88.3 | DONE | 书生主线补强一轮 | 已完成入仕首月差事、备考压力/入场反馈、阅卷放榜同年座师过渡、读书计划深化、考试入场后反馈五个切片；完整书生路径继续作为后续验收入口。 |
| S88.4 | DONE | 入仕官员首轮官场体验 | 已完成七个切片：首月差事派生 `officialCareerView.firstMonthExperience`、官署回执、上官同僚反馈、考成信号、月报摘录和官员面板“官署首月”；首月回署材料已整理为 `officialCareerView.courtEntry` / `courtEntries`，进入奏折/朝议 surface 与 `topic_draft` 安全 evidence；普通回合提交首月回署奏折/朝议后，服务器写入 `courtEntryResolutions`、近次裁决、事件档案和月报摘录；继续提交朝议/部院/御前/考成跟进后，服务器写入 `courtEntryFollowUps`、`latestFollowUp`、`official_court_follow_up` 事件档案、月报和 world thread 中间反馈；跨身份 `courtResponseView` / `officialCourtResponses` 已让皇帝、大臣、官员围绕公开奏议写入受限 `official_court_response` 中间态；长期 `courtConsequenceView` / `officialCourtConsequences` 已把公开奏议链路转为 `official_court_consequence` 信号、月报、world thread 和 React 官员/皇帝只读余波；皇帝/部院续办链路已把上一轮 `official_court_response` 投影为 `courtResponseView.chainItems`，普通回合可写入御前再摘、部院再覆、补据承批和考成续记的下一轮中间态。下一步进入 S88.5 六身份循环矩阵或 S88.6 跨域后果 refs。 |
| S88.5 | IN_PROGRESS | 六身份循环矩阵 | S88.5.1 已先建立服务器派生的 `roleCycleView` 与 React `RoleCycleSection` 首片，把皇帝、大臣、将领、地方官、书生、入仕官员统一为当前身份循环矩阵：只公开当前身份事务、风险、待办、AI read scope、工具权限、proposal 边界和服务器裁决说明，非当前身份只显示待任占位。S88.5.2 已启动跨域入口与证据 refs：地方官循环只读接入市价与人物月账，将领循环只读接入舆图与战事档案，并以前端 route/surface 入口展示，不新增写 API 或持久账本。S88.5.3 已接普通回合后端接缝：低风险市价处置、军议侦察和调粮复用既有 city/military resolver；人物月账保持只读。 |
| S88.6 | IN_PROGRESS | 官场与世界后果追踪 | 首片已实现安全 `domainConsequenceView`：从 `cityPolicyLedger`、`militaryDiplomacyLedger`、`judicialCaseLedger` 和 NPC 经济月账派生公开后果追踪 refs，接入 game/exam route response、事件档案、world thread 和官职月报；兼容 public `worldState` / redacted state 已补 `judicialCaseLedger` 剥离。第二片已接入 resolver/topic/source evidence、`topic_draft` 引用和搜索/SQLite 安全索引；前端片把 `domainConsequenceView` 接入地方官、将领、官员/大臣和皇帝主卷面板，按钮仅写草稿；红队片已收紧旧存档污染过滤、未应用状态外泄、重复后果去重、inactive role、高风险军务绕过、普通回合近 3 旬重复触发拦截、地图/史册追踪入口、high-volume evidence cap、角色可见性、map runtime 后果 effect 和跨视图 cap 压力。最新两片新增公开 `publicEchoRef` 与 topic draft -> turn canonical echo 审计链，让月报、world thread resolved、role-cycle 草稿、topic surface、`topic_draft` 和下一轮普通回合裁决按同一安全回响键去重/复核；浏览器 `draftContext` 只作为待校验 hint，服务器会重建当前 topic surface 反推 echo refs 后才写入公开 outcome、内部 audit 和最新 city/military ledger 审计字段，不重复写账、不接受伪造 echo、不扩大裁决权。后续可转入 S88.7 NPC/关系深化，或补真实 provider/streaming turn 的 draftContext smoke 与更长冷却周期回归。 |
| S88.7 | IN_PROGRESS | NPC 与关系深化 | 首片已启动专门 resolver trace：NPC 主动来函回应写入 `npc_active_request_resolver` 安全 trace，论道/切磋/求爱/婚姻写入 `npc_relationship_action_resolver` 安全 trace，并把新的 `npcActiveRequestLedger` 接入 `worldThreadView` 与 `worldEntity` 压力；第二片把安全 trace 接入长期回响：事件档案新增 `npc_active_request` / `npc_relationship_action` 来源，普通 turn 会把本旬主动来函 resolver trace 写成已知 NPC 的可见 `npc_active_request_trace` 记忆，且必须命中 canonical active request safe record，伪造可见/不可见 refs 或同 ref 篡改字段不会改记忆类型、标签或摘要；第三片把 `/npc-interaction` 的论道/切磋/求爱/议婚安全记录即时写成 `npc_relationship_action_trace` 可见记忆，并随响应返回 `actorMemoryView` / `eventArchiveView` 供 React session 合并刷新；第四片新增主动来函 `responseOptions` 与 resolved `outcome.followUpView`，将行贿、弹劾、背叛、引荐、请托、索债/人情债、献策、求助和议婚拆成服务器配置的后续复核类型、公开摘要、下一步、证据 refs、风险标签和前端草稿按钮；`responseOptions` 只对 `active` / `deferred` 来函开放，已裁决 follow-up 只展示说明和状态。第五片实现提交 `18e489e5`：`npcActiveRequestView.followUpTasks` 派生“来函后续簿”，把已裁决 follow-up 收束为公开 taskRoute、状态、证据 refs、风险标签和草稿；React 人物页只读展示并写本地草稿。第六片实现提交 `a16e34df`：普通回合现在可把匹配 task 的“续办/后续/复核”文本登记为 `npc_active_request_follow_up_resolver`，回写 canonical request 的 `outcome.followUpResolutions` / `followUpView.latestResolution` 并公开近次状态；失败 follow-up attempt 不回落处理普通 active 来函，普通“查证/登记+泛词”也不劫持后续簿。第七片实现提交 `c08eb0fd`：`followUpResolutions` 已接入事件档案、NPC 记忆和 world thread 长期公开回响，均从 safe view/canonical resolution 匹配派生，不读取 raw ledger 或创建真实领域结果。第八片把 `npcActiveRequestView.followUpEvidence` 派生成 people/events/economy 只读领域 evidence，并接入 resolver input、奏折/朝议/堂审/人物 topic surface、安全搜索和 SQLite safe-search；仍不直接扣资源、写婚姻、成弹劾/定罪、处置背叛、创建真实后续任务或公开 hidden 私档。第九片前端体验实现提交 `fa105ec5`：人物页、史册页和 topic surface 只读展示来函 evidence，按钮只写本地草稿，首页旧案卷/继续本局过滤开发文案污染。 |
| S88.8 | IN_PROGRESS | 资产、囊箧、交易、委派与经济解释性 | 第一片已新增 `economyTraceView` 公开安全解释投影，汇总资源、资产、囊箧、交易、委派、市价和 NPC 月账变化原因，并在囊箧页展示“账本为何变化”；按钮只写行动草稿，资源扣减、物品流转、交易成交、委派结果、人情债和关系变化仍由服务器裁决。实现提交待本轮提交后回填。 |
| S88.9 | TODO | React 前端操作与状态打磨 | 逐页补 loading、empty、error、低动效、移动端、文本溢出和操作效率。 |
| S88.10 | TODO | PixiJS 水墨地图行动入口 | 复用 `mapRuntimeView` 与已审核素材，把地图打磨为局势、移动、事件、地方事务、军务外交、NPC 活动和行动草稿入口。 |
| S88.11 | TODO | 视觉、立绘与氛围一致性 | 继续只用已审核 runtime manifest 与 `portraitRef`，不显示未审核素材、不硬编码本地路径、不一次性加载全量立绘池。 |
| S88.12 | TODO | Mock/真实 provider 长循环验收与归档 | 以 Mock 默认完整可玩为基线，真实 provider 只作为可选增强，补 provider 长循环 smoke 与 S88 归档。 |

## 5. 最新状态

- 2026-05-22：推进 S88.8 资产/交易/委派/经济解释性第一片，提交待回填。新增 `src/game/economyTraceConfig.js` / `src/game/economyTraceView.js`，从既有安全 `resourceLedgerView`、`assetLedgerView`、`inventoryView`、`tradeLedgerView`、`delegatedTaskView`、`marketPriceView` 和 `npcEconomyView` 派生 `economyTraceView`，用 `sourceRefs`、trace type、分组、金额摘要、下一步和服务器边界解释资源、资产、囊箧、交易、委派、市价和月账为何变化；公开 view 不读取 raw ledger，不输出 `evidenceRefs`、provider/prompt/key/path/SQLite/raw 字段，也不是结算器。`/api/game/start|state|player-state|turn|turn-stream`、`/api/game/inventory/:sessionId` 和 `/api/game/inventory-transfer/:sessionId` 已返回该安全投影，`src/contracts/serverContracts.ts` 与 React API 类型同步。新增 `client/src/components/EconomyTraceSection.tsx`，囊箧页展示“账本为何变化”，过滤污染行和跨案卷 stale session，只把“拟复核”写入本地行动草稿；前端不成交、不扣款、不转物、不改任务/NPC/关系。Harvey 与 Linnaeus 已做只读后端/API、前端接线探查。Lagrange 提交前只读初审发现两个问题：`transferInventoryItem()` stale 响应可能把旧案卷库存套进当前 `sessionId` 的 P1，以及 `economyTraceView.toolPermissions` 暴露 `SQLite` 实现名的 P2；本轮已让 transfer 响应只在 session 匹配时合并，并把公开文案改为“后端持久化账本”，补 store stale transfer 回归和 `SQLite|sqlite|SQL` canary。已通过本节 S88.8 验证口径全部命令；Wegener 最终只读复审未发现 P0/P1/P2。
- 2026-05-22：推进 S88.7 主动来函后续 evidence 前端体验片，实现提交 `fa105ec5`。新增 `client/src/components/NpcFollowUpEvidenceSection.tsx`，人物页只读展示 `npcActiveRequestView.followUpEvidence` 的人物/月账/案牍分组线索，史册页新增“来函证据追踪”，`SurfaceHost` 将 `npcActiveRequestView` 标注为“来函后续”并把 evidence refs 显示为“来函证据 · 人物/月账/案牍”，`surfaceRegistry` 同步安全数据来源。按钮只写 `role-surface` / `archive-view` 本地草稿，不调用 turn API，不结算资源、人情债、婚姻、弹劾、定罪、背叛、交易、NPC 行动或 hidden facts；首页旧案卷和继续本局摘要过滤开发文案污染，防止本地历史开发存档把 `S7x` / `smoke` / `验收` / `placeholder` / `debug` 等词带入玩家首页。James 提交前只读初审发现两个 P2：人物页可能渲染非当前 route session 的主动来函 evidence，以及完全污染的 evidence 行会 fallback 成可点击卡片；本轮已改为只读 `activeSession` 且整行丢弃核心污染 evidence，并补 stale session / polluted row 回归。已通过 `npm run typecheck:client`、focused App Vitest（38 项）、完整 client Vitest（73 项）、`AI_PROVIDER=mock npm run smoke:browser`、docs governance、documentation governance、完整 `npm test`（1107 项）和 `git diff --check`；James 最终只读复核确认两个 P2 已关闭，未发现新的 P0/P1/P2。
- S88 当前基线：全面系统打磨专项已启动，规划见 [QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)。S88.1 已完成 AI remote helper/provider public-safe envelope。S88.2 已完成 SQLite derived row builder 类型边界：`src/contracts/serverContracts.ts` 固定 world session、prompt retrieval、safe search、repair status 和 safe diagnostics 类型，`sqlitePromptRetrievalTables.js`、`sqliteSafeSearchTables.js`、`sqliteMaintenance.js` 纳入 `npm run typecheck:server`，继续保持派生表只从 `world_sessions.world_state_json` 单向修复。S88.3 已完成五个切片：殿试授官后会按服务器授官轨迹生成首月官场差事；考试取题后会按盘费、路途、保结、准考缺口、学业维度、体力心态和读书计划派生安全备考压力与入场反馈，并进入 public `entryPreparation`、`examProcedureView`、`studyProfileView`、书生面板和科举页；放榜后会由 `examAftermathView` 从服务器定榜、科名荣誉、公开同年座师网络和授官轨迹整理公开过渡摘要与草稿建议，皇榜页只读展示；读书计划现在由 `studyProfileView.nextPlan` 暴露服务器生成的三旬窗口、补弱强度、晨午暮日课、复盘节点、风险提示、首课草稿和权限边界，React 书生面板只读展示并只写行动草稿；场内推进后 `examProcedureView.phaseFeedback` 会按 `sceneTime`、科场阶段、备考压力和公开行动摘要生成入场后反馈、风险提示和下一步草稿建议，兼容 `worldState` 会同步清洗旧流程快照和科场局部时间，React 科举页只读展示并只把“拟行动”写入本地行动草稿。S88.4 已完成七个官场体验切片：`officialCareerView.firstMonthExperience` 从首月差事派生官署首月进度、风险、上官同僚反馈、回署回执、考成信号、下一步草稿建议和月报摘录提示；普通回合推进首月差事会生成 `[官署回执]`，`playerMonthlyBriefingView` 月末摘录该首月体验，React 官员面板新增“官署首月”区块且按钮只写行动草稿；`officialCareerView.courtEntry` / `courtEntries` 会把首月回署材料、奏折/朝议目标 surface、长期考成 trace、上官同僚后续回响和 draft-only 下一步整理为安全 evidence，供 `memorial-review`、`court-debate` 和 `topic_draft` 引用；普通回合提交这些草稿后，服务器写 `officialCareer.courtEntryResolutions`、近次 `latestResolution`、事件档案 `official_court_entry` 条目和月报摘录，只做受限进度/考成影响；继续提交朝议/部院/御前/考成跟进后，服务器写 `officialCareer.courtEntryFollowUps`、近次 `latestFollowUp`、参与 actor 摘要、事件档案 `official_court_follow_up`、月报和 `worldThreadView` 议题线索，仍不直接任免、奖惩、处分、奏议终局或风宪定案；跨身份回应新增 `officialCourtResponses` raw ledger 与 `courtResponseView` 安全投影，皇帝/大臣/官员可围绕公开奏议写入朱批留览、票拟覆奏、补据、朝议回应或考成观察中间态，事件档案 `official_court_response`、`worldThreadView`、`memorial-review` / `court-debate` 和 React 皇帝/官员面板只读消费；长期后果新增 `officialCourtConsequences` raw ledger 与 `courtConsequenceView` 安全投影，把公开奏议裁决、跟进和回应转为证据缺口、考成压力、风宪关注、功绩留痕或朝局余波，事件档案 `official_court_consequence`、`worldThreadView`、官职月报、topic surface 和 React 官员“考成与弹劾”/皇帝“赏罚预留”只读消费；皇帝/部院续办链路会把上一轮 `official_court_response` 投影为 `courtResponseView.chainItems`，并让普通回合续写御前再摘、部院再覆、补据承批或考成续记的下一轮中间态。下一步进入 S88.5 六身份循环矩阵或 S88.6 跨域后果 refs。
- S88.5 当前进展：S88.5.1 已建立 `roleCycleView` 首片，作为服务器即时派生的六身份循环矩阵安全 view；S88.5.2 已把当前身份循环接入跨域只读 evidence refs 和前端入口。S88.5.3 新增 `roleCycleDomainAdjudication` 普通回合反馈，把地方官“处置市价/平粜稳价”接到既有 `cityPolicyResolver`，把将领“舆图军议/战事档案”后的侦察或调粮接到既有 `militaryDiplomacyResolver`；人物月账入口只返回 read-only 说明，仍由 NPC 经济旬更/月结裁决。S88.6 红队已让该接缝在同一当前角色、resolver 意图和公开 evidence refs 近 3 旬重复提交时返回 `duplicate_recent`，不重复写 city/military ledger、不扣资源、不产生角色循环 attribute changes。`roleCycleView` 继续只派生 capped `entryPoints`、`items[].evidenceRefs` 和 `currentRole.evidenceRefs`；React 六身份主面板的入口仍只做 route allowlist 跳转或打开本地 surface，按钮仅写本地行动草稿，不调用 turn API，不替代服务器裁决。
- S88.6 当前进展：首片新增 `src/game/domainConsequenceTrace.js` 和 `domainConsequenceView`，只从服务器已裁决的城市政策、军务外交、刑名案件与 NPC 经济安全月账中派生公开后果摘要、来源类型、受影响指标标签、后续建议和稳定 public refs；不会把 `outcomeId`、证据 refs、`stateDelta` / `playerDelta`、资源消耗、关系信号、审计记录或 raw ledger 名称暴露给玩家。`eventArchiveView` 新增 `domain_consequence` 条目，`worldThreadView` 新增领域后果议题，`playerMonthlyBriefing` 会把近次领域后果纳入 sourceRefs、职责摘要、行动建议和风险提示；game/exam route 与 server/client route contracts 已返回 `domainConsequenceView`。`judicialCaseLedger` 已纳入 `RAW_LEDGER_KEYS`、`buildClientWorldState()` 与 redacted state forbidden keys，防止 accepted 刑名账本从兼容 `worldState` 外泄。第二片把 `domainConsequenceView.recentConsequences` 接入 resolver input 的 `events` source collection、`memorial-review` / `edict-draft` / `court-debate` / `trial` / `war-council` topic evidence、`topic_draft` 安全引用和 `safeWorldSearch` / SQLite `safe_search_index`，仍不新增 persistent ledger 或 SQLite 表。前端片新增 `DomainConsequenceSection`，并把安全 `domainConsequenceView` 接入地方官“领域后果追踪”、将领“军务后果追踪”、官员/大臣“领域后果”和皇帝“天下余波”；主卷安全视图索引新增“后果”，所有按钮只写 `role-surface` 行动草稿，不调用 turn API。红队已补强 `domainConsequenceView`：resolver ledger 行必须是 `accepted` / `applied` / `recorded` 且带应用旬标记才会公开；安全 `publicSourceId` 仅作为内部去重指纹，合并旧存档重放并保留较新、指标更完整的后果；文本清洗扩展到 provider/raw/evidence/private/hidden 旧别名和已配置环境密钥片段。`roleCycleDomainAdjudication` 同步收紧：高风险军务词混入侦察/调粮句时不触发低风险 resolver，非当前领域身份不能借市价或军议措辞写入 city/military ledger，近 3 旬同 actor/intent/evidence 重复提交也只返回 `duplicate_recent` 安全反馈。地图/史册红队片把筛选顺序改为先丢弃 pending/rejected/污染旧行，再按应用旬排序后套 source cap，新增 `domainConsequenceView.caps` 和 map/archive `trackingEntryPoints`，`safeWorldSearch` 在全局 row cap 下优先保留 domain consequence 搜索行；React 舆图页新增“舆图后果追踪”，史册页改为消费安全 `eventArchiveView` 与 `domainConsequenceView`，两处仍只写本地草稿、不新增服务器写口。角色可见性片在根 view 按当前 `player.role` 裁剪后果类型，书生默认不见领域后果，地方官只见地方政策/刑名/NPC 经济，将领只见军务外交，官员/大臣/皇帝可见跨域后果；archive/resolver/topic/search/SQLite 都只消费裁剪后的 view，`caps.publicCandidates` 不向低权限身份泄露被过滤后果数量。高量 cross-view 回归已确认 official/general 场景下事件档案、resolver input、topic surface、safe search 与 SQLite safe-search 均只消费 capped 后果，不复活被 source/global cap 或角色裁剪掉的来源。`mapRuntimeView` 现在从同一路由的角色裁剪 `domainConsequenceView` 派生 visual-only 后果 `eventEffects`，只绑定已有可见 runtime ref，不进入 `mapContextView` prompt 摘要、AI 工具或服务器裁决事实。长链路回响片新增安全 `publicEchoRef`：公开后果、world thread 和月报 sourceRefs 使用同一稳定回响键，连续月报不会重复把同一后果推进行动/风险，domain world thread 在角色可见性反复变化后不会重复写入 `recentResolved`，`roleCycleView` 让地方官/官员/大臣/将领/皇帝只读复核当前可见领域后果，并过滤同一后果经 world thread 间接重复进入角色循环。topic draft 审计链片新增 `canonicalEchoRefs`：resolver input、事件档案、world thread、topic surface 与 `topic_draft` 保留同一安全 echo，surface 端按 canonical echo 去重同一公开后果并优先保留 direct evidence；浏览器只把草稿 evidence 写成待校验 `draftContext`，普通 turn 会重建当前服务器 surface、忽略伪造 echo，并把通过校验的 echo refs 写入 `roleCycleDomainAdjudication` 公开反馈、内部 auditRecord 和最新 accepted city/military ledger record。
- S88.7 当前进展：首片实现提交 `875a0147`，已启动 NPC/关系 resolver trace：`npcActiveRequests` 在回应或逾期时生成 `npc_active_request_resolver` 安全 trace，公开 `requestType`、回应动作、状态、处置分层、风险标签、安全 source refs、服务器边界和 public resolution ref，并写入请求 `auditRefs` 与 turn feedback 的 `outcome.resolutionTraces`；它仍只调整 NPC 名册中的小幅公开关系摘要，不扣银、不转物、不写婚姻、不定罪、不让弹劾或背叛成事实。`npcRelationshipActions` 为论道、切磋、求爱和议婚生成 `npc_relationship_action_resolver` trace，并随 `npcInteractionLedger` 安全记录返回；`npcInteractionView` 会递归清洗 trace 中的 hidden/private/raw/provider/key/path 污染，客户端伪造胜负、伤势、配偶、资源或关系 delta 仍只进入 ignored fields。第二片实现提交 `ad44a420`：`eventArchiveView` 从安全 `npcActiveRequestView({ includeResolved: true })` 和 `npcInteractionView` 派生 `npc_active_request` / `npc_relationship_action` 条目；`applyTurnActorMemoryUpdates()` 接收本旬 `npcActiveRequests.outcome.resolutionTraces`，用公开 `npcRosterView` actor label map 为已知 NPC 写入 `npc_active_request_trace` 可见记忆，并在本轮 follow-up 片中收紧为必须先命中 canonical active request safe record，伪造可见/不可见 refs 或同 `publicResolutionRef` 篡改 trace 字段都不会改记忆类型、标签或摘要。第三片实现提交 `bec67aab`：已把 `/npc-interaction` 关系行动记录接入即时记忆，route 只把刚写入的安全 `recordNpcInteraction()` 记录传给 `actorMemoryLedger`，生成 `npc_relationship_action_trace` 可见记忆；孤立 trace、伪造不可见 NPC 记录、未命中 interaction ledger 的可见 NPC 记录和同 ID/ref/npcId 替换文本都会被拒或改用 canonical ledger 内容。响应新增安全 `actorMemory` 摘要、`actorMemoryView` 和 `eventArchiveView`，React store 会合并到当前 session，使人物页/史册页可在互动后立即看到记忆和档案回响，并按 session/NPC 守住 stale payload 不污染另一案卷。第四片实现提交 `e5ab3417`：`npcActiveRequestsConfig` 新增 follow-up/response option 配置，`npcActiveRequestView.items[].responseOptions` 只给 `active` / `deferred` 来函提供三类首选回应草稿，resolved `outcome.followUpView` 为行贿、弹劾、背叛、引荐、请托、索债/人情债、献策、求助和议婚提供服务器拥有的后续复核种类、公开摘要、下一步、证据 refs、风险标签和边界；事件档案与 `npc_active_request_trace` 记忆会带上 follow-up 上下文，React 人物页来函 inbox 改为按服务器选项写本地草稿，已裁决 follow-up 只展示后续说明和状态。第五片实现提交 `18e489e5`：`npcActiveRequestView.followUpTasks` 从已裁决安全 item 派生“来函后续簿”，只收录 `under_review` / `reported` / `converted_to_risk` / `accepted_pending_server_resolution`，并公开 taskRoute、状态、draftText、NPC 摘要、证据 refs、风险标签和 proposal-only 边界；React 人物页新增来函后续簿，按钮只写本地草稿。第六片实现提交 `a16e34df`：`runNpcActiveRequestStep()` 现在可从安全 `followUpTasks` 匹配普通回合“续办/后续/复核”输入，写入 `outcome.followUpResolutions`、`followUpView.latestResolution` 和 `npc_active_request_follow_up_resolver` 公开反馈；失败 follow-up attempt 不回落处理普通 active 来函，普通“查证/登记+泛词”也不劫持后续簿，已登记任务通过 safe view 展示近次状态。第七片实现提交 `c08eb0fd`：`followUpResolutions` 进入长期公开回响，事件档案沿用原 `npc_active_request` public sourceId 展示近次后续，`actorMemoryLedger` 只从本旬后续记录经 safe view/canonical resolution 匹配后写入 `npc_active_request_follow_up` 可见记忆，`worldThreadView` 把最新后续 public summary/next step 写入主动来函议题并用 `createdTurn` 更新时间；清洗别名同步覆盖 `provider_payload`、`private_signal_tags`、`hidden_dossier`、`safe_search_index`、`true_assets`、`secret_relationships`、`unrevealed_tasks` 和 `state_patch`。第八片新增 `npcActiveRequestView.followUpEvidence`，从安全 `followUpTasks` 派生引荐拜会、人情债月账、请托案牍、献策证据、廉政/风宪/背叛风险 watchlist，并以 `followUpEvidence.people/events/economy` 接入 resolver input、topic surface、安全搜索和 SQLite safe-search；它仍是只读材料，不写世界实体影响、记忆强化、资源、人情债、婚姻、弹劾、定罪、背叛真相或真实任务。`worldThreadView` 继续同时消费旧 `activeNpcRequest` 与新 `npcActiveRequestView`，把主动来函列为 `active_npc_request` 议题；`worldEntities` 可从来函 scheduled / resolver trace 派生地方士绅、同年书院或都察院等公开压力，不读取 raw `npcActiveRequestLedger`、private signal、hidden dossier、SQLite 行、provider payload、prompt 或本地路径。
- S87 当前基线：后端 route/API 响应类型覆盖已完成。`src/contracts/serverContracts.ts` 已覆盖 game/exam/AI/inventory/NPC/trade/delegation public response；`src/routes/routeResponses.js` 以局部 `@ts-check` helper 接入 `src/routes/game.js`、`src/routes/exam.js` 和 `src/routes/ai.js`，并在运行时拒绝 public `worldState` raw ledger key；大型 route 文件仍未 whole-file `@ts-check`，CommonJS 运行方式不变。
- S86 当前基线：后端 TypeScript 渐进迁移首轮已完成。新增 `npm run typecheck:server`、`npm run build:server:probe`、`tsconfig.server-check.json`、`tsconfig.server-probe.json`、`src/contracts/serverContracts.ts` 和 `src/contracts/runtimeGuards.ts`；安全 projection、AI facade/route policy、session/storage 高风险模块已选择性 `@ts-check`。后端仍以 CommonJS JavaScript 运行，`.ts` 试点不改变 `npm start`，Rust 仍只作为未来有性能证据后的可选 CLI/WASM/离线工具评估。
- S81-S84 当前基线：NPC、资产、储物、交易与委派首轮闭环已完成。后端已有 `assetLedger`、`inventoryLedger`、`npcRoster`、`npcInteractionLedger`、`tradeLedger`、`delegatedTaskLedger`、开局背景裁决、AI task/schema/prompt/provider fallback、JSON/SQLite 同步和 player-state 安全 view；React 已有“囊箧” route、人物 NPC 工作台、对话/交易/委派面板和开局裁决摘要。前端只消费安全 API/view，不裁决资源、价格、关系或任务结果。
- S85 当前基线：`npcEconomy` 已在普通回合和跳时共享的旬/月 tick 后运行，非月末刷新基础市价，月末再结算资产维护/收益、库存损耗、委派到期回禀、逾期交易承诺、人情债与 NPC 关系记忆；考试入场/场内场景不跑全局经济；委派预算由服务器校验不得超过地方库银，月结旧任务也按有效预算参与成功率和扣款；`marketPriceView` / `npcEconomyView` 进入 turn、SSE、player-state 和县令主卷，raw `marketPriceLedger` / `npcEconomyLedger` 与内部 ledger path 已从兼容 `worldState`、玩家 API 和 S85 反馈中剥离。`npcActiveRequestLedger` / `npcActiveRequestView` 已让 NPC 主动来函进入普通回合、SSE、考试和 player-state；`npcRelationshipActions` 已让论道、切磋、求爱和婚姻扩展位具备服务器 schema、权限、NPC eligibility view、UI“礼法”tab 和红队测试。
- S85 当前规划：S81-S85 已归档。后续深化已并入 S88，尤其是 S88.7 NPC/关系深化、S88.8 资产经济解释性和 S88.12 Mock/真实 provider 长循环验收。
- S80 当前基线：全局 AI 设置覆盖所有当前和未来案卷的 AI 路由；设置页和印匣共用 18 类任务矩阵，服务端 presets 为唯一来源，保存成功后以前端收到的服务端返回值回填表单。全局设置只保存 provider/model/预算/温度/安全控制，不保存 key、base URL、prompt、raw provider payload 或本地路径；缺 key 的真实 provider 不能作为可生效全局路由保存。
- S79 当前基线：React 子路由壳、考试 smoke、recovered 女性高清立绘入库、runtime manifest、压缩 QA 和只读高清查看器已收束。查看器只读 `/assets/ui/` runtime 主图，不写 canonical state、URL、localStorage/sessionStorage、行动草稿或 AI prompt。
- S78 及更早阶段均已迁入专题归档。活动台账不再展开完成流水；需要追溯时使用本文件顶部归档索引。

## 6. 最近完整验证口径

本轮 S88.8 经济解释 trace 第一片当前验证口径：

- `node --check src/game/economyTraceConfig.js`
- `node --check src/game/economyTraceView.js`
- `node --check src/routes/game.js`
- `node --test test/economyTraceView.test.js test/gameTurnNpcEconomy.test.js test/npcInventoryRoutes.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx`（40 项）
- `npm run test:client -- --pool=vmForks --maxWorkers=2`（76 项）
- `npm run build:client`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`（1108 项）
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据。

本轮 S88.7 主动来函后续 evidence 前端体验当前验证口径：

- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx`（38 项）
- `npm run test:client -- --pool=vmForks --maxWorkers=2`（73 项）
- `npm run build:client`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据。

本轮 S88.7 主动来函后续领域 evidence 当前验证口径：

- `node --check src/game/npcActiveRequestsConfig.js`
- `node --check src/game/npcActiveRequests.js`
- `node --check src/game/resolverInputConfig.js`
- `node --check src/game/resolverInputContext.js`
- `node --check src/game/topicSurfaceView.js`
- `node --check src/game/safeWorldSearch.js`
- `node --check test/npcActiveRequests.test.js`
- `node --check test/resolverInputContext.test.js`
- `node --check test/safeWorldSearch.test.js`
- `node --check test/topicSurfaceView.test.js`
- `node --check test/sqliteSafeSearch.test.js`
- `node --test --test-reporter=spec test/npcActiveRequests.test.js test/resolverInputContext.test.js test/safeWorldSearch.test.js test/topicSurfaceView.test.js`（34 项）
- `node --test --test-reporter=spec test/sqliteSafeSearch.test.js`（7 项）
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`（1107 项）
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据：Poincare 初审发现 topic surface 未执行 `topicSurfaceIds` allowlist 的 P2；主代理已在 resolver input 保留 surface ids、topic surface 按 surface 过滤，并补 `npc-profile` / `trial` 正反断言；Poincare 复核确认 P2 已关闭，未发现新的 P0/P1/P2。

本轮 S88.7 NPC/关系 resolver trace 与长期回响当前验证口径：

- `node --check src/game/npcActiveRequestsConfig.js`
- `node --check src/game/npcActiveRequests.js`
- `node --check src/game/npcRelationshipActions.js`
- `node --check src/game/npcInteractions.js`
- `node --check src/game/eventArchive.js`
- `node --check src/game/actorMemoryConfig.js`
- `node --check src/game/actorMemoryLedger.js`
- `node --check src/game/worldThreads.js`
- `node --check src/game/worldEntities.js`
- `node --check src/routes/game.js`
- `node --check test/npcActiveRequests.test.js`
- `node --check test/npcRelationshipActions.test.js`
- `node --check test/npcAiSafety.test.js`
- `node --check test/actorMemoryLedger.test.js`
- `node --check test/eventArchive.test.js`
- `node --check test/worldThreads.test.js`
- `node --check test/worldEntities.test.js`
- `node --check test/npcInventoryRoutes.test.js`
- `node --test test/npcActiveRequests.test.js test/npcRelationshipActions.test.js test/npcAiSafety.test.js`
- `node --test --test-reporter=spec test/npcActiveRequests.test.js`
- `node --test --test-reporter=spec test/actorMemoryLedger.test.js`
- `node --test --test-reporter=spec test/eventArchive.test.js`
- `node --test test/npcAiSafety.test.js test/npcInventoryRoutes.test.js test/npcRelationshipActions.test.js`
- `node --test --test-reporter=spec test/npcInventoryRoutes.test.js test/npcAiSafety.test.js test/eventArchive.test.js`
- `node --test --test-reporter=spec test/actorMemoryLedger.test.js test/worldThreads.test.js test/worldEntities.test.js`
- `node --test test/worldThreads.test.js test/worldEntities.test.js`
- `node --test test/npcInventoryRoutes.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- client/src/state/uiState.test.ts client/src/api/qianqiuClient.test.ts`
- `npm run test:client -- client/src/state/uiState.test.ts client/src/api/qianqiuClient.test.ts --pool=vmForks --maxWorkers=2`
- `npm run test:client -- client/src/__tests__/App.test.tsx --pool=vmForks --maxWorkers=2`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`
- `npm run build:client`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`（1098 项）
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据；Poincare 初审/复看发现的旧账身份字段污染、ignored client field key 污染、`npcInteractionView.resolverTrace` safe-search 与 snake_case unsafe alias 清洗缺口均已修复，最终复核未发现 P0/P1/P2。S88.7 长期回响片经 Carver 只读复审未发现 P0/P1/P2，非阻断建议是后续若复用 active-request trace memory helper，可考虑要求 trace 命中当前 safe request record 后再写泛化记忆。S88.7 `/npc-interaction` 即时记忆片经 Franklin 只读复审发现 stale session 合并、关系行动记忆 provenance 和同 ref 替换内容三个 P2；主代理已增加 session/NPC guard、要求命中 canonical `npcInteractionLedger.records` 并只从 ledger record 派生记忆，补 forged visible record、tampered same-ref record 和 stale payload 回归；Franklin 最终复核确认 P2 均关闭，未发现新的 P0/P1/P2。本轮主动来函 follow-up 片经 Franklin 提交前只读初审发现 `npc_active_request_trace` 可被非 canonical trace 或同 ref 篡改字段影响的 P2；主代理已要求 trace ref 命中 canonical active request safe record，并从 canonical resolver trace 派生 NPC、类型、标签和摘要，新增 forged visible 与同 ref 篡改回归。Franklin 复审又发现已裁决 follow-up 仍显示回应按钮的 P2；主代理已限制 `active` / `deferred` 才返回/渲染回应选项并补 view 回归。Franklin 最终复核确认两个 P2 均关闭，未发现新的 P0/P1/P2；残余风险仅是 `followUpView.recommendedResponseOptions` 仍作为 draft-only 上下文保留，当前 PeoplePage 不渲染。

本轮 S88.6 topic draft 与下一轮服务器裁决 canonical echo 审计链验证口径：

- `node --check src/game/domainConsequenceEchoRefs.js`
- `node --check src/game/eventArchive.js`
- `node --check src/game/resolverInputContext.js`
- `node --check src/game/topicSurfaceView.js`
- `node --check src/game/topicDrafts.js`
- `node --check src/game/roleCycleDomainAdjudication.js`
- `node --check src/routes/game.js`
- `node --check test/roleCycleDomainAdjudication.test.js`
- `node --test test/resolverInputContext.test.js`
- `node --test test/topicDraftRoute.test.js test/topicSurfaceView.test.js test/roleCycleDomainAdjudication.test.js test/gameTurnRoleCycleConsequences.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`
- `npm run build:client`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据。

上一轮 S88.6 普通回合重复触发与跨视图 cap 压力红队验证口径：

- `node --check src/game/roleCycleDomainAdjudication.js`
- `node --check src/game/resolverInputContext.js`
- `node --check test/roleCycleDomainAdjudication.test.js`
- `node --check test/gameTurnRoleCycleConsequences.test.js`
- `node --check test/domainConsequenceTrace.test.js`
- `node --check test/sqliteSafeSearch.test.js`
- `node --test --test-reporter=spec test/roleCycleDomainAdjudication.test.js`（11 项）
- `node --test --test-reporter=spec test/gameTurnRoleCycleConsequences.test.js`（6 项）
- `node --test --test-reporter=spec test/domainConsequenceTrace.test.js`（13 项）
- `node --test --test-reporter=spec test/sqliteSafeSearch.test.js`（6 项）
- `node --test --test-reporter=spec test/resolverInputContext.test.js test/topicSurfaceView.test.js test/eventArchive.test.js`（24 项）
- `node --test --test-reporter=spec test/safeWorldSearch.test.js test/sqliteSafeSearch.test.js`（12 项）
- `npm run typecheck:server`
- `npm test`（1074 项）
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check -- src/game/roleCycleDomainAdjudication.js src/game/resolverInputContext.js test/roleCycleDomainAdjudication.test.js test/gameTurnRoleCycleConsequences.test.js test/domainConsequenceTrace.test.js test/sqliteSafeSearch.test.js docs/SHARED_CONTEXT.md docs/DEVELOPMENT_STEPS.md docs/QIANQIU_DEVELOPMENT_BRIEF.md docs/QIANQIU_POLISHING_ROADMAP.md docs/AI_CONTROL_AUDIT_MATRIX.md`
- `git diff --check`（退出码 0；仅打印未改动归档/QA 文件既有 CRLF 提示）
- 提交前只读复审：Banach 初审发现 legacy actor wildcard 与 direct consequence 空数组断言两个 P2；主代理已要求 duplicate 匹配显式 actor 身份、补 direct consequence 非空断言和 source collection priority，重跑 focused/full 验证后，Banach 最终复核未发现 P0/P1/P2。
- 实现提交：`428a26bb`。

本轮 S88.6 角色可见性与舆图运行时后果 effect 红队当前验证口径：

- `node --check src/game/domainConsequenceTrace.js`
- `node --check src/game/mapRuntimeView.js`
- `node --check src/routes/game.js`
- `node --check src/routes/exam.js`
- `node --test --test-reporter=spec test/domainConsequenceTrace.test.js`（11 项）
- `node --test --test-reporter=spec test/mapRuntimeView.test.js`（7 项）
- `node --test --test-reporter=spec test/resolverInputContext.test.js test/topicSurfaceView.test.js test/eventArchive.test.js`（24 项）
- `node --test --test-reporter=spec test/safeWorldSearch.test.js test/sqliteSafeSearch.test.js`（11 项）
- `node --test --test-reporter=spec test/mapRuntimeView.test.js test/mapRuntimeRoute.test.js`（10 项）
- `node --test --test-reporter=spec test/topicDraftRoute.test.js`（13 项）
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`（1066 项）
- `npm run test:client -- --pool=vmForks --maxWorkers=2`（69 项；默认 `npm run test:client` 首轮 fork worker 启动超时，随后受控 worker 重跑通过）
- `npm run build:client`
- `AI_PROVIDER=mock npm run smoke:browser`
- `git diff --check`
- 提交前只读复审：Ptolemy 未发现 P0/P1/P2；额外确认低权限角色没有通过 archive/resolver/topic/topic-draft/search/SQLite/mapRuntime 看到不可见后果，cap 不泄露隐藏后果数量，domain consequence effect 不进入 prompt/mapContext/AI 工具，route/exam 共用同一份裁剪 view。
- 实现提交：`7ee4ae6f`。

本轮 S88.6 地图/史册后果追踪入口与 high-volume cap 红队当前验证口径：

- `node --check src/game/domainConsequenceTrace.js`
- `node --check src/game/safeWorldSearch.js`
- `node --check test/domainConsequenceTrace.test.js`
- `node --check test/safeWorldSearch.test.js`
- `node --test --test-reporter=spec test/domainConsequenceTrace.test.js`（9 项）
- `node --test --test-reporter=spec test/safeWorldSearch.test.js`（6 项）
- `node --test --test-reporter=spec test/sqliteSafeSearch.test.js`（5 项）
- `node --test --test-reporter=spec test/eventArchive.test.js test/topicSurfaceView.test.js test/resolverInputContext.test.js`（24 项）
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx`（37 项）
- `npm run test:client`（69 项）
- `npm run build:client`
- `AI_PROVIDER=mock npm run smoke:browser`（首轮 180s 外层超时后以 420s 超时重跑通过）
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`（1062 项）
- `git diff --check`
- 提交前只读复审：Poincare 首轮未发现 P0/P1/P2；低风险建议已补前端 deny list、`caps` / `trackingEntryPoints` 类型和乱序旧账 source cap 回归。Poincare 最终复审仍未发现 P0/P1/P2，仅建议后续清理 `npcEconomyConsequence()` 重复空数组判断并可进一步收紧乱序 cap 断言。
- 实现提交：`eee0185a`。

本轮 S88.6 inactive role 与高风险军务绕过红队当前验证口径：

- `node --check src/game/roleCycleDomainAdjudication.js`
- `node --check test/roleCycleDomainAdjudication.test.js`
- `node --check test/gameTurnRoleCycleConsequences.test.js`
- `node --test --test-reporter=spec test/roleCycleDomainAdjudication.test.js`（8 项）
- `node --test --test-reporter=spec test/gameTurnRoleCycleConsequences.test.js`（4 项）
- `node --test --test-reporter=spec test/militaryDiplomacyAuthority.test.js test/militaryDiplomacyResolver.test.js test/militaryDiplomacyRedaction.test.js`（10 项）
- `node --test --test-reporter=spec test/domainToolPermissions.test.js test/domainToolResolvers.test.js`（8 项）
- `npm run typecheck:server`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`
- `npm test`（1058 项）
- 提交前只读复审：Kierkegaard 未发现 P0/P1；发现的文档 gate 描述与复审状态 P2 已修复。
- 实现提交：`563c911e`。

上一轮 S88.6 旧存档污染与重复后果去重红队验证口径：

- `node --check src/game/domainConsequenceTrace.js`
- `node --check test/domainConsequenceTrace.test.js`
- `node --test --test-reporter=spec test/domainConsequenceTrace.test.js`（6 项）
- `node --test --test-reporter=spec test/topicSurfaceView.test.js test/resolverInputContext.test.js test/safeWorldSearch.test.js`（19 项）
- `node --test --test-reporter=spec test/sqliteSafeSearch.test.js test/topicDraftRoute.test.js`（18 项）
- `node --test --test-reporter=spec test/routeResponseContracts.test.js test/judicialCaseEvidenceRedaction.test.js`（7 项）
- `npm run typecheck:server`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`
- `npm test`（1054 项）
- 提交前只读复审：Zeno 未发现 P0/P1/P2，并额外确认 `publicSourceId` 原值未进入 `domainConsequenceView` JSON。
- 实现提交：`620d2d1f`。

上一轮 S88.6 前端可见领域后果追踪验证口径：

- `npm run typecheck:client`
- `node --test --test-reporter=spec test/reactClientScaffold.test.js`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx client/src/state/uiState.test.ts client/src/components/MemorialComposer.test.tsx`
- `npm run build:client`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`
- `npm test`
- 提交前只读复审：Ampere 初审发现无 `sourceTypes` 面板会展示未绑定可见后果 action 的 P2；本轮已改为显式 action 必须匹配当前可见 item，并补官员/皇帝 orphan action 回归。Ampere 复审确认 P2 关闭且未发现 P0/P1/P2；复审后仅回填文档状态，按低风险纯文档状态更新跳过额外子代理复审。
- 实现提交：`0b863158`。

上一轮 S88.6 topic/source evidence 与安全检索接线验证口径：focused domain/topic/search/SQLite tests、`npm run typecheck:server`、docs governance、documentation governance、完整 `npm test`（1051 项）和 `git diff --check`；提交前只读复审 Lovelace 未发现 P0/P1/P2；实现提交 `d5f1055b`。

本轮 S88.6 公开后果 refs 首片当前验证口径：

- `node --check test/domainConsequenceTrace.test.js`
- `node --check src/game/domainConsequenceTrace.js`
- `node --check src/game/eventArchive.js`
- `node --check src/game/worldThreads.js`
- `node --check src/game/playerMonthlyBriefing.js`
- `node --check src/routes/game.js`
- `node --check src/routes/exam.js`
- `node --check src/routes/routeResponses.js`
- `node --check src/game/clientWorldState.js`
- `node --check src/game/redactedState.js`
- `node --test test/domainConsequenceTrace.test.js`（3 项）
- `node --test test/routeResponseContracts.test.js test/judicialCaseEvidenceRedaction.test.js`（7 项）
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`（1048 项）
- `git diff --check`（退出码 0；仅打印未改动归档/QA 文件既有 CRLF 提示）
- 提交前只读复审：Lovelace 复核确认 public `affectedMetrics`、内部 token 过滤和 `publicSourceId` 覆盖风险均已关闭，未发现新的 P0/P1/P2。
- 实现提交：`6943c7de`。

本轮 S88.5.3 角色循环入口后端接缝当前验证口径：

- `node --check src/game/roleCycleDomainAdjudication.js`
- `node --check src/routes/game.js`
- `node --test test/roleCycleDomainAdjudication.test.js test/gameTurnRoleCycleConsequences.test.js test/worldGeography.test.js test/mapVisibility.test.js`（23 项）
- `node --test test/routeResponseContracts.test.js test/cityPolicyHiddenRedaction.test.js test/militaryDiplomacyRedaction.test.js test/npcEconomy.test.js test/gameTurnNpcEconomy.test.js`（15 项）
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm run typecheck:server`
- `npm test`（1045 项）
- `git diff --check`
- 待收口：无；实现提交已回填。

本轮 S88.5.1 六身份循环矩阵首片验证口径：

- `node --check src/game/roleCycleConfig.js && node --check src/game/roleCycleView.js && node --check src/routes/game.js && node --check src/routes/exam.js && node --check src/game/resolverInputContext.js && node --check src/ai/promptContextAssembler.js && node --check scripts/clientSmoke.js`
- `node --test --test-reporter=spec test/roleCycleView.test.js`
- `node --test --test-reporter=spec test/reactClientScaffold.test.js`
- `node --test --test-reporter=spec test/browserSmokeScript.test.js`
- `node --test --test-reporter=spec test/gamePlayerStateRoute.test.js test/gameStartRole.test.js`
- `node --test --test-reporter=spec test/resolverInputContext.test.js`
- `node --test --test-reporter=spec test/sceneRuntimeMock.test.js`
- `node --test --test-reporter=spec test/cityPolicyAuthority.test.js test/judicialCaseAuthority.test.js test/militaryDiplomacyAuthority.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/state/uiState.test.ts client/src/components/MemorialComposer.test.tsx`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`
- `npm run build:client`
- `npm run smoke:exam-s69`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`（1034 项）
- `git diff --check`（退出码 0；仅打印未改动归档/QA 文件既有 CRLF 提示）
- 提交前只读子代理复审最终 diff 与验证证据；Mencius 初审未发现代码/API/runtime P0/P1/P2，只指出文档验证状态仍待回填的 P2，本轮已修正，Mencius 复核确认 P2 关闭且未发现新的 P0/P1/P2。

本轮 S88.4 皇帝/部院续办链路切片验证口径：

- `node --check src/game/officialCourtResponseConfig.js && node --check src/game/officialCourtResponse.js && node --check src/game/resolverInputConfig.js && node --check src/game/worldThreads.js`
- `node --test --test-reporter=spec test/officialCourtResponse.test.js test/worldThreads.test.js test/officialCourtConsequences.test.js test/eventArchive.test.js test/playerMonthlyBriefing.test.js`（35 项）
- `node --test --test-reporter=spec test/reactClientScaffold.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- `npm run smoke:exam-s69`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`（1027 项）
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据；Kepler 初审发现 raw namespace 与续办角色裁决两个 P2，修复后复核未发现新的 P0/P1/P2。

本轮 S88.4 长期官场后果信号切片验证口径：

- `node --check src/game/officialCourtConsequencesConfig.js && node --check src/game/officialCourtConsequences.js && node --check src/routes/game.js && node --check src/routes/exam.js`
- `node --check src/game/eventArchive.js && node --check src/game/worldThreads.js && node --check src/game/playerMonthlyBriefing.js && node --check src/game/topicSurfaceView.js`
- `node --test --test-reporter=spec test/officialCourtConsequences.test.js test/officialCourtResponse.test.js test/eventArchive.test.js test/worldThreads.test.js test/playerMonthlyBriefing.test.js`
- `node --test --test-reporter=spec test/reactClientScaffold.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm run smoke:exam-s69`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm test`
- `git diff --check`

本轮 S88.4 跨身份奏议回应切片验证口径：

- `node --check src/game/officialCourtResponseConfig.js && node --check src/game/officialCourtResponse.js && node --check src/routes/game.js && node --check src/game/worldThreads.js`
- `node --check src/game/eventArchive.js && node --check src/game/roleWorldCoupling.js && node --check src/game/resolverInputContext.js && node --check src/routes/exam.js`
- `node --test test/officialCourtResponse.test.js`
- `node --test test/topicSurfaceView.test.js test/worldThreads.test.js test/gameTurnOfficialCareer.test.js`
- `node --test test/eventArchive.test.js test/topicDraftRoute.test.js`
- `node --test test/gameTurnRoleWorldCoupling.test.js test/gameTurnWorldThreads.test.js`
- `node --test test/reactClientScaffold.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx`
- `npm run build:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`（68 项）
- `npm run smoke:exam-s69`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`（1020 项）
- `git diff --check`（退出码 0；仅打印未改动归档/QA 文件既有 CRLF 提示）
- Kepler 提交前只读初审发现终局裁决文案过滤偏窄 P2，修复后复核确认 P2 已关闭，未发现新的 P0/P1/P2。

本轮 S88.4 朝议/部院/御前跟进切片验证口径：

- `node --check src/game/officialCourtEntryConfig.js && node --check src/game/officialCourtEntry.js && node --check src/game/officialCareer.js && node --check src/game/eventArchive.js && node --check src/game/playerMonthlyBriefing.js && node --check src/game/worldThreads.js && node --check src/game/resolverInputConfig.js`
- `node --test test/officialCareer.test.js test/gameTurnOfficialCareer.test.js`
- `node --test test/playerMonthlyBriefing.test.js test/eventArchive.test.js test/worldThreads.test.js`
- `node --test test/topicSurfaceView.test.js test/topicDraftRoute.test.js`
- `node --test test/reactClientScaffold.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`
- `npm run build:client`
- `npm run smoke:exam-s69`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据。

本轮 S88.4 首月回署草稿服务器裁决闭环验证口径：

- `node --check src/game/officialCourtEntryConfig.js && node --check src/game/officialCourtEntry.js && node --check src/game/officialCareer.js && node --check src/game/playerMonthlyBriefing.js && node --check src/game/eventArchive.js`
- `node --test test/officialCareer.test.js test/gameTurnOfficialCareer.test.js test/playerMonthlyBriefing.test.js`
- `node --test test/topicSurfaceView.test.js test/topicDraftRoute.test.js test/eventArchive.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`
- `npm run build:client`
- `npm run smoke:exam-s69`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据。

本轮 S88.4 奏折朝议入口与长期考成追踪切片验证口径：

- `node --check src/game/officialCourtEntryConfig.js && node --check src/game/officialCourtEntry.js && node --check src/game/officialCareer.js && node --check src/game/topicSurfaceView.js && node --check src/game/resolverInputConfig.js && node --check scripts/clientSmoke.js`
- `node --test test/officialCareer.test.js test/topicSurfaceView.test.js test/topicDraftRoute.test.js`
- `node --test test/gameTurnOfficialCareer.test.js test/playerMonthlyBriefing.test.js test/playerMonthlyBriefingRoute.test.js`
- `node --test test/reactClientScaffold.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`
- `npm run build:client`
- `npm run smoke:exam-s69`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据。

本轮 S88.4 官署首月体验切片验证口径：

- `node --check src/game/officialFirstMonthConfig.js && node --check src/game/officialFirstMonth.js && node --check src/game/officialCareer.js && node --check src/game/playerMonthlyBriefing.js && node --check scripts/mockImperialExamAcceptance.js`
- `node --test test/officialCareer.test.js test/gameTurnOfficialCareer.test.js test/playerMonthlyBriefing.test.js test/playerMonthlyBriefingRoute.test.js`
- `node --test test/appointmentTracks.test.js test/appointmentTracksRoute.test.js test/reactClientScaffold.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`
- `npm run build:client`
- `npm run smoke:exam-s69`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据。

本轮 S88.3 考试入场后反馈切片验证口径：

- `node --check src/game/examProcedureConfig.js && node --check src/game/examProcedure.js && node --check src/game/examSceneTime.js && node --check src/game/clientWorldState.js && node --check src/game/examTravel.js && node --check src/routes/exam.js && node --check scripts/mockImperialExamAcceptance.js && node --check scripts/clientSmoke.js`
- `node --test test/examProcedure.test.js test/examTravel.test.js`
- `node --test test/reactClientScaffold.test.js`
- `npm run typecheck:server`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`
- `npm run build:client`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm run smoke:exam-s69`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据。

本轮 PLAN-S87 route/API 响应类型覆盖规划与治理规范改动验证口径：

- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据

S87 route/API response 类型覆盖验证入口：

- `npm run typecheck:server`，每个 S87 小步必须运行。
- `npm run typecheck:client`，涉及共享 API/view 契约或前端类型引用时运行。
- `node --test test/gamePlayerStateRoute.test.js test/npcInventoryRoutes.test.js test/aiSettingsRoute.test.js` 作为 route response 回归的最小起点；实际小步应追加对应的 turn、exam、quick-actions、topic-draft 或 SSE focused tests。
- `npm run check:docs-governance` 与 `node --test test/documentationGovernance.test.js`，涉及治理、路线图、brief、README 或交接文档时运行。
- 涉及 API/schema、运行时行为、验证工具或共享契约时继续运行 `npm test` 与提交前只读复审。
- `git diff --check`。

本轮 PLAN-S86 后端 TypeScript 渐进迁移规划与治理规范改动验证口径：

- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据

S86 后端 TypeScript 迁移验证入口：

- `npm run typecheck:server`，后端契约、API/view 类型、安全 projection、AI provider facade、storage/session 或核心 resolver 新增/重构时运行。
- `npm run build:server:probe`，新增或调整 `src/contracts/**/*.ts` 试点时运行，确认 CommonJS/declaration/source map 输出仍可生成。
- `npm run typecheck:client`，涉及共享 API/view 契约或前端类型引用时运行。
- 与迁移模块对应的 focused Node tests，例如 redaction、AI schema、storage parity、route contract 或 resolver tests。
- 涉及运行时、API/schema、提示词、storage 或验证工具时继续运行 `npm test` 与提交前只读复审。

S80 最新完整口径：

- `npm run typecheck:client`
- `npm run test:client`
- `node --test test/aiSettings.test.js test/aiSettingsRoute.test.js test/reactClientScaffold.test.js`
- `npm run build:client`
- `npm run smoke:browser`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`

本轮 DOCS-2026-05-20 文档压缩与治理守门改动验证口径：

- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `npm test`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据

本轮 PLAN-S81-S85 规划与治理规范改动验证口径：

- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据

本轮 S81-S84 NPC、资产、储物、交易与委派系统验证口径：

- `node --test test/assetLedger.test.js test/inventoryLedger.test.js test/npcRoster.test.js test/delegatedTasks.test.js`
- `node --test test/sqliteNpcInventoryTables.test.js test/sqliteNpcInventoryAdapterIntegration.test.js`
- `node --test test/npcInventoryRoutes.test.js`
- `node --test test/tradeLedger.test.js test/npcAiSafety.test.js`
- `node --test test/aiSettings.test.js test/aiSettingsRoute.test.js test/modelRoutePolicy.test.js`
- `node --test test/aiSchemas.test.js test/prompts.test.js test/remoteHelpers.test.js`
- `node --test test/gameStartRole.test.js test/gamePlayerStateRoute.test.js test/stateRules.test.js test/sqliteMaintenanceTool.test.js`
- `node --test test/sessionStoreAdapterContract.test.js`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2`
- `npm run build:client`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm test`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`
- 提交前只读子代理复审最终 diff 与验证证据。

补充素材/manifest 回归入口仍保留：

- `npm run qa:frontend-assets`
- `npm run qa:portrait-compression`
- `node --test test/frontendInkAssetsManifest.test.js`
- `npm run smoke:browser` 覆盖 DOM、storage、runtime manifest、安全字段和截图产物名污染扫描。

S84 前端专项额外验收入口：

- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- `npm run smoke:browser`
- 与 S84 API 接线对应的 focused Node route tests
- 前端不得调用 unsafe `/api/game/state/*`、`/api/dev/*`，不得在 localStorage/sessionStorage 保存完整背包、NPC 私档、交易明细、provider payload 或 prompt。

本轮 S85.1-S85.2 长期经济与基础市价验证口径：

- `node --test test/delegatedTasks.test.js test/npcEconomy.test.js test/gameTurnNpcEconomy.test.js`
- `node --test test/worldTick.test.js test/gameTurnTick.test.js test/npcInventoryRoutes.test.js test/tradeLedger.test.js test/delegatedTasks.test.js`
- `npm run typecheck:client`
- `npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx client/src/components/MemorialComposer.test.tsx`
- `npm run build:client`
- `npm run check:docs-governance`
- 浏览器复验：临时 `PORT=3001 AI_PROVIDER=mock npm start`，开局县令案卷，确认“基础市价”“粮食一石”“NPC 月账”和安全视图 `9 / 9` 渲染；截图采集在 in-app browser CDP 层超时，DOM 验证通过。

本轮 S85.3-S85.6 NPC 主动性、礼法扩展位、总验收与归档验证口径：

- `node --test test/npcActiveRequests.test.js test/npcRelationshipActions.test.js test/npcAiSafety.test.js`
- `node --test test/npcInventoryRoutes.test.js`
- `node --test test/sqliteNpcInventoryTables.test.js test/sqliteNpcInventoryAdapterIntegration.test.js`
- `npm run typecheck:client`
- `npm run test:client`
- `npm run build:client`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`
- `AI_PROVIDER=mock npm run smoke:browser`
- `npm test`

## 7. 近期进度记录

### 2026-05-22：推进 S88.7 主动来函后续领域 evidence

- 范围：继续 S88.7 NPC 与关系深化，把安全 `followUpTasks` / `latestResolution` 从“后续簿”和长期回响推进为更具体的领域只读 evidence。本轮只给 resolver input、topic surface、安全搜索和 SQLite safe-search 提供公开材料；不新增真实任务队列，不结算资源、婚姻、弹劾、定罪、背叛、人情债、NPC 行动、world entity influence 或 hidden truth。
- 实现：`src/game/npcActiveRequestsConfig.js` 新增 `NPC_ACTIVE_REQUEST_FOLLOW_UP_EVIDENCE_CONFIG`、schema version 和 `maxFollowUpEvidence`，把 `social_help_check`、`network_visit_lead`、`economy_debt_note`、`public_docket_evidence`、`policy_advice_evidence`、`integrity_watchlist`、`censorate_watchlist`、`relationship_risk_watchlist` 等 taskRoute 映射到 people/events/economy 域、搜索域和 topic surface。`src/game/npcActiveRequests.js` 的 `buildNpcActiveRequestView()` 新增 `followUpEvidence`，只从已清洗 `followUpTasks` 派生 `items`、`people`、`events`、`economy`、counts 和 safeguards，每条 evidence 都带 read-only / proposal-only / server-owned boundaries、NPC 摘要、public summary、next step、source refs 和 topic surface ids。
- 接线：`resolverInputConfig` / `resolverInputContext` 新增 `npcActiveRequestView.followUpEvidence.people/events/economy` source collections，并保留 `topicSurfaceIds`；`topicSurfaceView` 让 `memorial-review`、`court-debate`、`trial` 和 `npc-profile` 按 surface allowlist 只读消费这些 evidence；`safeWorldSearch` 会索引 `npcActiveRequestView.followUpEvidence` rows，SQLite `safe_search_index` 因单向消费 `buildSafeSearchRows()` 自动同步；`client/src/api/types.ts` 补 `NpcActiveRequestFollowUpEvidenceView` / group 类型。
- 回归：`test/npcActiveRequests.test.js` 覆盖引荐拜会、背叛风险、人情债月账、请托案牍、廉政和风宪 watchlist 的 evidence 映射与边界；`test/resolverInputContext.test.js` 覆盖 resolver input 从 safe view 消费 people/economy/events evidence 且不读取 raw ledger；`test/topicSurfaceView.test.js` 覆盖奏折/人物/堂审 surface 显示只读后续 evidence，并断言人物档案不收请托案牍、堂审不收引荐拜会；`test/safeWorldSearch.test.js` 和 `test/sqliteSafeSearch.test.js` 覆盖内存搜索与 SQLite safe-search 同步这些公开行且不泄露 raw/private/provider/path/key。
- 验证：已通过语法检查、`node --test --test-reporter=spec test/npcActiveRequests.test.js test/resolverInputContext.test.js test/safeWorldSearch.test.js test/topicSurfaceView.test.js`（34 项）、`node --test --test-reporter=spec test/sqliteSafeSearch.test.js`（7 项）、topic surface P2 修复后 focused `test/topicSurfaceView.test.js`（7 项）与 `test/resolverInputContext.test.js`（11 项）、`npm run typecheck:server`、`npm run typecheck:client`、docs governance、documentation governance、完整 `npm test`（1107 项）和 `git diff --check`。
- 子代理：Poincare 只读建议采用独立派生 evidence view 并接 resolver/topic/search/SQLite，避免直接把 `followUpTasks` 塞入 source collections；Carver 只读建议本片暂不新增 actor memory 写入或 world entity influence，避免同一 follow-up 重复强化。两项建议均已采纳。Poincare 提交前只读初审发现 topic surface 未执行 `topicSurfaceIds` allowlist 的 P2；主代理已在 resolver input 保留 surface ids、topic surface 按 surface 过滤并补回归，Poincare 复核确认 P2 已关闭，未发现新的 P0/P1/P2。非阻断残余风险：`sourceViews` 统计仍来自原始 resolver buckets，当前不会扩大 evidence 展示或裁决。
- 提交：实现提交 `73d6540d`。本次哈希回填为低风险纯文档维护，不改代码、API/schema、运行时行为、提示词或验证工具；按项目规则跳过额外子代理复审。

### 2026-05-22：推进 S88.7 主动来函后续公开回响

- 范围：继续 S88.7 NPC 与关系深化，把已登记的 `followUpResolutions` 从 turn feedback / 后续簿近次状态推进到事件档案、NPC 可见记忆和 world thread 长期公开回响。本轮仍只做公开历史解释与可见记忆，不创建真实任务队列，不结算资源、婚姻、弹劾、背叛、人情债、NPC 行动或 hidden truth。
- 实现：`src/game/eventArchive.js` 的 `npc_active_request` 条目沿用原 resolver public ref 作为 stable sourceId，并从 safe `followUpView.latestResolution` 或 canonical `outcome.followUpResolutions` 的近次记录补充 public summary、next step、status/risk 标签和更新时间；`src/game/actorMemoryLedger.js` 新增 `npc_active_request_follow_up` 来源，只接受本旬 `npc_active_request_follow_up_resolver` 记录，且必须命中 `buildNpcActiveRequestView({ includeResolved: true })` 的 canonical resolutionId/ref、原 active-request resolver trace 和 `serverOwnsFollowUp` 边界后才写已知 NPC 可见记忆；`src/game/worldThreads.js` 的 `active_npc_request` 议题只读最新安全后续摘要和 `createdTurn`。事件档案与记忆敏感词过滤同步扩展 snake_case/camelCase 别名，覆盖 provider payload、private signal、hidden dossier、safe search、true assets、secret relationships、unrevealed tasks 和 state patch 污染。
- 回归：`test/eventArchive.test.js` 覆盖主动来函后续登记后仍按稳定 sourceId 展示最新后续摘要并过滤 snake_case 污染；`test/actorMemoryLedger.test.js` 覆盖 canonical follow-up 记忆、伪造 resolutionId 拒绝和同 ID 篡改只能使用 canonical 内容；`test/worldThreads.test.js` 覆盖主动来函议题吸收最新后续摘要和更新时间；`test/npcInventoryRoutes.test.js` 覆盖普通 turn 后响应中的 actor memory、event archive 计数、world thread 后续回响和 raw ledger 剥离。
- 验证：已通过语法检查、`node --test --test-reporter=spec test/eventArchive.test.js`（11 项）、`node --test --test-reporter=spec test/actorMemoryLedger.test.js`（19 项）、`node --test --test-reporter=spec test/worldThreads.test.js`（9 项）、`node --test --test-reporter=spec test/npcActiveRequests.test.js`（9 项）、`node --test --test-reporter=spec test/npcInventoryRoutes.test.js`（4 项）、`npm run typecheck:server`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、完整 `npm test`（1103 项）和 `git diff --check`。
- 子代理：Franklin 提交前只读复审未发现 P0/P1/P2；非阻塞残余风险是 `worldThreads` 当前安全性依赖继续只消费 `buildNpcActiveRequestView()` 的 safe projection，后续若改为直接读取 raw ledger 必须同步补强 sanitizer 或保持 safe-view-only 约束。
- 提交：实现提交 `c08eb0fd`；本哈希回填为低风险纯文档同步，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。

### 2026-05-22：推进 S88.7 主动来函后续簿服务器登记

- 范围：继续 S88.7 NPC 与关系深化，把上一片只读 `npcActiveRequestView.followUpTasks` 接到普通回合的一次窄服务器登记。浏览器按钮仍只写草稿；本轮不创建真实任务队列，不结算资源、婚姻、弹劾、背叛、人情债、NPC 行动或 hidden 私档。
- 实现：`src/game/npcActiveRequestsConfig.js` 新增 follow-up resolution schema、每类 task 的登记状态/摘要/下一步和匹配关键词；`src/game/npcActiveRequests.js` 新增 `npc_active_request_follow_up_resolver` 路径，先从安全 `buildNpcActiveRequestView().followUpTasks` 识别“续办/后续/复核”输入，再校验 canonical request 的 `publicResolutionRef` 与 `serverOwnsFollowUp` 边界，回写 `outcome.followUpResolutions`、`followUpView.latestResolution`、`auditRefs` 和 `[NPC 后续]` 事件。普通回合 feedback 新增 `outcome.followUpResolved` / `followUpResolutions`；`npcActiveRequestView.followUpTasks[].latestResolution` 与 React 人物页后续簿展示近次服务器登记。
- 回归：`test/npcActiveRequests.test.js` 覆盖引荐后续从 safe task 到 canonical resolution 的完整链路、同回合不处理 active response、资源/婚姻/hidden truth 不落账、safe view latest resolution、污染输入不生成 resolution、污染 `复核引荐` 不回落处理 active 来函，以及普通 `先查证来意` / `先登记线索，再查证来意` 不误登记 follow-up；`test/npcInventoryRoutes.test.js` 覆盖 turn route 提交后续簿草稿、public payload 不泄露 raw ledger，持久 session 中只有服务器写入的 follow-up resolution。
- 验证：已通过 `node --check src/game/npcActiveRequestsConfig.js`、`node --check src/game/npcActiveRequests.js`、`node --check test/npcActiveRequests.test.js`、`node --check test/npcInventoryRoutes.test.js`、`node --test --test-reporter=spec test/npcActiveRequests.test.js`（9 项）、`node --test --test-reporter=spec test/npcInventoryRoutes.test.js`（4 项）、`npm run typecheck:server`、`npm run typecheck:client`、`npm run test:client -- --pool=vmForks --maxWorkers=2`（72 项）、`npm run build:client`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`npm test`（1101 项通过）和 `git diff --check`。
- 子代理：Franklin 提交前只读复审先发现失败 follow-up attempt 可经“复核/核验”回落处理普通 active 来函的 P2，复审又发现普通 `查证` 与 `登记+线索` 可被泛化 task signal 误登记为 follow-up 的 P2；主代理已统一 cue/task signal、过滤通用动词和弱任务词，并补对应回归。Franklin 最终复核确认 P2 均关闭，未发现新的 P0/P1/P2；残余风险是后续新增 `taskIntentKeywords` 时仍需避免把泛化词重新放入 task-specific signal。
- 提交：实现提交 `a16e34df`；本哈希回填为低风险纯文档同步，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。

### 2026-05-22：推进 S88.7 主动来函后续簿安全投影

- 范围：继续 S88.7 NPC 与关系深化，把上一片 resolved `outcome.followUpView` 从单条说明推进为服务器派生的“来函后续簿”。本轮仍不新增真实结算器，不创建可绕过服务器的资源、婚姻、弹劾、背叛、NPC 经济或 hidden 私档后果。
- 实现：`src/game/npcActiveRequestsConfig.js` 新增 follow-up task schema、`taskRoute` / `taskRouteLabel` / `taskDraftTemplate` 和 `maxFollowUpTasks`；`src/game/npcActiveRequests.js` 新增 `buildNpcActiveRequestFollowUpTasks()`，只从已清洗的 active request safe item 与 followUpView 派生 `npcActiveRequestView.followUpTasks`，公开 task route、状态、标题、摘要、下一步、draftText、NPC 摘要、证据 refs、风险标签和 proposal-only/server-owned 边界。`client/src/api/types.ts` 与 React `PeoplePage` 新增来函后续簿，只读展示并把“拟后续”写入本地行动草稿。
- 回归：`test/npcActiveRequests.test.js` 覆盖六类高价值 follow-up task 进入后续簿、任务边界保持 `serverOwnsFollowUp` / `proposalOnly` / `browserDraftOnly`、敏感词不随任务投影泄漏，并断言 `deferred` 仍保留回应入口但不进入 follow-up task，`refused` 也不会被后续簿复活。
- 验证：已通过 `node --check src/game/npcActiveRequestsConfig.js && node --check src/game/npcActiveRequests.js && node --check test/npcActiveRequests.test.js`、`node --test --test-reporter=spec test/npcActiveRequests.test.js`、`node --test --test-reporter=spec test/eventArchive.test.js test/actorMemoryLedger.test.js test/worldThreads.test.js`、`npm run typecheck:server`、`npm run typecheck:client`、`npm run test:client -- --pool=vmForks --maxWorkers=2`（72 项）、`npm run build:client`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和完整 `npm test`（1098 项）。
- 复审：Franklin 提交前只读复审未发现 P0/P1/P2；非阻塞残余缺口是暂无专门 React click 测试断言“拟后续”只写草稿且不调用 API，`active` / `expired` 不入后续簿主要由实现过滤与复审覆盖。
- 提交：`18e489e5`（feat: add npc follow-up docket）。
- 下一步：在 follow-up task 安全投影基础上，再拆窄的普通回合服务器后续裁决，例如 `network_visit_lead` 只生成拜会/同年线索、`public_docket_evidence` 只生成案牍/奏议 evidence、`economy_debt_note` 只进入 NPC 经济解释，人情、廉政、弹劾、背叛等仍需独立服务器规则。

### 2026-05-21：推进 S88.7 主动来函 follow-up 安全 view

- 范围：继续 S88.7 NPC 与关系深化，聚焦主动来函回应后的专门后续复核 view、记忆/档案回响和人物页操作切片。本轮不新增直接写 API，不把 follow-up 变成真实后续任务，不让前端或 AI 裁决资源、婚姻、定罪、弹劾、背叛、NPC 经济或 hidden 私档。
- 实现：`src/game/npcActiveRequestsConfig.js` 新增 `NPC_ACTIVE_REQUEST_RESPONSE_ACTION_CONFIG` 与 `NPC_ACTIVE_REQUEST_FOLLOW_UP_CONFIG`，覆盖求助、索债/人情债、献策、请托、行贿、弹劾、引荐、议婚和背叛的首选回应、公开摘要、下一步、风险标签和草稿模板。`src/game/npcActiveRequests.js` 在安全 view 中新增 `responseOptions`，并在回应/逾期后写入 resolved `outcome.followUpView`，包含 follow-up kind、public resolution ref、证据 refs、边界和 task state；`eventArchiveView` 的 `npc_active_request` 条目与 `actorMemoryLedger` 的 `npc_active_request_trace` 记忆会消费该安全上下文。`client/src/api/types.ts` 和 React `PeoplePage` 已让人物页来函 inbox 按服务器选项显示回应按钮，只写本地行动草稿。
- 回归：`test/npcActiveRequests.test.js` 覆盖六类高价值来函的 follow-up kind、response options、安全边界和敏感词过滤，并断言已裁决 follow-up view 不再返回回应选项、`deferred` 仍保留回应入口；`test/eventArchive.test.js` 覆盖主动来函档案条目带 follow-up 风险标签；`test/actorMemoryLedger.test.js` 覆盖主动来函记忆摘要/标签带 follow-up 上下文，并新增 forged visible trace 不写记忆、同 `publicResolutionRef` 篡改字段不能改变 canonical memory type/tags 的回归。既有 NPC route/safety、world thread/entity 与 React App/focused client tests 已确认 route 和前端接线不泄露 raw ledger、不替服务器裁决。
- 验证：已通过本节顶部 S88.7 验证口径中新增的语法检查、`node --test --test-reporter=spec test/npcActiveRequests.test.js`、`test/eventArchive.test.js`、`test/actorMemoryLedger.test.js`、NPC route/safety/event focused tests、actor memory/world thread/entity focused tests、`npm run typecheck:server`、`npm run typecheck:client`、`npm run test:client -- client/src/state/uiState.test.ts client/src/api/qianqiuClient.test.ts --pool=vmForks --maxWorkers=2`、`npm run test:client -- client/src/__tests__/App.test.tsx --pool=vmForks --maxWorkers=2`、`npm run test:client -- --pool=vmForks --maxWorkers=2`（72 项）、`npm run build:client`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check` 和完整 `npm test`（1098 项）。一次未加受控 worker 的 focused client Vitest 出现 fork worker 启动超时，随后同目标受控 worker 重跑通过；一次 240 秒 `npm test` 命令超时截断，随后 720 秒重跑完整通过。Franklin 提交前只读初审发现主动来函记忆仍可由非 canonical trace 或同 ref 篡改字段影响的 P2，本轮已按 canonical safe record 修复并补回归；复审又发现已裁决 follow-up 仍显示回应按钮的 P2，本轮已限制 `active` / `deferred` 才返回/渲染回应选项并补 view 回归。Franklin 最终复核确认两个 P2 均关闭，未发现新的 P0/P1/P2。
- 提交：实现提交 `e5ab3417`（`feat: add npc request follow-up views`）。
- 下一步：在 follow-up view 基础上继续拆更窄的服务器后续任务切片，例如引荐转拜会/同年线索、请托转公开案牍或奏议 evidence、人情债转 NPC 经济月账解释、行贿/弹劾/背叛转廉政/风宪/查证 watchlist，继续保持 proposal-only 和服务器裁决。

### 2026-05-21：推进 S88.6 topic draft 与下一轮服务器裁决 canonical echo 审计链

- 范围：继续 S88.6 官场与世界后果追踪红队，聚焦同一公开领域后果经 direct domain consequence、事件档案、world thread、topic surface、`topic_draft` 和下一轮普通回合裁决反复出现时的 canonical echo 去重与审计。本轮不新增写 API、不新增 persistent consequence ledger、不改变财政、军务、刑名、NPC 经济或官场裁决所有权。
- 实现：新增 `src/game/domainConsequenceEchoRefs.js` 统一清洗 `domainConsequenceEcho:*`；`eventArchiveView`、`resolverInputContext`、`worldThreadView` source collection、`topicSurfaceView` 和 `topicDrafts` 现在保留安全 `canonicalEchoRefs`，topic surface 会按 canonical echo 去重同一公开后果并优先保留 direct `domainConsequenceView` evidence。`topic_draft` provider context 与响应只带服务器 evidence 派生的 echo refs；React surface 写草稿时附带待校验 `draftContext`，`POST /api/game/turn` 会重建当前服务器 topic surface、校验 `surfaceId` / `evidenceRefs` 后反推 canonical echo refs，伪造 echo 会被忽略。`roleCycleDomainAdjudication` 接收已校验 draft context 后，把 echo 审计链写入公开 outcome、内部 auditRecord 和最新 accepted city/military ledger record；`duplicate_recent` 反馈可回显同一安全 echo，但仍按 actor/intent/evidence window 拦截，不阻断新证据、新意图或冷却后的新裁决。
- 回归：`test/resolverInputContext.test.js` 覆盖 domain consequence / event archive / world thread evidence 的 canonical echo refs；`test/topicSurfaceView.test.js` 覆盖同一 echo 在 topic surface 中跨 direct/archive/thread 去重；`test/topicDraftRoute.test.js` 覆盖 topic draft provider context 与响应携带服务器派生 echo；`test/roleCycleDomainAdjudication.test.js` 覆盖已校验 draft echo 写入公开 outcome 与 ledger 审计；`test/gameTurnRoleCycleConsequences.test.js` 覆盖 `/api/game/turn` 重新校验 draftContext、忽略伪造 echo、accepted/duplicate 反馈保留安全 echo。
- 验证：已通过本节顶部“本轮 S88.6 topic draft 与下一轮服务器裁决 canonical echo 审计链验证口径”中已列语法检查、focused tests、server/client typecheck、docs governance、documentation governance、client Vitest（70 项；并行首轮 180 秒超时后单独重跑通过）、client build、完整 `npm test`（1083 项）和 `git diff --check`。
- 子代理：Franklin 只读探查指出 `topic_draft` 之前会丢失 `domainConsequenceEcho:*`，resolver input/event archive/topic surface/topic draft/turn request 需要共同保留服务器派生 canonical echo，并要求普通回合只把浏览器 draft context 当作待校验 hint；本轮采纳。Poincare 提交前只读初审发现 3 个 P2：accepted public outcome 回传 `outcomeId`、手动编辑奏折保留 stale `draftContext`、交接验证状态未回填；主代理已移除 public `outcomeId`、让手动改写清除 draftContext、补 accepted payload / UI store 回归并重跑 focused/full 验证。Poincare 最终复审确认三项 P2 均已关闭，未发现新的 P0/P1/P2。
- 提交：实现提交 `9a7a934b`；本哈希回填为低风险纯文档状态更新，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：提交后优先进入 S88.7 NPC 与关系深化；若继续 S88.6 收束，可补真实 provider/streaming turn 的 `draftContext` smoke 与更长冷却周期回归。

### 2026-05-21：推进 S88.6 长链路后果回响与公开 echo ref

- 范围：继续 S88.6 官场与世界后果追踪红队，聚焦同一公开领域后果进入后续月报、world thread resolved 历史和 role-cycle 草稿时的可审查回响与去重。本轮不新增写 API、不新增 persistent consequence ledger、不改变财政、军务、刑名、NPC 经济或官场裁决所有权。
- 实现：`domainConsequenceView.recentConsequences` 现在公开稳定 `publicEchoRef`，该 ref 由安全去重键派生，不暴露 `publicSourceId`、outcomeId、raw evidence、state/player delta、auditRecord 或 ledger path。`playerMonthlyBriefing` 会用已归档月报的 domain source refs 跳过已入报后果，避免连续月报重复把同一后果作为行动/风险主项；空后果行不再生成 fallback 伪 sourceRef。`worldThreads` 的 domain consequence thread id/sourceId 改用 `publicEchoRef`，并对 `recentResolved` 按来源回响去重，角色可见性反复切换时不会重复归档同一后果。`roleCycleView` 新增只读 `domainConsequenceView` 来源给地方官、官员、大臣、将领和皇帝，生成“复核后果”事务、entryPoint 和 nextAction；大臣/皇帝会过滤同一后果经 world thread 间接重复进入的条目。`client/src/api/types.ts` 同步 `publicEchoRef` 字段。
- 回归：`test/domainConsequenceTrace.test.js` 断言 `publicEchoRef` 稳定且不含原始 public source；`test/playerMonthlyBriefing.test.js` 覆盖同一后果跨月不再重复进入月报 sourceRefs/actionItems/riskItems；`test/worldThreads.test.js` 覆盖 domain thread 显隐反复后 `recentResolved` 不重复；`test/roleCycleView.test.js` 覆盖地方官 role-cycle 只读复核 domain consequence，按钮不调用 turn、不写终局。
- 验证：已通过本节顶部“本轮 S88.6 长链路后果回响与公开 echo ref 验证口径”中已列语法检查、focused tests（51 项）、server/client typecheck、docs governance、documentation governance、完整 `npm test`（1079 项）和 `git diff --check`；Maxwell 提交前最终只读复核未发现 P0/P1/P2。
- 子代理：McClintock 只读探查指出月报连续重复同一最新后果、`worldThreads.recentResolved` 可在可见性反复变化后重复归档、role-cycle 仅通过 world thread 间接消费领域后果且同一事实可能跨来源重复；本轮采纳。Maxwell 提交前只读初审发现两个 P1：role-cycle 后果复核草稿含“稳价/调粮/新处置”等执行词，可能触发普通回合 city/military 写裁决；月报标题级 label 去重会误挡同标题不同 `publicEchoRef` 的新后果。主代理已改为复核草稿不嵌入后果标题或执行词、地方官 generic 处置 action 跳过 domain item，并让月报新格式只按 stable echo/id/source 去重，补同标题新后果与 classifier 回归。Maxwell 复审又发现将领 generic 军务 action 仍可消费 domain item 并生成含标题/调粮词草稿的 P1；主代理已让将领 generic action 同样跳过 domain item，并把回归改为检查所有 `domainConsequenceView` actions；Maxwell 最终复核确认 P1 已关闭且无新的 P0/P1/P2。
- 提交：实现提交 `12fb20bf`；本哈希回填为低风险纯文档状态更新，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：提交后继续补 topic draft 与下一轮服务器裁决之间的后果 echo 审计链，尤其是同一公开后果通过 domain/topic/archive/thread 多入口进入草稿时的 canonical evidence 去重。

### 2026-05-21：推进 S88.6 普通回合重复触发与跨视图 cap 压力红队

- 范围：继续 S88.5.3 / S88.6 红队，聚焦普通回合身份循环接缝的重复 apply 风险，以及 `domainConsequenceView` 在高量后果、source/global cap、角色裁剪和下游 archive/resolver/topic/search/SQLite 消费中的一致性。本轮不新增写 API、不新增 persistent consequence ledger、不把 raw resolver ledger、SQLite raw/index row、prompt/provider payload、地图坐标或 hidden evidence 交给浏览器或 AI 裁决。
- 实现：`src/game/roleCycleDomainAdjudication.js` 新增近 3 旬重复裁决拦截。同一当前角色、resolver 意图和清洗后的公开 evidence refs 若已在 `cityPolicyLedger` / `militaryDiplomacyLedger` 有 accepted 且带显式 `actorRef.actorId` 的近旬记录，再次提交只返回 `duplicate_recent` 安全反馈，不重复调用 city/military apply、不追加 ledger、不扣钱粮或军需，也不产生角色循环 attribute changes；旧存档缺 actor 身份的 accepted 行不会挡住当前玩家首次处置。`src/game/resolverInputContext.js` 在领域优先级与置信度相同时按 source collection 顺序稳定排序，确保 high-volume 下 direct `domainConsequenceView` evidence 不被 `eventArchiveView` 中转条目挤出 events cap。
- 回归：`test/roleCycleDomainAdjudication.test.js` 与 `test/gameTurnRoleCycleConsequences.test.js` 覆盖地方官市价、将领侦察/调粮重复触发、冷却后可重新裁决、legacy row 缺 actor 身份不误挡、turn route 层不重复写 ledger/attribute changes 且不泄漏 raw outcome。`test/domainConsequenceTrace.test.js` 新增 official 跨域高量和 general 角色裁剪高量场景，显式要求 resolver/topic/safe-search 的 direct consequence 行非空且只来自 capped 可见后果；`test/sqliteSafeSearch.test.js` 覆盖 SQLite safe-search 在高量噪声下只同步 capped public consequence 行。
- 验证：已通过本节顶部“本轮 S88.6 普通回合重复触发与跨视图 cap 压力红队当前验证口径”中已列语法检查、focused tests、`npm run typecheck:server`、docs governance、documentation governance、完整 `npm test`（1074 项）、路径级 `git diff --check` 和完整 `git diff --check`；完整 diff check 退出码 0，仅打印未改动归档/QA 文件既有 CRLF 提示。
- 子代理：Raman 只读探查指出普通回合重复提交会重复 apply/cost/ledger，以及高量 consequence cap 需要跨 archive/resolver/topic/search/SQLite 一致验证，本轮已采纳。Banach 提交前只读初审发现两个 P2：缺 `actorRef.actorId` 的旧 ledger row 被当作 wildcard duplicate、resolver/topic direct consequence 断言因空数组而 vacuous；主代理已要求 duplicate 匹配显式 actor 身份、补 legacy 回归，并让 resolver input 尊重 source collection 顺序、补 direct consequence 非空断言。Banach 最终复核未发现 P0/P1/P2，残余风险仅是 accepted 正常裁决反馈继续沿用既有 public outcome 形状，本轮未改变该契约。
- 提交：实现提交 `428a26bb`；本哈希回填为低风险纯文档状态更新，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：提交后继续 S88.6 更长链路后果回响，尤其是连续多旬/month-end 后果如何从公开 refs 进入月报、议题线索和后续草稿，而不扩大 AI 或浏览器裁决权。

### 2026-05-21：推进 S88.6 角色可见性与舆图运行时后果 effect 红队

- 范围：继续 S88.6 官场与世界后果追踪红队，聚焦 `domainConsequenceView` 根 view 的角色可见性和舆图 runtime 更深接线。本轮不新增写 API、不新增 persistent consequence ledger、不把地图显示坐标、raw ledger、resolver delta 或 hidden evidence 交给浏览器、prompt 或 AI 工具裁决。
- 实现：`src/game/domainConsequenceTrace.js` 现在按当前 `player.role` 在服务端裁剪 `recentConsequences`、`nextActions`、`counts` 和 cap 语义：书生默认不接收领域后果，地方官只接地方政策/刑名/NPC 经济，将领只接军务外交，官员/大臣/皇帝接跨域后果；`caps.publicCandidates` / `roleEligibleCandidates` 只统计当前角色可见候选，避免低权限身份通过 cap 反推被过滤后果数量。archive、resolver input、topic surface、`topic_draft`、safe search 和 SQLite safe-search 都自然消费裁剪后的 view。
- 舆图：`src/game/mapRuntimeConfig.js` / `src/game/mapRuntimeView.js` 新增 domain consequence visual-only `eventEffects`，从同一路由已裁剪的 `domainConsequenceView` 派生，按来源类型绑定到已有可见 runtime ref（军务->军报/边面，地方政策->市况/辖区/城邑，刑名->案牍/辖区，NPC 经济->市况/城邑），`sourceRefs` 只使用 `domainConsequenceView:<safe-id>`；route 构建时复用同一份 `domainConsequenceView` 传给 `mapRuntimeView`，避免页面追踪与舆图 effect 不一致。
- 安全：`mapRuntimeView` 后果 effect 不写状态、不进入 `mapContextView`、prompt context、AI map tool 或 resolver evidence；找不到已可见 runtime ref 就不生成 effect。cap 满时保留少量当前角色可见 domain consequence effect，仍遵守 `MAP_RUNTIME_LIMITS.maxEventEffects`。
- 验证：已通过本节顶部“本轮 S88.6 角色可见性与舆图运行时后果 effect 红队当前验证口径”中已列命令；实现提交 `7ee4ae6f`。
- 下一步：继续 S88.6 普通回合重复触发、跨视图 cap 压力和更长链路后果回响红队。

### 2026-05-21：`7ee4ae6f` 提交哈希回填

- 范围：低风险纯文档回填 S88.6 角色可见性与舆图运行时后果 effect 红队实现提交哈希。
- 验证：`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`。
- 子代理：本轮只改文档哈希，不改代码、API/schema、运行时行为、提示词或验证工具；按项目规则跳过额外子代理复审。

### 2026-05-21：推进 S88.6 地图/史册后果追踪入口与 high-volume cap 红队

- 范围：继续 S88.6 官场与世界后果追踪红队，聚焦公开后果在舆图、史册和高事件量检索中的可用性。本轮不新增写 API、不新增 persistent consequence ledger、不把地图坐标、raw event archive、SQLite raw/index row、resolver delta 或 hidden evidence 交给浏览器裁决。
- 实现：`src/game/domainConsequenceTrace.js` 改为先过滤 `accepted` / `applied` / `recorded` 且已应用旬标记的公开候选，再按应用旬排序并对每类 ledger 套 source cap，避免旧存档末尾 pending/rejected/污染行或乱序旧账挤掉较早有效/较新有效后果；同一 view 暴露安全 `caps` 和 `trackingEntryPoints`，说明近次可见条数、公开候选数、是否 cap 以及“入舆图追踪 / 入史册归档”入口。`src/game/safeWorldSearch.js` 在全局 1200 行 cap 下优先保留 `domainConsequenceView.recentConsequences` 搜索行，防止地理/人物/report 噪声把后果追踪检索挤出。React `MapPage` 新增“舆图后果追踪”，`ArchivePage` 从 placeholder 升级为安全史册页，读取 `eventArchiveView.items` 与 `domainConsequenceView`，并展示 cap 文案与草稿按钮。
- 安全：舆图和史册只消费 safe route view，不读取 raw `cityPolicyLedger` / `militaryDiplomacyLedger` / `judicialCaseLedger` / `npcEconomyLedger`、raw `event_archive_index`、地图 layout 坐标、provider payload、prompt、path/key、`stateDelta` / `playerDelta`、`evidenceRefs`、`outcomeId` 或 `auditRecord`。按钮只写本地 `map-runtime` / `archive-view` 行动草稿，不调用 `/api/game/turn`，不裁决财政、军务、刑名、NPC 经济、关系或持久化。
- 验证：当前已通过语法检查、`test/domainConsequenceTrace.test.js`（9 项）、`test/safeWorldSearch.test.js`（6 项）、`test/sqliteSafeSearch.test.js`（5 项）、event/topic/resolver focused tests（24 项）、`npm run typecheck:server`、`npm run typecheck:client`、focused React App test（37 项）、完整 client Vitest（69 项）、`npm run build:client`、`AI_PROVIDER=mock npm run smoke:browser`（首轮 180s 外层超时后以 420s 超时重跑通过，最终又重跑通过）、docs governance、documentation governance、完整 `npm test`（1062 项）和 `git diff --check`。
- 子代理：Kant 只读探查指出地图页未展示后果、史册页仍是 placeholder、`rowsFromLedger()` 先 cap 后过滤会被污染尾行遮蔽、safe search 末尾追加的后果行可能被全局 cap 截掉；本轮采纳。Poincare 首轮提交前只读复审未发现 P0/P1/P2；低风险建议已补前端 deny list、`caps`/`trackingEntryPoints` 类型和乱序旧账 source cap 回归。Poincare 最终只读复审仍未发现 P0/P1/P2，仅建议后续清理 `npcEconomyConsequence()` 重复空数组判断并可进一步收紧乱序 cap 断言。
- 提交：实现提交 `eee0185a`；本哈希回填为低风险纯文档状态更新，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：提交后继续 S88.6 `domainConsequenceView` 角色可见性、map runtime 更深 hook/effect、普通回合重复触发和跨视图 cap 压力红队。

### 2026-05-21：推进 S88.6 inactive role 与高风险军务绕过红队

- 范围：继续 S88.6 官场与世界后果追踪红队，聚焦普通回合 `roleCycleDomainAdjudication` 的低风险接缝是否会被非当前身份或高风险军令措辞绕过。本轮不新增 API、不新增 ledger、不改变 `militaryDiplomacyResolver` 本身的高风险战役裁决规则。
- 实现：`src/game/roleCycleDomainAdjudication.js` 扩展 `GENERAL_HIGH_STAKES_TERMS`，把发兵、动兵、调兵、攻取、攻伐、突袭、奇袭、强攻、围城、合围、鏖战、接战、交战、动员、请战、扣使、扣留、mobilize、engage、assault、siege 等形态纳入低风险接缝阻断；将领草稿若把这些词混入“军议 / 战事档案 / 侦察 / 调粮”句，不会调用 scout/resupply resolver。分类器同时新增当前身份 gate：只有当前 `player.role` 是 `magistrate` / `general` 时才允许市价 / 军议接缝，`official` 不再因官衔推断为知县或将军而静默借用对应 resolver。
- 安全：新增回归确认书生、大臣、皇帝和官衔像知县/将领的入仕官员，即使写出“军议调粮”或“处置市价”，也不会触发 `cityPolicyResolver` / `militaryDiplomacyResolver`，不会写 `cityPolicyLedger` / `militaryDiplomacyLedger`，普通 turn payload 仍不暴露 `stateDelta`、`playerDelta`、`auditRecord`、sealed token 或 raw ledger。
- 验证：当前已通过语法检查、`test/roleCycleDomainAdjudication.test.js`（8 项）、`test/gameTurnRoleCycleConsequences.test.js`（4 项）、军务 resolver/权限 focused tests（18 项）、`npm run typecheck:server`、docs governance、documentation governance、完整 `npm test`（1058 项）和 `git diff --check`。
- 子代理：Kierkegaard 只读探查指出残余高风险词与 `official` 官衔推断绕过风险；本轮采纳。提交前只读复审未发现 P0/P1；发现的文档 gate 描述与复审状态 P2 已修复。
- 提交：实现提交 `563c911e`。本哈希回填为低风险纯文档状态更新，不改代码、API/schema、运行时行为、提示词或验证工具；按项目规则跳过额外子代理复审。
- 下一步：继续 S88.6 地图/史册追踪入口和 evidence cap 可用性红队。

### 2026-05-21：推进 S88.6 旧存档污染与重复后果去重红队

- 范围：继续 S88.6 官场与世界后果追踪的后端红队 coherent slice。聚焦 `domainConsequenceView` 的旧存档污染、未应用状态外泄、重复后果重放和敏感文本别名，不新增写 API、不新增 persistent consequence ledger、不改变财政、军务、刑名或 NPC 经济裁决所有权。
- 实现：`src/game/domainConsequenceTrace.js` 现在只从 `accepted` / `applied` / `recorded` 且带 `appliedAtTurn` / `generatedAtTurn` / `lastTickTurn` 的 resolver ledger 行派生公开后果；同一安全 `publicSourceId` 通过内部去重指纹合并，只保留较新、公开字段更完整的后果，避免旧存档 replay 生成多条重复余波；无 `publicSourceId` 的行仍按来源类型、标题和公开摘要生成安全去重键。`cleanText()` 新增已配置环境密钥片段检测，并扩展 provider/raw/evidence/private/hidden 旧别名过滤。
- 安全：`publicSourceId` 只参与进程内 Symbol 去重，不进入 JSON、prompt、topic evidence、搜索行或浏览器；`pending`、`rejected` 和仅拟议记录即使有安全摘要也不会成为公开后果；`privateResultRefs`、`hiddenDossier`、`sealedMapping`、`retrievalContext`、`actorMemoryLedger`、`sessionSummary`、`relationshipLedger`、`providerPayload`、`rawEvidence`、配置环境密钥及其常见片段命中后都会回落并丢弃该公开行。
- 验证：当前已通过 `node --check src/game/domainConsequenceTrace.js`、`node --check test/domainConsequenceTrace.test.js`、`node --test --test-reporter=spec test/domainConsequenceTrace.test.js`（6 项）、domain/topic/resolver/search focused tests（19 项）、SQLite safe-search/topic-draft focused tests（18 项）、route response/judicial redaction focused tests（7 项）、`npm run typecheck:server`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、完整 `npm test`（1054 项）和 `git diff --check`。
- 子代理：Zeno 只读探查指出 status 过滤、`publicSourceId` 去重、敏感别名和配置密钥片段是当前主要缺口；本轮采纳。Zeno 提交前只读复审未发现 P0/P1/P2，并额外确认 `publicSourceId` 原值未进入 `domainConsequenceView` JSON。
- 提交：实现提交 `620d2d1f`；本哈希回填为低风险纯文档状态更新，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：继续 S88.6 inactive role 泄漏、高风险军务绕过、地图/史册追踪入口和 evidence cap 可用性红队。

### 2026-05-21：推进 S88.6 前端可见领域后果追踪

- 范围：继续 S88.6 官场与世界后果追踪的前端 coherent slice。聚焦让 React 主卷消费安全 `domainConsequenceView`，不新增后端写 API、不新增 resolver、不新增 persistent consequence ledger、不让浏览器裁决财政、军务、刑名、NPC 经济、关系或持久化。
- 实现：新增 `client/src/components/DomainConsequenceSection.tsx`，只读取 `domainConsequenceView.recentConsequences` 和 `nextActions` 的公开字段，并在地方官、将领、官员/大臣、皇帝主卷面板分别显示“领域后果追踪”“军务后果追踪”“领域后果”“天下余波”。`client/src/api/types.ts` 新增 `DomainConsequenceView` / `DomainConsequenceItemView`，`uiState` route readiness 新增 `hasDomainConsequenceView`，主卷安全视图索引新增“后果”。
- 安全：组件二次过滤 provider/raw/prompt/path/key/hidden/SQLite、`stateDelta`、`playerDelta`、`evidenceRefs`、`outcomeId`、`auditRecord`、raw resolver ledger 名称、safe-search 表名和本地路径形态文本。后续按钮只调用既有 `onDraft` 写入 `role-surface` 行动草稿，不提交 `/api/game/turn`，不调用 resolver，不写 canonical state；显式 `nextActions` 必须绑定当前已通过清洗且实际可见的后果条目，否则不展示，并退回使用当前条目的 `nextStep` 生成草稿按钮。
- 验证：当前已通过 `npm run typecheck:client`、`node --test --test-reporter=spec test/reactClientScaffold.test.js`（39 项）、`npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx client/src/state/uiState.test.ts client/src/components/MemorialComposer.test.tsx`（54 项）、`AI_PROVIDER=mock npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、完整 `npm test`（1052 项）和 `git diff --check`。
- 子代理：Cicero 只读探查建议以共享组件接入地方官/将领/官员/皇帝面板，并补前端二次清洗和 route readiness；本轮采纳。Ampere 提交前只读初审发现无 `sourceTypes` 面板会展示未绑定可见后果 action 的 P2；主代理已改为所有显式 action 必须匹配当前可见 item，并补官员/皇帝 orphan action 回归。Ampere 复审确认 P2 关闭且未发现 P0/P1/P2；复审后仅回填文档状态，按低风险纯文档状态更新跳过额外子代理复审。
- 提交：实现提交 `0b863158`；本哈希回填为低风险纯文档状态更新，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：提交后继续补旧存档污染、重复后果去重、inactive role 泄漏、高风险军务绕过、地图/史册追踪入口和 evidence cap 可用性回归。

### 2026-05-21：推进 S88.6 topic/source evidence 与安全检索接线

- 范围：继续 S88.6 官场与世界后果追踪的第二个 coherent slice。聚焦把首片安全 `domainConsequenceView.recentConsequences` 接到 resolver input、topic surface、`topic_draft`、安全检索和 SQLite safe-search 派生行；本轮不新增写 API、不新增 persistent consequence ledger、不新增 SQLite 表，不让前端、AI 或搜索索引读取 raw resolver ledger。
- 实现：`resolverInputContext` 现在构建 `domainConsequenceView` source view，`resolverInputConfig` 把 `domainConsequenceView.recentConsequences` 作为 `events` source collection；`topicSurfaceView` 在 `memorial-review`、`edict-draft`、`court-debate`、`trial`、`war-council` 暴露公开 consequence evidence，`topic_draft` 可引用这些 safe refs 拟稿；`safeWorldSearch` 直接从安全 view 生成 `domainConsequenceView.recentConsequences` 搜索行，SQLite `safe_search_index` 继续经既有 `buildSafeSearchRows()` 单向同步。
- 安全：本轮只消费 `domainConsequenceView` 的公开字段，`npc-profile` 不接该 source。新增敏感词守门覆盖 `outcomeId`、`stateDelta` / `playerDelta`、资源消耗、关系信号、auditRecord、raw ledger 名称、`safe_search_index` / `safe_search_fts` 等内部 token；topic surface / topic draft 保留公开 payload 字段名 `evidenceRefs`，但测试断言 raw evidence ref 值、ledger 名称、SQL/table/path/key 不会进入 topic context、topic draft provider context、搜索结果或 SQLite safe-search row。
- 验证：当前已通过 `node --check src/game/resolverInputConfig.js`、`node --check src/game/resolverInputContext.js`、`node --check src/game/topicSurfaceView.js`、`node --check src/game/topicDrafts.js`、`node --check src/game/safeWorldSearch.js`、`node --check test/domainConsequenceTrace.test.js`、`node --check test/sqliteSafeSearch.test.js`、`node --check test/topicDraftRoute.test.js`、`node --test test/domainConsequenceTrace.test.js`（4 项）、`node --test test/topicSurfaceView.test.js test/resolverInputContext.test.js test/safeWorldSearch.test.js`（19 项）、`node --test test/sqliteSafeSearch.test.js`（5 项）、`node --test test/topicDraftRoute.test.js`（13 项）、`npm run typecheck:server`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、完整 `npm test`（1051 项）和 `git diff --check`。
- 子代理：Gibbs 只读探查建议将 `domainConsequenceView` 作为 `events` source collection 接入 resolver input 和奏折/诏令/朝议/刑名/军议类 surface，仅暴露 `recentConsequences`，不向 `npc-profile` 或 raw ledger 扩散；本轮采纳。Lovelace 提交前只读复审未发现 P0/P1/P2，仅建议后续在高事件量/evidence cap 场景补 domain consequence 可用性优先级回归。
- 提交：实现提交 `d5f1055b`；本哈希回填为低风险纯文档记录，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：提交本 slice 后继续补前端可见追踪、旧存档污染、重复后果去重、inactive role 泄漏和高风险军务绕过探针。

### 2026-05-21：推进 S88.6 公开领域后果 refs 首片

- 范围：启动 S88.6 官场与世界后果追踪的首个 coherent slice。聚焦把已经由服务器裁决的地方政策、军务外交、刑名案件和 NPC 经济月账整理为安全 public refs，并先接入 route response、事件档案、世界议程和官职月报；本轮不新增写 API、不新增 persistent consequence ledger、不让前端或 AI 直接裁决财政、军务、刑名、NPC 经济、关系或持久化。
- 实现：新增 `src/game/domainConsequenceTrace.js`，导出 `buildDomainConsequenceView()` / `collectDomainConsequences()`；每条公开后果只保留来源类型、公开标题/摘要、状态、发生旬、受影响指标标签、风险级别、public consequence refs 和下一步建议。`eventArchiveView` 增加 `domain_consequence` 条目，`worldThreadView` 增加 `domain_consequence` 议题，`playerMonthlyBriefing` 读取近次领域后果纳入 sourceRefs、职责摘要、行动建议和风险提示。`/api/game/*` 与考试 payload 的 `SafeRouteViews` 新增 `domainConsequenceView`。
- 安全：public sourceId 改为稳定哈希后缀，不复用可能含 evidence ref 的 resolver outcomeId；projection 会过滤 hidden/raw/provider/prompt/key/path/数据库表形态文本，不输出 `stateDelta`、`playerDelta`、资源消耗、关系信号、evidence refs 或 auditRecord。`judicialCaseLedger` 已加入 `RAW_LEDGER_KEYS`、`buildClientWorldState()` forbidden keys 和 redacted state forbidden/sensitive pattern，刑名 resolver 的 accepted ledger 不再可能通过兼容 public `worldState` 泄漏。
- 验证：当前已通过 `node --check test/domainConsequenceTrace.test.js`、`node --check src/game/domainConsequenceTrace.js`、`node --check src/game/eventArchive.js`、`node --check src/game/worldThreads.js`、`node --check src/game/playerMonthlyBriefing.js`、`node --check src/routes/game.js`、`node --check src/routes/exam.js`、`node --check src/routes/routeResponses.js`、`node --check src/game/clientWorldState.js`、`node --check src/game/redactedState.js`、`node --test test/domainConsequenceTrace.test.js`（3 项）、`node --test test/routeResponseContracts.test.js test/judicialCaseEvidenceRedaction.test.js`（7 项）、`npm run typecheck:server`、`npm run typecheck:client`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、完整 `npm test`（1048 项）和 `git diff --check`（退出码 0；仅打印未改动归档/QA 文件既有 CRLF 提示）。Lovelace 提交前只读复审未发现新的 P0/P1/P2；实现提交 `6943c7de`。
- 子代理：Kuhn 只读梳理建议新增安全 projection 并由事件档案、world thread 和月报消费，不直接读取 raw ledger；Aristotle 只读梳理四类 ledger 字段，明确 `judicialCaseLedger` 还缺 public worldState 剥离守门。本轮采纳两者建议。Lovelace 提交前只读初审发现 public `affectedMetrics` 暴露路径/方向/幅度的 P1、内部 token 过滤不全的 P2，复审又指出 `publicSourceId` 覆盖可泄露 evidence-shaped id 的 P2；主代理已改为只公开 `affectedMetricLabels`、补敏感 token 拦截、移除 `publicSourceId` override 并补回归，Lovelace 最终复核确认均已关闭且无新的 P0/P1/P2。
- 提交：实现提交 `6943c7de`；本哈希回填为低风险纯文档记录，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：继续 S88.6 的后续切片，把 `domainConsequenceView` 接入 topic/source evidence、搜索/SQLite 安全索引和前端可见追踪，并补旧存档污染、inactive role 泄漏、重复后果去重与高风险军务绕过红队。

### 2026-05-21：推进 S88.5.3 角色循环入口后端接缝

- 范围：继续 S88.5，把 S88.5.2 的地方官市价入口和将领舆图/战事档案入口接到普通回合里的既有服务器 resolver；不新增 API、SQLite 表、persistent role-cycle ledger 或前端写入口。人物月账只做只读追踪说明，不即时裁决 NPC 资产、关系、交易或人情债。
- 实现：新增 `src/game/roleCycleDomainAdjudication.js`，在 `finalizeTurn()` 中位于 `runRoleWorldCouplingStep()` 后、world tick 前运行。地方官输入含“处置市价 / 平粜稳价”等低风险意图时，只从当前 actor 可见 `market` evidence 取 refs 并调用 `resolveAndApplyCityPolicy()`；将领输入含“舆图 / 军议 / 战事档案 / 遣哨 / 调粮”等低风险意图时，只从可见 `military/geography/intel/market` evidence 取 refs 并调用 `resolveAndApplyMilitaryDiplomacy()`；含“会战 / 出击 / 进剿”等高风险词的输入不走该接缝。`/api/game/turn` 与 SSE preview 新增 `roleCycleDomainAdjudication` 安全反馈，反馈只含 schema、摘要、公开事件、attributeChanges 和脱敏 outcome，不回传 resolver `auditRecord`、`stateDelta`、`playerDelta` 或 raw ledger。
- 安全：`src/contracts/serverContracts.ts`、`src/routes/routeResponses.js`、`src/game/clientWorldState.js` 和 `src/game/redactedState.js` 把 `cityPolicyLedger` / `militaryDiplomacyLedger` 纳入 public `worldState` raw ledger 剥离；`buildClientWorldState()` 现在用 `worldGeographyView` 替换兼容 `worldState.worldGeography`，避免 hidden route/name 回流 public payload。AI 只能从公开 feedback、eventHistory 和安全 views 读取结果；服务器继续拥有资源、军务、财赋、NPC 经济、持久化和隐藏信息边界。
- 验证：当前已通过 `node --check src/game/roleCycleDomainAdjudication.js`、`node --check src/routes/game.js`、`node --check src/game/clientWorldState.js`、`node --check src/game/audit.js`、`node --test test/roleCycleDomainAdjudication.test.js test/gameTurnRoleCycleConsequences.test.js test/worldGeography.test.js test/mapVisibility.test.js`（23 项）、`node --test test/routeResponseContracts.test.js test/cityPolicyHiddenRedaction.test.js test/militaryDiplomacyRedaction.test.js test/npcEconomy.test.js test/gameTurnNpcEconomy.test.js`（15 项）、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`npm run typecheck:server`、完整 `npm test`（1045 项）和 `git diff --check`。Pauli 提交前只读初审指出只读入口泛触发写 resolver ledger 与验证状态文字陈旧两个 P2，复审又指出 read-only cue + action noun 仍可能写 ledger；本轮已收窄 classifier 并加入只读优先 suppression：`查市价`、`查看平粜旧案`、`复核稳价记录`、`据舆图开军议`、`开军议查看战事档案`、`开军议查看补给记录`、`翻看侦察案卷` 保持只读不写 ledger；Pauli 最终复核确认两个 P2 均关闭且无 P0/P1/P2。
- 子代理：Dewey 只读调查后端接缝，建议优先复用 `cityPolicyResolver` / `militaryDiplomacyResolver`，并把人物月账保持为只读说明；本轮采纳。Pauli 初审/复审 P2 已按建议修复，最终复核无 P0/P1/P2。
- 提交：实现提交 `b3a84bde`；本条哈希回填为低风险纯文档更新，未改变代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：优先进入 S88.6，把 `cityPolicyLedger`、`militaryDiplomacyLedger`、`judicialCaseLedger`、NPC 经济月账、事件档案、world thread 和官职月报之间的公开后果 refs 补齐；同时补旧存档污染、inactive role 泄漏和高风险军务绕过红队。

### 2026-05-21：推进 S88.5.2 跨域入口与证据 refs

- 范围：继续 S88.5，在不新增 persistent ledger、不新增写 API、不扩大前端裁决权的前提下，把 `roleCycleView` 当前身份事务接入更专门的跨域安全 view。首批聚焦地方官的市价 / 人物月账，以及将领的舆图 / 战事档案。
- 实现：`src/game/roleCycleView.js` 补齐 `marketPriceView`、`npcEconomyView`、`mapRuntimeView`、`eventArchiveView` source builders，并新增 capped `entryPoints`、`items[].evidenceRefs`、`currentRole.evidenceRefs` 和 prompt compact summary；`src/game/roleCycleConfig.js` 固定 entry/evidence caps 与 AI read scope。地方官循环会从 `marketPriceView.priceRows` 和 `npcEconomyView.recentEvents` 派生只读事务与入口；将领循环会从 `mapRuntimeView.refs`、map action drafts 和 `eventArchiveView.items` 派生只读事务、舆图入口、军议入口和战事档案入口。React `RoleCycleSection` 展示证据 chips 和“可查入口”，六身份面板与 `GamePage` 只通过 route allowlist 或本地 surface allowlist 接线；入口不调用 turn API，草稿按钮仍只写本地行动草稿。
- 边界：地图证据只保留 `sourceView/sourceId/label/targetRouteId` 等公开 ref，不投影 `layout`、`layoutPath`、`mapBounds`、`assetSetId`、`viewportHint`、坐标或 runtime 布局；AI prompt 只读取 compact refs，不读取 map runtime 原始结构。`roleCycleView` 仍只展开当前身份，非当前身份矩阵不显示其他身份案源；资源、身份、交易、NPC 行动、军务、财赋、地方事务、考试、官场和长期后果仍由服务器 resolver 裁决。
- 验证：已通过 `node --check src/game/roleCycleView.js`、`node --test test/roleCycleView.test.js`（9 项）、`node --test test/reactClientScaffold.test.js`（38 项）、`node --test test/browserSmokeScript.test.js`（44 项）、`npm run typecheck:server`、`npm run typecheck:client`、`npm run test:client`（68 项）、`npm run build:client`、`npm run check:docs-governance`、`npm run smoke:exam-s69`、`AI_PROVIDER=mock npm run smoke:browser`、完整 `npm test`（1037 项）和 `git diff --check`（退出码 0；仅打印未改动归档/QA 文件既有 CRLF 提示）。`npm run smoke` 不是当前 `package.json` 脚本，后续以现有 `smoke:*` 脚本记录。
- 子代理：Gibbs 只读梳理后端缺口，确认 `marketPriceView`、`npcEconomyView`、`mapRuntimeView`、`eventArchiveView` 未进入 role cycle builder 并建议 evidence/entry cap；Cicero 只读梳理前端接线，建议 route/surface allowlist 与只读入口。本轮实现已采纳。Peirce 提交前只读初审未发现 P0/P1/P2，仅指出入口可见重复的低风险 polish；本轮已补 entry dedupe 与回归，并重跑 `node --check src/game/roleCycleView.js`、`node --test test/roleCycleView.test.js`、server/client typecheck、browser smoke 和完整 `npm test`。Peirce 最终只读复审确认无 P0/P1/P2 且无残留低风险 gap。
- 提交：实现提交 `871c3a47`。本条哈希回填为低风险纯文档改动，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：继续把这些入口后的处置路径接入更专门 resolver 或 S88.6 跨域后果 refs，并补旧存档污染与 inactive role 泄漏红队。

### 2026-05-21：推进 S88.5.1 六身份循环矩阵首片

- 范围：启动 S88.5 六身份循环矩阵的第一个 coherent slice。聚焦先把皇帝、大臣、将领、地方官、书生和入仕官员的“本旬循环”统一成一个服务器安全 view 与共享 React 区块，便于后续再接更深的 resolver、长期后果 refs、地图/NPC/经济入口。
- 实现：新增 `src/game/roleCycleConfig.js` 与 `src/game/roleCycleView.js`，由服务器从 `studyProfileView`、`examCalendarView`、`localAffairsDocketView`、`economicFiscalView`、`officialCareerView`、`courtResponseView`、`courtConsequenceView`、`worldThreadView`、`militaryDiplomacyView` 和 `officialPostingsView` 即时派生 `roleCycleView`；`src/routes/game.js` / `src/routes/exam.js` 返回该 view，`src/contracts/serverContracts.ts` 与 `client/src/api/types.ts` 固定契约，resolver input 和 prompt context 只读取 capped 安全摘要。React 新增 `RoleCycleSection`，六身份主面板统一显示“本旬身份循环”“本旬事务”“风险”和草稿按钮，`GamePage` 和 `uiState` 同步 safe view readiness，`scripts/clientSmoke.js` 覆盖六身份 smoke；`docs/AI_CONTROL_AUDIT_MATRIX.md` 已补六身份循环矩阵 AI 权限行。
- 边界：`roleCycleView` 不新增 persistent ledger，不暴露 raw ledger、provider payload、完整 prompt、本地路径、key、SQLite 物理表行、hidden notes、hidden intent 或其他身份 hidden 信息；非当前身份矩阵只显示待任占位。AI 只能读取当前身份安全摘要并生成 proposal 或草稿，服务器仍裁决考试晋级、官职任免、资源、军务、财赋、地方事务、NPC 行动、经济结果、长期后果和持久化。前端按钮只写本地行动草稿，不调用 turn API。
- 验证：已通过 focused 语法检查、`test/roleCycleView.test.js`（6 项）、React scaffold（38 项）、browser smoke script（44 项）、player-state/start role route（12 项）、resolver input focused tests（9 项）、scene runtime mock（2 项）、city/judicial/military authority focused tests（13 项）、server/client typecheck、`uiState` / `MemorialComposer` focused Vitest（18 项）、完整 client Vitest（68 项）、client build、`npm run smoke:exam-s69`、`AI_PROVIDER=mock npm run smoke:browser`、docs governance、documentation governance、完整 `npm test`（1034 项）和 `git diff --check`（退出码 0；仅打印未改动归档/QA 文件既有 CRLF 提示）。
- 子代理：Sartre 已只读梳理后端/API 接线，建议首片采用派生 `roleCycleView`，不新增 raw ledger，并保持 inactive roles 不泄露跨身份信息；Jason 已只读梳理前端接线，建议六身份面板共用“本旬循环”区块且按钮只写草稿。本轮实现已采纳。Mencius 提交前只读初审未发现代码/API/runtime P0/P1/P2，只指出本文件和共享上下文仍写完整验证待回填的 P2；本轮已修正文档状态，Mencius 复核确认 P2 关闭且未发现新的 P0/P1/P2。
- 提交：实现提交 `8d24534e`；本条哈希回填为低风险纯文档改动，不改代码、API/schema、运行时行为、提示词或验证工具，按项目规则跳过额外子代理复审。
- 下一步：继续 S88.5，把当前 `roleCycleView` 中的事务接入更专门的身份 resolver、跨域后果 refs、地图/NPC/经济入口；或转入 S88.6，把官场链路 refs 扩展到军务、财赋、地方事务、NPC 请求和地图事件入口。

### 2026-05-20：完成 S88.0-S88.1 全面打磨规划与 AI provider 安全 envelope

- 范围：新增 [QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)，把完整书生主线、多身份循环、官场世界后果、AI 世界引擎、NPC/关系、资产经济、React 前端、PixiJS 地图、视觉立绘、后端类型安全和 Mock/真实 provider 验收拆成 S88.1-S88.12；首个实现切片完成 AI remote helper/provider public-safe envelope。
- 实现：新增 `src/ai/providerSafety.js`，统一 provider 错误摘要、诊断文本、connection-test 叙事 preview 和 fallback warning 的脱敏；`src/ai/providers/remoteHelpers.js` 增加 prompt task / requester / task envelope JSDoc 并纳入 `npm run typecheck:server`；`src/contracts/serverContracts.ts` 增加 AI remote task/requester 与 public forbidden field contract，`src/routes/routeResponses.js` 运行时拒绝 AI connection public response 携带 raw provider payload、完整 prompt、请求/响应体、base URL、key、本地路径、`statePatch` 或 `worldState`。
- 安全边界：真实 provider 失败仍只进入 Mock fallback 或安全失败 envelope；服务器继续负责 JSON 校验、proposal boundary、状态裁决和 persistence。为避免通用路径脱敏把敏感本地路径转成可公开占位，`aiControlAudit` 与 `redactedState` 会先按原始文本判定敏感项，命中即丢弃。
- 验证：已通过 `node --test test/routeResponseContracts.test.js test/remoteHelpers.test.js test/modelRoutePolicy.test.js test/aiDiagnostics.test.js test/aiConnectionRoute.test.js test/aiSettingsRoute.test.js test/aiControlAudit.test.js`、`node --test test/redactedState.test.js`、`npm run typecheck:server`、`npm run build:server:probe`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`npm test`（991 项）和 `git diff --check`。
- 子代理：Locke 只读探查了 AI remote helper/provider envelope 边界，Hooke 只读探查了 S88.2 SQLite row builder 类型边界；Confucius 提交前只读复审先发现 raw provider segment、嵌套 forbidden field 和 provider HTTP body 脱敏 P1/P2，主代理已补整段 provider body 脱敏、递归 public envelope guard 与回归测试。最终复审未发现 P0/P1/P2。
- 提交：实现提交 `5c0665ee`。
- 下一步：进入 S88.2，优先固定 `SqliteWorldSessionRow`、prompt retrieval、safe search、repair status 和首批 row builder JSDoc/TS contract，继续保持 SQLite 派生表只从 `world_sessions.world_state_json` 单向修复。

### 2026-05-20：完成 S88.2 SQLite derived row builder 类型边界

- 范围：延续 S86/S87 渐进 TypeScript 路线，固定 SQLite `world_sessions`、`prompt_retrieval_index`、`safe_search_index`、FTS mirror、repair status、maintenance safe diagnostics 的首批 type-only contract 与局部 JSDoc；不改 SQLite schema、不改 row content、不改 repair 事实源。
- 实现：`src/contracts/serverContracts.ts` 新增 `SqlitePromptRetrievalRow`、`SqliteSafeSearchIndexRow`、`SqliteSafeSearchFtsRow`、`SqlitePromptRetrievalRepairStatus`、`SqliteSafeSearchRepairStatus`、`SqliteDerivedPublicDriftStatus`、`SqliteSafeDiagnostics` 等类型，并把 safe-search source literal 收紧为实际的 `server_visible_safe_search_projection`。`src/storage/sqliteSessionAdapter.js` / `sqlitePromptRetrievalTables.js` / `sqliteSafeSearchTables.js` / `sqliteMaintenance.js` 补 JSDoc 与 `@ts-check`，`tsconfig.server-check.json` 显式纳入 prompt retrieval、safe search 和 maintenance。
- 边界：`world_sessions.world_state_json` 仍是 SQLite 模式事实源；prompt retrieval、safe search、maintenance drift/status 只能来自服务器安全 view 与 derived repair status，AI、浏览器、prompt、resolver 仍不得把 raw SQLite 行、audit 表或派生表当作 canonical truth。
- 验证：已通过 `npm run typecheck:server`、`npm run build:server:probe`、`node --test test/sqlitePromptRetrieval.test.js test/sqliteSafeSearch.test.js test/sqliteMaintenanceTool.test.js test/sessionStoreAdapterContract.test.js`（70 项）、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、完整 `npm test`（991 项）和 `git diff --check`。
- 子代理：Noether 只读探查 S88.2 类型边界，建议补 maintenance public drift/status contract、收紧 safe-search source literal，并确认 focused tests；本轮实现已采纳这些建议。Mendel 提交前只读复审最终 diff 与验证证据，未发现 P0/P1/P2。
- 提交：实现提交 `c4a97021`；本条 hash 记录随后一笔文档同步提交补齐。
- 下一步：进入 S88.3 书生主线补强，深化读书、备考、科场反馈、授官与入仕首月差事，并运行 `npm run smoke:exam-s69` 与科举/官场 focused tests。

### 2026-05-20：推进 S88.3 书生主线首月差事切片

- 范围：启动 S88.3 书生主线补强的第一个后端 coherent slice。聚焦 `scholar -> ... -> palace_exam -> official` 的入仕衔接：殿试服务器授官后不再只写官职与履历，还按授官轨迹生成首月官场差事。
- 实现：`src/game/appointmentTracksConfig.js` 新增 `APPOINTMENT_FIRST_MONTH_ASSIGNMENTS`，按一甲翰林、二甲庶吉士、二甲/三甲部曹、三甲外放和候缺观政配置首月任务标题、类型、进度、风险、期限、公开摘要和关联公开关系；`src/game/appointmentTracks.js` 在 `appendOfficialCareerAppointment()` 写入初授履历时同步 seed 一条 `officialCareer.assignments`，期限为一月三旬，`hiddenNotes` 为空，并更新考成 dossier 公开 notes。既有 `officialCareerView` 与 prompt summary 自动显示该差事；兼容 `worldState` 通过 `src/game/clientWorldState.js` 递归剥离嵌套 hidden/raw/provider/prompt/statePatch 字段，`src/routes/routeResponses.js` 也递归拒绝误入 public response 的内部键。
- 边界：首月差事只由服务器授官 resolver 派生；老师、房官、主考、吏部、皇帝或 provider 仍只能提供题目、评分、叙事或受限 proposal，不能写官职、差事、考成、官场结果或 canonical state。前端仍只消费 `officialCareerView` / `appointmentTrackView`，不能裁决首月差事。
- 验证：已通过 `node --check src/game/clientWorldState.js && node --check src/routes/routeResponses.js && node --check src/game/appointmentTracks.js && node --check src/game/appointmentTracksConfig.js && node --check scripts/mockImperialExamAcceptance.js`、`node --test test/appointmentTracks.test.js test/appointmentTracksRoute.test.js test/mockImperialExamAcceptanceScript.test.js test/routeResponseContracts.test.js`、`node --test test/officialCareer.test.js test/gameTurnOfficialCareer.test.js test/playerMonthlyBriefingRoute.test.js`、`node --test test/examTravel.test.js`、`npm run smoke:exam-s69`、`npm run typecheck:server`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、完整 `npm test`（993 项）和 `git diff --check`。
- 子代理：Avicenna 只读梳理 S88.3 后端接线，建议以“殿试授官后自动生成入仕首月差事”为首个 coherent slice；Nash 只读梳理现有测试和 smoke 入口，建议在 `appointmentTracks`、route 和 `smoke:exam-s69` 增加断言。本轮实现已采纳。Beauvoir 提交前只读初审发现兼容 `worldState` 会携带嵌套 `officialCareer.assignments[].hiddenNotes` 字段名的 P2；主代理已补递归清洗、递归 route guard 和回归测试。Beauvoir 最终复审未发现 P0/P1/P2，记录后续可补同一殿试 resolver 重复调用不新增第二条首月差事的专门幂等单测。
- 提交：实现提交 `2568db51`；本条 hash 由后续低风险纯文档提交回填。
- 下一步：继续 S88.3 的读书计划、备考压力、考试入场前后反馈切片，优先把 `entryPreparation` / `examProcedureView` 的压力摘要和书生面板安全提示补强。

### 2026-05-20：推进 S88.3 备考压力与入场反馈切片

- 范围：延续 S88.3 书生主线补强的第二个 coherent slice。聚焦考试取题到入场阶段，让备考状态不再只是费用数字，而是由服务器汇总盘费、路途、保结、准考缺口、学业短板、体力心态和读书计划后形成玩家可理解的压力与入场反馈。
- 实现：新增 `src/game/examPreparationConfig.js`，集中配置备考压力分段、权重、公开文本 caps 和权限边界文案。`src/game/examTravel.js` 在 `entryPreparation` 内派生 `preparationPressure` 与 `entryFeedback`，并提供 public `entryPreparation` sanitizer；`src/game/examProcedure.js` 把压力等级、入场搜检/号舍反馈和高压 incident 纳入安全 `examProcedureView` 与 prompt summary；`src/game/studyProfile.js` 新增 `studyProfileView.examPreparation`，让书生读书画像可看到当前科期压力。`src/game/clientWorldState.js` 会清洗兼容 `worldState` 内 active exam / exam history 的入场准备快照。React `ScholarPanel` 显示备考压力和下一步草稿入口，`ExamPage` 侧栏显示入场阶段、压力原因、建议与流程事件。
- 边界：备考压力、入场反馈、直接 `entryPreparation` public payload、兼容 `worldState` 入场准备快照和流程 incident 都由服务器派生并清洗；老师、房官、主考、吏部、皇帝或 provider 仍只能提供题目、评分、叙事或受限 proposal，不能写压力分数、搜检结果、号舍状态、晋级、榜单、授官或 canonical state。前端只读 `entryPreparation` / `examProcedureView` / `studyProfileView`，行动按钮只写本地草稿。
- 验证：已通过 `node --check src/game/examPreparationConfig.js && node --check src/game/examTravel.js && node --check src/game/examProcedure.js && node --check src/game/studyProfile.js && node --check src/game/clientWorldState.js && node --check src/routes/exam.js && node --check scripts/mockImperialExamAcceptance.js`、`node --test test/studyProfile.test.js test/examTravel.test.js test/examProcedure.test.js`（24 项）、`npm run typecheck:server`、`npm run typecheck:client`、`npm run test:client -- --pool=vmForks --maxWorkers=2 client/src/__tests__/App.test.tsx`、`npm run build:client`、`npm run test:client -- --pool=vmForks --maxWorkers=2`（68 项）、`AI_PROVIDER=mock npm run smoke:browser`、`npm run smoke:exam-s69`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、完整 `npm test`（997 项）和 `git diff --check`；最终提交前只读复核未发现新的 P0/P1/P2。
- 子代理：Nietzsche 只读梳理 S88.3 备考压力后端接线，建议从 `entryPreparation`、`examProcedureView` 与 `studyProfileView` 安全摘要入手；Arendt 只读梳理测试、smoke 和前端接线，建议同步 `ScholarPanel` / `ExamPage` 并运行 client typecheck/test/build/browser smoke。本轮实现已采纳。Halley 提交前只读初审发现两个 P2：真实取题路径没有把 `readiness.missing` 计入备考压力、直接 public `entryPreparation` 缺少污染投影，主代理已改为先计算 readiness 再派生压力，新增 `sanitizeEntryPreparationForView()` 并接入 exam route 与兼容 `worldState` active exam / exam history，同时补 readiness 与污染旧快照回归测试。Carson 后续复审发现 `studyProfileView.examPreparation` 与 `examProcedureView` 流程文本还可能沿用弱清洗 P2，主代理已让两者复用强 `entryPreparation` / 文本 sanitizer，并补 study/profile 与流程污染测试。Copernicus 再复审发现根层/嵌套 `examCalendar` 仍可能保留 raw provider 形态键 P2，主代理已新增 `sanitizeExamPreparationCalendarForView()`、规范化 unsafe key 识别并接入 route / 兼容 `worldState`，补旧快照污染测试。Einstein 最终只读复审发现兼容 `worldState` 根层 `examCalendar` value-level 污染 P2，主代理已让 `buildClientWorldState()` 根层日程复用同一 sanitizer 并补直接单测；Einstein 复核确认该 P2 已修复，未发现新的 P0/P1/P2。
- 提交：实现提交 `49459c98`；本次哈希回填为低风险纯文档维护。
- 下一步：继续 S88.3 的读书计划深化、考试入场后反馈和阅卷/放榜后同年座师过渡；保持完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` smoke 为第一验收入口。

### 2026-05-20：推进 S88.3 阅卷放榜同年座师过渡切片

- 范围：延续 S88.3 书生主线补强的第三个 coherent slice。聚焦交卷、评阅、放榜之后的玩家可理解过渡：榜次、科名、同年、座师/考官和授官轨迹不再散落在多个快照里，而是由服务器整理成皇榜页可直接消费的公开摘要和下一步草稿建议。
- 实现：新增 `src/game/examAftermathConfig.js` 与 `src/game/examAftermath.js`，从 canonical ranking、`examHonor`、`examNetwork`、`appointmentTrack`、成绩和首月差事生成 `examAftermathView`，并在 `examHistory.examAftermath` 中保存清洗快照；`src/routes/exam.js` 与 `src/routes/game.js` 把该 view 纳入考试提交、考试状态和通用安全 route views；`src/game/clientWorldState.js` 清洗兼容 `worldState.player.examHistory` 的旧/新快照；React `RankingPage` 新增“同年座师”区块，只展示服务器公开联系人和摘要，“拟行动”只写入行动草稿，不调用 `/api/game/turn`；S69 Mock 科举 smoke、browser smoke 和皇榜脚手架测试都增加 `examAftermathView` 断言。
- 边界：放榜后过渡只读服务器定榜、科名荣誉、公开同年座师和授官轨迹；AI 与前端不能补名次、造关系、定官职或写 hidden 私档。`examAftermathView` 只暴露清洗文本、有限联系人、公开摘要和草稿建议，兼容 `worldState` 历史快照也走同一 sanitizer。
- 验证：已通过语法检查、`node --test test/examAftermath.test.js test/examHonorsRoute.test.js test/examNetworks.test.js`（6 项）、`npm run typecheck:server`、`npm run typecheck:client`、全量 Vitest（68 项）、`npm run build:client`、`npm run smoke:exam-s69`、`AI_PROVIDER=mock npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`node --test test/reactClientScaffold.test.js`（37 项）、完整 `npm test`（1000 项）和 `git diff --check`；Euclid 初审 P2 修复后已重跑语法检查、focused exam aftermath/honors/network tests（6 项）、`npm run typecheck:server`、docs governance、S69 smoke、完整 `npm test`（1000 项）和 `git diff --check`。
- 子代理：Epicurus 只读梳理放榜后端过渡，建议用独立 server-owned aftermath view 串接榜次、科名、人脉和授官边界；Newton 只读梳理皇榜页与 smoke 接线，建议在 RankingPage 展示公开联系人和草稿按钮、在 client smoke 中断言区块存在。本轮实现已采纳。Euclid 提交前只读初审发现 `examAftermathView` 文本 sanitizer 仍会放过普通 `provider`、`provider payload` 与 `statePatch` 值的 P2；主代理已补 aftermath 专用 unsafe pattern 和污染回归。Euclid 复核确认该 P2 已修复，未发现新的 P0/P1/P2。
- 提交：实现提交 `66153cb7`；本条 hash 由后续低风险纯文档提交回填。
- 下一步：继续 S88.3 的读书计划深化与考试入场后反馈；保持完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` smoke 为第一验收入口。

### 2026-05-20：推进 S88.3 读书计划深化切片

- 范围：延续 S88.3 书生主线补强的第四个 coherent slice。聚焦书生面板与 prompt 中的读书计划：下旬计划不再只是弱项条目和书目，而是由服务器按学业画像生成三旬可执行日课、复盘节点、风险和首课行动。
- 实现：`src/game/studyProfileConfig.js` 新增 `STUDY_PLAN_SCHEMA_VERSION`、三旬复盘周期、强度档位、目标增益、晨午暮日课模板和复盘模板；`src/game/studyProfile.js` 把 `nextPlan` 规范化为 `schemaVersion`、`planningWindow`、`intensity`、`dailyRhythm`、`checkpoints`、`riskNotes`、`nextActions` 和 `authorityBoundary`，并让 `summarizeStudyProfileForPrompt()` 只读取同一安全投影。React `ScholarPanel` 展示计划节奏、当前/目标分、三旬窗口、晨午暮日课、复盘节点、风险和权限边界，新增“执行首课”按钮但只写行动草稿；`scripts/clientSmoke.js`、Vitest fixture 和 React 脚手架测试均增加深度读书计划断言。
- 边界：读书计划仍由服务器按 `studyProfile`、师友关系和科场记录生成；AI 老师只能提交文本建议或点评，不能写 `studyProfile`、属性、保结、准考、科名、榜次、官职或 canonical state。后端 visible text sanitizer 现在拒绝通用 `provider`、`statePatch`、`worldState`、raw/prompt/audit/table、key、本地路径和 SQLite 形态；若整组日课或复盘节点被污染，会回落到服务器默认计划。
- 验证：已通过本文件“本轮 S88.3 读书计划深化切片验证口径”中的语法检查、focused Node tests、server/client typecheck、React focused/scaffold tests、全量 Vitest、client build、browser smoke、完整书生路径 smoke、docs governance、documentation governance、完整 `npm test` 和 `git diff --check`。
- 子代理：Sartre 只读梳理后端/API 接线，建议保持 `nextPlan` 为当前切片的 server-owned safe shape 并补污染回归；Jason 只读梳理前端和验证入口，建议在 `ScholarPanel` 接入日课/复盘/首课草稿并扩展 App fixture、client smoke 和 scaffold 断言。本轮实现已采纳。Sagan 提交前只读初审发现两个 P2：复审状态文档未回填、未跟踪 `npm-start.log` / `npm-start.err.log` 需要明确排除；本轮已回填文档并排除本地日志，Sagan 复核未发现新的 P0/P1/P2。
- 提交：实现提交 `10e4e79f`；本次 hash 回填为低风险纯文档维护。
- 下一步：继续 S88.3 的考试入场后反馈；保持完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` smoke 为第一验收入口。

### 2026-05-20：完成 S88.3 考试入场后反馈切片

- 范围：延续 S88.3 书生主线补强的第五个 coherent slice。聚焦考试取题后的场内推进反馈：入场后不再只显示静态搜检/号舍摘要，而是由服务器随局部科场阶段生成玩家可读的审题、拟纲、草稿、誊清和归档反馈。
- 实现：`src/game/examProcedureConfig.js` 新增 `EXAM_PROCEDURE_PHASE_FEEDBACK` 模板、风险 note cap 和权限边界；`src/game/examProcedure.js` 在 `initialize/advance/complete` 流程中派生 `phaseFeedback`，并把公开摘要、压力标签、行动回声、风险提示和下一步建议纳入 `examProcedureView` 与 prompt capped summary。`src/game/examSceneTime.js` 新增 `sanitizeExamSceneTimeForView()`，`src/routes/exam.js`、`src/game/clientWorldState.js` 会清洗直接 payload、`examScene`、兼容 `worldState.activeExam` 和考试历史里的科场局部时间 / 流程快照。React `ExamPage` 新增“入场后反馈”展示和“拟行动”按钮，按钮只写 `useUiStateStore` 行动草稿，不调用考试推进、交卷或普通回合接口。
- 边界：`phaseFeedback` 只由服务器按 `sceneTime`、流程阶段、备考压力和公开行动摘要派生；AI、前端和 provider 不能写分数、处罚、榜次、晋级、弥封映射、官职或场内 canonical 结果。兼容 `worldState` 递归剥离 hidden/raw/provider/prompt/statePatch 字段，并对旧 `procedure.phaseFeedback`、`sceneTime.lastInput` 的 key/path/provider 污染回落到服务器默认文本。
- 验证：按本文件“本轮 S88.3 考试入场后反馈切片验证口径”执行。
- 子代理：Descartes 只读梳理后端/API 接线，建议把动态反馈放入 server-owned `examProcedureView.phaseFeedback` 而非 `entryPreparation.entryFeedback` 或 `worldTick`；Curie 只读梳理前端与验证入口，建议复用科举页右栏反馈区，并把建议按钮限制为 draft-only。本轮实现已采纳。Descartes 提交前只读复审发现两个 P2：`sceneTime` direct payload 清洗不是白名单重建、`sanitizePhaseFeedback()` 仍信任旧快照干净伪反馈；主代理已改为白名单重建 scene time/date stamp，并让 phase feedback 摘要、风险和建议从 `procedure.phase` 与服务器压力重算。复核又发现旧 `phaseFeedback.phase` 仍可选模板的 P2，已改为只从 `procedure.phase` 派生并补伪造 `closed` 回归；Descartes 最终复核未发现新的 P0/P1/P2。
- 提交：实现提交 `6972b923`。
- 下一步：进入 S88.4 入仕官员首轮官场体验；保持完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` smoke 为第一验收入口。

### 2026-05-20：推进 S88.4 官署首月体验切片

- 范围：启动 S88.4 入仕官员首轮官场体验的第一个 coherent slice。聚焦殿试授官后已 seed 的首月差事，让它在 `officialCareerView`、普通回合反馈、官职月报和 React 官员面板中形成“差遣推进 -> 上官同僚反馈 -> 回署回执 -> 考成风险 -> 月报摘录”的安全闭环。
- 实现：新增 `src/game/officialFirstMonthConfig.js` 与 `src/game/officialFirstMonth.js`，集中配置首月进度/风险档、按差事类型的上官同僚反馈、回署文案、下一步草稿和污染清洗规则；`src/game/officialCareer.js` 新增 `officialCareerView.firstMonthExperience`，普通回合推进首月差事时追加 `[官署回执]` 反馈，并让 prompt summary 只读取 capped 安全摘要；`src/game/playerMonthlyBriefing.js` 会在月末“本职差事 / 上官同僚 / 下月可行”优先摘录首月体验；`src/contracts/serverContracts.ts` 与 `client/src/api/types.ts` 增加 `OfficialFirstMonthExperienceView` / `OfficialCareerView` 类型。React `OfficialMinisterPanel` 新增“官署首月”区块，只读首月体验和月报摘要，按钮只写行动草稿。
- 边界：首月体验只由服务器从公开 `officialCareer.assignments` 与考成簿派生；AI、上官同僚叙事和前端都不能直接写官职、差遣成败、考成、弹劾、月报账本或 hidden 私档。`officialCareer` 公开文本清洗拒绝 provider/proposal/prompt/raw/statePatch/worldState/key/path/SQLite 形态污染，`hiddenNotes` 仍不得进入 route view、prompt summary、月报或浏览器。
- 验证：已按本文件“本轮 S88.4 官署首月体验切片验证口径”完成语法检查、focused Node tests（P1 修复后 26 项）、server/client typecheck、React App focused tests（36 项）、React scaffold tests（37 项）、全量 Vitest（68 项）、client build、`npm run smoke:exam-s69`、`AI_PROVIDER=mock npm run smoke:browser`、docs governance、documentation governance、完整 `npm test`（1006 项）和 `git diff --check`；Hypatia 提交前复核未发现新的 P0/P1/P2。
- 子代理：Hypatia 只读梳理后端接线，建议以“首月差事推进与官署回执安全 view”为 S88.4 首个切片，并指出 `officialCareer` 公开文本污染测试缺口；本轮已采纳。提交前只读复审发现非翰林首月差事草稿不能推进并生成 `[官署回执]` 的 P1，主代理已让 `classifyOfficialAction()` 在通用考成/奏疏规则前覆盖馆课、清册、观政日课、册籍民情等首月标题关键词，并补全所有 `APPOINTMENT_FIRST_MONTH_ASSIGNMENTS` 模板的推进回归测试；Hypatia 复核确认 P1 已关闭，未发现新的 P0/P1/P2。
- 提交：实现提交 `bafbdce1`。提交哈希回填为低风险纯文档记录，按项目规则跳过额外子代理复审。
- 下一步：继续 S88.4 的奏折/朝议入口与长期考成闭环；保持完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` smoke 为第一验收入口。

### 2026-05-20：推进 S88.4 奏折朝议入口与长期考成追踪切片

- 范围：延续 S88.4 入仕官员首轮官场体验的第二个 coherent slice。聚焦首月回署回执之后的玩家下一步，让官署首月材料进入奏折队列、朝议筹议、`topic_draft` 拟稿和长期考成 trace，但暂不在本切片裁决草稿采纳、朝议结论或考成结果。
- 实现：新增 `src/game/officialCourtEntryConfig.js` 与 `src/game/officialCourtEntry.js`，从服务器已有 `officialCareerView.firstMonthExperience`、回署回执和 `assessmentDossier` 派生 `officialCareerView.courtEntry` / `courtEntries`，包含 sourceRefs、targetSurfaces、memorial/court draft metadata、assessmentTrace、上官同僚后续回响、nextActions 和权限边界。`src/game/officialCareer.js` 将该 view 纳入玩家安全视图和 prompt summary；`src/game/resolverInputConfig.js` 与 `src/game/topicSurfaceView.js` 允许 `memorial-review`、`edict-draft`、`court-debate` 读取 `officialCareerView.courtEntries`，并增加“首月回署 / 首月筹议”草稿模板。`src/contracts/serverContracts.ts`、`client/src/api/types.ts`、React `OfficialMinisterPanel` 和 `scripts/clientSmoke.js` 已同步新字段、面板文案和 smoke 断言。
- 边界：`courtEntry` / `courtEntries` 只从服务器安全 view 派生，文本复用官署首月强清洗；`topic_draft` 只能引用 evidence 拟标题、正文、风险和下一步，不提交回合、不调用 resolver、不推进时间、不写 `officialCareer`、考成簿、弹劾程序、SQLite 或审计表。前端按钮只写底部奏折草稿，奏折采纳、朝议结论、任免奖惩和长期考成仍留给后续普通回合服务器裁决。
- 验证：已完成语法检查、official/topic-surface/topic-draft/monthly focused Node tests、server/client typecheck、React App focused tests（36 项）、React scaffold tests（37 项）、全量 Vitest（68 项）、client build、`npm run smoke:exam-s69`、`AI_PROVIDER=mock npm run smoke:browser`、docs governance、documentation governance、完整 `npm test`（1009 项）和 `git diff --check`。
- 子代理：Chandrasekhar 只读梳理奏折/朝议与考成追踪接线，建议把首月回署材料做成 `officialCareerView` 内的结构化 evidence，而不是让前端或 topic draft 直接拼 raw 首月文本；本轮实现已采纳。提交前只读复审发现裸 SQLite/SQL/rawSql 污染与官场考成/弹劾成案话术两个 P2，主代理已补强首月文本清洗、topic draft 结果宣称拦截和回归测试；Chandrasekhar 最终复核确认 P2 已关闭，未发现新的 P0/P1/P2。
- 提交：实现提交 `345d134d`。本次哈希与复审状态回填为低风险纯文档维护。
- 下一步：继续 S88.4 的草稿提交后服务器裁决闭环，普通回合识别首月回署奏折/朝议行动后，写入采纳/驳回/转部/留中/补查记录、事件档案、月报和长期考成后果。

### 2026-05-20：推进 S88.4 首月回署草稿服务器裁决闭环

- 范围：延续 S88.4 入仕官员首轮官场体验的第三个 coherent slice。聚焦玩家把“首月回署”草稿真正呈入普通回合后的服务器处理：奏折队列、朝议筹议和考成追踪不再只停留在 draft-only evidence，而是形成公开、可审查、受限后果记录。
- 实现：`src/game/officialCourtEntryConfig.js` / `src/game/officialCourtEntry.js` 新增裁决状态、记录归一化、普通回合提交识别和结果生成，覆盖准入复核、转部核议、留中补查、驳回补据、续入考成。`src/game/officialCareer.js` 新增 `courtEntryResolutions` server-owned ledger，在 `runOfficialCareerStep()` 中识别“入奏折队列 / 付朝议筹议 / 续记考成”文本，写入近次 `officialCareerView.courtEntry.latestResolution`、受限 assignment progress / risk 和考成 notes；`src/game/eventArchive.js` 新增 `official_court_entry` 公开归档，`src/game/playerMonthlyBriefing.js` 会把近次裁决纳入月报本职差事和下月可行。`src/contracts/serverContracts.ts`、`client/src/api/types.ts` 与 React `OfficialMinisterPanel` 已显示近次裁决；后端/前端测试覆盖所有授官首月模板的奏折/朝议提交。
- 边界：`topic_draft` 和专题 surface 仍只读 evidence、只产草稿；普通 provider 和前端不能写 `courtEntryResolutions`，不能直接任免、奖惩、处分、成弹劾、结案或写隐藏状态。裁决只记录公开处理状态、微量考成/进度影响和下一步，长期任免、弹劾、处分、朝议采纳与世界后果仍留给后续服务器规则。
- 验证：当前已通过语法检查、`node --test test/officialCareer.test.js`（13 项）、`test/gameTurnOfficialCareer.test.js`（9 项）、`test/playerMonthlyBriefing.test.js`（6 项）、topic/event archive focused tests（27 项）、`npm run typecheck:server`、`npm run typecheck:client`、React App focused tests（36 项）、全量 Vitest（68 项）、`npm run build:client`、`npm run smoke:exam-s69`、`AI_PROVIDER=mock npm run smoke:browser`、docs governance、documentation governance、完整 `npm test`（1013 项）和 `git diff --check`。实现提交 `8b678834`。
- 子代理：Newton 只读探查普通回合挂点，建议把提交裁决挂在 `runOfficialCareerStep()`，保持 `topic_draft` / topic surface 只读拟稿，并补所有授官首月模板、事件档案和月报回归；本轮实现已采纳。Chandrasekhar 提交前只读初审发现 `续记考成` 后端分支缺少前端入口、`targetSurfaceId` 与 `assessment-trace` 不一致且测试未覆盖的 P2；主代理已让第三个草稿按钮可见、把 action metadata 改为 `assessment-trace`，并扩展所有授官首月模板的 `track-assessment` 回归测试。Gauss 最终只读复核确认该 P2 已关闭，未发现新的 P0/P1/P2。
- 下一步：继续 S88.4 的多 actor 朝议、皇帝/部院批复、更长期官场世界后果和跨身份奏折回应闭环。

### 2026-05-20：推进 S88.4 朝议/部院/御前跟进切片

- 范围：延续 S88.4 入仕官员首轮官场体验的第四个 coherent slice。聚焦首月回署裁决之后的“首轮官场反馈”延展：朝议、部院、御前和考成观察可以继续经普通回合形成中间批复和世界议题线索，但仍不在本切片产生任免、奖惩、处分、弹劾成案或奏折终局采纳。
- 实现：`src/game/officialCourtEntryConfig.js` 新增跟进 schema version、stage/status 枚举、AI read scope、tool permissions、server adjudication 边界和跟进数量上限；`src/game/officialCourtEntry.js` 新增 `resolveOfficialCourtEntryFollowUpSubmission()`、跟进归一化、参与 actor 摘要、场景 preview 和 draft-only next actions。`src/game/officialCareer.js` 新增 `courtEntryFollowUps` ledger，在 `runOfficialCareerStep()` 中优先识别“朝议跟进 / 部院覆奏 / 御前摘报 / 考成观察”，写入 `latestFollowUp`、受限差事 progress/risk 和考成 notes；`src/game/eventArchive.js`、`src/game/playerMonthlyBriefing.js`、`src/game/resolverInputConfig.js` 和 `src/game/worldThreads.js` 已同步事件档案 `official_court_follow_up`、月报、topic evidence 和 world thread 线索。`src/contracts/serverContracts.ts`、`client/src/api/types.ts` 与 React `OfficialMinisterPanel` 已显示跟进 stage/status、参与者和草稿按钮。
- 边界：跟进只从服务器已有 `courtEntry` / `courtEntryResolutions` 与公开官场 view 派生；AI read scope 只含 `officialCareerView.courtEntry`、`courtEntries`、事件档案、月报、任所和公开 actor memory。工具权限仅允许读取与 proposal，不允许内部查询、持久化写入、写状态、写任免、写处分、写弹劾或把工具调用伪装成已发生事实。跟进批复只记录中间公开反馈、参与 actor 摘要和微量进度/考成影响；长期任免、弹劾、处分、奏折采纳和世界后果仍留给后续服务器规则。
- 验证：已按本文件“本轮 S88.4 朝议/部院/御前跟进切片验证口径”完成语法检查、official/game-turn focused tests（24 项）、monthly/event/world-thread focused tests（23 项）、topic focused tests（17 项）、React scaffold tests（37 项）、server/client typecheck、React App focused tests（36 项）、全量 Vitest（68 项）、client build、`npm run smoke:exam-s69`、`AI_PROVIDER=mock npm run smoke:browser`、docs governance、documentation governance、完整 `npm test`（1015 项）和 `git diff --check`。
- 子代理：Helmholtz 只读梳理前端/API/test 接线，建议把 `actorFollowUps` / `bureauReplies` / 御前摘报折入 server-owned `officialCareerView.courtEntry`，前端只保留 draft-only 按钮，并避免调用 `/api/game/turn`；Ohm 只读梳理后端场景/runtime，建议不用 generic `sceneRuntime.resolveSceneOutcome()` 直接裁决官场 follow-up，而是新增官场专用 follow-up adjudicator、事件档案来源和 world thread 派生。本轮实现已采纳。Dalton 提交前只读初审发现两个问题：`bureau-reply` 文案可被 generic official action 重复推进的 P1，以及 public follow-up view 默认权限文本携带“数据库查询”的 P2。主代理已把 follow-up submission 识别提前到 generic action 分类之前，补 `bureau-reply` 不得再产生 `[官场差遣]` / `[官署回执]` 的回归断言，并把公开权限文本改为不含数据库/写库话术；Dalton 最终只读复核确认 P1/P2 已关闭，未发现新的 P0/P1/P2。
- 提交：实现提交 `2eabfcb2`。提交哈希回填为低风险纯文档记录，不改代码、API/schema、运行时行为、提示词或验证工具；按项目规则跳过额外子代理复审。
- 下一步：继续 S88.4 的跨身份奏折回应、皇帝/部院更长链路、朝议后续世界后果与长期考成/弹劾风险联动；保持完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` smoke 为第一验收入口。

### 2026-05-20：推进 S88.4 跨身份奏议回应切片

- 范围：延续 S88.4 入仕官员首轮官场体验的第五个 coherent slice。聚焦首月奏议、朝议/部院/御前跟进之后的跨身份回应入口：皇帝、大臣、官员或有司可以围绕公开奏议写入受限回应，但仍不在本切片产生任免、奖惩、处分、拨钱粮、采纳奏折或弹劾终局。
- 实现：新增 `src/game/officialCourtResponseConfig.js` 与 `src/game/officialCourtResponse.js`，建立独立 server-owned `worldState.officialCourtResponses` 账本、`courtResponseView` 安全投影、回应角色/类型/状态枚举、AI read scope、工具权限、proposal 边界和 server adjudication 文案；`src/game/stateRules.js` 允许服务器写该账本，`src/game/clientWorldState.js`、`src/routes/routeResponses.js` 和 `src/contracts/serverContracts.ts` 将 raw ledger 从兼容 public `worldState` 剥离。`src/routes/game.js` 在普通回合中先运行 `runOfficialCourtResponseStep()`，再运行 `roleWorldCoupling`；`src/game/roleWorldCoupling.js` 对朱批、票拟覆奏、补据、御前摘报、朝议跟进和考成观察类输入跳过 generic 任免/弹劾联动。`src/game/eventArchive.js`、`src/game/worldThreads.js`、`src/game/resolverInputConfig.js`、`src/game/resolverInputContext.js` 和 `src/game/topicSurfaceView.js` 已同步 `official_court_response` 事件档案、世界议题和 topic evidence；`src/routes/exam.js`、server/client API types、React `EmperorPanel` 与 `OfficialMinisterPanel` 已接入 `courtResponseView`。
- AI/权限：AI 只能读取 `courtResponseView.responseItems` / `recentResponses`、事件档案、`worldThreadView` 和公开官署 view，生成朱批留览、票拟覆奏、补据清单、朝议回应或考成观察草稿；不能调用任免、处分、成弹劾、财政、军事、内部查询、持久化写入或内部状态工具。`topicSurfaceView` 和浏览器按钮仍只写草稿；普通回合服务器只写 `[奏议回应记录]` 和受限 `official_court_response` 中间态。
- 验证：已按本文件“本轮 S88.4 跨身份奏议回应切片验证口径”完成完整验证：语法检查、`test/officialCourtResponse.test.js`、topic/worldThread/official focused tests、event/topicDraft focused tests、role-world/world-thread route tests、React scaffold、server/client typecheck、React App focused test、client build、全量 Vitest（68 项）、`npm run smoke:exam-s69`、`AI_PROVIDER=mock npm run smoke:browser`、docs governance、documentation governance、完整 `npm test`（1020 项）和 `git diff --check`；diff check 退出码 0，仅打印未改动归档/QA 文件既有 CRLF 提示。自检已补 `official_court_response` 事件/议程 read scope，并避免裸“部院”误判为奏议回应导致大臣/官员 generic 身份联动被跳过。Kepler 初审 P2 已补终局污染拦截，覆盖准奏、照准、题准、奉旨准行、革职、拨给钱粮等旧账本文案；Kepler 复核确认 P2 已关闭，未发现新的 P0/P1/P2。
- 子代理：Kepler 只读梳理后端，建议独立 `courtResponseView` / response ledger，不让 emperor/minister 直接依赖 inactive `officialCareerView`；Helmholtz 只读梳理前端与 topic surface，建议在 `EmperorPanel` 和 `OfficialMinisterPanel` 增加 draft-only 回应入口。本轮均已采纳。Kepler 提交前只读初审发现终局裁决文案过滤偏窄 P2；已扩展跨身份回应 sanitizer 并新增回归，Kepler 复核确认 P2 已关闭，未发现新的 P0/P1/P2。
- 提交：`37a0c4d5`。
- 提交哈希回填为低风险纯文档记录，不改代码、API/schema、运行时行为、提示词或验证工具；按项目规则跳过额外子代理复审。
- 下一步：继续 S88.4 的更长期官场世界后果、皇帝/部院长链路与长期考成/弹劾风险联动；保持完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` smoke 为第一验收入口。

### 2026-05-21：推进 S88.4 长期官场后果信号切片

- 范围：延续 S88.4 入仕官员首轮官场体验的第六个 coherent slice。聚焦奏议裁决、朝议/部院/御前跟进和跨身份回应之后的长期余波：服务器可形成证据缺口、考成压力、风宪关注、功绩留痕或朝局余波信号，但仍不在本切片直接决定任免、奖惩、处分、财赋动用、奏议终局或风宪定案。
- 实现：新增 `src/game/officialCourtConsequencesConfig.js` 与 `src/game/officialCourtConsequences.js`，建立 server-owned `worldState.officialCourtConsequences` 账本、`courtConsequenceView` 安全投影、信号类型/状态枚举、AI read scope、工具权限、proposal 边界、server adjudication 文案和清洗规则。`src/routes/game.js` 在普通回合/月末运行 `runOfficialCourtConsequenceStep()`，从公开 `courtEntryResolutions`、`courtEntryFollowUps` 与 `officialCourtResponses` 派生 `[官场后果信号]`；兼容 public `worldState` 剥离 raw ledger。`eventArchive`、`worldThreads`、`playerMonthlyBriefing`、`resolverInputConfig`、`resolverInputContext` 和 `topicSurfaceView` 已接入 `official_court_consequence`、月报、world thread 与 topic evidence；`src/contracts/serverContracts.ts`、`client/src/api/types.ts`、React `OfficialMinisterPanel` 与 `EmperorPanel` 已接入 `courtConsequenceView`。
- AI/权限：AI 只能读取 `courtConsequenceView.pendingSources` / `recentSignals`、事件档案、`worldThreadView`、月报和公开奏议 refs，生成补证、考成观察、风宪关注、月报摘录或世界议程草稿；不能调用任免、处分、财赋、奏议终局、风宪定案、内部查询、持久化写入或内部状态工具。浏览器按钮仍只写本地行动草稿；普通回合服务器只写受限 `official_court_consequence` 中间态和 bounded career dossier note。
- 验证：已按本文件“本轮 S88.4 长期官场后果信号切片验证口径”完成语法检查、official/court-response/event/world-thread/monthly focused Node tests（32 项）、React scaffold tests（37 项）、server/client typecheck、全量 Vitest（68 项）、client build、`npm run smoke:exam-s69`、`AI_PROVIDER=mock npm run smoke:browser`、docs governance、documentation governance、完整 `npm test`（1024 项）和 `git diff --check`；diff check 退出码 0，仅打印未改动归档/QA 文件既有 CRLF 提示。
- 子代理：Kepler 只读梳理后端，建议独立 `officialCourtConsequences` 账本与 `courtConsequenceView`，并提醒长期信号不得放大为终局任免/弹劾结果；Ohm 只读梳理前端，建议把长期后果放在官员“考成与弹劾”和皇帝“赏罚预留”，按钮保持 draft-only。本轮实现已采纳。Kepler 提交前只读复审未发现 P0/P1/P2，建议后续补连续月末不重复同一 source 与旧存档 raw consequence 污染全链路过滤回归。
- 提交：实现提交 `09f9f83b`。本次哈希回填为低风险纯文档维护，不改代码、API/schema、运行时行为、提示词或验证工具；按项目规则跳过额外子代理复审。
- 下一步：继续 S88.4 皇帝/部院更长链路，随后进入 S88.5 六身份循环矩阵或 S88.6 跨域后果 refs；保持完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` smoke 为第一验收入口。

### 2026-05-21：推进 S88.4 皇帝/部院续办链路切片

- 范围：延续 S88.4 入仕官员首轮官场体验的第七个 coherent slice。聚焦长期后果信号之前仍需连续处理的皇帝/部院链路：上一轮朱批、票拟覆奏、补据或朝议回应可成为下一轮御前再摘、部院再覆、补据承批或考成续记来源，但仍不在本切片直接产生任免、奖惩、处分、拨款、采纳奏折、弹劾成案或持久化 hidden 事实。
- 实现：`src/game/officialCourtResponseConfig.js` / `src/game/officialCourtResponse.js` 升级到 `s88.4-official-court-response.v2`，新增 `courtResponseView.chainItems`，并在 `officialCourtResponses.responses` 归一化 `chainId`、`previousResponseId`、`sourceResponseId`、`chainRound`、`chainStageLabel`、`nextHandlerRole`、`nextHandlerLabel` 和 `chainPath`。普通回合带“续办 / 承前 / 御前再摘 / 部院再覆 / 补据承批”等意图时，优先匹配上一轮 `official_court_response`，只追加新的 `[奏议回应记录]` 中间态。`resolverInputConfig` 允许 topic surface 读取 `courtResponseView.chainItems`，`worldThreads` 优先把续办链路转为 `official_court_response` 议程线索，`src/contracts/serverContracts.ts`、`client/src/api/types.ts`、React `EmperorPanel` 和 `OfficialMinisterPanel` 已同步 chain view。
- AI/权限：AI read scope 只扩展到 `courtResponseView.chainItems`、`responseItems`、`recentResponses`、事件档案和公开议程；工具权限仍禁止任免、处分、成弹劾、财政、军事、内部查询、持久化写入或内部状态工具。浏览器只显示安全链路摘要和草稿按钮，public `worldState` 继续剥离 raw `officialCourtResponses`，topic evidence 与 prompt context 不读取 raw ledger、provider payload、完整 prompt、本地路径、key、hidden notes 或 hidden intent。
- 验证：已通过语法检查、`node --test test/officialCourtResponse.test.js test/worldThreads.test.js test/officialCourtConsequences.test.js test/eventArchive.test.js test/playerMonthlyBriefing.test.js`（35 项）、React scaffold tests（37 项）、`npm run typecheck:server`、`npm run typecheck:client`、全量 Vitest（68 项）、`npm run build:client`、`npm run smoke:exam-s69`、`AI_PROVIDER=mock npm run smoke:browser`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、完整 `npm test`（1027 项）和 `git diff --check`；diff check 退出码 0，仅打印未改动归档/QA 文件既有 CRLF 提示。Kepler 提交前只读初审发现 public evidence 暴露 raw `officialCourtResponses.response:*` namespace 与 `nextHandlerRole` 只展示不裁决两个 P2；主代理已改用 `courtResponseView.recentResponse:*` public ref、按 `nextHandlerRole === responseRole` 限制可提交续办链路并补回归，Kepler 复核确认 P2 已关闭，未发现新的 P0/P1/P2。后续可选补一条 minister 经 `/api/game/turn` 误续办不新增回应的 route 层回归。
- 提交：实现提交 `fb2be42d`。本次哈希回填为低风险纯文档维护，不改代码、API/schema、运行时行为、提示词或验证工具；按项目规则跳过额外子代理复审。
- 下一步：进入 S88.5 六身份循环矩阵，或先做 S88.6 跨域后果 refs，把官场链路 refs 扩展到军务、财赋、地方事务、NPC 请求和地图事件入口；保持完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` smoke 为第一验收入口。

### 2026-05-20：完成 S87.1-S87.7 route/API 响应类型覆盖

- 范围：完成 S87.1-S87.7，新增 [TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md)，扩展 `src/contracts/serverContracts.ts` 的 game/exam/AI/inventory/NPC/trade/delegation public response contract，并让 `serverContracts.typecheck.ts` 断言 start/state/turn/exam response 的 `worldState` 拒绝 raw ledger key。
- 实现：新增 `src/routes/routeResponses.js` 局部 `@ts-check` response helper，接入 `src/routes/game.js`、`src/routes/exam.js` 和 `src/routes/ai.js`；`buildCommonTurnViews`、start/saves/state/player-state/turn/SSE、inventory/NPC/trade/delegation、exam question/progress/submit、AI connection-test/settings/quick-actions/topic-draft 都有对应 public response helper。helper 运行时拒绝 public `worldState` 出现 `actorMemoryLedger`、`sessionSummary`、资产/背包/NPC/交易/委派/经济/主动来函等 raw ledger key。
- 边界：未对 `src/routes/game.js`、`src/routes/exam.js` 或 `src/routes/ai.js` 启用 whole-file `@ts-check`，未改变 `npm start` CommonJS 运行方式，未放宽安全 projection、raw ledger 剥离、Ajv/runtime 校验或服务器裁决。AI settings POST 继续保留现有兼容 `settings` / `routePolicy` 字段，但 contract 明确为 public-safe response；前端仍应优先依赖 `aiSettingsView` / `aiInvocationSummaryView` / `aiControlAuditView`。
- 验证：已通过 `node --check src/routes/game.js`、`node --check src/routes/exam.js`、`node --check src/routes/ai.js`、`node --check src/routes/routeResponses.js`、`npm run typecheck:server`、`npm run build:server:probe`、`npm run typecheck:client`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`node --test test/routeResponseContracts.test.js test/gamePlayerStateRoute.test.js test/gameSavesRoute.test.js test/npcInventoryRoutes.test.js test/quickActionRoute.test.js test/topicDraftRoute.test.js test/aiSettingsRoute.test.js`、`node --test test/examTravel.test.js test/mapRuntimeRoute.test.js test/streamingTurnRoute.test.js test/actorMemoryRoute.test.js`、`node --test test/aiControlRedTeam.test.js test/examHonorsRoute.test.js test/appointmentTracksRoute.test.js test/gameSavesRoute.test.js test/safeWorldSearch.test.js test/topicSurfaceView.test.js`、`npm test`（985 项）和 `git diff --check`。
- 子代理：Einstein 提交前只读复审未发现 P0/P1；指出 1 个 P2（`GET /api/game/saves` 未接 `SavesResponse` helper）和 1 个 player-state 类型负例缺口。主代理已补 `defineSavesResponse`、接入 saves route，并让 `PlayerVisibleState` / typecheck fixture 明确拒绝 raw ledger key；修复后 focused tests、typecheck 和完整 `npm test` 已重新通过。
- 下一步：建议开新专项覆盖 AI remote helper payload 与 SQLite derived build row 类型边界，继续使用 contract / 局部 helper / focused tests 的渐进方式，不一次性重写稳定 CommonJS 模块。

### 2026-05-20：新增 S87 route/API 响应类型覆盖规划

- 范围：按用户要求新增 [TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ROADMAP.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ROADMAP.md)，把后端 TypeScript 下一轮拆为 S87.1-S87.7：route response contract、`buildCommonTurnViews`、start/state/player-state/turn、inventory/NPC/trade/delegation、exam route、AI route 和验收归档。
- 决策：后续开发是否使用 TypeScript 已写入稳定开发规范。后端契约/API/view/safe projection/AI/storage/resolver 新增或重构时优先使用 TS 或纳入 TS 检查；route/API response shape 新增或重构时必须对齐 `src/contracts/serverContracts.ts` 或局部 JSDoc typedef，并运行 `npm run typecheck:server`。
- 边界：S87 不做大型 route `.js -> .ts` 迁移，不对 `src/routes/game.js` 这类高耦合文件一次性 whole-file `@ts-check`，不改变 `npm start` 的 CommonJS 运行方式，不放宽安全 projection、raw ledger 剥离、Ajv/runtime 校验或服务器裁决。
- 同步：已同步 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 受保护段落、本文件、brief、README、AGENTS/CLAUDE 和共享上下文；因修改治理检查脚本，本轮按非纯低风险文档处理，提交前执行只读复审。
- 验证：本轮已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`npm run typecheck:server`、`npm test`（983 项）和 `git diff --check`。
- 子代理：Lagrange 提交前只读复审未发现 P0/P1；发现 2 个 P2，分别是治理脚本未把 `npm run typecheck:server` 作为 route response 新规则守门 needle、共享上下文/台账仍保留复审待回填占位。主代理已补 `scripts/checkGovernanceDocs.js` 的 `npm run typecheck:server` 检查，并将复审结果回填到本条和共享上下文；Lagrange 复核确认 2 个 P2 均已解决，未发现新的 P0/P1/P2。
- 提交：随本轮 coherent change 提交，最终 hash 见 Git 历史和本次回复。

### 2026-05-20：完成 S86.1-S86.7 后端 TypeScript 渐进迁移首轮

- 范围：完成 S86.1-S86.7，新增 `typecheck:server`、`build:server:probe`、后端检查 tsconfig、server probe tsconfig、`src/contracts/serverContracts.ts`、`src/contracts/runtimeGuards.ts` 和 [TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md](TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md)。
- 类型覆盖：`clientWorldState`、`redactedState`、`stateRules`、`src/ai/index.js`、`modelRoutePolicy`、`sessionRecord`、`sessionStore`、JSON adapter 和 SQLite adapter 已选择性 `@ts-check`；contract 固化 raw ledger 剥离、player-state envelope、安全 route views、AI task/provider/tool envelope、session record、storage adapter 和 SQLite row 形状。
- 运行边界：`npm start` 仍直接运行 `server.js` / CommonJS；`.ts` 试点只用于 type-only contract、纯 guard/helper 和 probe 编译，不让生产 runtime 直接 require `.ts`。`.tmp/` 已加入 Git 忽略，probe 输出不入库。
- Rust：继续不进入核心玩法、Express routes、AI 编排、resolver、科举晋级、交易/婚姻/弹劾结果或 canonical persistence；只有可选 CLI/WASM/离线工具并有 profiling 证据时再评估。
- 验证：本轮已通过 `npm run typecheck:server`、`npm run build:server:probe`、`node --test test/redactedState.test.js test/gamePlayerStateRoute.test.js test/stateRules.test.js`、`node --test test/aiSchemas.test.js test/remoteHelpers.test.js test/modelRoutePolicy.test.js test/aiToolProtocolContract.test.js`、`node --test test/sessionStoreAdapterContract.test.js test/sqliteNpcInventoryTables.test.js test/sqliteNpcInventoryAdapterIntegration.test.js`（56 项）、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`npm test`（983 项）和本轮改动路径 `git diff --check`。
- 子代理：Hypatia、Socrates、Lorentz 已分别只读盘点 S86.3/S86.4/S86.5 风险点、推荐类型和 focused 验证命令；Sartre 提交前只读复审发现 3 个 P2，主代理已补 raw ledger 类型拒绝 fixture、SafeRouteViews 字段和 storage adapter audit surface；Bohr 复看发现 `searchSafeSearchIndex` optional 签名 P2，已修正为 `(sessionId, options?)` 并复验，最终未发现 P0/P1/P2。
- 提交：实现提交 `bedea92a`；本条 hash 记录随后一笔文档同步提交补齐。

### 2026-05-20：新增 S86 后端 TypeScript 渐进迁移规划

- 范围：按用户要求新增 [TYPESCRIPT_BACKEND_MIGRATION_ROADMAP.md](TYPESCRIPT_BACKEND_MIGRATION_ROADMAP.md)，规划 S86 后端 TypeScript 渐进迁移与 Rust 使用边界；活动路线图第 4 节新增 S86.1-S86.7 TODO 小步骤。
- 决策：后端需要进入 TypeScript 迁移，但不做全仓重写；优先覆盖契约、API/view 类型、安全 projection、AI schema/provider facade、storage adapter 和核心 resolver。既有 JavaScript 允许渐进迁移，新增或重构高风险后端边界应优先使用 TypeScript 或纳入 TypeScript 检查。
- Rust：当前不重写核心玩法、Express routes、AI 编排、resolver 或存档系统；只有在有 profiling 证据、可隔离为可选 CLI/WASM/离线工具且不破坏 `npm install && npm start` 时再评估。
- 开发规范：已把 TypeScript 渐进迁移原则写入 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 受保护段落，并同步本文件受保护段落、brief、README、AGENTS/CLAUDE 和共享上下文；因修改治理检查脚本，本轮按非纯低风险文档处理，提交前执行只读复审。
- 验证：本轮已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`npm test`（983 项）和 `git diff --check`。
- 子代理：Dalton 提交前只读复审未发现 P0/P1；唯一 P2 是本地未跟踪 `npm-start.log` / `npm-start.err.log` 不属于本轮范围，提交时需排除。
- 提交：随本轮 coherent change 提交，最终 hash 见 Git 历史和本次回复。

### 2026-05-20：清理活动路线图 DONE 长表

- 范围：按用户指出的问题，移除第 4 节“活动路线图总览”中 S81-S85、S79、S80 和文档维护类 DONE 长表；该节现在只记录当前没有 `TODO` / `IN_PROGRESS` 专项、S81-S85 已归档和下一步应由用户或新路线图指定。
- 口径：已完成步骤不再保留在活动路线图表格中；追溯入口改为顶部归档索引、专题归档、近期进度记录和 Git history。新专项启动后，第 4 节只放未开始、进行中或阻塞的小步骤，完成后再迁出。
- 边界：纯文档维护，不改运行时代码、后端 API、provider schema、SQLite schema、存档格式、AI 权限、素材 manifest、服务器 resolver、canonical state、README 或产品行为。
- 子代理：低风险纯文档改动，按项目规则跳过提交前子代理复审；已在共享上下文记录。
- 验证：本轮通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
- 提交：随本轮 coherent docs change 提交，最终 hash 见 Git 历史和本次回复。

### 2026-05-20：再压缩已完成活动台账归档

- 范围：按用户要求把 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md) 从约 98 KB 的旧活动台账复制件压缩为短索引，移除重复治理段落、S73-S77 长表和逐日实现流水，只保留完成阶段索引、S73-S78 压缩锚点、验证锚点、稳定边界和后续维护规则。
- 同步：本文件顶部追溯口径改为“压缩索引”，路线图表新增 `DOCS-LEDGER-ARCHIVE-COMPRESSION` 完成项；`docs/SHARED_CONTEXT.md` 记录本次纯文档维护、跳过子代理复审和验证结果。
- 边界：纯文档维护，不改运行时代码、后端 API、provider schema、SQLite schema、存档格式、AI 权限、素材 manifest、服务器 resolver、canonical state、README 或产品行为。
- 子代理：低风险纯文档改动，按项目规则跳过提交前子代理复审；已在共享上下文记录。
- 验证：本轮通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
- 提交：随本轮 coherent docs change 提交，最终 hash 见 Git 历史和本次回复。

### 2026-05-20：完成 S85.3-S85.6 NPC 主动性、礼法扩展位、总验收与归档

- 范围：完成 NPC 私人目标与主动请求、论道/切磋/求爱/婚姻正式扩展位、S81-S85 聚焦总验收和专项归档。新增 [NPC_INVENTORY_SYSTEM_ARCHIVE.md](NPC_INVENTORY_SYSTEM_ARCHIVE.md)，并同步契约、brief、README、共享上下文、活动台账和 AI 权限矩阵。
- 后端：新增 `npcActiveRequestsConfig.js`、`npcActiveRequests.js`、`npcRelationshipActionsConfig.js` 和 `npcRelationshipActions.js`。普通回合在经济 tick 后运行 NPC 私人 planner 和主动请求 step；`npcActiveRequestView` 进入 turn、SSE、考试和 player-state；raw `npcActiveRequestLedger` 被 `clientWorldState`、`redactedState` 和 stateRules 保护。NPC 交互 route 对 `debate | duel | courtship | marriage` 调用服务器 eligibility/resolver，忽略客户端伪造胜负、伤势、银钱、配偶、关系 delta 和 state patch。
- AI 与存储：`npc_private_planner` schema、prompt pack 和 Mock provider 已输出 requestType、requestedAction、targetRefs 和 serverAdjudicationHint；AI 只提出主动请求意图，不裁决资源、婚姻、弹劾、背叛或任务结果。SQLite 新增 `npc_active_requests` 安全派生表，只保存安全摘要、refs 和 content hash。
- 前端：人物页新增主动来函 inbox 和“礼法”tab；来函回应只写入主卷行动草稿，礼法 tab 只读取 `relationshipActionEligibilityView` 并提交服务器交互请求。主卷安全视图索引加入“来函”，route flags 从 `9 / 9` 扩展为 `10 / 10`。
- 验证：已通过本文件“本轮 S85.3-S85.6 NPC 主动性、礼法扩展位、总验收与归档验证口径”中的聚焦 Node tests、SQLite tests、客户端 typecheck、Vitest、client build、docs governance、documentation governance、browser smoke、完整书生路径 smoke、diff check 和全量 `npm test`（983 项）。`npm install` 仅补齐本机缺失的 rolldown Linux 可选原生依赖，未改变锁文件。
- 子代理：Heisenberg 只读梳理 S85.3 主动请求接线；Chandrasekhar 只读梳理 S85.4 礼法扩展位；Poincare 提交前只读复审发现 NPC 主动来函公开 view 回显 `privateSignalTags` 值的 P1，已修复为私档软信号仅作内部选择，不进入公开 intent/risk/evidence，并补私密 tag 值不外泄测试；Poincare 复核又发现旧存档污染 `evidenceRefs`、`outcome` 和 `recentEvents` 的 P2，已补 view 层过滤与 SQLite 派生表回归测试；最终复审未发现 P0/P1/P2。
- 提交：随本轮 S85.3-S85.6 coherent change 提交，最终 hash 见 Git 历史和本次回复。
- 下一步：S81-S85 已归档；建议新专项继续深化婚姻、比武、论道和 NPC 主动来函来源，并补真实 provider 长循环与浏览器深度 smoke。

### 2026-05-20：完成 S85.1-S85.2 长期经济 tick 与基础市价

- 范围：新增 `npcEconomy` 与 `npcEconomyConfig`，把基础市场价格、NPC 经济月结和安全 view 接入普通回合、跳时复用链路、SSE、player-state 与县令主卷；考试场景只补安全 projection，不推进全局经济。
- 后端：非月末刷新 `marketPriceLedger`，月末结算资产维护/收益、库存损耗、委派到期结果、逾期交易承诺、人情债和 NPC 关系记忆；考试入场/场内场景只走局部阶段推进；所有委派创建拒绝超过地方库银的预算，月结对旧任务按有效预算计算成功率和扣款；新增 `marketPriceView` 与 `npcEconomyView`，并把 `marketPriceLedger` / `npcEconomyLedger` 纳入 `clientWorldState` 与 redacted player API 剥离清单，S85 反馈中的资产/资源/库存变化只用公开 `economy.*` path。
- 前端：`client/src/api/types.ts`、UI route flags 和 `MagistratePanel` 已显示“基础市价”“NPC 月账”和服务器裁决边界；前端只读价格与月账，不成交、不扣库存、不完成委派。
- 验证：已通过本文件“本轮 S85.1-S85.2 长期经济与基础市价验证口径”列出的 focused Node tests（含委派预算越权、考试入场态不跑经济、内部 ledger path 不进入 S85 反馈回归）、客户端 typecheck、定点 Vitest、client build、docs governance 和浏览器 DOM 复验；`npm install` 仅补齐本机缺失的 rolldown 可选原生依赖，未改变锁文件。
- 子代理：Lovelace 只读梳理前端安全 view 接线风险，Meitner 只读梳理回合链路接入点；Zeno 只读复审发现委派预算可超过府库并影响月结的 P1，已修复并补测；Parfit 只读复审发现考试入场态、泛委派预算和反馈 path 三个 P2，已修复并补测；最终只读复审 Franklin 未发现 P0/P1/P2。
- 提交：随本轮 S85 coherent change 提交，最终 hash 见 Git 历史和本次回复。
- 下一步：S85.3 实现 NPC 私人目标与主动请求，再推进 S85.4 论道/切磋/求爱/婚姻扩展位。

### 2026-05-20：完成 S81-S84 NPC、资产、储物、交易与委派首轮闭环

- 范围：完成 S81 后端契约与存储地基、S82 开局背景兑现、S83 NPC 名册与 AI 对话后端、S84 React NPC/背包/交易/委派体验。新增 [NPC_INVENTORY_SYSTEM_CONTRACT.md](NPC_INVENTORY_SYSTEM_CONTRACT.md)，并把资产、资源、物品、NPC、交互、交易、委派和开局背景裁决纳入安全 view 与文档口径。
- 后端：新增 `assetLedger`、`inventoryLedger`、`npcRoster`、`npcInteractions`、`tradeLedger`、`delegatedTasks`、`openingBackgroundClaims` 领域模块；`POST /api/game/start` 先调用 `background_claim_parser`，服务器裁决房产、银两、书籍、债务、禁物、军权、官职和虚假身份宣称后再落账。新增 `GET /api/game/inventory/:sessionId`、`POST /api/game/inventory-transfer/:sessionId`、`GET /api/game/npcs/:sessionId`、`GET /api/game/npc/:sessionId/:npcId`、`POST /api/game/npc-interaction/:sessionId`、`POST /api/game/trade/:sessionId`、`POST /api/game/npc-command/:sessionId`。
- AI 与存储：新增 `background_claim_parser`、`npc_dialogue`、`npc_private_planner`、`trade_negotiator`、`delegated_task_planner`、`delegated_task_reporter`、`inventory_effect_explainer` 七类任务的 route policy、设置矩阵、prompt pack、schema、Mock 和 remote adapter 方法；SQLite 新增 `asset_resource_accounts`、`asset_long_term_assets`、`inventory_containers`、`inventory_items`、`npc_roster_profiles`、`npc_interaction_events`、`delegated_tasks`、`trade_ledger_records` 安全派生表，并接入 adapter sync/repair/delete/maintenance drift。
- 前端：React 新增“囊箧” route，人物页升级为 NPC 工作台，提供档案、对话、交易、委派、记录 tabs；主卷展示开局背景服务器裁决摘要；API client 与 Zustand store 只缓存服务器安全 view 和临时草稿，不写 localStorage/sessionStorage，不读取 unsafe `/api/game/state/*` 或 `/api/dev/*`。
- 边界：新增 raw ledgers 已从 `clientWorldState`、`redactedState` 和玩家 API 兼容 `worldState` 剥离；浏览器、prompt、SQLite 派生表和 AI 调动摘要均不暴露 hiddenDossier、privateSignalTags、交易底价、raw provider payload、完整 prompt、本地路径或 key。资源扣减、资产授予、价格、任务结果、关系影响、科举和官职仍由服务器裁决；交易 AI `accepted` 只记录议价，不直接写银钱/物品，NPC/交易/委派 AI 文本若命中 hidden/raw/path/key 形状会在服务端拒绝；委派创建 API 只回传安全 task view，SQLite 交易派生行带双方 actor refs。
- 验证：已通过本文件“本轮 S81-S84 NPC、资产、储物、交易与委派系统验证口径”列出的 focused Node tests、client typecheck、Vitest VM pool、client build、完整 `npm test`、docs governance、documentation governance 和 diff check；第一次只读复审 Epicurus 发现的交易结算和 AI 文本泄漏 P1 已修复并补测，第二次复审 Hegel 未发现 P0/P1，非阻断项已收口；最终只读复审 Russell 未发现 P0/P1。
- 子代理：Bacon 负责资产/背包账本小步，Linnaeus 负责 NPC/委派账本小步，Pasteur 负责 SQLite 派生表小步，Turing 负责 S84 React 前端小步；主代理完成整合、补缺、验证、文档同步和最终提交。子代理均未提交。
- 提交：实现提交 `4c007f00`（`Complete S81-S84 NPC inventory systems`）；本条提交哈希补记为低风险文档同步。
- 下一步：进入 S85，优先补长期 tick、基础市场价格、NPC 主动性和预留玩法正式扩展位，再做 S81-S85 总验收与归档。

### 2026-05-20：完成 PLAN-S81-S85 NPC、资产与储物系统规划

- 范围：按用户需求新增 [NPC_INVENTORY_SYSTEM_ROADMAP.md](NPC_INVENTORY_SYSTEM_ROADMAP.md)，规划 S81-S85：后端数据契约与存储地基、开局背景兑现与资产落账、NPC 名册与 AI 对话后端、React NPC/背包/交易/委派体验、经济长期关系与总验收。
- 保护：明确 AI 权力扩大为解析、扮演、提案和回禀，canonical state、资源扣减、交易、物品归属、委派结果、官职/科举和持久化仍由服务器裁决；JSON 默认可玩，SQLite 只做本机派生查询和可修复 projection。
- 开发规范：已把“复杂功能必须坚持前后端分离和大步骤拆分”写入 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 受保护段落和本文件受保护段落；S81-S83 以后端/API/数据/AI 为主，S84 集中前端体验，S85 做系统整合与总验收。
- 依赖与数据库：规划默认沿用 Node.js + Express、React + TypeScript + Vite、Ajv、Zustand、Lucide 和 `node:sqlite`；如 S84 后续确需 `@tanstack/react-query` 或 `@dnd-kit/core`，必须先走依赖治理。SQLite 规划新增资产、资源、背包、NPC、交互、委派和交易派生表，均从 `world_sessions.world_state_json` 单向修复。
- 验证：本轮应通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`；因同步治理检查脚本，提交前执行只读复审。
- 提交：随本轮 coherent change 提交，最终 hash 见 Git 历史和本次回复。
- 下一步：从 S81.1 开始，先写可执行契约和测试骨架，再实现 `assetLedger`、`inventoryLedger`、`npcRoster`、`delegatedTasks` 与 SQLite 派生表；不要先做前端假状态。

### 2026-05-20：补充 S81-S85 全量小步骤台账

- 范围：按用户追问把 S81-S85 所有小步骤写入活动台账表。S81 拆为契约、资产物品账本、NPC/委派后端、SQLite 派生表、后端测试；S82 拆为背景解析 AI task、开局接口、裁决规则、安全 view/审计、前端摘要；S83 拆为阶段 NPC、立绘分配、NPC API、NPC 交互、记忆审计；S84 拆为前端 API、导航架构、人物谱牒、NPC 详情、背包仓库、交易赠礼、委派任务、前端验收；S85 拆为长期 tick、市场价格、NPC 主动性、预留玩法、总验收、归档。
- 边界：仍坚持 S81-S83 先交付后端/API/数据/AI 安全契约，S84 只消费稳定安全 API 与安全 view；前端不裁决资源、身份、交易、NPC 行动、经济结果或隐藏信息。用户明确本轮不用子代理审核，因本轮为低风险文档台账补充，跳过子代理复审并在交接中记录。
- 验证：本轮为低风险文档补充，已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。

### 2026-05-20：完成 DOCS-2026-05-20 上下文压缩与完整实现规范

- 范围：压缩 `docs/SHARED_CONTEXT.md` 与 `docs/DEVELOPMENT_STEPS.md`，只保留接手下一步必要的状态、边界、归档索引、验证入口和当前建议；新增用户要求的开发规范，明确后续开发和维护不追求“最小实现点”或“最小改动点”，而追求完整、丰富、功能强大的游戏实现。
- 保护：稳定治理锚点、子代理纪律、Mock 默认可玩、完整书生路径、AI proposal-only、服务器裁决、magic numbers/配置集中、中文协作输出和本地-only 内容边界均保留；新增规范同时写入 `docs/DEVELOPMENT_GOVERNANCE.md` 的受保护段落和本文件受保护段落。
- 同步：已同步 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`、`docs/SHARED_CONTEXT.md`、`AGENTS.md` 与 `scripts/checkGovernanceDocs.js`。由于检查脚本属于验证工具，本轮按非纯低风险文档处理，提交前执行只读子代理复审。
- 验证：已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`npm test`（940 项）和 `git diff --check`；提交前只读复审 Anscombe 未发现 P0/P1/P2。
- 提交：随本轮 coherent change 提交，最终 hash 见 Git 历史和本次回复。
- 下一步：新功能步骤应以完整玩家体验和完整系统闭环为目标，再拆成可审查的 coherent changes；不要只做临时占位或“最小能跑”的半成品。

### 2026-05-19：完成 S80 服务端全局 AI 设置与保存反馈

- 范围：建立服务端全局 AI 设置，保存后覆盖所有当前和未来案卷的 AI 路由；设置页与印匣共用 11 类任务矩阵，显示保存状态、保存时间、失败原因、provider key 可用性和每类任务生效状态。
- 实现：新增 `GET/POST /api/ai/settings/global` 与运行时文件 `data/settings/ai-global-settings.json`；旧 `GET/POST /api/ai/settings/:sessionId` 只保留兼容，仍校验案卷存在但读写同一份全局设置。`resolveAiSettingsForSession` 全局优先，开局、普通/流式回合、考试出题/评卷、快捷建议和专题拟稿共用 route policy。
- 安全：全局保存拒绝 hidden/raw/server/path/key、观测日志伪造和缺 key 的真实 provider；落盘只保存安全路由/预算/温度/控制字段。
- 验证：通过 client typecheck/test、focused Node tests、client build、React browser smoke、docs governance、documentation governance、diff check 和完整 `npm test`。提交前只读复审发现的禁用字段别名静默忽略问题已修复并补测。

### 2026-05-19：完成 S79 前端打磨与高清女性立绘使用

- 范围：修复考试页 `wordCount` 对象显示与 smoke 漏报，收束子路由壳；将 194 张 recovered 女性高清母版入库为公开 runtime WebP、缩略图和低清占位；新增游戏内只读高清立绘查看器。
- 边界：不改后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver、canonical state 或游戏规则。公开 manifest/runtime manifest 只登记 `/assets/ui/` 派生产物，不暴露 artifacts 母版路径。
- 验证：通过 client typecheck/test、React scaffold、browser smoke、素材 QA、runtime manifest、portrait compression、frontend asset QA、manifest tests、docs governance、documentation governance、diff check 和完整 `npm test`。

### 2026-05-19：完成活动台账归档

- 范围：新增 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)，保存本次整理前 `docs/DEVELOPMENT_STEPS.md` 的完整完成流水；本文件瘦身为当前边界、归档索引、最新完成节点、最近验证口径和下一步入口。
- 边界：纯文档整理，不新增运行时代码、后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver、canonical state 写入、素材或资源预算。
- 验证：通过 `npm run check:docs-governance` 与 `node --test test/documentationGovernance.test.js`。
