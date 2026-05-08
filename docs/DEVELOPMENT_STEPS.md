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
- AI 是《千秋》的核心世界引擎，不是可替换装饰；新增玩法、数据域、角色、官署、事件、面板或 prompt 检索时，必须设计 AI 的读取范围、角色智能、工具权限、proposal 边界、服务器裁决、审计记录和 Mock/no-key 降级。
- AI 只能生成叙事、题目、评分建议、关系建议和受限 `statePatch`；服务器继续拥有时间推进、状态边界、科举晋级、作弊处罚、官场任免、长期事件、世界实体、世界议程、数据库写入和持久化裁决。
- 游戏规则、数值阈值、时间间隔、概率、UI 限制、fixture 规模和 prompt budget 等可调参数不得散落为魔法数字；新增或调整时优先集中到具名配置模块，例如 `src/config/GameConfig.js` 或更贴近领域的 `src/game/*Config.js`，并写清单位、范围和默认值意图。
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
| S59.2 | DONE | S54-S59 归档、活动台账压缩、S60+ 内容充实专项规划 | 2026-05-08 / Codex / `fd8cf72` |

## 5. 活动路线图总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S60.1 | DONE | 超大动态世界数据库内容契约：规模目标、seed 分层、数据密度、可见性、隐私和服务器生成边界 | 2026-05-08 | Codex / 子代理 | 本次提交 |
| S60.2 | IN_PROGRESS | 内容基线与规模验收 fixture：用固定大世界样本定义国家、城市、NPC、官职和事件数量/性能/防泄漏门槛 | - | Codex / 子代理 | - |
| S61.1 | DONE | 国家与邻国深度内容包：财政、军事、国威、继承风险、外交、情报可信度和国策压力 | 2026-05-08 | Codex / 子代理 | `2d15b07` |
| S61.2 | DONE | 城市与区域深度内容包：全国与邻国城市的税粮、市价、士绅、诉讼、水利、灾害、交通、驻军和书院 | 2026-05-08 | Codex / 子代理 | `aa8c75b` |
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
| S70.0 | DONE | AI 编排提前规划：固定 AI 核心地位、现实权力原型、工具调用路线、actor 权限层和 S70 子步骤 | 2026-05-08 | Codex / Web / 子代理 | 本次文档提交 |
| S70.1 | TODO | AI 工具协议契约：tool envelope、proposal/result schema、strict schema、失败降级和 provider 兼容策略 | - | - | S67 后启动 |
| S70.2 | TODO | AI actor 与权限模型：按书生、士绅、地方官、大臣、将领、皇帝、系统引擎划分读取范围和工具组 | - | - | S70.1 后 |
| S70.3 | TODO | 内部工具运行时：`game_ai_tools` registry、权限检查、read/proposal runner、审计 hook 和 Mock runner | - | - | S70.2 后 |
| S70.4 | TODO | NPC mind 与记忆：高显著度 NPC LLM loop、背景 NPC heuristic、目标/恩怨/人情债记忆演化 | - | - | S70.3 后 |
| S70.5 | TODO | 制度 AI 与朝议场景：官署、派系、大臣、谏官和皇帝围绕奏折/弹章/政令进行 scene-local 推演 | - | - | S70.4 后 |
| S70.6 | TODO | 压力驱动事件生成器：由城市、财政、军政、关系、情报压力生成额外事件候选并由服务器成案 | - | - | S70.5 后 |
| S70.7 | TODO | 刑名、财政、军事、外交工具：案牍、赈济、军令、战役、和议、宣战等 proposal 与 resolver | - | - | S70.6 后 |
| S70.8 | TODO | 多模型路由与仲裁：narrator、actor_mind、planner、domain_specialist、critic、safety 分工与成本边界 | - | - | S70.7 后 |
| S70.9 | TODO | AI 调动可观测性：工具调用摘要、拒绝原因、成本、审计面板和 hidden-safe 开发诊断 | - | - | S70.8 后 |
| S70.10 | TODO | S70 大世界验收与归档：Mock/no-key、JSON/SQLite parity、hidden-token、越权工具、provider smoke 和归档 | - | - | S70.9 后 |

