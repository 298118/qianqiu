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

S60.1 的 [HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md](HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md) 固定开发小样本、默认可玩中样本和压力测试大样本三档规模，明确 seed catalog、场景 seed pack、每局动态安全账本、服务器 hidden 私档、玩家 view、prompt retrieval、浏览器 projection 和审计公开 projection 分层。

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

S67.1 把内容充实阶段纳入 `npm run smoke:dual-mode -- --storage-only` 的 `scale` 输出段。最新通过的代表性验证包括：

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
- 性能观测：fixture 约 2750ms、event archive 约 170ms、prompt assembly 约 561ms、prompt retrieval rows 约 328ms、fixture page 约 2ms、information panel 约 710ms、SQLite repair 约 1395ms、heap delta 约 69MiB，均低于脚本阈值。

## 6. 接手提示

S60-S67 已经把大世界内容、安全 projection、prompt strategy、浏览器分页和规模验收收束到可交接状态。后续不要在活动台账中继续展开这些实现细节；需要追溯时打开本归档、[HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md](HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md)、[LOCAL_DATABASE_FOUNDATION_ARCHIVE.md](LOCAL_DATABASE_FOUNDATION_ARCHIVE.md) 和 [LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md](LOCAL_DATABASE_BUSINESS_TABLE_ARCHIVE.md)。

下一阶段建议从 S68.1 开始：

1. 先落成科举制度契约，明确童试县试/府试/院试，乡试/会试三场多日多卷，保结、搜检、号舍、弥封、誊录、对读、磨勘、复核和多考官阅卷。
2. 保护现有 API 与完整书生路径；内部可深化制度流程，但不能破坏 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`。
3. 把 AI 老师、同年、房官、同考官、主考官、吏部和皇帝限制为题目、点评、批语、事件或授官 proposal；资格、舞弊、排名、榜单、授官、任免和持久化仍由服务器裁决。
4. S68-S69 完成后，再进入 S70 的 AI prompt pack、工具协议、actor 权限和内部 `game_ai_tools` registry。
