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
- 已完成活动台账压缩索引：[ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md)。

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
- S88 已作为阶段性打磨归档到 [QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)；若后续继续其中某个方向，应新开 S89 或更具体的小步骤，不要把 S88 长流水复制回本文件。

## 4. 活动路线图总览

当前活动小步骤只保留最新可接手状态。S88 全面系统打磨长表已于 2026-05-24 迁出本台账，归档入口为 [QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)，原规划仍见 [QIANQIU_POLISHING_ROADMAP.md](QIANQIU_POLISHING_ROADMAP.md)。

| ID | 状态 | 目标 | 范围 / 下一步 |
| --- | --- | --- | --- |
| S89.6 | DONE | 高清立绘查看器人物小传与当前情况 polish | 承接 S89.5，点击高清立绘后查看器显示“观画印象”人物头、公开标签、外貌介绍、人物小传和当前情况；人物页画像 profile 补案主/名册/详情/谱牒当前情况，均只来自已审阅 runtime 画像元数据和人物页安全摘要。`scripts/clientSmoke.js` 与源码 canary 已覆盖 `s89-6-portrait-life` 标记、人物小传/公开近况文案、存储禁写和污染词守门；CSS 仅保留轻量结构样式并通过预算。未改后端 API/schema、AI 权限、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。实现提交：`d476d41d747afc6e650ed8a6fa5041b23d01c87c`。 |
| S89.5 | DONE | React 全局材质、覆盖层过渡与交互反馈 polish | 主壳、右上角印匣、专题层 drawer/modal/surface、地图行动面板、高清立绘查看器与设置目录已补 S89.5 材质/覆盖层/交互反馈标记和低动效守门；舆图行动只增加本地“已写入草稿”反馈，不提交、不裁决、不扩大 `draftContext` 权限。`scripts/clientSmoke.js` 与源码 canary 已覆盖材质样式、覆盖层标记、地图草稿反馈、立绘查看器和设置目录安全污染守门。范围限 React 前端、样式、客户端 smoke/canary、前端测试和文档；未改后端 API/schema、AI 权限、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。实现提交：`b3237606ffa3abc7fbeb396d89c5c9eb8605f8f9`。 |
| S89.4 | DONE | React 首页旧案状态与史册信息密度 polish | 承接 S89.3 后续建议，补首页旧案卷 loading/empty/error 的案架状态、数量与安全兜底文案，旧案读取失败不再串到开卷表单或回显底层错误；异常 `sessionId` 旧案只显示“暂不可读”，不生成 `/game/...` 读档链接；史册页补“案卷索引/近次线索”导读和更紧凑的公开条目密度，继续只消费 `eventArchiveView`、`domainConsequenceView` 与来函 follow-up 安全投影。只改 React 前端、样式、客户端 smoke/源码 canary、前端测试和文档；不改后端 API/schema、AI 权限、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。实现提交：`3a600b82f86855a563c64563251eec7081724d71`。 |
| S89.3 | DONE | React 设置入口、专题文案与错误空态收束 | 承接 S89.2 后续建议，删除主卷功能页签中的重复“印匣”入口，把 `/game/:sessionId/settings` 保留为刷新/旧路由可达的案头工具目录并导向右上角唯一印匣抽屉；专题层把“数据来源/裁决边界”等工程口径改为“卷宗取材/回批口径”；错误页、404 和畸形主卷恢复页改用统一案卷空态视觉。只改 React 路由壳、专题层文案、前端样式、客户端 smoke/源码 canary 和验收文档；不改后端 API/schema、AI 权限、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。实现提交：`efa507aa729c8acb9503ba8f8e45a67e6b265969`。 |
| S89.2 | DONE | React 视觉矩阵与轻量专题页壳打磨 | 承接 S89.1 后续建议，补真实浏览器视觉回归截图矩阵便捷入口，覆盖首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、设置和移动端印匣；人物/囊箧/史册改用轻量案卷专题页壳，避免独立页重复渲染主卷案头和底部奏折；强化囊箧与专题页材质、按钮反馈、移动端截图、安全污染守门和高清立绘查看器公开说明。不改后端 API/schema、AI 权限、prompt、存档格式、素材 manifest 或服务器裁决。实现提交：`b8a564514498c7de6c6d7183597df51bbab5e662`。 |
| S89.1 | DONE | React 玩家可见文案与移动端覆盖层润色 | 承接 S88.9 残余方向，清理首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、身份循环、推演设置和专题层中的工程词外露；抽屉增加遮罩与外点关闭，人物/囊箧工作台和推演矩阵补窄屏单列；不改后端 API/schema、AI 权限、prompt、存档格式或服务器裁决。提交：随本次 S89.1 提交完成。 |
| DOCS-2026-05-24-S88-ARCHIVE | DONE | 压缩当前上下文并归档 S88 台账 | 新增 S88 专题归档，压缩 `docs/SHARED_CONTEXT.md` 与本文件，活动台账不再展开 S88.0-S88.12 长表。纯文档维护，不改代码、API/schema、运行时行为、提示词、验证工具或素材 manifest；按低风险纯文档规则跳过子代理复审。 |

