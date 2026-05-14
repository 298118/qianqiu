# 《千秋》S49-S67 本地数据库与大世界内容归档

归档整合日期：2026-05-12。

本文件统一保存 S49-S53 本地数据库基础、S54-S59 本地 SQLite 业务表与双模式验收、S60-S67 超大动态世界数据库内容充实，以及 S60 内容规模与可见性契约。旧的分卷归档文件保留为跳转页，后续追溯优先阅读本文件。

## 目录

- S49-S53 本地数据库基础
- S54-S59 本地 SQLite 业务表与双模式验收
- S60-S67 超大动态世界数据库内容充实
- S60 内容规模与可见性契约

---

## S49-S53 本地数据库基础

# 《千秋》S49-S53 本地数据库基础归档

归档日期：2026-05-07。

本文件压缩 S49-S53 已完成的本地动态数据库基础工作，供后续追溯。稳定开发治理仍以 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 为锚点；当前活动路线图见 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md)。

## 归档结论

S49-S53 已经完成“先边界、后拆表”的数据库基础层：

- 路由面对 `sessionStore` facade，默认 JSON adapter 保持可玩；`STORAGE_ADAPTER=sqlite` 可选启用本地 SQLite session row，一行一 session，仍保存 JSON `world_state`。
- 本地审计已具备 `event_log` 与 `ai_change_proposals`：JSON 模式写 `data/audit/*.jsonl`，SQLite 模式写本地表，只记录脱敏摘要、服务器接受/拒绝原因和应用事件 id。
- 天下地理、人物关系、官职任所已经先形成 server-owned ledger / visible bridge 和 route view：`worldGeographyView`、`worldPeopleView`、`officialPostingsView`。
- `promptContextAssembler` 已把 prompt 动态上下文集中到服务器可见 projection 与 `retrievalContext`，不读取 raw ledger、raw audit 或 SQLite 审计表。
- 浏览器“局势簿”已落地天下格局、任所地理、人物谱牒、官职簿和事件档案五类面板；事件档案读取 `eventArchiveView`，不读取 raw audit、provider proposal、prompt、本地路径或 key。

S49-S53 没有把国家、城市、NPC、家族、资产、官职任所等拆成 SQLite 业务表。后续 S54+ 的重点是基于这些安全 view 和审计底座，逐步拆业务表并保持 JSON/SQLite route-view parity。

## 完成步骤索引

| ID | 摘要 | 主要提交 |
| --- | --- | --- |
| S49.1 | 动态世界数据库总体规划；确认本地 SQLite 可行、AI 不直写数据库、先 adapter 后拆表 | `e3808df`、`990f7d3`；路线图切换 `c2e31f3`、`9726ccb` |
| S49.2 | Storage adapter facade 与 JSON adapter contract tests | `2e15e13` |
| S49.3 | 可选本地 SQLite session row adapter、`node:sqlite`、JSON -> SQLite 导入脚本 | `22217e0` |
| S49.4 | 本地事件日志与 AI proposal 审计 | `092de20` |
| S50.1 | 天下地理静态 seed 契约与 `worldGeographySeeds` | `45f9b65` |
| S50.2 | 每局 `worldGeography` ledger、`worldGeographyView` 与 prompt summary | `b0ced01` |
| S51.1 | NPC、家族、资产、田产、关系 schema 契约 | `418077b` |
| S51.2 | `worldPeople` 可见桥接、`worldPeopleView` 与 prompt summary | `8ed984a` |
| S52.1 | 官职、官署、任所、城市辖区、考成和迁转 schema 契约 | `4ce6d0e` |
| S52.2 | `officialPostings` 可见桥接、任所城市联动与 prompt summary | `4599869` |
| S53.1 | `promptContextAssembler` 与检索式 `retrievalContext` | `1268c04` |
| S53.2 | 浏览器信息面板规划 | `b89882a` |
| S53.3 | 浏览器局势簿 tab 壳与 view 缓存基础 | `89e73c2` |
| S53.4 | 天下格局与任所地理面板 | `657c08e` |
| S53.5 | 人物谱牒与官职簿面板 | `e642ae3` |
| S53.6 | `eventArchiveView` 安全事件档案与浏览器面板 | `bac7d2f` |

## 稳定边界

- JSON 仍是默认存储；`npm install && npm start` 与 Mock 模式不依赖 SQLite。
- SQLite 只表示本机存档增强；远程存档、账号体系、多人同步、云端冲突解决和托管数据库不属于当前范围。
- AI 不能执行 SQL、不能直接写 `countries`、`cities`、`npcs`、`office_postings`、`event_log` 等表，也不能绕过服务器事务。
- AI 只能提交 schema-valid proposal；服务器负责 schema、白名单、数值 clamp、可见性过滤、科举晋级、官职任免、长期事件、世界实体、世界议程和持久化裁决。
- 浏览器和 prompt 只读服务器整理后的 player-facing view / capped summary；不得读取 raw audit、raw provider proposal、raw prompt、数据库路径、密钥、hidden notes、hidden intent 或未公开关系/任所。
- 事件档案属于安全 projection，不等于 raw audit 浏览器。

## 当前剩余缺口

- 尚无地理业务表：国家、区域、城市、路线、边面、官署辖区仍主要存在于 JSON `worldState.worldGeography` 与安全 view。
- 尚无人物业务表：NPC、家族、资产、田产、关系仍以 `characters`、`relationshipLedger` 和 `worldPeople` 可见桥接为主。
- 尚无官职任所业务表：官署、官职、任命、考成、迁转仍以 `officialCatalog`、`officialCareer` 和 `officialPostings` projection 为主。
- `eventArchiveView` 不读取 raw audit；后续如需分页、筛选和长期检索，需要另建安全事件索引。
- `retrievalContext` 目前基于 route/prompt helper 的可见 projection；SQLite 索引驱动检索仍需 S58 实现。