## 6. S60：内容契约与规模验收

### S60.1：超大动态世界数据库内容契约

状态：DONE。

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

完成：

- 新增 [HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md](HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md)，固定开发小样本、默认可玩中样本和压力测试大样本三档规模，明确国家/城市/NPC/家族/官职/事件/情报/prompt 索引的字段密度。
- 写入 seed catalog、场景 seed pack、每局动态安全账本、服务器 hidden 私档、玩家可见 view、prompt retrieval、浏览器 projection 和审计公开 projection 的分层规则。
- 明确 S60.2 `small` / `medium` / `large` fixture 最低数量、hidden-token、防泄漏、prompt budget、JSON/SQLite parity、读档修复和浏览器分页验收口径。

### S60.2：内容基线与规模验收 fixture

状态：IN_PROGRESS。

目标：

- 新增固定测试 fixture 或 generator，覆盖多个国家、数十城市、数百 NPC、若干官署/官职、事件链和情报可见性。
- 让 fixture 能在 JSON 与 SQLite 双模式下生成同等安全 view。
- 建立“内容密度”可测指标：国家/城市/NPC/事件数量、prompt retrieval 条目、事件档案分页、隐藏词防线和运行耗时。
- 数量、hidden canary、prompt budget 和 parity 口径以 [HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md](HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md) 的 `small` / `medium` / `large` fixture 目标为准。

验收：

- focused tests 覆盖 fixture 数量、view parity、hidden-token、prompt budget 和读档修复。
- 不要求一次性做完整玩法内容，但必须让后续 S61-S66 有稳定验收样本。

阶段性进展：

- 已新增 `src/game/worldContentFixtures.js`，提供 `small` deterministic fixture、数量度量、prompt budget 报告、hidden canary 侧车和污染输入 helper。
- `small` fixture 当前生成 6 国、24 城、96 NPC、32 家族、160 关系、80 官职/官署目录行、48 任命行、64 条事件/情报侧车和约 491 条安全 prompt retrieval 行；真正 private canary 不写入当前 raw route `worldState`。
- 已新增 `test/worldContentFixtures.test.js`，覆盖数量门槛、hidden canary 防泄漏、prompt summary 高相关预算、JSON/SQLite view parity 和缺失 `prompt_retrieval_index` 行读档修复。
- 本步骤仍为 `IN_PROGRESS`：`medium` / `large` fixture、事件档案/浏览器分页大数据验收和普通回合全局 48 行 prompt budget 仍待 S60.2 后续切片与 S65/S66/S67 完成。

## 7. S61：国家、邻国、城市与区域

### S61.1：国家与邻国深度内容包

状态：DONE。

目标：

- 扩充本国与邻国字段：财政、军力、国威、正统性、朝局稳定、继承风险、外交关系、互市/贡使、边患、情报可信度。
- 让 World Entities / Threads 可以读取国家级压力，但最终外交、战争、割地、议和仍由服务器裁决。
- 为玩家身份提供不同可见摘要：书生只见传闻，官员/皇帝可见更高置信度奏报。

完成：

- 新增 `src/game/worldGeographyConfig.js`，集中 S61 国家/城市深度指标默认值、字段 keys 和文本上限，避免把可调指标散落为魔法数字。
- `worldGeography` 国家行新增 `fiscalPressure`、`militaryReadiness`、`nationalPrestige`、`legitimacy`、`successionRisk`、`diplomaticTension`、`tributeTradeActivity`、`intelligenceReliability`、`policyPressureTags`、`diplomaticPosture`、`intelligenceSummary`。
- 这些字段进入 `worldGeographyView`、capped prompt summary、`retrievalContext.geography` 和 `prompt_retrieval_index` 安全 payload；SQLite `geo_countries.metadata_json.s61CountryDepth` 保存派生摘要，但不新增 STRICT 表列，兼容已有本地库。
- AI 只可读取这些服务器可见 projection 并解释公开奏报/传闻；外交、战争、割地、贡使关系、继承结果和国家指标改写仍由服务器后续 resolver 裁决。