后续建议：由用户或下一轮 Codex 明确新专项后再加入本表。若继续 S88 残余方向，优先转为新的 S89/S90 小步骤，并继续沿用 S88 归档中的安全边界：安全 view 重建 evidence、浏览器 draft-only、AI proposal-only、服务器裁决、Mock/no-key 可玩、完整书生路径不破坏。

## 5. 最新状态

- 2026-05-24：完成上下文压缩与 S88 台账归档。`docs/QIANQIU_POLISHING_ARCHIVE.md` 现在是 S88.0-S88.12 阶段性打磨的追溯入口，记录已完成/已推进范围、稳定边界、验证锚点和后续候选方向；`docs/SHARED_CONTEXT.md` 与本文件改为短交接板，删除 S88 长流水和重复哈希回填串。`docs/ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md` 已补 S86-S88 完成阶段索引。
- 2026-05-24：S89.1 完成 React 玩家可见文案与移动端覆盖层润色。前端继续只消费安全 view，所有草稿、人物/囊箧操作、地图和专题入口仍由服务器复核；本步不新增 API 字段、不改变 provider/AI schema、不调整存档或 SQLite schema。
- 2026-05-24：S89.2 完成 React 视觉矩阵、轻量专题页壳与高清立绘查看器公开说明，实现提交 `b8a564514498c7de6c6d7183597df51bbab5e662`。当前范围仅限 React 路由壳、前端样式、browser smoke/视觉矩阵脚本、前端测试 canary 和验收文档；人物/囊箧/史册与立绘查看器仍只消费安全 view、runtime manifest 安全字段和本地草稿，不新增服务器裁决入口。
- 2026-05-24：S89.3 完成设置/印匣重复入口收束、专题层玩家可见口径和错误空态视觉。当前范围仍限 React 前端、样式、客户端 smoke/canary 与验收文档，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite 或素材 manifest。
- 2026-05-24：S89.4 完成首页旧案 loading/empty/error 案架状态、异常旧案案号链接防线和史册案卷索引/导读密度 polish。当前范围仍限 React 前端、样式、客户端 smoke/canary、前端测试和文档，不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档或素材 manifest。
- 2026-05-24：S89.5 完成 React 全局材质、覆盖层过渡、地图/立绘/设置目录交互反馈与对应 smoke/canary 文档同步。当前范围仍限 React 前端、样式、客户端 smoke/canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档或素材 manifest。
- 2026-05-24：S89.6 完成高清立绘查看器人物小传与当前情况 polish。当前范围仍限 React 前端、样式、客户端 smoke/source canary、前端测试和文档；不新增浏览器裁决权，不改后端 API/schema、AI 权限、prompt、provider、SQLite、存档或素材 manifest。
- 前一轮 S88 归档是低风险纯文档维护；S89.3-S89.6 涉及前端代码、样式、验证脚本和文档，提交前按子代理复审规则执行。