## 后续入口

后续不应重做 S49-S53 的基础边界。接手者应从 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md) 的第一个 `TODO` 开始，当前推荐是 S54.1：地理 SQLite 业务表契约。

---

## S54-S59 本地 SQLite 业务表与双模式验收

# 《千秋》S54-S59 本地数据库业务表归档

归档日期：2026-05-08。

本文件压缩 S54-S59 已完成的本地 SQLite 业务表与双模式验收工作，供后续追溯。当前活动路线图已转入 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md) 的 S60+ “超大动态世界数据库内容充实”专项；稳定开发治理仍以 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 为锚点。

## 1. 归档范围

S54-S59 完成的核心成果是：在默认 JSON/Mock 可玩路径不变的前提下，把已经稳定的地理、人物、官职任所、事件档案和 prompt 检索 projection 拆成可选本地 SQLite 派生表，并补齐导入、修复、脱敏导出、浏览器 parity 和双模式整体验收。

已完成切片：

- S54：天下地理 `geo_*` 业务表、读档单向修复、导入/修复/导出工具、JSON/SQLite route/prompt/browser parity。
- S55：人物、家族、资产、田产、关系 `people_*` 可见 bridge 行持久化；人物事件审计与 `people_*.last_event_id` 本地关联。
- S56：官署、官职、辖区、任所、考成、迁转 `office_*` 安全 projection 行持久化；内容指纹和 hidden 引用污染修复。
- S57：安全事件档案分页 projection、SQLite `event_archive_index`、本地审计到公开事件 projection 工具。
- S58：SQLite `prompt_retrieval_index` 安全检索来源，以及浏览器“局势簿” JSON/SQLite parity smoke。
- S59.1：`smoke:dual-mode` 双模式整体验收入口，串联完整 Mock 主线、局势簿 parity、导入/修复/导出、审计公开 projection、派生表计数和 hidden-token 防线。

## 2. 提交索引

| 步骤 | 摘要 | 提交 |
| --- | --- | --- |
| S54.1 | 地理 SQLite 业务表契约 | `6cb03a0` |
| S54.2 | 地理 SQLite 持久化 adapter | `5acf894` |
| S54.2 回填 | 记录 S54.2 提交哈希 | `b237385` |
| S54.3 | 地理导入、修复、导出与 parity 工具 | `54505b3` |
| S54.3 回填 | 记录 S54.3 提交哈希 | `77d0447` |
| S55.1 | 人物域 SQLite 表契约 | `b95086c` |
| S55.2 | `worldPeople` SQLite 持久化与桥接 parity | `0d18b5d` |
| S55.3 | 人物事件与审计关联 | `c5d0e6d` |
| S56.1 | 官职任所 SQLite 表契约 | `e8c0d2d` |
| S56.2 | 官职任所 SQLite 持久化 | `d7b0a26` |
| S56.3 | 官职任所内容 hash 与引用修复 | `cbac99c` |
| S57.1 | 安全事件索引与事件档案分页 | `acfe9c1` |
| S57.2 | 审计到公开事件 projection 工具 | `84e1fcc` |
| S58.1 | SQLite prompt 安全检索索引 | `2a664eb` |
| S58.2 | 浏览器局势簿双模式 parity smoke | `e12d5f0` |
| S59.1 | JSON/SQLite 双模式整体验收 | `4b0d0a2` |

## 3. 稳定边界

S54-S59 没有改变这些安全边界：