### S61.2：城市与区域深度内容包

状态：DONE。

目标：

- 扩充全国及邻国城市：人口、税基、粮储、市价、商路、士绅、书院、诉讼、徭役、水利、灾害、治安、驻军、驿路。
- 明确地方官、将领、入仕官员在不同任所应读取哪些城市/区域指标。
- 城市变化应能落入事件档案、官职考成和 prompt retrieval。

阶段性进展：

- 已给城市行补入 S61 安全深度指标：`populationScale`、`taxBase`、`grainStock`、`marketPriceStress`、`gentryInfluence`、`lawsuitPressure`、`corveeBurden`、`waterworksIntegrity`、`disasterRisk`、`trafficLoad`、`garrisonStrength`、`academyLevel`、`localIssueTags`、`cityIntelligenceSummary`。
- 指标已进入 `worldGeographyView`、prompt summary、`retrievalContext.geography`、`prompt_retrieval_index` 和 SQLite `geo_cities.metadata_json.s61CityDepth`；prompt budget 仍由既有 domain cap 控制。
- 任所桥接已开始读取 S61 城市指标：`officialPostings` 的 `localMetrics` 优先使用城市税基、词讼、水利、士绅、灾害、驻军和书院等 projection，玩家地方官自有地方指标仍优先；玩家当前任所考成会追加“任所奏报”公开摘要，`eventArchiveView` 也会从可见 `assessmentRecords` 派生 `official_assessment` 安全条目。
- 城市深度指标已从静态 seed 升级为 seed 基线 + 当前财政、粮储、治安、腐败、军情压力的幂等服务器刷新；同一 `turnCount` 的 route view 不会反复漂移，进入新回合或旧档补刷时才重新派生。
- 已补 raw `officialPostings.assessmentRecords` 污染回归、地方官 `banditPressure` 优先级断言、SQLite `event_archive_index` / `prompt_retrieval_index` 对 S61 任所考成摘要的修复回归。
- S60 small fixture 的扩展国家和城市已带 S61 可见指标，并加入 hidden canary 文本字段防泄漏测试。
- S61 范围至此收束完成；更大 `medium/large` fixture、浏览器分页搜索和大数据量信息面板归入 S60.2/S66/S67 后续验收。

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

S70 是 MiMo + DeepSeek 之后的 AI 编排专项，已从原 S60 顺延，避免挤占当前数据库内容充实专项。当前 `mimo-deepseek` 仍只是 provider 方法级路由：普通叙事、开局、流式回合和科举出题走 MiMo，科举评卷走 DeepSeek V4 Pro。完整 AI actor、工具调用、NPC 智力、事件生成、制度推演、narrator/planner/critic/safety 仲裁、成本边界、失败降级和可观测性排在 S67 之后再启动。

详细提前规划见 [AI_ORCHESTRATION_ROADMAP.md](AI_ORCHESTRATION_ROADMAP.md)。S70 的核心目标不是让模型直接改库，而是让 AI 在服务器法度内变成“有身份、有记忆、有权限、有后果”的世界行动者网络。

### S70 设计基线