## 6. 最近完整验证口径

本轮文档压缩与归档验证：

- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`

S89.1 前端润色验证结果：

- 已通过 `npm run typecheck:client`。
- 已通过 `npm run test:client`（6 files / 126 tests）；此前本机曾遇到 Vitest worker 启动超时，另以 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false` 串行池完整复核过同一批断言。
- 已通过 `npm run smoke:browser`，并串联通过 `npm run qa:runtime-manifest`、`npm run build:client` 和 `npm run budget:client`。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`；`git diff --check` 仅输出仓库既有 CRLF warning，非本次修改文件。
- 已通过 `node --test test/reactClientScaffold.test.js` 与完整 `npm test`（1159 tests），源码 canary 已同步到本轮玩家可见文案新口径。
- 最终只读子代理复审已通过。

S89.1 包含前端代码、样式和行为改动，提交前必须完成只读子代理复审。未改后端 API/schema、prompt、AI 权限、SQLite schema 或服务器 resolver，因此不要求 `npm run typecheck:server` 作为本步必跑项；若后续继续触碰跨端契约再补跑。

S89.2 前端视觉矩阵验证结果：

- 已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`。
- `npm run test:client` 本机多次命中 Vitest fork worker 启动超时，已用 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` 通过同一套客户端断言（6 files / 126 tests）；focused `people ledger|portrait viewer|inventory` 通过 7 tests。
- 已通过 `npm run smoke:browser:visual`，并复核 `artifacts/browser-visual-matrix` 中首页、人物、囊箧桌面/移动和史册截图；该命令串联通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client` 和 React browser smoke。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`、`git diff --check`；`git diff --check` 只报告仓库既有 CRLF 提示。
- 已通过完整 `npm test`（1159 tests）。
- 提交前只读子代理复审已通过；复审指出囊箧 `authorityBoundary` 清洗需补本地路径、`manifest/schema/draftContext` 等边缘工程词，本轮已补 `safeLabel()`、React 断言和 browser smoke 桌面/移动守门，并由同一只读子代理复核确认无阻断问题。

S89.3 设置入口、专题文案与错误空态收束验证结果：

- 已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、`git diff --check`。
- `npm run test:client` 本机仍命中 Vitest fork worker 启动超时：4 files / 84 tests 已通过，`client/src/state/uiState.test.ts` 与 `client/src/api/qianqiuClient.test.ts` worker 未启动；已用 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` 通过同一客户端套件（6 files / 126 tests）。
- 已通过 focused React 验收：`keeps the settings route as a directory into one inkbox tool surface`、`opens registry-backed local surfaces`、`global AI settings` 三组 `App.test.tsx` 用例。
- 已通过 `npm run smoke:browser:visual`，该命令串联 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client` 和 React browser smoke，并写出 `artifacts/browser-visual-matrix`；smoke 覆盖单一右上角印匣入口、settings 目录刷新路由、专题层“卷宗取材/回批口径”文案和玩家可见污染守门。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`。
- 已通过完整 `npm test`（1160 tests）。
- 提交前只读子代理复审已通过；复审未发现阻断问题，仅提示把复审完成状态写回文档。

S89.4 首页旧案状态与史册信息密度验证结果：