- 默认存储仍是 JSON；Mock AI 默认完整可玩。
- SQLite 仅是本地单机增强，不代表远程存档、账号体系、多人同步、云冲突解决或托管数据库。
- `world_sessions.world_state_json` 仍是 SQLite 模式下派生表修复来源；业务表不是 route state、prompt、浏览器或服务器裁决的 raw truth source。
- AI 不能执行 SQL，不能直接写 `geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index`、`event_log` 或 `ai_change_proposals`。
- 浏览器与 prompt 只读服务器生成的 `worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`eventArchiveView` 和 capped retrieval summary。
- raw audit、provider proposal、完整 prompt、本地路径、密钥、hidden notes、hidden intent、未公开关系、未公开任所和 hidden raw rows 不进入玩家 payload。
- 服务器继续拥有时间推进、科举晋级、作弊处罚、官职任免、长期事件、世界实体、世界议程、schema、白名单、clamp、可见性过滤和持久化事务。

## 4. 代表性验证

S54-S59 期间常用验证集合包括：

- `npm test`
- `npm run check:docs-governance`
- `npm run smoke:browser -- --information-parity`
- `npm run smoke:dual-mode`
- `npm run smoke:dual-mode -- --storage-only`
- `node --test test/sessionStoreAdapterContract.test.js`
- `node --test test/sqliteGeographyTool.test.js test/auditEventArchiveTool.test.js test/sqlitePromptRetrieval.test.js test/dualModeAcceptanceScript.test.js`

归档时再次确认过的 focused 数据库套件：

```bash
node --test test/sessionStoreAdapterContract.test.js test/sqlitePromptRetrieval.test.js test/dualModeAcceptanceScript.test.js test/sqliteGeographyTool.test.js test/auditEventArchiveTool.test.js
```

结果：66 tests pass。

## 5. 为什么还需要 S60+ 内容充实

当前“超大动态世界数据库”的内容充实度约 55-65%。S54-S59 已经让本地 SQLite 底座、派生表、索引、修复和验收可用，但世界内容仍偏“可见 projection + 少量实例化账本”，还没有真正达到大型历史沙盘所需的密度。

主要缺口：

- 国家与邻国：已有地理/边面框架，但缺少多国财政、军事、外交、国威、继承风险、情报可信度和历史事件链的规模化内容。
- 城市与区域：已有城市/辖区行，但缺少全国与邻国城市的税粮、市价、士绅、诉讼、水利、灾害、驿路、驻军、书院、商帮等长期指标。
- NPC 与家族：已有可见 bridge 与关系事件，但还不是数百到数千 NPC 的家族谱系、资产流、婚姻、迁居、升迁、死亡、门生故旧和隐藏动机系统。
- 官职生态：已有官职任所 projection，但缺少空缺池、候补池、上级下属、吏员幕友、考成档案、任期轮转和地方事务负载。
- 事件与记录：已有安全事件索引，但还缺少可组合事件模板、地区事件链、跨域因果、传闻/情报可信度和长期档案生成机制。
- Prompt 检索：已有安全索引，但还缺少大规模数据下的排序、预算、分页、角色视野、情报置信和性能验收。

S60+ 因此应聚焦“内容生成、演化规则、可见性与规模验收”，而不是继续先扩远程、账号或多人功能。

## 6. 接手提示

后续实施 S60+ 时，建议保持这个顺序：

1. 先补内容契约、规模预算和安全验收 fixture。
2. 再分批扩国家/城市/NPC/官职/事件/情报内容。
3. 每次只让服务器 helper 生成或接受受限 proposal，并通过现有 SQLite adapter 同步安全 projection。
4. 不把 hidden 私档塞回当前 raw route `worldState`；如确需保存完整 hidden 私档，先设计 API redaction 与玩家 payload 分层。

---

## S60-S67 超大动态世界数据库内容充实

# 《千秋》S60-S67 超大动态世界数据库内容充实归档

归档日期：2026-05-11。

本文件压缩 S60-S67 已完成的“超大动态世界数据库内容充实”专项，供后续追溯。当前活动路线图已转入 [DEVELOPMENT_STEPS.md](DEVELOPMENT_STEPS.md) 的 S68-S69 科举深化与 S70 AI 编排准备；稳定开发治理仍以 [DEVELOPMENT_GOVERNANCE.md](DEVELOPMENT_GOVERNANCE.md) 为锚点。

## 1. 归档结论

S60-S67 的核心成果是：在 S49-S59 已完成的本地 JSON/SQLite 底座、业务派生表、索引、修复和 dual-mode 验收之上，把大世界内容从“少量 projection 可用”推进到可支撑长期历史沙盘的规模化安全内容层。

已完成能力包括：

- S60：内容规模契约、small/medium/large deterministic fixture、hidden canary、防泄漏、分页和 prompt budget 基线。
- S61：国家/邻国、城市/区域深度指标，接入 route view、任所考成、事件档案、prompt retrieval 和 SQLite 安全派生索引。
- S62：NPC 人口、家族谱系、人物关系网络、月末生命周期、资产/田产/人情债和可见人物事件链路。
- S63：官职生态、任命池、空缺/候补/属官/幕友/丁忧/起复压力，以及地方案牍模板。
- S64：外交军务态势和经济财政态势，覆盖边防、驻军、粮道、使节、税粮、府库、粮价、盐漕、赈济、债务和市场预警。
- S65：公开历史事件链、密档链边界、情报传闻、角色视野、可信度和来源归因。
- S66：大规模 prompt retrieval 策略、ordinary/high profile 预算、角色视野、排序/裁剪统计，以及浏览器局势簿服务器分页、检索、筛选和排序。
- S67：large fixture 规模/性能/回归验收，固定 dual-mode、读档修复、hidden-token、防泄漏、内存和耗时门槛。

## 2. 完成步骤索引

| ID | 摘要 | 主要提交 |
| --- | --- | --- |
| S60.1 | 超大动态世界数据库内容契约：规模档位、seed 分层、hidden/private 边界、prompt budget 和 S60.2 fixture 目标 | 见归档前 git history |
| S60.2 | 内容基线与规模验收 fixture：small route-safe 样本、medium/large storage-only 总量样本、分页、防泄漏和 prompt budget | 见归档前 git history |
| S61.1 | 国家与邻国深度内容包：财政、军备、国威、正统性、继承风险、外交、贡贸和情报可靠度 | `2d15b07` |
| S61.2 | 城市与区域深度内容包：税粮、市价、士绅、词讼、水利、灾害、交通、驻军和书院，并接入任所考成/事件档案 | `aa8c75b` |
| S62.1 | NPC 人口生成与家族谱系：官员、胥吏、士绅、商贾、军官、师友、同年、亲族、使节和关系网络 | `ceae352` |
| S62.2 | NPC 生命周期与资产流动：健康、婚丧、迁居、官职履历、财富欠账、田产、家族风险和人情债 | `15e532c` |
| S63.1 | 官职生态与任命池：上级、属官、空缺、候补、补授、试署、外放、丁忧、起复和弹劾候勘 | 见归档前 git history |
| S63.2 | 地方事务与案牍事件模板：钱粮、刑名、灾赈、水利、盗匪、徭役、士绅、疫病和任所收束 | 见归档前 git history |
| S64.1 | 外交、边防与军事数据库内容：边镇、驻军、粮道、战备、邻国使节和边患预警 | 见归档前 git history |
| S64.2 | 经济、财政、粮储与市场演化：税赋、府库、粮价、盐漕、商路、地方库银、赈济、债务和腐败 | 见归档前 git history |
| S65.1 | 事件模板与历史档案生成系统：公开事件链、跨域因果、密档 projection 边界和安全索引 | 见归档前 git history |
| S65.2 | 情报、传闻与可见性系统：角色视野、传闻可信度、线索来源、秘密过滤和 prompt 边界 | 见归档前 git history |
| S66.1 | 大规模 prompt retrieval 策略：排序、预算、分页、角色视野、性能和 hidden-token 防线 | `e8b2dd1` |
| S66.2 | 大数据量浏览器信息面板：五类局势簿服务器分页、检索、筛选、排序和 hidden-token smoke | `efa5fa1` |
| S67.1 | 规模/性能/回归验收：large fixture dual-mode、读档修复、prompt 策略、UI 分页和内存/耗时门槛 | `400d714` |
| S67.2 | 本归档、活动台账压缩、brief/README/共享上下文交接到 S68-S69 | 本次提交 |

## 3. 稳定边界

S60-S67 没有改变这些安全边界：

- 默认存储仍是 JSON；Mock AI 默认完整可玩。
- SQLite 只表示本机存档增强，不代表远程存档、账号体系、多人同步、云冲突解决或托管数据库。
- `world_sessions.world_state_json` 仍是 SQLite 派生表读档修复来源；`geo_*`、`people_*`、`office_*`、`event_archive_index` 和 `prompt_retrieval_index` 不是 route state、prompt、浏览器或服务器裁决的 raw truth source。
- AI 不能执行 SQL，不能直接写 canonical 状态、业务表、审计表、事件档案索引或 prompt 检索索引。
- AI 可以读取身份可见的 capped projection，并通过身份受限的领域工具提交 proposal / request-adjudication；真正落地必须由服务器 helper、schema、clamp、visibility filter、resolver 和 adapter transaction 裁决。
- 浏览器和 prompt 只读服务器生成的 route view、`informationPanelPageView` 与 capped retrieval summary，不读 raw SQLite table、raw audit、provider proposal、完整 prompt、本地路径、密钥、hidden notes 或 hidden intent。
- hidden NPC 私档、资产真数、未公开关系、未公开任所、密档事件链和隐藏情报真值不回填当前 raw route `worldState`。
- `retrievalContext.strategy` 只是只读上下文编排元数据，不是权限层；它不能授予 AI 写库、任免、战和、财政结算、事件成案或 hidden 公开权。
- 服务器继续拥有时间推进、科举晋级、作弊处罚、官职任免、长期事件、世界实体、世界议程、数据库写入和持久化事务。
- 完整书生路径必须继续保护：`scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。

