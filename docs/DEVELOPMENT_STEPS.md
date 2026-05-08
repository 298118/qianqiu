# 《千秋》数据库专项开发路线图与进度台账

本文件是 Codex 与 Claude Code 共同维护的当前活动路线图与进度台账。旧阶段细节已经归档：

- 第一阶段：[PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段：[PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段：[PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段：[PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度见 [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md)。
- S48 时间专项：[TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S53 本地数据库基础：[LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md)。
- S54-S59 本地 SQLite 业务表与双模式验收：[LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md)。

当前路线图从 S60 开始，目标是把“超大动态世界数据库”的内容充实度从约 55-65% 推进到可支撑长期历史沙盘的规模。范围仍只考虑本机 JSON/SQLite 持久化增强；远程存档、账号体系、多人同步、云端冲突解决和托管数据库不进入本专项。

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

## 3. 当前专项边界

当前数据库完成度判断：底层本地存储、派生业务表、索引、修复、审计和 JSON/SQLite 双模式验收已经达到可继续扩内容的状态；“超大动态世界数据库”的内容充实度约 55-65%。下一阶段不急于引入远程或多人能力，而是把国家、城市、NPC、官职、事件、情报和 prompt 检索的内容密度补上。

S60+ 必须遵守：

- JSON adapter 继续是默认路径，Mock 模式继续完整可玩。
- SQLite 模式只表示本机不同存档，不引入远程、账号、多人或云端语义。
- `worldState` snapshot 继续可读、可导入、可导出；SQLite 派生表继续可从 `world_sessions.world_state_json` 单向修复。
- 新内容生成只能通过服务器 helper、seed、fixture、受限 proposal 和 adapter transaction；AI 不能执行 SQL、不能直接写表、不能绕过 schema/clamp/可见性过滤。
- API、prompt 和浏览器只读服务器整理后的 projection；不得暴露 raw audit、provider proposal、prompt、本地路径、密钥、隐藏 notes、hidden intent、未公开任所、未公开关系或 hidden raw rows。
- 如果后续要保存真正 hidden 私档或高密度 NPC 内幕，必须先设计玩家 API redaction 和 prompt role-visibility 分层，不能把 hidden 私档塞回当前 raw route `worldState`。

## 4. 已完成归档摘要

| ID | 状态 | 摘要 | 归档 |
| --- | --- | --- | --- |
| S49-S53 | DONE | storage adapter、SQLite session row、本地审计、地理/人物/官职任所 projection、prompt context、浏览器局势簿 | [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md) |
| S54 | DONE | 地理 `geo_*` 业务表、维护工具和 parity | [LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md) |
| S55 | DONE | 人物 `people_*` 可见 bridge、人物事件审计关联 | [LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md) |
| S56 | DONE | 官职任所 `office_*` 派生表、内容 hash 与引用修复 | [LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md) |
| S57 | DONE | 安全事件档案索引、分页和审计公开 projection 工具 | [LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md) |
| S58 | DONE | SQLite prompt 检索索引和浏览器双模式 parity smoke | [LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md) |
| S59.1 | DONE | JSON/SQLite 双模式整体验收入口 | [LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md) |
| S59.2 | DONE | S54-S59 归档、活动台账压缩、S60+ 内容充实专项规划 | 2026-05-08 / Codex / 本次提交 |

## 5. 活动路线图总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S60.1 | TODO | 超大动态世界数据库内容契约：规模目标、seed 分层、数据密度、可见性、隐私和服务器生成边界 | - | - | - |
| S60.2 | TODO | 内容基线与规模验收 fixture：用固定大世界样本定义国家、城市、NPC、官职和事件数量/性能/防泄漏门槛 | - | - | - |
| S61.1 | TODO | 国家与邻国深度内容包：财政、军事、国威、继承风险、外交、情报可信度和国策压力 | - | - | - |
| S61.2 | TODO | 城市与区域深度内容包：全国与邻国城市的税粮、市价、士绅、诉讼、水利、灾害、交通、驻军和书院 | - | - | - |
| S62.1 | TODO | NPC 人口生成与家族谱系：数百 NPC、家族、婚姻、门生故旧、派系、同乡同年和社会身份 | - | - | - |
| S62.2 | TODO | NPC 生命周期与资产流动：财富、田产、官职、婚丧、迁居、健康、人情债和关系记忆演化 | - | - | - |
| S63.1 | TODO | 官职生态与任命池：空缺、候补、上级下属、吏员幕友、考成、任期轮转和差遣压力 | - | - | - |
| S63.2 | TODO | 地方事务与案牍事件模板：钱粮、刑名、灾赈、水利、盗匪、徭役、士绅、疫病和任所收束 | - | - | - |
| S64.1 | TODO | 外交、边防与军事数据库内容：边镇、驻军、粮道、战备、邻国使节、边患事件和可见情报 | - | - | - |
| S64.2 | TODO | 经济、财政、粮储与市场演化：税赋、粮价、盐漕、商路、地方库银、赈济、腐败和财政压力 | - | - | - |
| S65.1 | TODO | 事件模板与历史档案生成系统：可组合事件链、跨域因果、公开/密档 projection 和审计关联 | - | - | - |
| S65.2 | TODO | 情报、传闻与可见性系统：角色视野、传闻可信度、线索来源、秘密过滤和 prompt 可读边界 | - | - | - |
| S66.1 | TODO | 大规模 prompt retrieval 策略：排序、预算、分页、角色视野、性能和 token 防线 | - | - | - |
| S66.2 | TODO | 大数据量浏览器信息面板：城市、NPC、官职、事件的搜索、筛选、分页和 hidden-token smoke | - | - | - |
| S67.1 | TODO | 规模/性能/回归验收：大 fixture 下的 dual-mode、读档修复、prompt 检索、UI 和内存/耗时门槛 | - | - | - |
| S67.2 | TODO | 内容充实阶段归档与下一阶段交接 | - | - | - |
| S70.1 | TODO | 多 AI 协作编排层规划：任务路由、仲裁、成本边界、失败降级和验收矩阵 | - | - | S67 后启动 |
| S70.2 | TODO | 多 AI 协作实现：在现有 `mimo-deepseek` 最小路由基础上扩展 narrator/grader/critic/safety 分工 | - | - | S70.1 后 |

## 6. S60：内容契约与规模验收

### S60.1：超大动态世界数据库内容契约

状态：TODO。

目标：

- 固定“超大动态世界数据库”的内容目标、规模档位和阶段性定义。
- 建议规模档位：开发小样本、默认可玩中样本、压力测试大样本。
- 明确国家、邻国、城市、NPC、家族、官职、事件、情报和 prompt 索引的字段密度。
- 标注静态 seed、每局动态、服务器 hidden、玩家可见、prompt 可读、浏览器可查和审计可追溯的分层。
- 明确内容生成入口：seed catalog、服务器 generator、fixture、受限 AI proposal 和迁移/修复工具。

验收：

- 文档明确 local-only、AI 不直写库、view-first、hidden 不回填 raw route state。
- 给出 S60.2 大世界 fixture 的数量目标和防泄漏验收口径。
- 同步 brief、动态数据库规划、共享上下文和必要 README 摘要。

### S60.2：内容基线与规模验收 fixture

状态：TODO。

目标：

- 新增固定测试 fixture 或 generator，覆盖多个国家、数十城市、数百 NPC、若干官署/官职、事件链和情报可见性。
- 让 fixture 能在 JSON 与 SQLite 双模式下生成同等安全 view。
- 建立“内容密度”可测指标：国家/城市/NPC/事件数量、prompt retrieval 条目、事件档案分页、隐藏词防线和运行耗时。

验收：

- focused tests 覆盖 fixture 数量、view parity、hidden-token、prompt budget 和读档修复。
- 不要求一次性做完整玩法内容，但必须让后续 S61-S66 有稳定验收样本。

## 7. S61：国家、邻国、城市与区域

### S61.1：国家与邻国深度内容包

状态：TODO。

目标：

- 扩充本国与邻国字段：财政、军力、国威、正统性、朝局稳定、继承风险、外交关系、互市/贡使、边患、情报可信度。
- 让 World Entities / Threads 可以读取国家级压力，但最终外交、战争、割地、议和仍由服务器裁决。
- 为玩家身份提供不同可见摘要：书生只见传闻，官员/皇帝可见更高置信度奏报。

### S61.2：城市与区域深度内容包

状态：TODO。

目标：

- 扩充全国及邻国城市：人口、税基、粮储、市价、商路、士绅、书院、诉讼、徭役、水利、灾害、治安、驻军、驿路。
- 明确地方官、将领、入仕官员在不同任所应读取哪些城市/区域指标。
- 城市变化应能落入事件档案、官职考成和 prompt retrieval。

## 8. S62：NPC、家族与人生演化

### S62.1：NPC 人口生成与家族谱系

状态：TODO。

目标：

- 生成或 seed 数百 NPC，覆盖官员、胥吏、士绅、商贾、军官、书院师友、同年、亲族、邻国使者等身份。
- 补家族、婚姻、门生故旧、同乡同年、派系和社会声望网络。
- NPC 不全量进入 prompt，只由服务器按地点、事件、关系、官署和玩家输入检索。

### S62.2：NPC 生命周期与资产流动

状态：TODO。

目标：

- 建立服务器生命周期 helper：财富/田产变化、婚丧、迁居、健康、官职履历、声誉、人情债、怨怼和庇护关系。
- AI 只能建议可见关系或事件语气；资产真数、隐藏动机、死亡/任免等仍由服务器裁决。
- 人物变化应关联安全事件档案和 `people_*` 派生行。

## 9. S63：官职生态与地方事务

### S63.1：官职生态与任命池

状态：TODO。

目标：

- 扩充空缺、候补、补授、试署、外放、升迁、丁忧、起复、弹劾、考成和上级下属网络。
- 建立官署内部角色：堂官、属官、胥吏、幕友、同僚和地方士绅接口。
- 保护完整书生入仕路径，`player.officeTitle` 和任免仍由服务器写入。

### S63.2：地方事务与案牍事件模板

状态：TODO。

目标：

- 为地方官与入仕官员补事件模板：钱粮、刑名、灾赈、水利、盗匪、徭役、士绅、疫病、学政、驿递。
- 事件模板需要可组合、可审计、可落地城市指标，并能生成官场考成影响。
- 不把事件模板交给 AI 随意改库；AI 只写叙事和受限 proposal。

## 10. S64：外交、军事、经济与市场

### S64.1：外交、边防与军事数据库内容

状态：TODO。

目标：

- 补边镇、驻军、粮道、战备、军心、统帅、边境事件、邻国使节、谈判和战争预警。
- 信息必须按角色视野、地理距离和情报可信度过滤。

### S64.2：经济、财政、粮储与市场演化

状态：TODO。

目标：

- 补税赋、粮价、商路、盐漕、矿冶、地方库银、赈济、腐败、债务和财政压力。
- 经济变化与城市、国家、官职考成、事件档案和 prompt retrieval 联动。

## 11. S65：事件档案、情报与可见性

### S65.1：事件模板与历史档案生成系统

状态：TODO。

目标：

- 建立可组合事件模板和事件链，覆盖自然灾害、官场争斗、边事、商税、人物关系、科举、地方差遣。
- 每个事件明确公开摘要、密档摘要、related refs、applied changes、审计链接和后续触发条件。

### S65.2：情报、传闻与可见性系统

状态：TODO。

目标：

- 建立情报来源、可信度、角色视野、传闻流转和隐藏信息过滤规则。
- 同一事实可根据身份显示为奏报、坊间传闻、同僚私信或完全不可见。
- prompt/UI 不读 hidden raw rows。

## 12. S66：大规模检索与浏览器面板

### S66.1：大规模 prompt retrieval 策略

状态：TODO。

目标：

- 在 `prompt_retrieval_index` 基础上补排序策略、token 预算、分域上限、角色视野、事件新鲜度和玩家输入匹配。
- 建立大 fixture 下的 prompt budget 与 hidden-token tests。

### S66.2：大数据量浏览器信息面板

状态：TODO。

目标：

- 为城市、NPC、官职、事件提供搜索、筛选、分页、排序和移动端可读布局。
- 浏览器仍只读 route views，不读取 raw SQLite table。
- 加 smoke 覆盖 overflow、hidden token、分页 metadata 和 JSON/SQLite parity。

## 13. S67：规模验收与归档

### S67.1：规模/性能/回归验收

状态：TODO。

目标：

- 在大 fixture 下验证 JSON/SQLite dual-mode、读档修复、prompt retrieval、局势簿分页、事件档案和 hidden-token 防线。
- 记录内存、耗时、条目数量和失败降级。

### S67.2：内容充实阶段归档与下一阶段交接

状态：TODO。

目标：

- 把 S60-S67 实现细节压缩入归档。
- 更新 brief、README、共享上下文和路线图下一阶段。
- 若用户重新开启多 AI 编排，转入 S70；否则继续做玩法内容或 UI 深化。

## 14. S70：多 AI 协作编排

S70 是 MiMo + DeepSeek 之后的多模型协作后续规划，已从原 S60 顺延，避免挤占当前数据库内容充实专项。当前 `mimo-deepseek` 仍只是 provider 方法级路由：普通叙事、开局、流式回合和科举出题走 MiMo，科举评卷走 DeepSeek V4 Pro。完整 narrator/grader/critic/safety 仲裁、成本边界、失败降级和可观测性排在 S67 之后再启动。

## 15. 进度记录

### 2026-05-08

工具：Codex

步骤：S59.2 归档与 S60+ 内容充实专项规划

提交：本次提交。

完成：

- 新增 [LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md)，归档 S54-S59 已完成的地理、人物、官职任所、事件档案、prompt 检索、浏览器 parity 和双模式验收。
- 将活动台账压缩为 S60+ “超大动态世界数据库内容充实”路线图，把原多 AI S60 顺延为 S70。
- 明确当前内容充实度约 55-65%，后续重点从“数据库底座”转向国家/邻国、城市、NPC、官职生态、地方事务、外交军事、经济市场、事件模板、情报可见性和大规模检索。
- 重申本专项只考虑本地 JSON/SQLite；不规划远程存档、账号体系、多人同步、云端冲突解决或托管数据库。

验证：

- 已通过：`npm run check:docs-governance`
- 已通过：`node --test test/sessionStoreAdapterContract.test.js test/sqlitePromptRetrieval.test.js test/dualModeAcceptanceScript.test.js test/sqliteGeographyTool.test.js test/auditEventArchiveTool.test.js`（66 tests）
- 已通过：`git diff --check`
- 提交前只读复审：本轮涉及路线图重写和内容保护，已委派只读子代理检查最终 diff 与验证证据。

风险/遗留：

- 本轮是文档规划与上下文压缩，不改运行时代码、测试、API、provider schema、存档格式或 SQLite 表结构。
- S60.1 仍需把内容规模、seed 分层、hidden 私档/API redaction、fixture 数量和 prompt budget 写成更严格契约。

下一步：

- 开始 S60.1：超大动态世界数据库内容契约。