- 已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`、`git diff --check`。
- 已通过 focused React 验收：`unsupported archive route|S89.4|archive route entries`（5 tests），覆盖首页旧案 loading/empty 互斥、旧案读取失败安全重试、开卷错误后旧案重试失败不覆盖开卷错误、异常旧案案号不生成读档链接、史册案卷索引和近次线索导读。
- 已通过 `npm run test:client`（6 files / 129 tests）；此前同机曾命中 Vitest fork worker 启动超时，本轮修复后又以 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` 通过同一客户端套件（6 files / 129 tests）。
- 已通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`。
- 已通过 `npm run smoke:browser:visual`，该命令串联 runtime manifest QA、client build、budget 和 React browser smoke，并写出 `artifacts/browser-visual-matrix`；smoke 现覆盖首页旧案案架结构、史册案卷索引、移动端史册不溢出、异常/工程词污染守门。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和完整 `npm test`（1160 tests）。

S89.5 React 全局材质、覆盖层过渡与交互反馈验证结果：

- 已通过 `node --check scripts/clientSmoke.js`、`npm run typecheck:client`、`node --test test/reactClientScaffold.test.js`、`git diff --check`。
- `npm run test:client` 本机命中已知 Vitest fork worker 启动超时：5 files / 126 tests 已通过，未见断言失败；已用 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1` 通过同一客户端套件（6 files / 129 tests）。
- 已通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`；最终预算输出为 `CSS 97.5 KiB`，仍在硬性预算内。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- `npm run smoke:browser:visual` 在 240s 限时内已完成 runtime manifest QA、client build 和 budget，但进入 `clientSmoke.js` 后超时；随后直接运行 `node scripts/clientSmoke.js --screenshots artifacts/browser-visual-matrix` 通过，覆盖 S89.5 首页材质、印匣/低动效覆盖层、地图草稿反馈、高清立绘查看器、设置目录和安全污染守门，并写出 `artifacts/browser-visual-matrix`。
- 已通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`。提交前只读子代理复审已通过；实现提交哈希已回填。

S89.6 高清立绘查看器人物小传与当前情况 polish 验证结果：

- 已通过 `npm run typecheck:client`、`node --check scripts/clientSmoke.js`、`node --test test/reactClientScaffold.test.js`、focused `npx vitest --config vitest.config.mjs run client/src/__tests__/App.test.tsx -t "current people ledger" --pool=vmThreads --fileParallelism=false --maxWorkers=1`；只读复审指出 `/Users`、`/private` 与 `tp-...` token 形态未被本轮 portrait profile 路径显式覆盖后，已补 `Portrait.tsx`、`PeoplePage.tsx`、`SurfaceHost.tsx` 三处清洗和 portrait viewer smoke/source canary，并重跑通过上述检查。
- 已通过 `npm run qa:runtime-manifest`、`npm run build:client`、`npm run budget:client`；本轮新增样式一度超过 CSS 硬预算，已裁剪为轻量结构样式，最终预算输出为 `CSS 97.6 KiB`。
- 已通过直接浏览器验收 `node scripts/clientSmoke.js --screenshots artifacts/browser-visual-matrix`，覆盖 S89.6 立绘查看器人物小传/当前情况 polish、runtime 画像路径、浏览器存储禁写和安全污染守门，并写出 `artifacts/browser-visual-matrix`。Vite 仍输出既有 `/assets/ui/...` runtime asset 与 chunk size warnings。
- 已通过完整串行客户端套件 `npx vitest --config vitest.config.mjs run --pool=vmThreads --fileParallelism=false --maxWorkers=1`（6 files / 129 tests）。
- 已通过 `git diff --check`、`npm run check:docs-governance`、`node --test test/documentationGovernance.test.js`。提交前只读子代理首轮发现的路径/key 清洗缺口已修复，最终只读复审已通过，未发现阻断问题。

## 7. 近期进度记录

### 2026-05-24：S89.6 高清立绘查看器人物小传与当前情况 polish