## 4. 已交付内容域

### 内容契约与规模 fixture

本归档的“S60 内容规模与可见性契约”章节固定开发小样本、默认可玩中样本和压力测试大样本三档规模，明确 seed catalog、场景 seed pack、每局动态安全账本、服务器 hidden 私档、玩家 view、prompt retrieval、浏览器 projection 和审计公开 projection 分层。

S60.2 的 `src/game/worldContentFixtures.js` 提供 `small` / `medium` / `large` deterministic fixture：

- small route-safe 样本：6 国、24 城、96 NPC、32 家族、160 关系、80 官职/官署目录行、48 任所/任命行、64 条事件/情报侧车和约 491 条安全 prompt retrieval 行。
- medium storage-only 样本：10 国、96 城、480 NPC、160 家族、1000 关系、220 官职/官署行、180 任所/任命行、500 事件/情报条目和 1800 prompt retrieval 行。
- large storage-only 样本：14 国、300 城、2000 NPC、700 家族、5000 关系、450 官职/官署行、1000 任所/任命行、5000 事件/情报条目和 10000 prompt retrieval 行。

真正 private hidden canary 保持在 fixture 侧车，不写入当前 raw route `worldState`。

### 地理、人物与官职生态

S61 给国家、邻国和城市补充可见深度指标。国家行包含财政压力、军备、国威、正统性、继承风险、外交张力、贡贸活跃度、情报可靠度和政策压力标签；城市行包含人口规模、税基、粮储、市价、士绅、词讼、徭役、水利、灾害、交通、驻军、书院和地方问题标签。这些指标进入 `worldGeographyView`、prompt summary、`prompt_retrieval_index` 和 SQLite `geo_*` metadata，但不替代外交、战争、财政或城市治理裁决。

S62 给可见人物域补 NPC 人口、家族谱系和生命周期。生成器覆盖官员、胥吏、士绅、商贾、军官、书院师友、同年、亲族和邻国使者，并补父母、配偶、子女、姻亲、门生故旧、同乡、同年和派系关系。生命周期 helper 在月末推进可见健康、婚丧、迁居、履历、财富、欠账、田产、家族风险和人情债，继续通过 `world_people` 审计和 `people_*` 派生行追踪。

S63.1 扩充 `officialPostingsView` 的官职生态与任命池，包括上级堂官、属官、胥吏、幕友、空缺、候补、补授、试署、外放、丁忧、起复、弹劾候勘和差遣压力。这些是可见 projection、SQLite 派生行和 prompt 检索素材，不是真实任免事实。

### 地方案牍、军务外交与经济财政

S63.2 新增 `localAffairsDocketView`，从可见城市/任所指标派生钱粮、刑名、灾赈、水利、盗匪、徭役、士绅、疫病和任所收束案牍。案牍可进入 route view、事件档案 `local_docket` 条目和 prompt 检索，但不直接改城市指标、官场考成、任免或数据库。

S64.1 新增 `militaryDiplomacyView`，把边镇、驻军、粮道、战备、邻国使节和边患预警接入 route view、事件档案和 prompt retrieval。AI 可以解释可见军务外交态势，但不能宣战、和议、调兵、任免统帅、结算战役或公开 hidden 情报。

S64.2 新增 `economicFiscalView`，把税粮、府库、粮价、盐漕商路、地方库银、赈济、债务腐败和市场预警接入 route view、事件档案和 prompt retrieval。AI 可以解释财政市场压力，但不能裁决征收、拨银、开仓、平粜、赈济、盐漕、矿冶、清债、价格、考成或持久化。

### 历史事件链与情报传闻

S65.1 新增 `historicalEventArchiveView` 与 `events.eventChains`，把自然灾害/赈务、官场争斗、边事、商税、人物关系、科举和地方差遣组合为公开历史事件链。密档链只有服务器显式 `includeSealed` 才生成，不进入普通玩家路由、浏览器、prompt retrieval 或 SQLite prompt 索引。