- AI 是《千秋》的核心世界引擎。后续新增玩法、角色、官署、城市、事件、经济、战争、外交、浏览器面板或 prompt 检索时，都必须设计 AI actor、可读摘要、可调用工具、proposal 边界、服务器裁决、审计和 Mock/no-key 降级。
- 工具调用采用“模型请求、服务器执行”：OpenAI/Anthropic/DeepSeek 等 provider 的 function calling、structured output、MCP connector 或未来内部 MCP 只能产生 tool call / proposal；真正读写世界仍由服务器 helper、schema、权限检查、clamp、visibility filter 和 adapter transaction 完成。
- 权力按现实原型分层：书生只影响自身学业、关系、文章、名声和局部微事件；地方官能审案、赈济、征粮和治理辖区；大臣、将领和总督能提出跨区域政策、弹章、军令和调粮；皇帝可下诏、任免、诛罚、宣战或和议，但必须承受礼法、证据、财政、军心、士论、派系和执行链反噬。
- 大多数 NPC 不全量调用大模型。S70 先做高显著度 NPC、场景参与者、权力核心、玩家近关系和事件相关者的 AI mind；背景 NPC 走服务器启发式、批处理 proposal 和记忆摘要。
- 多模型只改变建议、叙事质量和审查力度，不改变服务器最终裁决权。多数模型同意也不能绕过 schema、白名单、hidden 过滤、科举晋级、官职任免、战争结局、数据库写入或审计规则。

### 推荐工具组

- 只读工具：`world.read_visible_context`、`memory.read_actor_memory`、`law.read_ritual_legal_bounds`、`office.read_docket`、`intel.read_reports`、`market.read_prices`。
- Proposal 工具：`actor.propose_personal_action`、`relationship.propose_delta`、`event.propose_incident`、`office.propose_memorial`、`city.propose_policy`、`judicial.propose_case_resolution`、`military.propose_order`、`diplomacy.propose_move`、`ruler.propose_edict`。
- 服务器裁决工具：`server.adjudicate_policy`、`server.resolve_case`、`server.apply_appointment`、`server.resolve_battle`、`server.apply_diplomacy`、`server.schedule_event_chain`、`server.apply_relationship_memory`、`server.write_audit_and_revision`。这些工具不是模型可直接执行的动作，而是服务器 resolver。

### 深层玩法方向

- NPC 智力：NPC 记住恩怨、亲族、门生、派系、人情债、风险和目标；玩家的善恶、错判、救援、提拔或迫害会多年回响。
- 官僚执行链：皇帝诏令、高官奏折、地方执行、军镇供给、士绅配合、财政承压和舆论反弹形成多段因果，强权不等于无成本成功。
- 合法性与滥权：无证杀臣、越法征敛、擅自出兵、伪造祥瑞、乱开边衅都可以成为玩法，但必须留下合法性、士论、军心、财政、家族和派系后果。
- 压力驱动事件：粮价、水利、边防、财政、派系、人物野心、书院清议和邻国继承风险共同生成额外事件候选，由服务器裁定是否成案。
- 场景化 AI：朝议、堂审、会盟、战役、科场、地方差遣收束都应使用 scene-local time，让多个 AI actor 在同一场景里基于身份和证据互动。

## 15. 进度记录

### 2026-05-08

工具：Codex

步骤：S61.2 城市与区域深度内容包（动态刷新与验收收尾）

提交：`aa8c75b`

完成：

- `src/game/worldGeographyConfig.js` 新增 S61 城市动态刷新权重，`src/game/worldGeography.js` 让城市深度指标以 seed 为基线，随财政、粮储、治安、腐败和军情压力由服务器幂等派生。
- 同一 `turnCount` 下已刷新的 seed 城市不会在 route view / prompt summary 构造时反复漂移；进入新回合、旧档补刷或上层压力改变后才重新生成城市深度 projection。
- 补齐上一轮只读复审建议：raw `officialPostings.assessmentRecords` 污染不会进入 `eventArchiveView`，地方官 `banditPressure` 优先影响任所 `militaryPressure`。
- 补 SQLite 双模式回归：污染的 `prompt_retrieval_index` S61 任所考成行、污染的 `event_archive_index` `official_assessment` 行都会从服务器可见 view 单向修复。
- S61.2 状态改为 `DONE`。更大 `medium/large` fixture、浏览器分页搜索和大数据量面板继续归入 S60.2/S66/S67，不再作为 S61 未完成项。

