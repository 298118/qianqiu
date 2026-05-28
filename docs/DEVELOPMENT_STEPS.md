# 《千秋》活动路线图与进度台账

本文件是 Codex 当前维护的压缩活动路线图与进度台账。它只保留接手下一步所必需的治理规则、当前状态、验证口径和归档入口；已完成或阶段性收束的长流水不在这里展开。

需要追溯已迁出的完成流水时，优先阅读专题归档、压缩索引和 Git history：

- 第一阶段：[PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段：[PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段：[PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段：[PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度见 [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)。
- S48 时间专项：[TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S67 本地数据库与大世界内容：[LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)。
- S68-S69 科举深化：[IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)，制度契约见 [IMPERIAL_EXAM_SYSTEM_CONTRACT.md](IMPERIAL_EXAM_SYSTEM_CONTRACT.md)。
- S70 AI 编排：[AI_ORCHESTRATION_ARCHIVE.md](AI_ORCHESTRATION_ARCHIVE.md)。
- S71 数据库玩法化 resolver：[DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)，resolver 输入契约见 [DATABASE_RESOLVER_INPUT_CONTRACT.md](DATABASE_RESOLVER_INPUT_CONTRACT.md)。
- S72 PixiJS 水墨地图：[PIXIJS_INK_MAP_ARCHIVE.md](PIXIJS_INK_MAP_ARCHIVE.md)，运行时契约见 [PIXIJS_INK_MAP_RUNTIME_CONTRACT.md](PIXIJS_INK_MAP_RUNTIME_CONTRACT.md)。
- S73-S77 前端水墨重构：[FRONTEND_INK_REDESIGN_ARCHIVE.md](FRONTEND_INK_REDESIGN_ARCHIVE.md)，素材台账见 [FRONTEND_ASSET_LEDGER.md](FRONTEND_ASSET_LEDGER.md)。
- S81-S85 NPC、资产、储物、交易、委派、经济、主动来函与礼法扩展位：[NPC_INVENTORY_SYSTEM_ARCHIVE.md](NPC_INVENTORY_SYSTEM_ARCHIVE.md)。
- S86 后端 TypeScript 渐进迁移：[TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md](TYPESCRIPT_BACKEND_MIGRATION_ARCHIVE.md)，规划见 [TYPESCRIPT_BACKEND_MIGRATION_ROADMAP.md](TYPESCRIPT_BACKEND_MIGRATION_ROADMAP.md)。
- S87 route/API 响应类型覆盖：[TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ARCHIVE.md)，规划见 [TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ROADMAP.md](TYPESCRIPT_ROUTE_RESPONSE_COVERAGE_ROADMAP.md)。
- S88 全面系统打磨阶段性归档：[QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)，原规划见 [QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)。
- S89-S90 React 产品 polish、CSS token/keyframe/surface 收敛和预算稳定专题归档：[FRONTEND_PRODUCT_POLISH_ARCHIVE.md](FRONTEND_PRODUCT_POLISH_ARCHIVE.md)，压缩索引见 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。

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
- S88 已作为阶段性打磨归档到 [QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)；S89.1-S89.68 已作为完成流水压缩到 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。继续打磨时应新开可审查小步骤，不要把旧长流水复制回本文件。

## 4. 活动路线图总览

当前活动小步骤只保留下一步候选。接手者应先确认用户意图、工作树状态和预算风险，再把选定步骤改为 `IN_PROGRESS`。

| ID | 状态 | 目标 | 范围 / 下一步 |
| --- | --- | --- | --- |
| S90.1 | DONE | CSS 物理拆文件第二阶段与预算恢复 | 首页、主卷、舆图/史册、人物/囊箧、科举/皇榜和对应移动端样式已迁到页面级 import，`global.css` 仅保留 token/base/shell/controls/overlay/motion/全局移动布局；source canary 继续读取产品样式全集保护既有 selector，并新增全局启动样式图预算守门。 |
| S90.2 | DONE | route 空态一致性与跨页读法继续 polish | 已完成舆图读图/地点状态/路线暗示/tooltip 操作、人物/高清立绘/科举/皇榜读法、全局壳、右上角印匣/设置入口、`SurfaceHost` 专题层、错误/loading/empty 状态和基础控件反馈 polish；只消费安全 view 与本地草稿，不新增裁决权。 |
| S90.4 | DONE | 囊箧、史册、朝议深层读卷 polish | 已完成囊箧“四读”账解索引、史册“由史册成题”归档读法、朝议“材料入席”读法和 `SurfaceHost` 专题层材料/证据/草稿读法；只消费现有安全 view、本地草稿和页面状态，不新增 route/API/schema/AI 权限/依赖/素材或服务器裁决能力。 |
| S90.3 | DONE | S89/S90 前端 polish 专题归档 | 已将 S89.1-S89.68 与 S90.1/S90.2/S90.4 从 Git history、压缩索引和 brief 摘要整理为 [FRONTEND_PRODUCT_POLISH_ARCHIVE.md](FRONTEND_PRODUCT_POLISH_ARCHIVE.md)；避免重新引入逐项长流水。 |
| S91.1 | DONE | 设置/AI 来源状态读法 polish | 已完成右上角印匣“推演设置”的来源三读：本地样例可开卷、真实来源接通/缺 key、分工候复边界；只改 React 前端读法、CSS、测试与文档，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.2 | DONE | 首页开卷校阅与旧案入口 polish | 已完成首页“开卷校阅”四读，从现有表单状态、runtime 画像 registry、旧案目录和本地 loading/error 派生题名、立绘、自定背景字数、旧案架和朱印候复边界；并修正人物/囊箧移动端按钮内部 overflow 守门，不新增 route/API/schema/AI 权限/依赖/素材、存档字段或服务器裁决。 |
| S91.3 | DONE | 主卷行止校阅与快捷建议状态 polish | 已完成主卷“行止校阅”四读，从现有 route/session 状态、quick action 状态、上一回批和本地草稿长度派生身份、草稿、快捷建议与回批边界；草稿只显示来源与字数，不回显全文，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.4 | DONE | 人物往来校阅与本地草稿状态 polish | 已完成人物详情工作台“往来校阅”四读：从当前安全人物 view、当前页签、四类本地输入字数、近次公开回批和当前人物明确绑定的公开记录数量派生照面、本地稿、回批与留痕；不回显草稿正文，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.5 | DONE | 囊箧移置校阅与候批状态 polish | 已完成囊箧页“移置校阅”四读：只从当前安全囊箧 view、本地移置选择、既有候批 readiness 和当前案卷本地回执提示派生物件、去处、候批与回执状态；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.6 | DONE | 科举落墨校阅与候榜状态 polish | 已完成科举页“落墨校阅”四读：只从现有安全考试 view、本地文章字数、route 支持状态、交卷 readiness 和本案卷近次交卷评定派生试别、草稿、交卷与候榜状态；不回显文章正文，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.7 | DONE | 皇榜题名校阅与授官候复状态 polish | 已完成皇榜“题名校阅”四读：只从现有公开榜行、案主榜行、本地细读选择、同年座师公开计数和授官提示派生榜文、我名、细读与授官候复；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.8 | DONE | 舆图图层校阅与草稿候复状态 polish | 已完成舆图“图层校阅”四读：只从现有 `mapRuntimeView` 安全投影、图层显示状态、公开计数、可见行动条数和本地草稿写入状态派生图层、卷宗、可见与草稿候复读法；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.9 | DONE | 史册拟稿校阅与候复状态 polish | 已完成史册页“拟稿校阅”四读：只从现有公开史册/旁证计数、route 状态和当前案卷本地 `archive-view` 草稿状态派生归档、旁证、草稿与候复读法；写稿后只显示已入主卷候复，不回显草稿正文或史册条目标题，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.10 | DONE | 朝议专题草稿校阅与候复状态 polish | 已完成朝议页“专题校阅”四读：只从现有公开材料计数、route 状态和当前案卷本地 `role-surface` 专题草稿 `draftContext.surfaceId` 派生材料、官署、草稿与候复状态；写稿后只显示已入主卷候复，不读取或回显草稿正文，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.11 | DONE | 入仕官职月报校阅与候复状态 polish | 已完成既有官员/大臣面板“官职月报校阅”四读：只从 `playerMonthlyBriefingView`、官职履历、公开任所/首月差事和当前案卷本地 `role-surface` 草稿写入状态派生本职、月报、差事与候复；不回显草稿正文，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.12 | DONE | 皇帝御案朱批校阅与候复状态 polish | 已完成既有皇帝面板“御案朱批校阅”四读：只从 `eventArchiveView`、`worldThreadView`、`courtResponseView`、`courtConsequenceView`、公开朝议/任免/赏罚线索和当前案卷本地 `role-surface` 草稿写入状态派生御案、章奏、朝议与候复；不回显草稿正文，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.13 | DONE | 六身份循环候复校阅与本地草稿状态 polish | 已完成既有 `RoleCycleSection` “身份候复校阅”四读，并把当前案卷本地 `role-surface` 草稿写入布尔透传到书生、地方官、官员/大臣、将领和皇帝主卷：读法只从 `roleCycleView.currentRole`、安全取材标签、入口/草稿建议和本地草稿状态派生身份、事务、取材与候复；不读取或回显草稿正文，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.14 | DONE | SurfaceHost 专题层候复校阅与写入状态 polish | 已完成既有 `SurfaceHost` 专题层“材料 / 证据 / 草稿 / 候复”四读：只从当前案卷专题材料、证据勾选、拟稿状态和本地 `role-surface` 专题草稿是否已写入主卷派生候复状态；不读取或回显草稿正文，不新增 topic surface 类型、route/API/schema、AI 权限、依赖、素材、存档字段、prompt 能力或服务器裁决。 |
| S91.15 | DONE | 领域后果追踪校阅与候复状态 polish | 已完成既有 `DomainConsequenceSection` “后果追踪校阅”四读：只从现有 `domainConsequenceView` 公开后果、公开 next actions、sourceType 过滤、来源/牵连/指标标签和调用处传入的当前案卷本地草稿布尔派生后果、凭据、牵连与候复；不读取或回显草稿正文，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |
| S91.16 | DONE | 史册议程月报互证校阅 polish | 已完成史册页“议程月报互证”四读：只从当前案卷公开 `worldThreadView`、`playerMonthlyBriefingView`、`sessionSummaryView`、史册旁证计数和本地史册草稿状态派生议程、月报、互证与候复；不回显草稿正文，不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。 |

## 5. 最新状态

- S89.1-S89.68 已完成并迁出活动台账。压缩归档见 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。
- 最新实现步骤 S91.16：史册议程月报互证校阅 polish 已完成，代码实现提交为 `1ea44d9b`（`Polish archive agenda reader`）。史册页新增 `data-polish-archive-agenda-reader="s91-16-archive-agenda-reader"` 的“议程月报互证”，四读为“议程 / 月报 / 互证 / 候复”，只从当前案卷公开 `worldThreadView.activeThreads`/`threads`/`recentResolved`、`playerMonthlyBriefingView.latest`/`recentReports`、`sessionSummaryView.recentMonthlySummaries`、史册旁证计数和当前案卷本地 `archive-view` 草稿状态派生；写稿后只显示“主卷待呈 / 本地史册札记已入底部奏折，仍候主卷回音”，不读取或回显草稿正文。
- S91.16 不新增依赖或素材，不请求完整 manifest，不硬编码本地路径，不改变后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决；浏览器仍只消费现有安全史册、世界议程、官职月报、经历摘要、旁证计数和本地草稿状态，不把议程、月报、经历摘要、互证或候复状态改写成考成、任免、关系、交易、定罪、资源、钱粮或时间推进事实。
- 最近完整运行态验证来自 S91.16：`npm run typecheck:client`、`npm run typecheck:server`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js --test-name-pattern "S91.16 archive agenda reader|S91.9 archive draft reader"`（实际完整 117 tests 通过）、S91.16 focused archive Vitest（2 passed / 75 skipped）、完整 App Vitest（77 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-16-archive-agenda-reader-smoke`、`npm run check:docs-governance`、`git diff --check`（仅既有未触碰归档/素材 CRLF warning）和 `npm test`（1231 tests）已通过；提交前只读复审代理 `019e69e1-f179-75a3-9098-77945ffd0138` 两轮复审均未发现阻塞问题。

## 6. 最近完整验证口径

最新运行态完整验证锚点来自 S91.16：

- `node --check scripts/clientSmoke.js`
- `node --test test/reactClientScaffold.test.js --test-name-pattern "S91.16 archive agenda reader|S91.9 archive draft reader"`（实际完整 117 tests 通过）
- `npm run typecheck:client`
- `npm run typecheck:server`
- `npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx -t "archive route"`（2 passed / 75 skipped）
- `npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（1 file / 77 tests）
- `npm run qa:runtime-manifest`
- `npm run build:client`
- `npm run budget:client`（JS 715.3 KiB / CSS 179.2 KiB / fonts 26288.4 KiB / client-assets 27182.9 KiB）
- `node scripts/clientSmoke.js --screenshots artifacts/s91-16-archive-agenda-reader-smoke`
- `npm run check:docs-governance`
- `git diff --check`（仅既有未触碰归档/素材 CRLF warning）
- `npm test`（1231 tests）

## 7. 近期进度记录

### 2026-05-28：S91.16 史册议程月报互证校阅 polish 完成

- 范围：史册页新增 `data-polish-archive-agenda-reader="s91-16-archive-agenda-reader"` 的“议程月报互证”，四格显示议程、月报、互证与候复；读法只从当前案卷公开 `worldThreadView.activeThreads` / `threads` / `recentResolved`、`playerMonthlyBriefingView.latest` / `recentReports`、`sessionSummaryView.recentMonthlySummaries`、史册旁证计数和本地 `archive-view` 草稿状态派生。
- 体验修正：史册页现在能把长期世界议程、官职月报、经历摘要、领域后果、实体余波和来函证据放在同一互证区扫读；写稿后只显示“主卷待呈 / 本地史册札记已入底部奏折，仍候主卷回音”，不读取或回显草稿正文。新 reader 过滤“服务器/后端/模型”和 `server`/`backend`/`model` 等工程口径、provider/raw/prompt/path/key/hidden/schema/manifest、本地路径和 token 形态，移动端单列。
- 边界：本步只改 React 史册页读法、史册/舆图 route CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema、AI 权限、provider/prompt 能力、依赖、素材、存档字段或服务器裁决。浏览器仍只消费现有安全 view、route 状态和本地草稿标记；议程、月报、经历摘要、互证或候复状态不得被改写成考成、任免、关系、交易、定罪、资源、钱粮或时间推进事实。
- 子代理审计：只读审计代理 `019e6e30-b9f6-7e11-ac26-f76088a44256` 已阅读指定治理与交接文档，确认未编辑文件、未运行 Git 命令、未跑测试；其候选清单首推 S91.15 过滤 cap 残余，另列 World Threads、月报、朝议和专题层文案候选。主代理本步选择收束史册 World Threads/月报互证空白，S91.15 cap 残余继续作为下一候选风险记录。
- 验证：已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js --test-name-pattern "S91.16 archive agenda reader|S91.9 archive draft reader"`（实际完整 117 tests）、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx -t "archive route"`（2 passed / 75 skipped）、完整 App Vitest（77 tests）、`npm run build:client`、`npm run budget:client`、`npm run typecheck:server`、`npm run qa:runtime-manifest`、`node scripts/clientSmoke.js --screenshots artifacts/s91-16-archive-agenda-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1231 tests）。首次 S91.16 source canary 因移动端 CSS selector 合并影响旧 S91.9 正则失败，已拆分规则后通过；首次 browser smoke 因新 agenda written 断言要求“已入主卷”过严失败，同时暴露公开 world thread 摘要中的“模型”字样被带入新 reader，已收紧 smoke 断言并把“服务器/后端/模型”加入史册清洗后复跑通过；采纳复审建议补入英文 `server`/`backend`/`model` 过滤后重新通过 focused checks、build、budget、runtime manifest QA、browser smoke 和 `npm test`；browser smoke 曾以 300 秒外层超时无断言失败，900 秒复跑通过；`git diff --check` 仅输出未触碰归档/素材文件的既有 CRLF warning。
- 子代理复审：提交前只读复审代理 `019e69e1-f179-75a3-9098-77945ffd0138` 两轮复审均未发现阻塞问题；非阻塞提醒为英文 `server`/`backend`/`model` 使用 substring 清洗偏保守，当前中文史册玩家表面可接受。主代理已采纳英文工程词 hardening，复审确认无新增阻塞；代理未编辑文件、未运行任何 Git 命令、未创建 PR。
- 提交：`1ea44d9b`（`Polish archive agenda reader`）。

### 2026-05-28：S91.15 领域后果追踪校阅与候复状态 polish 完成

- 范围：既有 `DomainConsequenceSection` 新增 `data-polish-domain-consequence-reader="s91-15-domain-consequence-reader"` 的“后果追踪校阅”，四格显示后果、凭据、牵连与候复；组件内部复用既有公开后果过滤和安全清洗，只从 `domainConsequenceView.recentConsequences`、`nextActions`、sourceType 过滤、来源/领域/指标标签和调用处传入的本地草稿布尔派生读法。
- 体验修正：主卷地方官、官员/大臣、将领、皇帝面板传入当前案卷 `role-surface` 草稿布尔；史册页传入当前案卷 `archive-view` 草稿布尔；舆图页传入当前案卷 `map-runtime` 草稿布尔。未写稿时显示公开余波数量、来源数量、牵连域和可拟项；写稿后只显示“主卷待呈”和“本页草稿已入底部奏折，仍候主卷回音”，不读取或回显 `actionDraft.text`、按钮正文或草稿正文。样式放在 `routes/game.css`，移动端单列。
- 边界：本步只改 React 前端共享后果卡、主卷/史册/舆图调用处、主卷 route CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema、AI 权限、provider/prompt 能力、依赖、素材、存档字段或服务器裁决。浏览器仍只消费现有安全 `domainConsequenceView`、route 状态和调用处本地草稿标记；后果追踪、凭据、牵连、续记或本地草稿状态不得被改写成资源、任免、赏罚、定罪、交易、调兵、人物资产、关系或时间推进事实。
- 复审后修正：首次提交前只读复审代理 `019e6e05-1b50-74d2-9d44-363e135c7e3e` 未发现阻塞问题，确认未编辑文件、未运行任何 Git 命令；非阻塞提醒为史册页 `hasArchiveDraft` 可补 `targetPage === "game"`、过滤后无后果条目时 reader 不宜因全局 caps 变成 ready。两项均已采纳：史册本地草稿状态补目标页校验，`readerCapLine` 只在过滤后有可见后果条目时进入四读；S91.9/S91.15 source canary 已补相应守门。
- 验证：已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js --test-name-pattern "S91.15 domain consequence reader"`（实际完整 116 tests）、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx -t "magistrate panel"`（1 passed / 76 skipped）、`npm run qa:runtime-manifest`、`npm run typecheck:server`、完整 App Vitest（77 tests）、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-15-domain-consequence-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1230 tests）。首次完整 App Vitest 因旧舆图断言用 `getByText(/当前显示近次 1 条/)` 而新增 reader 复述同一公开上限文案失败，已改为 `getAllByText` 后复跑通过；browser smoke 首次在首页 `networkidle` 30 秒超时，未进入 S91.15 断言，同命令复跑通过；采纳复审建议后重新通过 client typecheck、S91.9/S91.15 source canary、完整 App Vitest、runtime manifest QA、build、budget、browser smoke、docs governance、server typecheck、`git diff --check` 和 `npm test`；`git diff --check` 仅输出未触碰归档/素材文件的既有 CRLF warning。
- 子代理：首次提交前只读复审代理 `019e6e05-1b50-74d2-9d44-363e135c7e3e` 未发现阻塞问题，低风险建议已采纳；补充只读复审代理 `019e6e1e-1b08-7e03-a1db-dba2b592b6e1` 未发现阻塞问题，确认未编辑文件、未运行任何 Git 命令，并额外运行 S91.9/S91.15 source canary（实际 116 tests）和 `node --check scripts/clientSmoke.js` 通过。残余低风险：当调用处传入 `sourceTypes` 且过滤后无可见后果条目时，组件顶部独立 `domainConsequenceCapLine` 仍按全局 `view.caps` 显示公开追踪数；reader 已不再因此进入 ready，当前作为 UX 口径风险记录，不阻塞提交。
- 提交：S91.15 实现提交 `7c24a7b0`（`Polish domain consequence reader`）；本哈希记录随低风险纯文档后续提交补入台账。

### 2026-05-28：S91.14 SurfaceHost 专题层候复校阅与写入状态 polish 完成

- 范围：既有 `SurfaceHost` 专题层读法从“材料 / 证据 / 草稿”扩为“材料 / 证据 / 草稿 / 候复”四格；`LocalSurfaceHost` 订阅当前案卷本地 `actionDraft`，只在 `sessionId`、`source === "role-surface"`、`targetPage === "game"` 且 `draftContext.surfaceId` 命中当前专题时，把专题层 reader 标为已写入主卷。
- 体验修正：初始或未写入时，“候复”格显示“候落稿 / 可写入 / 材料候取”和“专题层只整理草稿线索；呈递后才由主卷回批”；点击“写入底部奏折”后，reader 的 `data-topic-written-state` 变为 `written`，只显示“主卷待呈”和“专题草稿已入底部奏折，仍候主卷回音”。读法不读取或回显 `actionDraft.text`、专题草稿正文或污染测试句；overlay CSS 将专题层 reader 改为四列，移动端仍沿用既有单列规则。
- 边界：本步只改 React 前端读法、共享 overlay CSS、客户端测试、browser smoke 和文档；不新增后端 topic surface 类型、route/API/schema、AI 权限、provider/prompt 能力、依赖、素材、存档字段或服务器裁决。浏览器仍只消费现有安全 `topicSurfaceView`、`topicDraft` 回包、本地证据勾选、本地草稿和当前案卷 route 状态；证据勾选、专题草稿或写入状态不得被改写成资源、交易、任免、赏罚、罪名、战和、关系或时间推进事实。
- 验证：已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（115 tests）、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（77 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-14-topic-reply-reader-smoke`、`npm run check:docs-governance`、`npm run typecheck:server`、`git diff --check` 和 `npm test`（1229 tests）；首次 source canary 因 S91.14 新增测试把 `TopicSurfaceWorkbench` 切片终点设在函数之前失败，已改为切到文件末尾后复跑通过；首次 `git diff --check` 120 秒超时，仅输出未触碰归档/素材文件的既有 CRLF warning，300 秒重跑通过且仍仅既有 CRLF warning。
- 子代理：提交前只读复审代理 `019e6dcb-301f-7600-bba1-0a5f9cc87074` 已复审最终 diff 与验证证据，未发现阻塞问题；非阻塞提醒为 `aria-live="polite"` 放在整个专题 reader `dl` 上，写入态切换时可能播报整组四读内容，当前范围可接受。代理确认未编辑文件、未运行任何 Git 命令；额外运行 `node --test test/reactClientScaffold.test.js --test-name-pattern "S91.14 topic surface reply reader"`，实际完整 115 tests 通过。
- 提交：S91.14 实现提交 `853df837`（`Polish topic surface reply reader`）；本哈希记录随低风险纯文档后续提交补入台账。

### 2026-05-28：S91.13 六身份循环候复校阅与本地草稿状态 polish 完成

- 范围：共享 `RoleCycleSection` 新增 `data-polish-role-cycle-reader="s91-13-role-cycle-reader"` 的“身份候复校阅”，四格显示身份、事务、取材与候复状态；`GamePage` 把当前案卷本地 `actionDraft.source === "role-surface"` 且 `targetPage === "game"` 的写入布尔透传到书生、地方官、官员/大臣、将领和皇帝主卷，五处身份面板再传给共享身份循环卡。
- 体验修正：reader 只从当前安全 `roleCycleView.currentRole`、`cycleBoundarySummary` 的中文取材标签、可见事务/风险、入口和可拟草稿数量派生；初始显示可据此拟或候公开卷，写稿后显示“主卷待呈”和“身份循环草稿已入底部奏折，仍候主卷回音”。读法不读取或回显 `actionDraft.text`、身份循环草稿正文、面板按钮正文或污染测试句；移动端同 `routes/game.css` 单列。
- 边界：本步只改 React 前端读法、主卷 route CSS、客户端测试、browser smoke 和文档；不新增后端 route/API/schema、AI 权限、provider/prompt 能力、依赖、素材、存档字段或服务器裁决。浏览器仍只消费现有安全 `roleCycleView`、route 状态和本地草稿标记；身份候复、取材、入口或本地草稿状态不得被改写成身份切换、任免、调兵、审案、交易、考试或时间推进事实。
- 验证：已通过 `npm run typecheck:client`、`npm run typecheck:server`、`node --test test/reactClientScaffold.test.js`（114 tests）、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（77 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-13-role-cycle-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1228 tests）；首次 App Vitest 因测试期望“3 类取材”但 fixture 实际 allowed source scope 只含“官职履历、奏议回应”两类失败，已把断言收紧到当前安全来源后复跑通过；browser smoke 首次在首页 `networkidle` 超时，未进入 S91.13 断言，同命令重跑通过；`git diff --check` 仅输出未触碰归档/素材文件的既有 CRLF warning。
- 子代理：提交前只读复审代理 `019e6d9c-9251-7b23-86d1-4da148389ca0` 已复审最终 diff 与验证证据，未发现阻塞问题；残余风险提醒为 `localRoleSurfaceDraftWritten` 是当前案卷主卷页任意 `role-surface` 草稿的页面级布尔，并非证明草稿来自身份循环某个按钮，此口径已在交接记录中说明。代理确认未编辑文件、未运行任何 Git 命令。
- 提交：S91.13 实现提交 `231fde57`（`Polish role cycle reader`）；本哈希记录随低风险纯文档后续提交补入台账。

### 2026-05-28：S91.12 皇帝御案朱批校阅与候复状态 polish 完成

- 范围：既有 `EmperorPanel` 新增 `data-polish-emperor-edict-reader="s91-12-emperor-edict-reader"` 的“御案朱批校阅”，四格显示御案、章奏、朝议与候复状态；读法只从 `eventArchiveView`、公开章奏、`courtResponseView` 奏议回应、`worldThreadView` 朝议/任免线索、`courtConsequenceView` 赏罚/后果线索和当前案卷本地 `role-surface` 草稿写入状态派生。
- 体验修正：有公开御案时显示 ready 状态、题名/日期、公开章奏数、可候朱批奏议数、朝议/任免/赏罚线索计数；reader 章奏计数使用 `courtMemorials = getMemorialQueue(eventArchive, worldThread, {})`，不把舆图 runtime event effects 纳入“章奏”计数；从皇帝面板点击“拟旨”后，“候复”只显示“主卷待呈”和“御案草稿已入底部奏折，仍候主卷回音”，不读取或回显 `actionDraft.text`、拟旨正文、朱批正文或污染测试句“草拟一道明发谕旨”。移动端同 `routes/game.css` 单列。
- 边界：本步只改 React 前端读法、主卷 route CSS、客户端测试、browser smoke 和文档；不新增后端 route/API/schema、AI 权限、provider/prompt 能力、依赖、素材、存档字段或服务器裁决。浏览器仍只消费现有安全御案/奏折/朝议/任免/赏罚 view、route 状态和本地草稿标记；朱批、拟旨、朝议、任免候选、赏罚线索或本地草稿状态不得被改写成已生效圣旨、任免、赏罚、处分、拨款、调兵或时间推进事实。
- 验证：已通过 `npm run typecheck:client`、`npm run typecheck:server`、`node --test test/reactClientScaffold.test.js`（113 tests）、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-12-emperor-edict-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1227 tests）；首次 source canary 因测试把 `EmperorPanel` 的防泄漏护栏常量纳入运行时扫描误报，已剥离护栏常量后复跑通过；收紧 `courtMemorials` 后重新通过 client typecheck、source canary、App Vitest、browser smoke、build/budget、runtime manifest QA 和 `npm test`；browser smoke 收紧后首次 420 秒外层超时未出断言失败输出，720 秒同命令重跑通过；`git diff --check` 仅输出未触碰归档/素材文件的既有 CRLF warning。
- 子代理：提交前只读复审代理 `019e6d04-225d-7122-9155-b4d715b3f147` 已复审最终 diff 与验证证据，未发现阻塞问题；非阻塞提醒为文档待补状态、章奏计数可收紧、移动端单列主要由 source canary 覆盖。主代理已采纳章奏计数建议，把 reader 计数收紧到 `eventArchiveView` + `worldThreadView`，并请求同一代理补充复审；补充复审确认数据源范围问题已解决且无新增建议。代理确认未编辑文件、未运行任何 Git 命令。
- 提交：S91.12 实现提交 `7039a5f7`（`Polish emperor edict reader`）；本哈希记录随低风险纯文档后续提交补入台账。

### 2026-05-27：S91.11 入仕官职月报校阅与候复状态 polish 完成

- 范围：既有 `OfficialMinisterPanel` 新增 `data-polish-official-monthly-reader="s91-11-official-monthly-reader"` 的“官职月报校阅”，四格显示本职、月报、差事与候复状态；读法只从 `playerMonthlyBriefingView`、官职履历、公开任所/首月差事、现有 assignments 和当前案卷本地 `role-surface` 草稿写入状态派生。
- 体验修正：有月报时显示期号、公开 section/action/risk 计数和本月本职标签；首月入仕时把公开回署/差事提示整理成“首月差事”读法；从官职面板写入底部奏折后，“候复”只显示“已入主卷”和主卷候复，不读取或回显 `actionDraft.text`，污染测试句“若有弹劾风声”不会进入读法。移动端同 `routes/game.css` 单列。
- 边界：本步只改 React 前端读法、主卷 route CSS、客户端测试、browser smoke 和文档；不新增后端 route/API/schema、AI 权限、provider/prompt 能力、依赖、素材、存档字段或服务器裁决。浏览器仍只消费现有安全月报/官职/公开差事 view、route 状态和本地草稿标记；月报、首月差事、任所摘要或本地草稿状态不得被改写成考成、任免、弹劾、财赋或官署终局事实。
- 验证：已通过 `npm run typecheck:client`、`npm run typecheck:server`、`node --test test/reactClientScaffold.test.js`（112 tests）、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-11-official-monthly-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1226 tests）；首次 App Vitest 使用 180 秒外层超时未出结果，长超时复跑通过；browser smoke 首次在首页 `networkidle` 超时、未进入 S91.11 断言，同命令重跑通过；`git diff --check` 仅输出未触碰归档/素材文件的既有 CRLF warning。
- 子代理：提交前只读复审代理 `019e6cd5-420f-79e3-a467-913d096f8f7e` 已复审最终 diff 与验证证据，未发现阻塞问题；代理确认未编辑文件、未运行任何 Git 命令。非阻塞提醒为文档待补状态与 `localRoleSurfaceDraftWritten` 当前表示当前案卷主卷页任意 `role-surface` 草稿，前者已补记，后者符合本轮页面级本地草稿状态设计。
- 提交：S91.11 实现提交 `1e9988be`（`Polish official monthly reader`）；本哈希记录随低风险纯文档后续提交补入台账。

### 2026-05-27：S91.10 朝议专题草稿校阅与候复状态 polish 完成

- 范围：朝议页在跨页线索与既有“材料入席”读法之间新增 `data-polish-court-draft-reader="s91-10-court-draft-reader"` 的“专题校阅”，四格显示公开材料可读条数、当前本地专题官署、草稿是否已入主卷和候复边界。
- 体验修正：初始状态显示“候公开材料 / 六署待选 / 尚未落稿”和“不回显正文”；从朝议专题写入底部奏折后，“官署”格显示“朝议”，“草稿”格只变为“已入主卷”和“本地专题草稿已入底部奏折，仍候主卷回音”，候复格显示“主卷待呈”。读法只检查当前案卷 `actionDraft.sessionId`、`actionDraft.source === "role-surface"` 和 `actionDraft.draftContext?.surfaceId` 是否命中既有官署专题；没有 `draftContext.surfaceId` 的旧静态拟圣旨草稿不会误判为专题草稿，也不读取 `actionDraft.text`，因此不回显“请召诸臣廷议……”等草稿正文。移动端同 route CSS 单列。
- 边界：本步只改 React 前端读法、朝议 route CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。浏览器仍只消费现有公开章奏、史册、后果、议题、thread、月账安全投影、route 状态和本地专题草稿标记；官署材料只作读卷提示，不能改写成呈递、任免、诏令、战和、财赋结算或未公开事实。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（111 tests）、`npm run typecheck:client`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-10-court-draft-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1225 tests）；首次 S91.10 App Vitest 使用 120 秒外层超时未出结果，长超时复跑通过；接手前 source canary 因旧 S89.36/S89.17 片段过宽触发，已收窄到各自读法后通过；`git diff --check` 仅输出未触碰归档/素材文件的既有 CRLF warning。
- 子代理：提交前只读复审代理 `019e6b45-c803-7aa2-9c4e-c43faae028e5` 已复审最终 diff 与验证证据，未发现阻塞问题；非阻塞提醒为提交前把本条“待执行”文案改为已完成，已采纳。代理确认未编辑文件、未运行任何命令或 Git 命令。复审后只做本条文档状态补记，按低风险纯文档状态更新处理。
- 提交：S91.10 实现提交 `a4058332`（`Polish court draft reader`）；本哈希记录随低风险纯文档后续提交补入台账。

### 2026-05-27：S91.9 史册拟稿校阅与候复状态 polish 完成

- 范围：史册页在操作区与案卷索引之间新增 `data-polish-archive-draft-reader="s91-9-archive-draft-reader"` 的“拟稿校阅”，四格显示公开归档可据条数、公开后果/实体余波/来函旁证条数、本地史册草稿是否已入主卷和候复边界。
- 体验修正：初始状态显示“尚未落稿”和“据此拟稿只写本地奏折，不回显正文”；点击“据此拟稿”后，“草稿”格只变为“已入主卷”和“本地史册札记已入底部奏折，仍候主卷回音”，候复格显示“主卷待呈”。读法只检查当前案卷 `actionDraft.sessionId` 与 `actionDraft.source === "archive-view"`，不读取 `actionDraft.text`，因此不回显“平粜余波”等史册标题或草稿正文。移动端同 route CSS 单列。
- 边界：本步只改 React 前端读法、史册 route CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。浏览器仍只消费现有 `eventArchiveView`、`domainConsequenceView`、来函 evidence 安全投影、route 状态和本地草稿标记；旁证只作读卷提示，不能改写成资源、关系、任免、罪名或未公开事实。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（110 tests）、`npm run typecheck:client`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-9-archive-draft-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1224 tests）；首次 source canary 因 S91.8/S91.9 移动端 CSS selector 合并破坏旧 S91.8 正则守门失败，已拆回独立规则后通过；提交前复审后将 browser smoke 的 S91.9 文案检查从正则 alternation 改为逐项缺失检查，随后 `node --check`、source canary、docs governance、`git diff --check` 和 browser smoke 已复跑通过；browser smoke 首次复跑在首页 `networkidle` 超时、未进入 S91.9 断言，同命令重跑通过；`git diff --check` 仅输出未触碰归档/素材文件的既有 CRLF warning。
- 子代理：提交前只读复审代理 `019e6b45-c803-7aa2-9c4e-c43faae028e5` 已复审最终 diff 与验证证据，未发现阻塞问题；代理确认未编辑文件、未运行任何 Git 命令。非阻塞提醒为 browser smoke 的 S91.9 文案检查原先用正则 alternation，已改为逐项缺失检查并复跑通过；复审后改动的跟进只读复审同样未发现阻塞问题。
- 提交：S91.9 实现提交 `dce85fff`（`Polish archive draft reader`）；本哈希记录随低风险纯文档后续提交补入台账。

### 2026-05-27：S91.8 舆图图层校阅与草稿候复状态 polish 完成

- 范围：舆图页在操作区与地图 runtime 之间新增 `data-polish-map-reader="s91-8-map-layer-reader"` 的“图层校阅”，四格显示图层显隐、公开地点/驿路/近事/人物计数、当前可见近事/人物、公开后果与可拟行动、本地舆图草稿是否已入主卷。
- 体验修正：三层全开时读法显示公开卷宗计数和可拟行动条数；点击罗盘、点位、路线或近事写入草稿后，“草稿”格只变为“已入主卷”和候复说明，不回显行动全文；三层全关时读法切换为“三层暂收 / 暂不显示”，提示公开线索不在卷上显示。移动端同 route CSS 单列。
- 边界：本步只改 React 前端读法、舆图 route CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决。浏览器仍只消费现有 `mapRuntimeView`、`domainConsequenceView` 安全投影、图层显示偏好和本地草稿状态；坐标、layout、viewport、画面层级、visual-only effect 和 NPC visual-only anchor 仍只供观图，不能成为主卷证据或地图行动事实。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（109 tests）、`npm run typecheck:client`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-8-map-layer-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1223 tests）；首次 source canary 因新增 `.mapLayerReader dl` 复用旧四格 CSS 间距形状触发 S89.24 重复预算守门失败，已将新读法间距调为 10px 后复跑通过；`git diff --check` 仅输出未触碰归档/素材文件的既有 CRLF warning。
- 子代理：提交前只读复审代理 `019e6b0a-1f98-72f0-a363-dce46d46cff3` 已复审最终 diff 与验证证据，未发现阻塞问题；非阻塞提醒为提交前把复审待执行文案改为已完成，已采纳。代理确认未编辑文件、未运行任何 Git 命令。
- 提交：S91.8 实现提交 `38463a07`（`Polish map layer reader`）；本哈希记录随低风险纯文档后续提交补入台账。

### 2026-05-27：S91.7 皇榜题名校阅与授官候复状态 polish 完成

- 范围：皇榜页新增 `data-polish-ranking-reader="s91-7-ranking-reader"` 的“题名校阅”四读，集中显示已张榜行数、案主榜行、本地细读选择、公开同年座师计数和授官候复提示；仍只读取现有安全皇榜/科举公开 view 与浏览器本地选择状态。
- 体验修正：榜文格只数已经张挂的公开榜行，荣誉摘要不补成正榜；我名格只按服务器标记的本人榜行呈现；细读格随本页榜名选择更新，但明确不改名次、关系或官职；授官格只显示已清洗授官提示和主卷候复边界。App Vitest 覆盖 posted、empty、同名未标记三种状态，污染榜名切换后只显示清洗 fallback。
- 边界：本步只改 React 前端读法、科举/皇榜 route CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决；浏览器不得凭同名、评语、荣誉摘要、本地细读选择或前端文案补认榜次、关系、官职或 hidden 信息。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（108 tests）、`npm run typecheck:client`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-7-ranking-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1222 tests）；首次 source canary 因 S91.6/S91.7 移动端 CSS selector 合并破坏旧正则守门失败，已拆回独立规则后通过；首次 App Vitest 因新增“授官”读法让旧 `getByText("授官")` 变多匹配失败，已改为数量断言后通过；`git diff --check` 仅输出未触碰归档/素材文件的既有 CRLF warning。
- 子代理：提交前只读复审代理 `019e6acd-3e5a-7f00-85b2-269545fa87cc` 已复审最终 diff 与验证证据，未发现阻塞问题；非阻塞提醒为提交前把复审待执行文案改为已完成，已采纳。首次复审提示只禁止 `git add/commit/push/PR`，代理运行了 `git status/diff` 等只读 Git 命令；主代理随后发起同一代理的无 Git 补充复审，明确禁止任何 Git 命令，代理确认未运行 Git、未编辑文件，并再次未发现阻塞问题。
- 提交：S91.7 实现提交 `77504ecd`（`Polish ranking outcome reader`）；本哈希记录随纯文档后续提交补入台账。

### 2026-05-27：S91.6 科举落墨校阅与候榜状态 polish 完成

- 范围：科举页新增 `data-polish-exam-writing-reader="s91-6-exam-writing-reader"` 的“试别 / 草稿 / 交卷 / 候榜”四读，集中显示当前试别/场地流程、本地文章字数、可否呈卷、近次交卷评定和候榜边界；不显示文章正文、raw ledger、隐藏字段、完整 provider/prompt 信息或本地路径。
- 体验修正：交卷成功后 `activeExam` 会按既有 store 逻辑清空，本读法仍根据同案卷 `lastExamResult` 显示“已呈卷”和清洗后的分数摘要，避免退回成“未启封”；榜次、同年、座师与授官仍引导到皇榜公开 view。App Vitest 原先手算文章字数与 `countCjkAwareWords()` 口径不一致，已改为断言数字字数与正文不回显。
- 边界：本步只改 React 前端读法、科举/皇榜 route CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决；浏览器仍只消费现有安全考试 view、本地文章字数、route 状态和交卷回执，不裁决评分、舞弊、放榜、晋级、授官、同年座师或 hidden 信息。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（107 tests）、`npm run typecheck:client`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-6-exam-writing-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1221 tests）；首次 App Vitest 因测试手算字数与组件计数口径不一致失败，调整断言后通过；首次 `git diff --check` 60 秒超时且仅输出既有 CRLF warning，长超时复跑通过。
- 子代理：提交前只读复审代理 `019e6998-28f8-7072-8af8-84bcad3b1ee4` 已复审最终 diff 与验证证据，未发现阻塞问题；非阻塞提醒为提交前把复审待完成文案改为已完成，已采纳，代理未编辑文件、未运行 Git 命令。
- 提交：随本次 coherent change 统一提交，最终哈希见 Git history 和本轮回复。

### 2026-05-27：S91.5 囊箧移置校阅与候批状态 polish 完成

- 范围：囊箧“移置物件”面板新增 `data-polish-inventory-transfer-reader="s91-5-inventory-transfer-reader"` 的“物件 / 去处 / 候批 / 回执”四读，集中显示当前可流转物件、现处、目标容器、候批 readiness 和当前案卷本地回执提示；不显示 raw ledger、隐藏字段、完整 provider/prompt 信息或本地路径。
- 体验修正：成功回执现在既保留原有状态行，也进入移置校阅读法的“回执”格，便于玩家复核最近本地提示；App Vitest 同步断言双处显示，并继续验证换案卷后旧案物件、容器和回执不会串入新案卷。拒绝原因经 `safeLabel(payload.reason, "规则不许", 64)` 清洗后再进入提示。
- 边界：本步只改 React 前端读法、人物/囊箧 route CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决；浏览器仍只消费现有安全囊箧 view、本地选择状态和回执提示，不裁决成交、扣减、赠予、借用、关系回响或真实账目。
- 验证：已通过 `node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`（106 tests）、`npm run typecheck:client`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-5-inventory-transfer-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1220 tests）；首次 App Vitest 因旧断言未适配双处显示失败，已调整后通过；首次 browser smoke 在首页 `networkidle` 超时，单独重跑通过且未命中 S91.5 断言。
- 子代理：提交前只读复审代理 `019e6a71-cd5e-7090-a695-d2619e49f025` 已复审最终 diff 与验证证据，未发现阻塞问题；非阻塞提醒为提交前将本条“复审待完成”文案改为已完成，已采纳，代理未编辑文件、未运行 Git 命令。
- 提交：随本次 coherent change 统一提交，最终哈希见 Git history 和本轮回复。

### 2026-05-27：S91.4 人物往来校阅与本地草稿状态 polish 完成

- 范围：人物详情工作台新增 `data-polish-npc-workbench-reader="s91-4-people-workbench-reader"` 的“照面 / 本地稿 / 回批 / 留痕”四读，集中显示当前人物、页签、本地对话/交易/委派/礼法草稿字数、近次公开回批和当前人物明确绑定的公开记录数量；不显示本地草稿正文，不读取隐藏关系或内部账。
- 体验修正：留痕统计只计入记录对象中明确带当前 NPC 标识的近事、交易或委派记录，避免无标识记录被误归到当前照面；提交前只读复审提出空 NPC 标识兜底风险后，已改为返回 0 并补 source canary。App Vitest 覆盖旧案与同案其他 NPC 回执不串入当前人物读法，本地对话草稿只显示字数。
- 边界：本步只改 React 前端读法、人物 route CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决；浏览器仍只消费现有安全 view、本地输入状态和公开记录，不裁决资源、身份、交易、NPC 行动、经济结果、考试晋级、官职任免、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- 验证：已通过 `npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（105 tests）、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-4-people-workbench-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1219 tests）。
- 子代理：提交前只读复审代理 `019e6a1d-9405-72a3-9cfb-b0593b67ce2f` 已复审最终 diff 与验证证据，未发现阻塞问题；非阻塞建议已采纳，代理未编辑文件、未运行 Git 命令。
- 提交：随本次 coherent change 统一提交，最终哈希见 Git history 和本轮回复。

### 2026-05-27：S91.3 主卷行止校阅与快捷建议状态 polish 完成

- 范围：主卷案桌新增 `data-polish-game-turn-reader="s91-3-main-turn-reader"` 的“身份 / 草稿 / 快捷 / 回批”四读，从现有 route/session 状态、案主身份、场景、已载公开卷宗计数、quick action 状态/条数、上一回批和本地草稿派生；本地草稿只显示来源与字数，不回显草稿全文。
- 体验修正：玩家在主卷上可直接确认当前身份、草稿是否已入底部奏折、快捷建议是否可用、呈上后仍回主卷候复；快捷建议写入草稿后的读法由 browser smoke 检查不会自动提交、不会回显行动全文。
- 边界：本步只改 React 前端读法、route CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决；浏览器仍只消费现有安全 view、本地草稿和页面状态。
- 验证：已通过 `npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`（104 tests）、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm test`（1218 tests）和 `node scripts/clientSmoke.js --screenshots artifacts/s91-3-main-turn-reader-smoke`。初次 `node --test test/reactClientScaffold.test.js` 因新增 `.gameTurnReader dl` 命中既有 CSS duplicate budget 失败，已调开网格间距后复跑通过。
- 提交：随本次 coherent change 统一提交，最终哈希见 Git history 和本轮回复。

### 2026-05-27：S91.2 首页开卷校阅与旧案入口 polish 完成

- 范围：首页开卷表单新增 `data-polish-home-reader="s91-2-home-opening-reader"` 的“题名 / 立绘 / 旧案 / 朱印”四读校阅，从现有朝代年份、姓名、身份、书生家境、自定背景字数、runtime 画像 registry、已选立绘、旧案目录状态、开局 loading/error 和年份校验派生玩家可扫读摘要；自定背景只呈字数，不回显全文。
- 移动端验证修正：browser smoke 暴露既有人物/囊箧移动端仓储按钮内部 overflow；根因是页面级样式导入顺序和移动端按钮装饰伪元素会影响按钮滚动尺寸。已让 `PeoplePage` / `InventoryPage` 先导入 route 样式再导入 mobile override，并在窄屏关闭 `.npcListButton::after` / `.inventoryContainerButton::after`、允许仓储标签换行，source canary 守住顺序与规则。
- 边界：本步只改 React 前端读法、CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决；浏览器仍只消费现有安全 view、本地表单/草稿和页面状态。
- 子代理：提交前只读复审代理 `019e69c3-4e58-7680-852f-41db1761356d` 已复审最终 diff 与验证证据，未发现新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力、服务器裁决越界或自定背景全文回显；非阻塞提醒为 browser smoke 读取 `gridTemplateColumns` 但未显式断言移动端单列，当前已有移动端横向 overflow smoke 与 source canary 守住规则。
- 验证：已通过 `node --test test/reactClientScaffold.test.js`（103 tests）、`npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（76 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`node scripts/clientSmoke.js --screenshots artifacts/s91-2-home-opening-reader-smoke`、`npm run check:docs-governance`、`git diff --check` 和 `npm test`（1217 tests）。一次完整 `npm run smoke:browser -- --screenshots artifacts/s91-2-home-opening-reader-smoke` 因 360 秒外层超时中断，随后直接重跑同一 browser smoke 脚本本体通过。
- 提交：随本次 coherent change 统一提交，最终哈希见 Git history 和本轮回复。

### 2026-05-27：S91.1 设置/AI 来源状态读法 polish 完成

- 范围：右上角印匣“推演设置”面板新增 `data-polish-ai-source="s91-1-ai-source-reader"` 的来源三读，从既有 `aiSettingsView.providerOptions` 与 `taskRoutes` 派生“底本 / 接通 / 候复”三格，说明本地样例 no-key 可玩、真实来源接通或缺 key、未保存改动、分工可呈候复和工具辅佐次数；设置失败时显示“候载”与固定中文提示，不补造来源或回显底层诊断。
- 边界：本步只改 React 前端读法、共享 overlay CSS、移动端单列规则、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材、存档字段、prompt 能力或服务器裁决；浏览器仍只消费安全 settings view、本地偏好/草稿和专题状态。
- 子代理：提交前只读复审代理 `019e690f-e043-7a01-ab07-787e14e514dc` 已复审最终 diff 与验证证据，未发现阻塞问题；非阻塞提醒为本轮污染词检查主要覆盖可见文本而非所有 DOM 属性、未载入/空来源口径仍保持粗粒度 fallback。
- 验证：已通过 `node --test test/reactClientScaffold.test.js`（102 tests）、`npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（75 tests）、`npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`、`npm run check:docs-governance`、`git diff --check`、`npm test`（1216 tests）和 `npm run smoke:browser -- --screenshots artifacts/s91-1-ai-source-reader-smoke`。首次 browser smoke 因新文案包含“未保存”导致既有 Playwright 文本选择器严格匹配到两处而失败，改为“尚待落印”后重跑通过。
- 提交：随本次 coherent change 统一提交，最终哈希见 Git history 和本轮回复。

### 2026-05-27：S90.3 S89/S90 前端 polish 专题归档完成

- 范围：新增 [FRONTEND_PRODUCT_POLISH_ARCHIVE.md](FRONTEND_PRODUCT_POLISH_ARCHIVE.md)，把 S89.1-S89.68 与 S90.1/S90.2/S90.4 的 React 产品 polish、玩家可见读法、CSS 架构/token/keyframe/surface 收敛、安全守门、验证锚点和追溯入口整理为专题归档；同步本活动台账与完成压缩索引。
- 边界：纯文档归档，不改运行时代码、前端行为、后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决。
- 子代理：低风险纯文档改动，按项目规则跳过提交前子代理复审，并在归档记录中说明。
- 验证：已运行 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
- 提交：随本次 coherent 文档提交完成，最终哈希见 Git history 和本轮回复。

### 2026-05-27：S90.4 囊箧、史册、朝议深层读卷 polish 完成

- 范围：囊箧页新增 `data-polish-inventory-reader="s90-4-inventory-ledger-index"` 的“囊箧四读”，把资源、资产、凭证、账解、容器、物件分类和流转候批边界整理成可扫读索引；史册页新增 `data-polish-archive-flow="s90-4-archive-court-reader"` 的“由史册成题”，说明归档、旁证、成题与候复关系；朝议页新增 `data-polish-court-reader="s90-4-archive-court-reader"` 的“材料入席”，说明材料、人物、专题与不定终局边界；`SurfaceHost` 专题层新增同一 S90.4 标记的材料/证据/草稿读法。样式分别放入 `people-inventory.css`、`map-archive.css`、`game.css` 与共享 `overlays-surfaces.css`，移动端均单列。
- 子代理：实施子代理 `019e686e-06c0-7a11-aa91-9e44529016d9` 已完成囊箧/史册/朝议/专题层 patch 与聚焦验证报告，未提交、未推送、未创建 PR。提交前只读复审会随最终 diff 和验证证据执行。
- 边界：本步只改 React 前端读法、CSS、客户端测试、browser smoke 和文档；不新增 route/API/schema/AI 权限/依赖/素材，不请求完整 manifest，不硬编码本地路径，不改变 provider、prompt、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决；浏览器仍只消费安全 view、本地草稿和页面/专题状态，不裁决资源、交易、委派、NPC 行动、经济结果、考试晋级、官职任免、关系、婚姻、弹劾、定罪、背叛或 hidden 信息。
- 验证：已通过 `node --test test/reactClientScaffold.test.js`（101 tests）、`npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1 client/src/__tests__/App.test.tsx`（74 tests）、`npm run build:client`、`npm run budget:client`、`npm run check:docs-governance`、`git diff --check`、`npm test`（1215 tests）和 `npm run smoke:browser -- --screenshots artifacts/s90-4-polish-smoke`。一次与全量 `npm test` 并行的 browser smoke 因首页 `networkidle` 超时失败，单独重跑同命令通过，失败未命中 S90.4 断言。
- 提交：随本次 coherent change 统一提交，最终哈希见 Git history 和本轮回复。

### 2026-05-27：S90.1/S90.2 React 产品级前端 polish 完成

- 范围：S90.1 已把首页、主卷、舆图/史册、人物/囊箧、科举/皇榜和对应移动端样式迁到页面级 import，`global.css` 仅保留 token、base、shell、controls、overlay、motion 和全局移动布局，source canary 新增全局启动样式图预算守门并继续用产品样式全集覆盖历史 selector。S90.2 已整合舆图读图指引、地点状态、路线暗示、掌中 tooltip 操作，人物详情“来函 / 礼法 / 交易 / 委派”读法、人物卡候回音提示、高清立绘“画卷三读”、科举入场-落墨-候批、皇榜题名-同年座师-授官过渡，以及印匣/设置、专题层状态、错误空态和基础控件反馈。
- 子代理：按用户要求拆分为舆图、人物/立绘/科举/皇榜、全局壳/设置三个实施子代理。三个实施子代理均未提交、未推送、未创建 PR；主代理已接管整合，修复舆图类型谓词错误和立绘测试异步重渲染断言。提交前只读子代理复审已完成，无阻塞发现，复审代理仅运行只读轻量检查并认可主代理完整验证证据。
- 边界：不新增依赖或素材，不请求完整 manifest，不硬编码本地路径，不改变后端 API/schema、AI 权限、prompt、provider、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决；浏览器仍只消费安全 view、已审核 runtime 资产引用和本地偏好/草稿/专题状态。
- 验证：已通过 `npm run typecheck:client`、`npm run typecheck:server`、`npm run build:client`、`npm run budget:client`、`npm run qa:runtime-manifest`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、`npm run test:client -- --pool=vmThreads --fileParallelism=false --maxWorkers=1`、`npm run check:docs-governance`、`git diff --check`、`npm test` 和 `npm run smoke:browser -- --screenshots artifacts/s90-polish-smoke`。浏览器 smoke 覆盖首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、设置、移动端和低动效路径。
- 提交：随本次 coherent change 统一提交，最终哈希见 Git history 和本轮回复。

### 2026-05-27：上下文压缩与 S89 完成台账归档

- 范围：压缩 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，把 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md) 中 S89.1-S89.68 的 DONE 表格和近期流水迁出，并在 [ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md) 增加 S89 压缩归档入口。
- 边界：纯文档维护，不改运行时代码、前端行为、后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest、素材 manifest 或服务器裁决。
- 子代理：低风险纯文档改动，按项目规则跳过提交前子代理复审，并在共享上下文记录。
- 验证：已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
- 提交：随本次 coherent 文档提交完成；最终哈希见 Git history 和本轮回复。