S65.2 新增 `intelligenceRumorView` 与 `intel.rumors`，从服务器可见事实派生坊间传闻、衙门案牍、官署奏报、同僚私信、军中侦报、粮道风声、部院奏报、御史风闻或御前摘报，并附可信度、来源归因和相关 refs。它只提供角色可见线索，不裁决传闻真伪、公开密情、任免、战和、刑赏、财政结算、事件成案、审计或落库。

### Prompt 策略与浏览器分页

S66.1 在 `src/ai/promptContextAssembler.js` 中新增 `retrievalContext.strategy`，记录 ordinary/high profile、行/字符预算、候选/选中/丢弃域统计、全局裁剪、字符预算裁剪、排序信号、角色视野和分页边界。普通 prompt 仍控制在 48 行 / 约 20,000 字符，高相关 profile 控制在 72 行 / 约 30,000 字符。显式内部检索源会过滤 hidden canary、raw table/index、审计、本地路径和 key 形状文本。

S66.2 新增 `src/game/informationPanelPage.js`，从服务器 route views 和安全事件档案条目生成 `informationPanelPageView`。天下格局、任所地理、人物谱牒、官职簿和事件档案支持 query/filter/sort/page/pageSize；`GET /api/game/state/:sessionId` 支持 `information*` 查询参数读取指定页。该 view 不读 raw SQLite table、raw audit、provider proposal、完整 prompt、本地路径、key、hidden notes 或 hidden intent。

## 5. 代表性验收

S67.1 把内容充实阶段纳入 `npm run smoke:dual-mode -- --storage-only` 的 `scale` 输出段。2026-05-14 维护性回补已修正性能指标命名：旧 `fixtureGenerationMs` 实际混入了 `createWorldContentFixture()` 外层总构建、summary 与 baseline 工作，现拆为只量原始生成段的 `rawFixtureGenerationMs` 和报告型 `fixtureBuildMs`。规模数量、防泄漏、分页 cap、prompt budget、SQLite read-repair parity 仍是硬门；`fixtureBuildMs` 和 full-suite 资源竞争敏感的总耗时只用于报告，避免 Windows/WSL 并发测试把无行为退化的资源波动误判为失败。最新通过的代表性验证包括：

- `node --check scripts/dualModeAcceptance.js && node --test test/dualModeAcceptanceScript.test.js`
- `npm run smoke:dual-mode -- --storage-only`
- `node --test test/dualModeAcceptanceScript.test.js test/worldContentFixtures.test.js test/promptContextAssembler.test.js test/informationPanelPage.test.js`
- `npm run check:docs-governance`
- `node --test test/documentationGovernance.test.js`
- `git diff --check`

最新本机 `storage-only` scale 观测值：

- large fixture：14 国、300 城、2000 NPC、700 家族、5000 关系、450 官职/官署行、1000 任所/任命行、5000 事件/情报条目、10000 prompt 行、256 hidden canary。
- route view cap：24 城、96 NPC、160 关系、601 route-safe prompt rows。
- ordinary prompt：46 行 / 19,570 字符。
- high prompt：72 行 / 29,007 字符。
- SQLite `prompt_retrieval_index` 删除后读档修复：0 行恢复到 601 行。
- 性能观测：`rawFixtureGenerationMs` 约 112ms、`fixtureBuildMs` 约 3960ms、event archive 约 200ms、prompt assembly 约 796ms、prompt retrieval rows 约 395ms、fixture page 约 4ms、information panel 约 803ms、SQLite repair 约 3597ms、heap delta 约 101MiB；行为指标低于脚本阈值，`fixtureBuildMs` 作为 full-suite 噪声敏感报告字段。

## 6. 接手提示

S60-S67 已经把大世界内容、安全 projection、prompt strategy、浏览器分页和规模验收收束到可交接状态。后续不要在活动台账中继续展开这些实现细节；需要追溯时优先打开本归档。旧的 S49-S53、S54-S59、S60-S67 分卷和 S60 契约文件仅保留为跳转页，避免历史链接失效。

下一阶段建议从 S68.1 开始：

1. 先落成科举制度契约，明确童试县试/府试/院试，乡试/会试三场多日多卷，保结、搜检、号舍、弥封、誊录、对读、磨勘、复核和多考官阅卷。
2. 保护现有 API 与完整书生路径；内部可深化制度流程，但不能破坏 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
3. 把 AI 老师、同年、房官、同考官、主考官、吏部和皇帝限制为题目、点评、批语、事件或授官 proposal；资格、舞弊、排名、榜单、授官、任免和持久化仍由服务器裁决。
4. S68-S69 完成后，再进入 S70 的 AI prompt pack、工具协议、actor 权限和内部 `game_ai_tools` registry。

---

## S60 内容规模与可见性契约

# S60 超大动态世界数据库内容契约

本文是 S60.1 的交付物，负责把“超大动态世界数据库”从方向性愿景固定为可验收的内容规模、数据分层、生成入口、可见性边界和 S60.2 fixture 目标。后续 S61-S67 扩充国家、城市、人物、官职、事件、情报、prompt 检索和浏览器面板时，都应先对照本文。

## 1. 范围与不变量

本专项继续只考虑本机 JSON/SQLite，不规划远程存档、账号体系、多人同步、云端冲突解决或托管数据库。SQLite 是本地增强索引和派生表；JSON adapter 仍是默认可玩路径，`world_sessions.world_state_json` 仍是可读、可导入、可修复的兼容 snapshot。

AI 仍是世界引擎，但不是数据库执行者。模型可以生成叙事、传闻、公文口吻、事件描述和受限 proposal；服务器 helper 才能 schema 校验、clamp、过滤 hidden、写入 `worldState`、同步 SQLite 派生表、追加审计并推进 revision。AI 不执行 SQL，不直接写 `geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index`、`event_log` 或 `ai_change_proposals`。