验证：

- 已通过：`node --test test/worldGeography.test.js`
- 已通过：`node --test test/officialPostings.test.js`
- 已通过：`node --test test/eventArchive.test.js test/sqlitePromptRetrieval.test.js`
- 已通过：`node --test test/sessionStoreAdapterContract.test.js`
- 已通过：`npm run check:docs-governance`
- 已通过：`git diff --check`
- 已通过：`npm test`（456 tests）
- 提交前只读复审：子代理 Carver 未发现 P0/P1/P2 或需提交前处理的 P3；确认未编辑文件、未运行 Git 命令。

风险/遗留：

- 本轮仍不新增 SQLite STRICT 表列、不改变 route shape、provider schema 或官场/外交/战争/城市治理裁决；AI 只读可见 projection。
- S60.2 的 medium/large fixture、S66 浏览器搜索筛选分页、S64/S65 更完整经济/军事/灾害 resolver 仍需后续步骤承接。

下一步：

- 开始 S62.1 NPC 人口与家族谱系，或先转 S60.2/S66 扩 medium/large fixture 和局势簿分页搜索验收。

### 2026-05-08

工具：Codex、只读子代理 Galileo / Einstein

步骤：S61.2 城市与区域深度内容包（任所考成与事件档案切片）

提交：`112a35c`。

完成：

- `src/game/officialPostings.js` 的任所 `localMetrics` 开始优先读取 S61 城市深度指标：`taxBase` 映射钱粮能力，`lawsuitPressure` 映射词讼，`waterworksIntegrity` 映射水利，`gentryInfluence`、`disasterRisk`、`academyLevel`、`garrisonStrength` 等进入公开任所压力摘要；地方官玩家自有 `localOrder` / `pendingLawsuits` / `waterworks` / `gentryRelations` 仍优先。
- 玩家当前任所 `assessmentRecords` 的 `publicFinding` / `publicSummary` 追加“任所奏报”，把税基、粮储、市价、士绅、词讼、水利、灾害、驿路、驻军和书院等 S61 城市压力转成 capped 中文摘要；不改变 `meritScore`、`riskScore`、`recommendation` 或官场任免算法。
- `src/game/eventArchive.js` 新增 `official_assessment` 公开事件档案来源，只从 `buildOfficialPostingsView()` 的可见 `assessmentRecords` 读取，经既有 `cleanArchiveText()` / `makeArchiveItem()` 过滤，不读 raw `officialPostings`、raw `geo_*`、SQLite 表或审计 proposal。
- prompt 输入通过 `officialPostings` / `officialPostingsView` 可读到“任所奏报”，SQLite 派生表继续经 `office_assessments` / `event_archive_index` / `prompt_retrieval_index` 的安全 projection 流动，不新增 STRICT 表列。

验证：

- 已通过：`node --test test/officialPostings.test.js`
- 已通过：`node --test test/eventArchive.test.js`
- 已通过：`node --test test/gameTurnEventArchive.test.js`
- 已通过：`node --test test/sqlitePromptRetrieval.test.js`
- 已通过：`node --test test/prompts.test.js`
- 已通过：`npm run check:docs-governance`
- 已通过：`git diff --check`
- 已通过：`npm test`（450 tests）
- 只读最终复审：Einstein 未发现阻断提交的问题；建议后续补 raw `officialPostings.assessmentRecords` 污染回归和地方官 `banditPressure` 优先级断言。

风险/遗留：

- 本轮只做可见摘要联动，不让城市指标直接裁决升迁、弹劾、任免、地方治理结果或外交/军事结果。
- 仍待后续补 SQLite event/prompt 大样本污染探针、raw `officialPostings.assessmentRecords` 污染回归、地方官 `banditPressure` 优先级断言、浏览器分页/筛选、城市指标随经济/军事/灾害系统动态演化。