- 范围：高清立绘查看器新增 `data-polish-profile="s89-6-portrait-life"` 人物说明标记，打开后显示“观画印象”人物头、公开标签、外貌介绍、人物小传和当前情况；人物页画像 profile 为案主、名册、详情和谱牒补更具体的公开近况说明。
- 体验：小传文案改为“人物小传据公开传略整理”，外貌文案强调只作观画印象，当前情况明确来自公开案卷/人物页近况；查看器只读已审阅 runtime 画像字段和人物页传入的安全 `PortraitViewerProfile`，不读取完整素材清单，不写浏览器存储、行动草稿、URL 或服务器状态。
- Smoke/canary：`scripts/clientSmoke.js` 现检查 S89.6 profile 标记、人物小传、当前情况、观画印象/公开近况强化文案、存储禁写和 `/Users`、`/private`、`tp-...` 等路径/key 污染；`test/reactClientScaffold.test.js` 与 `App.test.tsx` 同步覆盖新 heading、标记、公开近况文案和污染词守门。
- 边界：本步不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决；人物近况与小传只作公开卷宗摘要，不生成隐藏事实或真实人物行动。
- 复审：提交前只读子代理指出 portrait profile 路径未显式覆盖 `/Users`、`/private` 与 `tp-...` token 形态；本轮已补三处前端清洗、browser smoke 和源码 canary，最终只读复审确认不阻塞提交。
- 验证：按第 6 节 S89.6 口径通过；`artifacts/browser-visual-matrix` 产物目录仅作本地 artifact，不提交。
- 提交：实现提交 `d476d41d747afc6e650ed8a6fa5041b23d01c87c`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.5 React 全局材质、覆盖层过渡与交互反馈 polish

- 范围：主壳新增 S89.5 材质反馈标记，右上角印匣和顶栏接入轻量材质/阴影样式；drawer、modal、本地专题层和高清立绘查看器统一补覆盖层 polish 标记；设置目录与卡片补可检测材质标记。
- 体验：舆图页新增本地 `lastWrittenMapDraftId`，玩家把 runtime 选择、行动牌或近事写入主卷草稿后，对应公开行动/事件行显示 `data-draft-state="written"` 并触发短反馈；切换案卷会清空该本地状态。此反馈只表示浏览器草稿写入，不提交回合、不复核 evidence、不结算地图行动。
- Smoke/canary：`scripts/clientSmoke.js` 新增 `assertS895MaterialFeedbackPolish()`，覆盖材质样式、印匣覆盖层、低动效禁用、地图行动反馈、立绘查看器、设置目录和污染词守门；`test/reactClientScaffold.test.js` 增加源码 canary，确认新增标记仍为 frontend-only 且不引入 raw route、source manifest、provider/key/path/hidden 污染。
- 边界：本步只改 React 前端、样式、客户端 smoke/source canary、前端测试和文档；不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。
- 复审：提交前只读子代理首轮指出空 keyframes 与 `.mapEventList` 写入反馈样式缺口；本轮已改为真实短动画、行动/事件共享写入反馈与低动效覆盖，并强化 browser smoke/source canary 阻断空 keyframes；最终只读复审通过，未发现阻断问题。
- 验证：按第 6 节 S89.5 口径通过；`npm run test:client` 与 `npm run smoke:browser:visual` 的本机超时均已有等价/直接命令通过记录，未见断言失败。
- 提交：实现提交 `b3237606ffa3abc7fbeb396d89c5c9eb8605f8f9`；本次哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.2 React 视觉矩阵、轻量专题页壳与立绘查看器公开说明