浏览器和 prompt 只读服务器整理后的 view / capped retrieval summary。raw SQLite table、raw audit、provider proposal、完整 prompt、本地路径、密钥、hidden notes、hidden intent、未公开关系、未公开任所、密札考成和邻国真实虚实都不得成为玩家 UI 或普通 provider prompt 的数据源。

当前 `GET /api/game/state/:sessionId` 仍返回完整本地 `worldState` 以保持开发兼容。因此 S60-S67 不得把真正 hidden 私档、资产真数、密谋、暗线情报或未公开调任回填进当前 raw route `worldState`。若后续要保存完整 hidden 私档，必须先实现玩家 API redaction、角色视野分层和只读诊断出口。

既有地理、人物或官职契约中的 `hidden` 测试种子和可见性标签，仍可用于验证 view/prompt 过滤；它们不等同于“真正 hidden 私档”。S60.2 的私档 canary 若包含资产真值、密谋、线人、邻国虚实或密札考成，必须放在不会随当前 raw route state 返回的服务器私档层或污染输入中，只能用来证明 sanitizer 不泄漏。

## 2. 内容规模档位

S60 后的内容规模分为三档。数量是验收目标，不要求每个后续步骤一次性填满，但新增 generator、fixture、prompt retrieval 或浏览器面板必须声明自己支持哪一档。

| 档位 | 用途 | 国家/政权 | 区域/城市 | NPC/家族 | 官职/任所 | 事件与情报 | prompt 索引 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 开发小样本 | 单元测试、快速 smoke、旧路径回归 | 5-6 国，含本国和主要邻国 | 8-12 区域，24-32 城市，12-20 路线 | 80-120 NPC，30-50 家族，160-240 关系 | 80-120 官职/官署目录行，30-60 任所/任命行 | 40-80 事件模板或档案条目，40-80 情报/传闻线索 | 250-500 条安全检索行 |
| 默认可玩中样本 | `npm start` 后长期本地游玩、Mock/JSON 默认体验 | 8-12 国 | 24-36 区域，80-120 城市，50-80 路线，16-24 边面 | 350-500 NPC，120-180 家族，800-1200 关系，400-700 资产/田产估计 | 180-260 官职/官署目录行，120-220 任所/任命/考成/迁转行 | 180-260 事件模板，300-600 公开档案/传闻/线索 | 1500-2500 条安全检索行 |
| 压力测试大样本 | S67 性能、防泄漏、分页和修复验收 | 12-18 国 | 60-90 区域，240-360 城市，160-240 路线，40-64 边面 | 1500-2500 NPC，450-800 家族，4000-7000 关系，2500-4000 资产/田产估计 | 300-500 官职/官署目录行，800-1200 任所/任命/考成/迁转行 | 400+ 事件模板，3000-5000 公开档案/情报/传闻条目 | 8000-12000 条安全检索行 |

默认可玩中样本是 S61-S66 的内容密度目标。压力测试大样本只要求 fixture / generator / storage-only 验收可运行，不要求浏览器一次渲染全部内容；浏览器必须通过搜索、筛选、分页和 domain cap 查阅。

这些数量表示“世界内容总量”和“fixture 总量”，不是当前 route view、`worldPeople` bridge bundle、`officialPostings` bundle 或 prompt summary 必须一次承载的行数。S51/S52 既有 bundle cap 仍然有效：后续要支持数百 NPC 或数百任所时，必须采用“数据库/fixture 总量 > 安全分页 view > prompt capped summary”的分层，或先调整对应 schema cap、测试和浏览器分页契约。任何实现不得为了达到总量目标而把全部 NPC、官职、事件或 hidden 私档塞入当前会随 route 返回的 raw `worldState`。

## 3. Seed 与数据分层

大世界内容必须按层进入游戏，不能把所有内容混在一个 raw state 里。