下一步：

- 继续 S61.2 或转入 S60.2/S66：为更多城市样本和浏览器局势簿分页加入规模验收，或补 `event_archive_index` / `prompt_retrieval_index` 对 S61 考成摘要的 dual-mode 污染回归。

### 2026-05-08

工具：Codex、子代理 Zeno

步骤：S61.1 国家与邻国深度内容包；S61.2 城市与区域深度内容包（基础指标切片）

提交：`2d15b07`。

完成：

- 新增 `src/game/worldGeographyConfig.js`，集中 S61 国家/城市深度指标默认值、字段 keys 和文本上限。
- 国家行新增财政压力、军备、国威、正统性、继承风险、外交张力、贡贸活跃度、情报可靠度、政策压力标签、外交态势和情报摘要；城市行新增人口规模、税基、粮储、市价、士绅、词讼、徭役、水利、灾害、交通、驻军、书院和城市情报摘要。
- `worldGeographyView`、`summarizeWorldGeographyForPrompt()`、`retrievalContext.geography` 和 `prompt_retrieval_index` 均携带这些安全字段；SQLite `geo_countries` / `geo_cities` 通过 `metadata_json.s61CountryDepth` / `metadata_json.s61CityDepth` 保存派生摘要，不新增 STRICT 表列。
- S60 small fixture 的扩展国家/城市补入 S61 指标，并把 hidden canary 文本字段加入污染输入，验证 view/prompt/retrieval 不泄漏。
- 同步地理契约、开发 brief、AI 权限矩阵、README 与共享上下文；AI 仍只读可见 projection，不写地理 ledger、`geo_*`、外交/战争/城市治理结果。

验证：

- 已通过：`node --test test/worldGeography.test.js`
- 已通过：`node --test test/worldGeographySeeds.test.js`
- 已通过：`node --test test/worldContentFixtures.test.js`
- 已通过：`node --test test/sqlitePromptRetrieval.test.js`
- 已通过：`node --test test/sessionStoreAdapterContract.test.js`
- 修复只读复审发现的旧 SQLite prompt 索引升级缺口后，已重跑：`node --test test/sqlitePromptRetrieval.test.js`（4 tests）
- 已通过：`npm run check:docs-governance`
- 已通过：`node --test test/documentationGovernance.test.js`
- 已通过：`git diff --check`
- 已通过：`npm test`（449 tests）

风险/遗留：

- 本轮不改变 API 路由数量、provider schema、存档 envelope、SQLite 表列、前端面板布局或服务器外交/战争/城市治理裁决。
- S61.2 仍为 `IN_PROGRESS`；更大城市样本、事件档案/官职考成联动、浏览器分页搜索和城市指标演化留给后续切片。
- 提交前只读子代理 Ohm 发现旧 `prompt_retrieval_index` 自洽旧 payload 不会因 S61 字段升级而重建；已改为对照当前服务器 expected row hash，并补回归测试。最终只读子代理 Averroes 确认无 P0/P1/P2，余留 P3 是回归测试可后续从正则任一命中加强为逐字段断言。

下一步：

- 继续 S61.2，优先把城市指标接入事件档案/任所考成可见摘要，或为更大城市 fixture 增加分页与 prompt budget 验收。

### 2026-05-08

工具：Codex、子代理复审

步骤：DEV-GOV-2026-05-08 配置化与魔法数字开发规范

提交：本次文档与治理检查提交。

完成：

