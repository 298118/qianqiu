# 《千秋》数据库专项开发路线图与进度台账

本文件是 Codex 与 Claude Code 共同维护的当前活动路线图与进度台账。第四阶段已归档到 [PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，S48 时间专项已归档到 [TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)，S49-S53 本地数据库基础已压缩归档到 [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md)。

当前路线图从 S54 开始，目标是在不破坏默认 JSON/Mock 可玩路径的前提下，把已经成形的国家/城市、人物、官职任所和事件 projection 逐步拆入本地 SQLite 业务表。当前范围仍只考虑本机 SQLite / 本地文件持久化增强；远程存档、账号体系、多人同步、云端冲突解决和托管数据库不进入本专项。

- 第一阶段路线图已归档到 [PHASE_ONE_ROADMAP_ARCHIVE.md](PHASE_ONE_ROADMAP_ARCHIVE.md)，验收记录见 [PHASE_ONE_ACCEPTANCE.md](PHASE_ONE_ACCEPTANCE.md)。
- 第二阶段路线图已归档到 [PHASE_TWO_ROADMAP_ARCHIVE.md](PHASE_TWO_ROADMAP_ARCHIVE.md)，验收记录见 [PHASE_TWO_ACCEPTANCE.md](PHASE_TWO_ACCEPTANCE.md)。
- 第三阶段路线图已归档到 [PHASE_THREE_ROADMAP_ARCHIVE.md](PHASE_THREE_ROADMAP_ARCHIVE.md)。
- 第四阶段路线图已归档到 [PHASE_FOUR_ROADMAP_ARCHIVE.md](PHASE_FOUR_ROADMAP_ARCHIVE.md)，早期详细进度可在 [FOURTH_PHASE_PROGRESS_ARCHIVE.md](FOURTH_PHASE_PROGRESS_ARCHIVE.md) 追溯。
- S48 时间专项已归档到 [TIME_SPECIALTY_ROADMAP_ARCHIVE.md](TIME_SPECIALTY_ROADMAP_ARCHIVE.md)。
- S49-S53 数据库基础已归档到 [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md)。

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

## 3. 当前数据库专项边界

S49-S53 已完成“基础层”：

- `sessionStore` facade、默认 JSON adapter、可选 SQLite session row adapter、JSON -> SQLite 导入脚本和 adapter contract tests。
- 本地 `event_log` / `ai_change_proposals` 审计底座，记录脱敏 proposal、服务器接受/拒绝和应用事件 id。
- 天下地理 `worldGeographyView`、人物 `worldPeopleView`、官职任所 `officialPostingsView`、事件档案 `eventArchiveView` 和检索式 `retrievalContext`。
- 浏览器“局势簿”五类面板：天下格局、任所地理、人物谱牒、官职簿、事件档案。

S54 起不推翻这些成果，而是把仍在 JSON `worldState` / projection 中的领域数据逐步拆成本地 SQLite 业务表。每个拆表切片必须遵守：

- JSON adapter 继续是默认路径，Mock 模式继续完整可玩。
- SQLite 模式只表示本机不同存档；不引入远程、账号、多人或云端语义。
- `worldState` snapshot 继续可读、可导入、可导出，直到后续明确迁移完成。
- 业务表写入只通过服务器领域 helper 和 adapter 事务，AI 不能执行 SQL、不能直接写表、不能绕过 schema/clamp/可见性过滤。
- API、prompt 和浏览器只读服务器整理后的 projection；不得暴露 raw audit、provider proposal、prompt、本地路径、密钥、隐藏 notes、hidden intent 或未公开任所/关系。
- 完整 scholar -> official 路径、S48 年月旬与 scene-local time 契约、官职任免和考试晋级仍由服务器裁决。

## 4. 已完成基础归档

| ID | 状态 | 摘要 | 归档 |
| --- | --- | --- | --- |
| S49 | DONE | 本地数据库规划、storage adapter、可选 SQLite session row、事件日志与 AI proposal 审计 | [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md) |
| S50 | DONE | 天下地理静态 seed、每局 `worldGeography` ledger、`worldGeographyView` 与 prompt summary | [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md) |
| S51 | DONE | NPC/家族/资产/田产/关系 schema 与 `worldPeopleView` 可见桥接 | [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md) |
| S52 | DONE | 官职/官署/任所/城市辖区/考成/迁转契约与 `officialPostingsView` 可见桥接 | [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md) |
| S53 | DONE | `promptContextAssembler`、浏览器信息面板规划与五类安全 UI projection | [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md) |

## 5. 剩余路线图总览

| ID | 状态 | 目标 | 完成日期 | 工具 | 提交 |
| --- | --- | --- | --- | --- | --- |
| S54.1 | DONE | 地理 SQLite 业务表契约：国家、区域、城市、路线、边面、官署辖区 | 2026-05-07 | Codex | 本次提交 |
| S54.2 | DONE | 地理 SQLite 持久化 adapter：SQLite 模式读写地理业务行，JSON 模式不变 | 2026-05-07 | Codex | `5acf894` |
| S54.3 | TODO | 地理导入/修复/导出工具与 JSON/SQLite route-view parity 验收 | - | - | - |
| S55.1 | TODO | 人物、家族、资产、田产、关系 SQLite 表契约 | - | - | - |
| S55.2 | TODO | `worldPeople` SQLite 持久化与可见桥接 parity | - | - | - |
| S55.3 | TODO | NPC 生命周期、财富/家产/关系事件写入与审计关联 | - | - | - |
| S56.1 | TODO | 官署、官职、任所、考成、迁转 SQLite 表契约 | - | - | - |
| S56.2 | TODO | `officialPostings` SQLite 持久化与官场/地方任所桥接 parity | - | - | - |
| S56.3 | TODO | 官职、城市、人物之间的本地外键/引用完整性与安全 view | - | - | - |
| S57.1 | TODO | 安全事件索引与事件档案分页，不暴露 raw audit | - | - | - |
| S57.2 | TODO | 审计到公开事件 projection 的本地工具与脱敏测试 | - | - | - |
| S58.1 | TODO | SQLite 索引驱动的检索式 prompt context，JSON fallback 不变 | - | - | - |
| S58.2 | TODO | 浏览器局势簿在 JSON/SQLite 双模式下的视图 parity smoke | - | - | - |
| S59.1 | TODO | JSON/SQLite 双模式整体验收：Mock 主线、导入导出、修复脚本和文档 | - | - | - |
| S59.2 | TODO | S54-S59 完成后再次压缩活动台账并归档实现细节 | - | - | - |
| S60.1 | TODO | 多 AI 协作编排层规划：任务路由、仲裁、成本边界、失败降级和验收矩阵 | - | - | S54-S59 后启动 |
| S60.2 | TODO | 多 AI 协作实现：在现有 `mimo-deepseek` 最小路由基础上扩展 narrator/grader/critic/safety 分工 | - | - | S60.1 后 |

## 6. S54：天下地理业务表拆分

### S54.1：地理 SQLite 业务表契约

状态：DONE。

目标：

- 在新契约文档或既有 `WORLD_GEOGRAPHY_SEED_CONTRACT.md` 扩展本地 SQLite 表形状。
- 建议表：`geo_countries`、`geo_regions`、`geo_cities`、`geo_routes`、`geo_frontier_zones`、`geo_office_jurisdictions`。
- 固定 `session_id` 分区、`row_id` / seed id 映射、`revision`、`visibility`、`intel_confidence`、`source`、`last_updated_turn`、年月旬字段、动态指标字段和隐藏字段边界。
- 区分静态 seed 字段、每局动态字段、玩家可见摘要字段和服务器 hidden 字段。
- 不改运行时代码，不新增 route 字段，不写 SQLite 表。

验收：

- 文档明确 JSON 默认、SQLite local-only、AI 不直写 SQL/表、prompt/UI 只读 view。
- 表设计能覆盖当前 `worldGeography` 的国家、邻国、城市、路线、边面和官署辖区。
- 记录后续 S54.2/S54.3 所需的 parity 与迁移测试点。

完成：

- 已在 [WORLD_GEOGRAPHY_SEED_CONTRACT.md](WORLD_GEOGRAPHY_SEED_CONTRACT.md) 增补 S54.1 契约，固定 `geo_countries`、`geo_regions`、`geo_cities`、`geo_routes`、`geo_frontier_zones`、`geo_office_jurisdictions` 的公共列、表字段、seed/动态/可见/hidden 分类、引用修复策略和后续 parity 验收点。
- 明确本切片不改运行时代码、不新增 route 字段、不创建 SQLite 表；JSON 默认可玩、SQLite local-only、AI 不直写 SQL/table rows、prompt/UI 只读服务器 view 的边界不变。
- 已同步产品 brief、AI 控制矩阵和共享交接板；后续从 S54.2 地理 SQLite 持久化 adapter 开始。

### S54.2：地理 SQLite 持久化 Adapter

状态：DONE。

目标：

- 在 `STORAGE_ADAPTER=sqlite` 模式下，把 `worldState.worldGeography` 的领域行同步写入地理业务表；JSON adapter 继续只保存 JSON worldState。
- 读取时能从业务表重建或校验 `worldGeographyView`，必要时从 `worldState.worldGeography` fallback 修复。
- 路由 payload、prompt summary 和浏览器面板形状保持不变。
- 所有写入仍通过服务器 helper，不能让 provider `statePatch.worldGeography` 或 prompt proposal 直写表。

验收：

- JSON/SQLite 双模式 focused tests 证明 `worldGeographyView` parity。
- SQLite 模式不暴露数据库路径、raw row、hidden rows 或 raw audit。
- `npm run check:docs-governance` 与相关 storage/geography tests 通过。

完成：

- 新增 `src/storage/sqliteGeographyTables.js`，在 SQLite 模式下创建 `geo_countries`、`geo_regions`、`geo_cities`、`geo_routes`、`geo_frontier_zones`、`geo_office_jurisdictions`，并把规范化后的 `worldState.worldGeography` 同步为业务行。
- `src/storage/sqliteSessionAdapter.js` 在同一 SQLite transaction 中写入 `world_sessions.world_state_json`、审计记录和 `geo_*` 行；读取 session record 时会用 `world_state_json` 修复缺失或陈旧的地理业务行；删除 session 时同步删除地理业务行。
- JSON adapter 不创建、不读取 `geo_*` 表；route payload、prompt summary、浏览器 view 形状不变。
- `test/sessionStoreAdapterContract.test.js` 增加 SQLite 地理表行数/hidden row 原始表保存、缺失行与同数量错 `row_id` 读取修复、mutate revision 推进、stale revision 拒写、导入/删除同步和 `worldGeographyView` parity 覆盖。

### S54.3：地理导入、修复与导出工具

状态：TODO。

目标：

- 提供 JSON -> SQLite 地理业务表导入/修复工具，保留 JSON 原档。
- 如需要，提供 SQLite -> JSON 导出或 debug dump，且默认脱敏、不输出 hidden notes。
- 增加 route/prompt/browser parity 测试，确认天下格局和任所地理在两种 adapter 下可见内容一致。

验收：

- 工具 dry-run 不修改数据库；正式导入不删除 JSON 原档。
- 隐藏城市、路线、边面和辖区引用不会进入 UI/prompt。
- 文档说明回滚方式：禁用 SQLite env 回到 JSON adapter，或导出 JSON snapshot。

## 7. S55：人物、家族、资产与关系业务表

### S55.1：人物域 SQLite 表契约

状态：TODO。

目标：

- 为 `people_npcs`、`people_households`、`people_assets`、`people_estates`、`people_relationships` 设计本地 SQLite 表。
- 明确玩家已知、角色可见、关系可见、传闻、隐藏等可见性字段，以及 `intel_confidence`、`last_report_turn`、`hidden_intent`、`hidden_notes` 的禁止曝光规则。
- 区分当前可见桥接数据和未来完整 NPC 私档；在 route 仍返回完整 `worldState` 的前提下，不把 hidden 私档塞回 raw route state。

验收：

- 表设计覆盖财富、田产、官职、家族、婚姻、人情债、怨怼、庇护、声望和近期札记。
- AI 权限分级写清：关系 delta 可建议，隐藏意图、资产真数、官职任命不可写。

### S55.2：`worldPeople` SQLite 持久化与桥接

状态：TODO。

目标：

- SQLite 模式下持久化当前可见 `worldPeople` 桥接行，并保持 `worldPeopleView` 与 JSON 模式一致。
- 保留 `relationshipLedger`、`activeNpcRequest` 和 `relationshipChanges` 的既有服务器裁决；AI 仍只能提交关系建议。
- 不让浏览器或 prompt 读取 raw 人物表；只读 `worldPeopleView` / capped prompt summary。

验收：

- JSON/SQLite 双模式 `worldPeopleView` parity。
- hidden NPC、hidden asset、hidden relationship refs 不进入 prompt/UI。
- active request 生命周期和关系 clamp 测试继续通过。

### S55.3：NPC 生命周期与事件集成

状态：TODO。

目标：

- 把 NPC 财富变化、田产变动、官职变动、家庭事件、死亡/迁居、关系升降和 active request 结果写成服务器事件。
- 关联 `event_log` / 安全事件索引，但不直接暴露 raw audit。
- 给重要 NPC 建立 `last_event_id`、`last_updated_turn` 或等价索引，方便后续检索式 prompt context。

验收：

- 普通 provider 不能伪造 NPC 私档或资产真数。
- 事件档案只展示可见 projection。
- 现有人物谱牒 UI 不显示 hidden intent、hidden notes 或 raw row ids。

## 8. S56：官职、任所与地方事务业务表

### S56.1：官职域 SQLite 表契约

状态：TODO。

目标：

- 设计 `office_bureaus`、`office_catalog`、`office_city_jurisdictions`、`office_postings`、`office_assessments`、`office_transfers` 等表。
- 明确静态 catalog 与每局动态 posting 的边界；`officialCatalog` 可继续作为代码种子或导入来源。
- 记录 `holder_type` / `holder_id`、城市/区域/辖区引用、任期年月旬、状态、考成、弹劾、迁转和可见性。

验收：

- 表契约能覆盖当前 `officialPostingsView`、`officialCareerView` 与地方官任所数据。
- 明确 AI 不可任命、调任、处分或改考成；服务器继续拥有官职任免。

### S56.2：`officialPostings` SQLite 持久化与桥接

状态：TODO。

目标：

- SQLite 模式下持久化官署、官职、任所、考成和迁转 projection。
- 由 `officialCareer`、地方官 role state、地理城市/辖区表和服务器 career history 派生写入。
- 维持 `officialPostingsView` 与 prompt summary 兼容。

验收：

- JSON/SQLite 双模式 `officialPostingsView` parity。
- 完整 scholar -> official 路径、地方官开局、入仕官员开局和官场差事测试继续通过。
- 未公开调任、hidden 考成札记、密参不进入 UI/prompt。

### S56.3：跨域引用完整性与安全 View

状态：TODO。

目标：

- 建立官职、城市、NPC/player 之间的本地引用完整性策略。
- 城市被隐藏、NPC 未公开、官职未可见时，任所 view 必须裁剪相关引用。
- 处理旧档或导入不完整时的修复策略：降级为摘要、标记 `unknown`、或从 `worldState` fallback。

验收：

- 跨域 hidden 引用不泄漏 raw id。
- 导入不完整不会让读档失败；玩家 API 返回安全降级 view。

## 9. S57：安全事件索引

### S57.1：安全事件索引与分页

状态：TODO。

目标：

- 在 raw `event_log` / `ai_change_proposals` 外新增安全事件索引或 projection 表，供事件档案 UI 和 prompt 检索。
- 支持按人物、城市、官职、世界议程、考试、长期事件、年份月份旬筛选。
- 事件档案分页，避免长期世界一次性把大量事件塞给浏览器或 prompt。

验收：

- `eventArchiveView` 不读取 raw audit，不展示 provider proposal、prompt、key、路径、hidden notes。
- UI 与 prompt 只读 sanitized event projection。

### S57.2：审计到公开事件 Projection 工具

状态：TODO。

目标：

- 提供本地 dev 工具，把审计摘要、世界事件、官场履历、考试记录整理为可见事件 projection。
- 增加脱敏测试：密钥片段、本地路径、raw prompt、provider 错误、hidden notes、hidden intent 必须被丢弃或遮蔽。

验收：

- 工具输出默认面向玩家/调试安全，不输出 raw audit 全量。
- redaction 覆盖 JSON sidecar 与 SQLite 审计两种来源。

## 10. S58：检索式 Prompt 与浏览器 Parity

### S58.1：SQLite 索引驱动的 Prompt Context

状态：TODO。

目标：

- `promptContextAssembler` 在 SQLite 模式下可从地理、人物、官职和安全事件索引读取相关摘要；JSON 模式继续从现有 view/prompt helper fallback。
- 按当前身份、地点、active scene、玩家输入、世界议程和可见关系排序，而不是全量灌入模型。
- 不改变 provider schema、稳定 prompt 前缀或 AI/server 权限矩阵。

验收：

- prompt tests 证明 hidden rows 不进入 `retrievalContext`。
- 同一场景 JSON/SQLite 生成的关键摘要一致或有记录的安全降级。

### S58.2：浏览器局势簿双模式验收

状态：TODO。

目标：

- 在 JSON 和 SQLite 模式下分别 smoke 局势簿：天下格局、任所地理、人物谱牒、官职簿、事件档案。
- 验证 selector、隐藏词、横向溢出、空状态、长列表分页或截断。

验收：

- Browser smoke 或 focused UI test 覆盖两种 adapter。
- 不暴露 raw `worldState` ledger、raw audit、`retrievalContext`、provider proposal、本地路径或 key。

## 11. S59：整体验收与再压缩

### S59.1：JSON/SQLite 双模式集成硬化

状态：TODO。

目标：

- 跑完整 Mock 主线、代表身份回合、读档/存档簿、导入/修复/导出工具和 SQLite 业务表 parity。
- 更新 README、architecture、brief、shared context 与相关契约文档。
- 记录 SQLite 显式模式的 Node 版本/`node:sqlite` 要求和回滚方式。

验收：

- JSON 默认路径无需数据库即可启动和完整游玩。
- SQLite local-only 模式能 start/turn/save/list/read state，并保持 route/view shape。
- 完整 scholar -> official 路径未破坏。

### S59.2：完成后归档与上下文压缩

状态：TODO。

目标：

- S54-S59 完成后，把详细实现记录移入新的归档文档。
- `docs/DEVELOPMENT_STEPS.md` 只保留下一阶段活动路线图、治理保护块和必要摘要。
- 清理 README/brief/shared context 中过长的历史段落，保留内容安全边界。

验收：

- `npm run check:docs-governance` 通过。
- 压缩后仍能看清：当前状态、下一步、JSON 默认、SQLite local-only、AI 不直写、view-first 安全边界。

## 12. S60：多 AI 协作编排（S54-S59 之后）

本节是应 MiMo + DeepSeek 混合使用需求追加的后续规划，不插队当前数据库专项。当前已落地的 `mimo-deepseek` 只是 provider 方法级路由：普通叙事、开局、流式回合和科举出题走 MiMo，科举评卷走 DeepSeek V4 Pro。S60 目标是在不扩大 AI 权限的前提下，把它升级为可观测、可测试、可降级的多模型协作层。

### S60.1：多 AI 协作编排层规划

状态：TODO。

目标：

- 设计 task router：按任务类型、风险、成本、上下文长度和可用 key 选择 `mimo`、`deepseek` 或未来 provider。
- 固定角色分工建议：MiMo 作为主要 narrator/world interpreter/question writer；DeepSeek V4 Pro 只用于高风险 grading、关键合法性复核、越权输出复审或失败重试仲裁。
- 明确失败降级：缺 key、超时、schema 失败、streaming 中断、provider 限额或 Token Plan 不适用时如何回到 Mock、单 provider 或安全拒绝。
- 记录可观测性边界：只保存脱敏 provider 名、任务名、模型摘要、latency、schema 结果和失败类别；不保存 key、raw prompt、raw provider response 或隐藏 ledger。
- 明确官方服务条款边界：Token Plan `tp-...` key 仅在授权场景使用，公开部署或非 Coding 自定义后端应改用普通 API key 或先确认授权。

验收：

- 不改变现有 route payload、provider schema、Mock 默认路径或服务器裁决边界。
- 输出设计文档，列出单元测试、route health、provider long-run、secret redaction 和成本/限额风险。

### S60.2：多 AI 协作实现

状态：TODO。

目标：

- 在当前 `mimo-deepseek` provider 之上抽出 task router / policy helper，避免把每个任务的模型选择散落在 adapter 方法里。
- 支持按任务配置 primary、critical、fallback 和 optional review provider，但默认仍以 MiMo 为主、DeepSeek V4 Pro 只用于关键环节。
- 为高风险任务增加可选只读 critic/review pass；critic 只能产生诊断或重试建议，不能直接写 statePatch、评分、晋级、任免或持久化结果。
- 为 connection-test 和 provider smoke 输出更清晰的混合模型摘要。

验收：

- Mock 默认可玩，`AI_PROVIDER=mimo-deepseek` 可跑 route health 和 provider smoke。
- schema、remote normalization、AI 控制矩阵、secret redaction、server-owned patch tests 继续通过。
- 完整 scholar -> official 路径不被多模型编排打断。

## 13. 进度记录

### 2026-05-07

工具：Codex

步骤：S54.2 地理 SQLite 持久化 adapter

提交：`5acf894`。

完成：

- 新增 `src/storage/sqliteGeographyTables.js`，集中维护 SQLite 地理业务表 schema、公共列映射、行同步、行计数和读取修复逻辑。
- 扩展 `src/storage/sqliteSessionAdapter.js`：初始化 `geo_*` 表；写入、导入和 mutate 保存时与 `world_sessions` 同 transaction 同步地理业务行；读取时按 `world_state_json` 修复缺失/陈旧业务行；删除 session 时清理地理业务行。
- 保持 JSON adapter、route payload、prompt schema 和浏览器 view 不变；业务表 raw rows 不进入玩家 API，hidden 行仍只能通过服务器 view 被过滤。
- 增加 SQLite-focused tests，验证表行数、hidden route raw row、缺失行与同数量错 `row_id` 读取修复写回、mutate revision 推进、stale revision 拒写、导入/删除同步和 `worldGeographyView` parity。
- 同步 `docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md`、`docs/QIANQIU_DEVELOPMENT_BRIEF.md`、`docs/ARCHITECTURE.md`、`docs/DYNAMIC_WORLD_DATABASE_PLAN.md`、`docs/AI_CONTROL_AUDIT_MATRIX.md`、README 和本交接台账。

验证：

- 已通过：`node --check src/storage/sqliteGeographyTables.js`
- 已通过：`node --check src/storage/sqliteSessionAdapter.js`
- 已通过：`node --check test/sessionStoreAdapterContract.test.js`
- 已通过：`node --test test/sessionStoreAdapterContract.test.js`（30 tests）
- 已通过：`node --test test/worldGeographySeeds.test.js test/worldGeography.test.js test/gameTurnWorldGeography.test.js test/promptContextAssembler.test.js test/prompts.test.js test/stateRules.test.js test/aiSchemas.test.js test/remoteHelpers.test.js test/sessionStoreAdapterContract.test.js`（86 tests）
- 已通过：`npm run check:docs-governance`
- 已通过：`git diff --check`
- 已通过：`npm test`（393 tests）
- 提交前只读复审：Kepler 首轮发现 2 个 P2；已修复为 transaction 内重读当前 session，以及按预期 `row_id` 集合识别同数量错行并补测试。Kepler 基于修复后最终 diff 与上述验证证据完成第二轮只读复审，未发现 P0/P1/P2；残余风险仅为 S54.3 导入/修复/导出工具和更广 route/prompt/browser parity 尚未实现。

风险/遗留：

- S54.2 只让 SQLite adapter 内部同步地理业务行；prompt context 仍从服务器 view/summary 读取，尚未从 `geo_*` 表检索。
- S54.3 仍需补 JSON -> SQLite 地理导入/修复/导出工具和更完整 route/prompt/browser 双模式 parity smoke。
- `role_visible` 仍保持既有粗规则，S54.2 没有细化官署/任所视野。

下一步：

- S54.3：实现地理导入、修复、导出/调试工具，并扩展 route/prompt/browser JSON/SQLite parity 验收。

### 2026-05-07

工具：Codex

步骤：S54.1 地理 SQLite 业务表契约

提交：本次提交。

完成：

- 在 `docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md` 中新增 S54.1 SQLite 地理业务表契约，固定 `session_id` 分区、`row_id` / seed 映射、`revision` / `row_revision`、`source`、可见性、情报可信度、更新时间和 hidden 字段边界。
- 为 `geo_countries`、`geo_regions`、`geo_cities`、`geo_routes`、`geo_frontier_zones`、`geo_office_jurisdictions` 记录字段分类：静态 seed 字段、每局动态快照、玩家可见摘要和服务器 hidden 字段。
- 明确 S54.2/S54.3 的 JSON/SQLite `worldGeographyView` parity、hidden nested refs 裁剪、导入 dry-run、修复、导出/回滚和 prompt/browser 安全验收点。
- 同步 `docs/QIANQIU_DEVELOPMENT_BRIEF.md`、`docs/AI_CONTROL_AUDIT_MATRIX.md` 和 `docs/SHARED_CONTEXT.md`，保留 JSON 默认、SQLite local-only、AI 不直写 SQL/table rows 和 route-view-first 安全边界。

验证：

- 已通过：`node --test test/worldGeographySeeds.test.js test/worldGeography.test.js test/promptContextAssembler.test.js test/prompts.test.js test/stateRules.test.js test/aiSchemas.test.js test/remoteHelpers.test.js`
- 已通过：`npm run check:docs-governance`
- 已通过：`git diff --check`
- 已执行只读子代理核对：Fermat 检查现有地理字段、表契约覆盖点、hidden/visibility/ref/revision 风险，并报告聚焦测试通过。
- 已执行提交前只读复审：Laplace 基于最终 diff 与验证证据复审，未发现 P0/P1/P2 风险、遗漏或测试缺口。

风险/遗留：

- 本轮是契约与台账同步，不改运行时代码、不新增依赖、不改变存档格式和 route payload。
- `role_visible` 当前仍沿用“非书生可见”的粗规则；S54.2 实现 SQLite 持久化时必须保持现有 parity，不提前收窄或扩大玩家视野。
- `revision` / `row_revision` 只作为业务表同步诊断；S54.2 仍必须在同一 transaction 内推进 `world_sessions.world_state_json` 和 `geo_*` 行，避免漂移。

下一步：

- S54.2：在 `STORAGE_ADAPTER=sqlite` 模式下同步写入地理业务表，并补 JSON/SQLite `worldGeographyView` parity tests；JSON adapter 保持不变。

步骤：MiMo provider 与 MiMo+DeepSeek 最小混合路由

提交：`80a0c07`。

完成：

- 新增 `mimo` provider，使用 Xiaomi MiMo OpenAI-compatible `/chat/completions`，默认 `api-key` 认证头、`MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1`、`MIMO_MODEL=mimo-v2.5-pro`、`thinking=disabled` 和 JSON object 输出；`mimo-v2.5-pro[1m]` 是本轮真实 route health 已证实不可作为 API request model 的标签，1M 作为长上下文能力记录。
- 新增 `mimo-deepseek` provider：MiMo 负责开局、普通回合、SSE 流式回合和科举出题；DeepSeek 只负责科举评卷，默认用 `DEEPSEEK_GRADE_MODEL=deepseek-v4-pro`。
- 远端 provider turn payload 现在会在 schema 校验前丢弃不兼容的 `relationshipChanges` 建议行，保留 `character/faction`、非空目标、数值 delta 和字符串原因；目标是否可见/存在、最终夹断和持久化仍由 route 关系系统裁决。
- 扩展 `/api/ai/connection-test`、provider smoke、provider route health 和 provider long-run 的 provider 枚举、别名、混合 key 检查和多 key 脱敏。
- 按只读复审反馈，将 MiMo 运行时默认 Base URL 与 Token Plan 示例保持一致，并把 `MIMO_API_KEY` / `tp-...` 纳入事件档案与浏览器 smoke 的隐藏 token 扫描。
- 同步 README、产品 brief、architecture、真实 provider 验收和 AI 控制矩阵；将完整多 AI 协作编排排到 S60，位于 S54-S59 当前数据库专项之后。

验证：

- 已通过：`node --test test/remoteHelpers.test.js test/mimoProvider.test.js test/mimoDeepseekProvider.test.js test/aiDiagnostics.test.js test/aiConnectionRoute.test.js test/providerSmokeScript.test.js test/providerRouteHealthScript.test.js`
- 已通过：`npm run smoke:provider:route -- --provider mimo`
- 已通过：`npm run smoke:provider:route -- --provider mimo-deepseek`
- 已通过：`npm run smoke:provider -- --provider mimo-deepseek --stream`
- 已通过：`npm test`
- 已通过：`npm run check:docs-governance`
- 已通过：`git diff --check`
- 已验证：同一 Token Plan key 与 Base URL 下，普通问答请求 `model=mimo-v2.5-pro[1m]` 返回 `Not supported model`，`model=mimo-v2.5-pro` 返回正常中文内容。
- 已执行两轮只读子代理复审；P2/P3 反馈已修正，最终确认未发现阻塞问题。

风险/遗留：

- 本轮不改变 route payload、provider schema、Mock 默认路径、科举晋级、官职任免或服务器状态边界。
- 官方 Token Plan 文档说明 `tp-...` key 与普通 `sk-...` key 不可混用，且订阅额度面向 AI 编程工具场景；公开部署或明显非 Coding 自定义后端使用前需确认授权或改用普通 API key。
- `mimo-deepseek` 是最小路由，不是完整多代理仲裁系统；完整编排、critic pass、成本/限额策略和可观测性排入 S60。

下一步：

- 完成全量验证、只读子代理复审和本次提交；随后回到 S54.1 地理 SQLite 业务表契约。

### 2026-05-07

工具：Codex

步骤：数据库专项规划压缩与 S54+ 拆分

提交：`5ab5350 docs: plan remaining database table split`。

完成：

- 将 S49-S53 已完成的 storage/audit、地理、人物、官职任所、prompt context 和浏览器局势簿细节从活动台账压缩出去，新增归档入口 [LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md)。
- 将剩余数据库工作拆为 S54-S59：地理业务表、人物业务表、官职任所业务表、安全事件索引、SQLite 检索式 prompt/browser parity、双模式集成硬化与再次归档。
- 明确所有后续拆表步骤仍只考虑本地 SQLite；不规划远程存档、账号体系、多人同步、云端冲突解决或托管数据库。
- 重申 AI 不得执行 SQL 或直接写业务表；服务器继续拥有 schema、白名单、clamp、隐藏过滤、科举晋级、官职任免、事件写入和持久化事务。

验证：

- 已通过：`npm run check:docs-governance`
- 已通过：`git diff --check`
- 已完成只读复审：Wegener 未发现 P0/P1 blocker；其 P2 旧未来式表述和验证状态问题已在提交前修正。

风险/遗留：

- 本轮是文档规划与上下文压缩，不改运行时代码、不新增依赖、不改变存档格式。
- 因涉及活动路线图重写和内容保护，本轮虽为纯文档变更，仍已执行只读子代理复审。

下一步：

- 开始 S54.1：地理 SQLite 业务表契约。