| 层级 | 含义 | 可写入者 | 可读入口 | 说明 |
| --- | --- | --- | --- | --- |
| 静态 seed catalog | 朝代、国家、城市、路线、官署、官职、事件模板、NPC 原型 | 代码 seed、文档契约、受测 fixture | 服务器 generator、迁移/修复工具 | 不含每局私档真相；可以公开或带初始可见性标签。 |
| 场景 seed pack | 默认明末基础盘、后续朝代包或测试包 | 服务器 generator、fixture helper | 开局初始化、S60.2 fixture | 用固定 seed id 和随机种子生成稳定世界。 |
| 每局动态安全账本 | 当前 `worldState.worldGeography`、`worldPeople`、`officialPostings`、`eventArchiveView` 来源数据 | 服务器 helper、storage adapter transaction | route view、prompt summary、SQLite 派生修复 | 只保存可进入本地 raw route 的安全 projection。 |
| 服务器 hidden 私档 | 未公开关系、密谋、资产真数、邻国虚实、密札考成 | 后续专门私档模块 | 未来 redacted API 后的服务器内部 resolver | S60-S67 不得塞回当前 raw route `worldState`。 |
| 玩家可见 view | `worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`eventArchiveView` 等 | view builder | 浏览器、route payload | 移除 hidden notes、hidden refs、raw id fallback 和越权角色内容。 |
| prompt retrieval summary | `retrievalContext` 与 `prompt_retrieval_index` 安全行 | prompt assembler、SQLite 安全派生表 | provider prompt | 从玩家可见/角色可见摘要中按预算选择，不全量塞给模型。 |
| 浏览器查阅 projection | 局势簿、搜索、分页、过滤后的卡片数据 | route view / API projection | `public/app.js` | 不读取 raw SQLite table 或 provider-only payload。 |
| 审计公开 projection | public 审计摘要、事件档案安全条目 | 审计 sanitizer、event archive builder | 本地工具、事件档案 view | AI proposal 原文只计数或脱敏摘要，不进玩家面板。 |

## 4. 各域字段密度

### 国家与邻国

国家内容至少覆盖身份、财政、军政、国威、外交、民生、继承风险、情报可信度和可见摘要。默认可玩中样本中，每个主要国家应有财政压力、粮储压力、军力/边备、朝局稳定、继承风险、外交态度、互市/贡使、边患线索和 `intelConfidence`。邻国真实虚实可以在服务器私档中保留，但 prompt/UI 只能看到奏报、传闻或粗略情报。

### 区域、城市与交通

城市不只是地名。默认可玩中样本中，每座核心城市应至少有税基、粮储、市价、治安、士绅势力、诉讼积压、徭役、水利、灾害风险、交通/驿路、驻军和书院/科举影响。边镇、漕运节点、府州县、邻国都城可以有不同字段密度，但必须能落到事件档案、官职考成、地方事务模板和 prompt retrieval。

### NPC、家族与资产

NPC 内容至少覆盖身份、地点、家族、官场/职业、能力、性情、声望、人情债、关系、可见财富估计和生命周期状态。默认可玩中样本不要求每个 NPC 调用模型，但要求服务器能按地点、官署、事件、关系和玩家输入检索相关 NPC。资产真数、密账、隐藏动机、隐秘庇护和未公开亲缘不得进入当前 raw route state；玩家看到的是估计、传闻、公开族谱或关系札记。

### 官职、官署与任所

官职内容至少覆盖目录、官署层级、职责、任所辖区、空缺、候补、上级下属、胥吏幕友、考成、迁转、弹劾、丁忧/起复和地方指标。`player.officeTitle`、NPC 任免、考成结论、处分和迁转仍由服务器裁决。AI 可以写奏牍口吻、上官态度、传闻和普通 meter 建议，不能写任命行或把自己标为表行来源。

### 地方事务、经济、军事与外交

地方事务模板至少覆盖钱粮、刑名、灾赈、水利、盗匪、徭役、士绅、疫病、学政、驿递。经济内容应覆盖税赋、粮价、商路、盐漕、库银、债务、腐败和赈济压力。军事外交内容应覆盖边镇、驻军、粮道、战备、军心、邻国使节、谈判、边患事件和可见情报。每个模板都必须标明可见摘要、可应用的服务器 resolver、可能影响的城市/人物/官职/事件引用和审计记录。

### 事件、历史档案与情报

事件模板和历史档案必须分开：模板是可组合规则，档案是已经发生或可见的记录。每条可见档案至少包含 `title`、`summary`、`sourceType`、`scope`、`severity`、`relatedRefs`、`visibility`、`intelConfidence`、`publicText` 和分页/检索权重。密档摘要、隐藏原因、真实线人、未公开后果和 raw applied changes 只能存在于服务器私档或审计 allowlist 之外。

### Prompt 检索索引

检索行必须说明来源 view、domain、title、summary、tags、related ids、visibility、role scope、freshness、severity、query match hints 和内容 hash。检索索引是 prompt 入口，不是裁决入口；同一事实在 raw table、view、prompt row 和浏览器 projection 中必须保持单向安全派生。

## 5. 可见性与私档规则

S60-S67 沿用并统一这些可见性标签：

- `public`：公开奏报、官样文书、地名、已知人物和事件档案。
- `role_visible`：由当前身份、职位、辖区、官署、军务或考试场景获得的公文视野。
- `office_visible`：与当前官署、任所、上级下属或差遣相关。
- `relationship_visible`：由师门、同年、亲族、私信、人情债或庇护关系得知。
- `rumor`：传闻、坊间风声、低可信边报或商旅线索。
- `hidden`：服务器内部事实，不进入 prompt/UI/route view/save list。

同一事实可以有多份 projection：皇帝看到奏报，地方官看到案牍，书生只听传闻，普通玩家完全不可见。实现上应优先生成“可见摘要”，而不是把 hidden row 交给 prompt 后要求模型自律。

防泄漏规则：

- `hiddenNotes`、`hiddenIntent`、`hidden_notes_json`、私档真值、raw SQL row、raw audit、raw provider output 和完整 prompt 不能进入 `world*View`、`retrievalContext`、浏览器 DOM、save-list 或调试导出默认输出。
- 嵌套引用目标不可见时，view 必须裁剪引用或降级为安全摘要，不得展示 raw id。
- 传闻必须带低于正式档案的 `intelConfidence`，并在文本上保持“未证”“闻得”“边报称”等语气。
- 任何把 hidden 私档写入 `worldState` 的实现都视为超出 S60-S67 当前边界，除非同一提交先提供玩家 API redaction 和相应 hidden-token 验收。

## 6. 内容生成入口

允许入口：

- seed catalog：人工维护或脚本生成的静态目录，必须有 schema、可见性和引用校验。
- server generator：从 seed pack 和 session seed 生成每局动态安全账本，必须幂等、可重放、可测试。
- fixture generator：用于 S60.2/S67 的小/中/大样本，可固定随机种子，不依赖真实 provider key。
- migration / repair tool：只能从 `world_sessions.world_state_json`、安全 view 或受控 seed 单向修复派生表。
- bounded AI proposal：只能提交服务器 schema 允许的叙事、关系建议、事件建议或普通 meter 建议；服务器接受后再写安全事件和派生表。

禁止入口：

- provider 直接返回 SQL、表名、row id 写入指令或“已写入数据库”的事实。
- 浏览器直接修改 raw ledger 或 raw SQLite table。
- prompt assembler 读取 raw audit、raw business table 或 hidden 私档。
- fixture 为了过 hidden-token 测试而删除真实边界字段；测试应证明字段存在于私档/污染输入时也不会泄漏。

## 7. Prompt Budget

大世界不能随规模线性扩大 prompt。普通回合 prompt 的动态内容应保持 capped summary：

| 域 | 普通回合建议上限 | 高相关场景上限 | 说明 |
| --- | --- | --- | --- |
| 国家/邻国 | 4 条 | 6 条 | 优先当前外交、边患、玩家身份相关国家。 |
| 城市/区域/路线 | 6 条 | 10 条 | 优先当前地点、任所、目的地、边镇和玩家点名地点。 |
| NPC/家族 | 8 条 | 12 条 | 优先同地、同官署、同事件、近关系、被点名人物。 |
| 关系/人情 | 8 条 | 12 条 | 只取可见关系和 capped recent notes。 |
| 官署/官职/任所 | 6 条 | 10 条 | 官员、地方官、皇帝和相关差遣场景可提高上限。 |
| 事件档案 | 8 条 | 12 条 | 结合 freshness、severity、related refs 和 query match。 |
| 情报/传闻 | 6 条 | 10 条 | 必须保留可信度和来源语气。 |
| 市场/军事/财政压力 | 6 条 | 10 条 | 以摘要行进入，不塞完整指标表。 |

S60.2 起，测试应检查 prompt retrieval 不随 fixture 总行数线性增长：小样本、中样本和大样本下，普通回合动态摘要应稳定在同一数量级，并且没有 hidden token、raw table 名、本地路径、完整 prompt 或 provider proposal 原文。

普通自由回合的全局动态检索预算建议先设为：

- `retrievalContext` 各域合计不超过 48 条摘要行；高相关场景合计不超过 72 条。
- 动态检索 JSON 序列化后普通回合不超过约 20,000 字符；高相关场景不超过约 30,000 字符。
- 单条摘要优先控制在 160 字以内；事件、案牍或考试相关条目可略长，但必须经过 domain cap。
- 排序优先级依次为：玩家当前地点/任所、玩家点名实体、active scene、未解决世界议程、近期高严重事件、强关系 NPC、角色权限、情报可信度、地理距离。
- 超额时丢弃低可信、低相关、低严重、旧闻和重复实体摘要；不得丢弃安全过滤步骤，也不得用 raw table fallback 补足数量。

## 8. S60.2 Fixture 目标

S60.2 应新增 deterministic fixture 或 generator，至少支持：

| Fixture | 目标用途 | 最低数量 |
| --- | --- | --- |
| `small` | 快速单元测试、JSON/SQLite parity、hidden-token smoke | 6 国、24 城、96 NPC、32 家族、160 关系、80 官职/官署行、48 任所/任命行、64 事件/情报条目、250 prompt retrieval 行 |
| `medium` | 默认内容密度验收、浏览器分页/筛选基线 | 10 国、96 城、480 NPC、160 家族、1000 关系、220 官职/官署行、180 任所/任命/考成行、500 事件/情报条目、1800 prompt retrieval 行 |
| `large` | S67 storage-only 和性能防泄漏压力 | 14 国、300 城、2000 NPC、700 家族、5000 关系、450 官职/官署行、1000 任所/任命/考成/迁转行、5000 事件/情报条目、10000 prompt retrieval 行 |

S60.2 不要求一次性把这些内容都变成深度玩法，但必须让后续 S61-S66 有稳定样本可验收。fixture 可以用 seed + generator 生成，不要求提交巨大的手写 JSON 文件。所有 fixture 必须可在无 key、Mock、JSON 默认路径下运行；SQLite 只作为双模式 parity / repair 增强。

## 9. S60.2 验收口径

S60.2 focused tests 至少应覆盖：

- 数量门槛：国家、城市、NPC、家族、关系、官职、事件、prompt retrieval 行达到对应 fixture 档位。
- JSON/SQLite parity：同一 fixture 生成的 route view、prompt summary、事件档案分页 metadata 和安全检索摘要一致，或只有记录过的安全降级。
- hidden-token：hidden notes、hidden intent、密札考成、邻国真实虚实、raw table 名、raw audit token、provider proposal token、本地路径和假 key 片段不会进入 view、prompt、浏览器 DOM 或 debug export 默认输出。
- hidden canary：每个主要域至少放入 10 个 hidden canary；主要域包括国家/邻国、城市/路线、NPC/家族/资产、官职/任所、事件档案、情报/传闻、prompt retrieval 和审计/导出。`small` fixture 总计不少于 40 个，`medium` fixture 总计不少于 80 个，`large` fixture 总计不少于 250 个。canary 应覆盖 hidden id、hidden nested ref、`hiddenNotes`、`hiddenIntent`、`last_event_id`、`contentHash`、SQLite path、raw table 名、raw audit/proposal token、完整 prompt 片段、假 key 片段和低可信情报真值。
- prompt budget：大样本下普通回合 `retrievalContext` 条目和文本长度保持 cap，不随总行数线性增长。
- 读档修复：污染或删除 raw SQLite 派生行后，读取只从 `world_state_json -> server views` 单向修复，不反向制造 route state。
- 浏览器分页：中/大样本下信息面板通过搜索、筛选、分页读取 route view，不渲染全量 raw ledger。
- 性能记录：记录原始 fixture 生成、外层 fixture build 报告、prompt assembly、event archive pagination、SQLite import/repair 的耗时；门槛可先作为 S67 调整项，但 S60.2 必须输出命名准确的基线。

## 10. 后续步骤使用方式

S61-S66 每个内容切片都应在实现说明或契约中回答：

1. 本切片填充哪个规模档位，新增多少 seed / dynamic / view / prompt rows。
2. 哪些字段是静态 seed，哪些是每局动态，哪些是 hidden/private，哪些能进入 prompt/browser。
3. AI 在该域能读什么、能建议什么、不能裁决什么。
4. 服务器 helper 如何生成、校验、clamp、审计和修复。
5. Mock/no-key、JSON 默认、SQLite parity、hidden-token、prompt budget 和浏览器分页如何验收。

若某实现无法回答以上问题，应先补契约或测试，再写运行时代码。