- 在 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 的受保护治理段、本文“开发规范继承”和 [QIANQIU_DEVELOPMENT_BRIEF.md](QIANQIU_DEVELOPMENT_BRIEF.md) 中新增“避免魔法数字、优先配置化”规则。
- 明确游戏规则、数值阈值、时间间隔、概率、UI 限制、fixture 规模和 prompt budget 等可调参数应优先集中到 `src/config/GameConfig.js` 或领域 `src/game/*Config.js`，并写清单位、范围和默认值意图。
- 同步 `scripts/checkGovernanceDocs.js`，让治理检查保护 `可调参数不得散落为魔法数字` 与 `src/config/GameConfig.js` 这两个规范锚点。
- 更新 [SHARED_CONTEXT.md](SHARED_CONTEXT.md)，把该规则作为后续 Codex / Claude Code 接手时必须继承的上下文。

验证：

- 已通过：`npm run check:docs-governance`
- 已通过：`node --test test/documentationGovernance.test.js`
- 已通过：`git diff --check`
- 已通过：`npm test`（447 tests）
- 提交前只读复审：子代理 Lovelace 未发现 P0/P1/P2；建议补强 brief/shared 保护与共享上下文范围说明，已采纳。

风险/遗留：

- 本轮不改运行时行为、API、provider schema、存档格式、SQLite 表结构或玩家 UI。
- 后续若真正新增 `src/config/GameConfig.js` 或迁移现有散落常量，应作为独立代码步骤处理并补 focused tests。

下一步：

- 继续 S60.2：扩展 medium/large storage-only fixture 或先为事件档案/浏览器分页/普通 prompt budget 增加更细的规模验收入口。

### 2026-05-08

工具：Codex、子代理 Banach

步骤：S60.2 内容基线与规模验收 fixture（small 基线切片）

提交：本次代码与测试提交。

完成：

- 新增 `src/game/worldContentFixtures.js`，以 `createInitialState()` 为 base 生成 S60 `small` 规模验收样本，不接入 `POST /api/game/start` 或 route 响应形状。
- `small` 样本生成 6 国、24 城、12 路线、96 NPC、32 家族、160 关系、80 官职/官署目录行、48 任命行、64 事件/情报侧车和约 491 条 `prompt_retrieval_index` 安全行。
- 真正 private hidden canary 保持在 fixture 侧车；`createCanaryPollutedWorldState()` 只用于测试 view/prompt 对 hidden 行、hidden notes、hidden intent、raw table 名、假 key 和本地路径片段的过滤。
- 新增 `test/worldContentFixtures.test.js`，覆盖数量门槛、hidden-token 防泄漏、prompt 高相关预算、JSON/SQLite view parity 和删除 `prompt_retrieval_index` 行后的读档修复。

验证：

- 已通过：`node --test test/worldContentFixtures.test.js`

风险/遗留：

- S60.2 仍是 `IN_PROGRESS`，本轮只完成 `small` 基线；`medium` / `large` fixture 总量会撞到现有 `worldPeople`、`worldGeography`、`eventArchive` 或 prompt 全局预算 cap，后续必须走分页/派生表总量与 capped route view 分层。
- 当前事件/情报 64 条是 fixture 侧车总量，不代表 `eventArchiveView` 已一次暴露 64 条；事件档案大规模模板、分页 UI 和普通回合 48 行全局 prompt budget 后续放到 S65/S66/S67。

下一步：

- 继续 S60.2：扩展 medium/large storage-only fixture 或先为事件档案/浏览器分页/普通 prompt budget 增加更细的规模验收入口。

### 2026-05-08

工具：Codex、子代理 Bernoulli

步骤：S60.1 超大动态世界数据库内容契约

提交：本次文档提交。

完成：

