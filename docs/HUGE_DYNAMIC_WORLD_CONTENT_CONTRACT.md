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
- 性能记录：记录 fixture 生成、prompt assembly、event archive pagination、SQLite import/repair 的耗时；门槛可先作为 S67 调整项，但 S60.2 必须输出基线。

## 10. 后续步骤使用方式

S61-S66 每个内容切片都应在实现说明或契约中回答：

1. 本切片填充哪个规模档位，新增多少 seed / dynamic / view / prompt rows。
2. 哪些字段是静态 seed，哪些是每局动态，哪些是 hidden/private，哪些能进入 prompt/browser。
3. AI 在该域能读什么、能建议什么、不能裁决什么。
4. 服务器 helper 如何生成、校验、clamp、审计和修复。
5. Mock/no-key、JSON 默认、SQLite parity、hidden-token、prompt budget 和浏览器分页如何验收。

若某实现无法回答以上问题，应先补契约或测试，再写运行时代码。