- 范围：新增 `smoke:browser:visual`，在默认 React browser smoke 上写出产品视觉矩阵截图，并要求首页、主卷、舆图、人物、囊箧、史册、科举、皇榜、朝议、设置和移动端印匣标签完整；脚本新增囊箧桌面/移动截图、section 完整性、安全污染和首页朱印字体守门。
- 体验：人物、囊箧、史册改用轻量 `sessionRouteShell`，独立页不再重复主卷案头和底部奏折；史册标题提升为页面级 `h1`；囊箧、账解、专题页壳和纸按钮补齐宣纸/折纸/朱印质感与按钮反馈；高清立绘查看器显示外貌介绍、公开传略和当前情况，文本来自已审阅画像元数据与人物安全摘要。
- 修复：纸按钮红印伪元素收回按钮内部，避免伪元素撑大 `scrollWidth` 导致地图页“筛舆图/写入行动”在真实浏览器文本溢出守门中误报；囊箧 `authorityBoundary` 统一经过玩家可见清洗，污染时退回世界内回批口径，并阻断本地路径、密钥、`manifest/schema/draftContext`、`hidden/raw` 和“服务器裁决”等工程词外露。
- 边界：只改 React 路由壳、样式、客户端 smoke/视觉矩阵脚本、前端测试 canary 和验收文档；不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。
- 子代理：已委派只读子代理巡检 S89.2 缺口，指出高清立绘查看器缺少人物说明；提交前只读复审又指出囊箧边界文案清洗缺本地路径和若干工程词覆盖，均已补齐并由同一复审子代理确认无阻断问题。
- 验证：按第 6 节 S89.2 口径通过；`artifacts/browser-visual-matrix` 产物目录仅作本地 artifact，不提交。
- 提交：实现提交 `b8a564514498c7de6c6d7183597df51bbab5e662`；后续哈希回填为低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.3 React 设置入口、专题文案与错误空态收束

- 范围：主卷与轻量专题壳不再渲染重复“印匣”功能页签；`/game/:sessionId/settings` 继续可刷新/直达，但只作为“案头工具”目录，四个卡片分别打开右上角唯一印匣抽屉中的推演、显示、旧案和摘要 tab。
- 体验：错误页、404 和畸形主卷恢复页统一使用 `statePage` 案卷空态壳，补图章、宣纸、墨角、动作按钮图标、进入动效与低动效降级；设置目录卡片补宣纸/朱印材质、hover/focus 抬升和移动端单列。
- 文案：专题层把“数据来源/材料状态/占位状态/裁决边界”改为“卷宗取材/材料进度/案卷状态/回批口径”，browser smoke 和 React canary 阻断 `数据来源|裁决边界|服务器裁决|draftContext|schema|manifest` 等玩家可见泄漏。
- 边界：本步只改浏览器路由入口、文案、样式、客户端 smoke 和测试 canary；不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。设置、专题、错误空态和角色循环入口仍只消费安全 view 或本地 UI 状态，不创建真实行动、交易、任免、考试、地图或 NPC 后果。
- 子代理：开工前已委派只读子代理巡检 S89.3 缺口，指出设置入口重复、专题层工程口径、错误/404 空态和 smoke canary 缺口；提交前只读 diff 复审已通过，未发现阻断问题。
- 验证：按第 6 节 S89.3 口径通过；`artifacts/browser-visual-matrix` 产物目录仅作本地 artifact，不提交。
- 提交：实现提交 `efa507aa729c8acb9503ba8f8e45a67e6b265969`；后续哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.4 React 首页旧案状态与史册信息密度 polish