- 新增 [HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md](HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md)，把 S60-S67 内容充实专项固定为开发小样本、默认可玩中样本、压力测试大样本三档，并写明国家/城市/NPC/家族/官职/事件/情报/prompt 检索的内容密度目标。
- 明确数据库/fixture 总量、route view 分页量、prompt capped summary 和服务器 hidden 私档不是同一层；当前 state route 仍返回完整本地 `worldState`，所以真正 hidden 私档不得回填 raw route state。
- 固定 S60.2 `small` / `medium` / `large` fixture 数量目标、hidden canary 数量、prompt 全局预算、防泄漏扫描、JSON/SQLite parity、读档单向修复、浏览器分页和性能基线口径。
- 同步 [DYNAMIC_WORLD_DATABASE_PLAN.md](DYNAMIC_WORLD_DATABASE_PLAN.md)、[QIANQIU_DEVELOPMENT_BRIEF.md](QIANQIU_DEVELOPMENT_BRIEF.md)、[AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md)、README、共享上下文，以及地理/人物/官职契约中的 S60 cap 说明。

验证：

- 已通过：`npm run check:docs-governance`
- 已通过：`node --test test/documentationGovernance.test.js`
- 已通过：`git diff --check`
- 未运行完整 `npm test`：本轮只改文档契约、README 和交接记录，不改运行时代码。

风险/遗留：

- 本轮是文档契约改动，不改运行时代码、API、provider schema、存档格式或 SQLite 表结构。
- S60.2 仍需新增 deterministic fixture / generator 和 focused tests，优先从 `small` fixture、hidden canary、prompt budget、JSON/SQLite parity 做起。
- 契约中的 `medium` / `large` 总量高于当前部分 bridge bundle cap；后续实现必须走安全分页 view / prompt cap，或先调整 schema cap 与测试。

下一步：

- 开始 S60.2：内容基线与规模验收 fixture。

### 2026-05-08

工具：Codex、Web、子代理 Averroes

步骤：S70.0 AI 编排提前规划

提交：本次文档提交。

完成：

- 新增 [AI_ORCHESTRATION_ROADMAP.md](AI_ORCHESTRATION_ROADMAP.md)，把 S70 扩展为 AI actor、职位分级工具、NPC mind、制度 AI、压力驱动事件、多模型 narrator/planner/critic/safety、Mock/no-key 降级和红队验收规划。
- 将“AI 是《千秋》的核心世界引擎，不是可替换装饰”写入 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 的受保护治理段，并同步 [AGENTS.md](../AGENTS.md)、[CLAUDE.md](../CLAUDE.md)、[QIANQIU_DEVELOPMENT_BRIEF.md](QIANQIU_DEVELOPMENT_BRIEF.md)、[SHARED_CONTEXT.md](SHARED_CONTEXT.md) 和本台账。
- 基于官方资料确认工具调用方向：OpenAI/Anthropic/DeepSeek 的 function calling / structured output / MCP connector 都应解释为“模型请求工具，服务器执行工具”，不允许模型直接执行 SQL、改表或绕过服务器裁决。
- 更新 [AI_CONTROL_AUDIT_MATRIX.md](AI_CONTROL_AUDIT_MATRIX.md) 与 [DYNAMIC_WORLD_DATABASE_PLAN.md](DYNAMIC_WORLD_DATABASE_PLAN.md)，把 S70 AI 工具边界、数据库关系和后续红队重点写入可追溯文档。

验证：

- 已通过：`npm run check:docs-governance`
- 已通过：`node --test test/documentationGovernance.test.js`
- 已通过：`git diff --check`
- 已通过：`npm test`（443 tests）

风险/遗留：

- 本轮是提前规划与治理规范更新，不改运行时代码、API、provider schema、存档格式、SQLite 表结构或玩家 UI。
- S70 仍排在 S67 后实施；该记录完成时 S60.1 是下一步，现已由上方 S60.1 记录完成。
- 后续 S70.1 开工时必须把 tool envelope、actor 权限、resolver、审计和 Mock runner 写成可测试契约，并补越权工具/hidden-token/provider fallback 红队 fixture。

下一步：

- 该记录完成时的下一步是 S60.1；当前下一步见上方最新记录。

### 2026-05-08

工具：Codex

步骤：S59.2 归档与 S60+ 内容充实专项规划

提交：`fd8cf72`。

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