- 范围：首页旧案区改为独立案架状态，提供 loading/empty/error/ready 互斥呈现、可读旧案数量、案架状态、骨架占位、空态说明和“重翻旧案”安全重试；旧案读取失败只更新 `savesStatus`，不再让开卷朱印进入错误态、覆盖既有开卷错误或回显底层错误。
- 安全：`SaveCaseList` 在生成读档 action 前校验 `isRunnableSessionId()`；异常 `sessionId` 只显示“暂不可读”，不把 `/api/game/state`、本地路径、raw/provider/hidden/key 等污染案号写入链接或载入回调。
- 体验：史册页新增“案卷索引 / 近次线索”导读带，展示入册条目、后果线索、实体余波和前三条公开线索；仍只读 `eventArchiveView`、`domainConsequenceView` 与来函后续 evidence，按钮继续只写本地草稿。
- Smoke：`scripts/clientSmoke.js` 新增首页案架与史册索引 DOM 守门；`.sessionNav` 仅从重叠检查中排除，避免 sticky 二级导航与同名页面标题误判，页签文字仍接受溢出检查。
- 边界：本步只改 React 前端、样式、客户端 smoke/source canary、前端测试和文档；不改后端 API/schema、AI 权限矩阵、prompt、provider facade、SQLite schema、存档格式、runtime manifest 字段、素材 manifest 或服务器裁决。
- 子代理：开工中委派只读子代理巡检 S89.4 缺口，指出首页旧案状态互斥、旧案错误隔离、异常案号链接防线、史册密度和 smoke canary 缺口；提交前只读复审又指出 `refreshSaves()` 在已有开卷错误后仍可能覆盖共享 `error`，本轮已改为旧案读取失败只更新 `savesStatus`，并补 UI 回归测试。
- 验证：按第 6 节 S89.4 口径通过；`artifacts/browser-visual-matrix` 产物目录仅作本地 artifact，不提交。
- 提交：实现提交 `3a600b82f86855a563c64563251eec7081724d71`；提交前按规则执行只读 diff 复审并通过。后续哈希回填仅修改本文件与 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，属于低风险纯文档改动，跳过子代理复审。

### 2026-05-24：S89.1 React 玩家可见文案与移动端覆盖层润色

- 范围：清理 React 页面和专题层中面向玩家的 `AI`、provider/model、服务器、安全视图、projection、resolver、ref 等工程词外露，改成“推演、案卷、公开卷宗、回批、复核、线索”等世界内用语；主卷畸形案卷根路由改为固定安全恢复页。
- 体验：抽屉加入遮罩、外点关闭和移动端满宽布局；常用纸按钮/纸链接补齐焦点、悬停和禁用状态；人物、囊箧、推演分工和统计格在窄屏降为单列，避免表单挤压和长文本溢出。
- 边界：只改浏览器文案、样式和 route recovery；不改后端 API/schema、存档格式、AI 权限矩阵、prompt、provider facade、SQLite schema、runtime manifest 字段或服务器裁决。
- 子代理：开工前已委派只读子代理巡检 React polish 缺口；提交前只读复审指出专题层动态字段、少量固定文案、角色面板空态、快捷行动来源标签、舆图无障碍名称和朝议页专题入口 aria 仍有工程词泄漏，已补专题材料/证据/错误文案清洗、角色面板空态改写、快捷行动玩家语汇映射、舆图/朝议页 aria 名称清理和玩家可见 canary；修复后最终只读子代理复审已通过，未发现阻断或应修复项。
- 验证：已通过客户端类型检查、React 单测、脚手架 canary、串行 Vitest、browser smoke/runtime manifest/build/budget；朝议页 aria 修复后又补跑 `npm run typecheck:client`、`npm run test:client`、`node --test test/reactClientScaffold.test.js` 通过，治理与 diff check 按第 6 节提交前收尾。

### 2026-05-24：完成 S88 台账归档与上下文压缩

- 范围：新增 [QIANQIU_POLISHING_ARCHIVE.md](QIANQIU_POLISHING_ARCHIVE.md)，把 S88 全面系统打磨从活动台账长表迁出；压缩本文件和 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，只保留当前可接手状态、边界、验证入口和下一步建议；[ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md](ACTIVITY_LEDGER_COMPLETED_ARCHIVE.md) 增加 S86-S88 索引。
- 口径：S88 不再在本文件作为 `IN_PROGRESS` 长表维护；若继续打磨，应新开可审查小步骤并引用 S88 归档，不回灌旧流水。
- 边界：纯文档维护，不改运行时代码、后端 API、provider schema、SQLite schema、存档格式、AI 权限、服务器 resolver、canonical state、前端行为或素材 manifest。
- 子代理：低风险纯文档改动，按项目规则跳过提交前子代理复审；已在共享上下文记录。
- 验证：本轮应通过 `npm run check:docs-governance`、`node --test test/documentationGovernance.test.js` 和 `git diff --check`。
