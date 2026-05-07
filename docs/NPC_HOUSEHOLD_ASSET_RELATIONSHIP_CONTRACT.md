# S51 人物、家族、资产、田产与关系 Schema / 桥接契约

S51 是本地动态世界数据库专项的人物域切片。S51.1 先固定 NPC、家族、资产、田产、关系与可见性 schema；S51.2 在此基础上桥接当前 `characters`、`relationshipLedger` 和可见 `activeNpcRequest`。S55.1 在本文固定本地 SQLite 人物域业务表契约；S55.2 已把当前可见 `worldPeople` bridge projection 同步进 SQLite `people_*` 业务表；S55.3 已加入服务器人物事件 helper 和本地 `last_event_id` 审计关联。

S51 切片本身不替换旧 `relationshipView` / `activeNpcRequestView`，也不让 AI 直接创建人物或改写家产。S51.2 新增的 `worldState.worldPeople` 是当前可见旧系统数据的安全 projection，不是隐藏人物私档总库。S53.5 后浏览器“人物谱牒”已经读取 `worldPeopleView`，但仍只读 route player-facing view，不读取 raw ledger。S55.2 新增的 `people_*` SQLite 表也只是可见 bridge 派生存储；S55.3 的事件 id 只落本地 people row / audit 关联，不进入 view 或 prompt：默认 JSON 路径和 Mock 可玩性不变，route 字段不变，prompt/UI 不读取 raw `people_*`。

## 范围

S51.1 新增运行时契约 helper：`src/game/worldPeopleSchemas.js`。

该模块只提供：

- `WORLD_PEOPLE_SCHEMA_VERSION`
- `normalizeWorldPeopleSchemaBundle(input, worldState)`
- `buildWorldPeopleSchemaView(input, worldState)`
- `summarizeWorldPeopleSchemaForPrompt(input, worldState)`
- `canSeeWorldPeopleRow(row, worldState)`

S51.2 新增 `src/game/worldPeople.js`，提供：

- `createInitialWorldPeopleState(worldState)`
- `normalizeWorldPeopleState(worldState)`
- `ensureWorldPeopleState(worldState)`
- `buildWorldPeopleView(worldState)`
- `summarizeWorldPeopleForPrompt(worldState)`

该模块从旧 `characters[]`、`relationshipLedger.characters`、`relationshipLedger.factions` 和 `buildActiveNpcRequestView()` 派生安全桥接行。它会写入每局 `worldState.worldPeople`，但只保存当前角色可见 projection：hidden legacy 目标、自定义 hidden worldPeople 行、`hiddenNotes` 和 `hiddenIntent` 不进入 raw `worldState.worldPeople`，因为现有本地 route 仍随 payload 返回完整 `worldState`。

## 顶层 Bundle

```json
{
  "schemaVersion": 1,
  "generatedAtTurn": 0,
  "npcs": [],
  "households": [],
  "assets": [],
  "estates": [],
  "relationships": [],
  "recentNotes": []
}
```

限制：

- `npcs` 最多 128 行。
- `households` 最多 64 行。
- `assets` 最多 128 行。
- `estates` 最多 128 行。
- `relationships` 最多 256 行。
- 文本会裁剪为短句；数值会 clamp；非法 id、重复 id 和缺少关键字段的行会丢弃。

## NPC 行

NPC 是未来人物表的主行，覆盖现有 `characters[]` 不能承载的家世、官署、资产和风险信息。

核心字段：

- 身份：`id`、`name`、`courtesyName`、`genderLabel`、`age`、`alive`
- 地理：`homeCityId`、`currentCityId`
- 家族：`householdId`、`family.fatherId`、`family.motherId`、`family.spouseIds`、`family.childrenIds`、`family.marriageAllianceTags`
- 官场：`currentOfficeId`、`currentPostingId`、`rankLabel`、`bureauId`、`factionId`
- 能力：`skills.literarySkill`、`skills.administration`、`skills.legalJudgment`、`skills.militaryCommand`、`skills.diplomacy`、`skills.learning`
- 性情：`temperament.ambition`、`temperament.loyalty`、`temperament.integrity`、`temperament.caution`、`temperament.temper`
- 社会资本：`reputation`、`influence`、`patronagePower`、`peerNetwork`
- 经济：`wealthCash`、`landMu`、`debts`、`annualIncomeEstimate`、`assetIds`、`estateIds`
- 风险：`health`、`legalRisk`、`impeachmentRisk`、`resentmentRisk`
- 信息：`visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenIntent`、`hiddenNotes`、`lastUpdatedTurn`

能力、性情、社会资本和风险指标均为 `0..100`；`wealthCash`、`landMu`、`debts`、`annualIncomeEstimate` 为非负整数。`hiddenIntent` 与 `hiddenNotes` 只可保留在 raw bundle / future ledger，不得进入 view 或 prompt summary。

## 家族、资产与田产行

`households` 表示家族/户。它不是 NPC 的重复字段，而是多个 NPC、田产、资产和婚姻网络的共同归属。

核心字段：

- `id`、`familyName`、`seatCityId`
- `wealthScore`、`landMu`、`prestige`、`gentryRank`
- `marriageNetworkScore`、`debtPressure`、`politicalAlignment`、`familyRisk`
- `memberNpcIds`、`estateIds`、`assetIds`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

`assets` 表示非田产资产，如现金、铺面、矿山、仓储、债务、俸禄或经营权益。`kind` 允许 `cash`、`shop`、`mine`、`granary`、`debt`、`stipend`、`business`、`other`。资产必须有 `ownerType` 和 `ownerId`；当 owner 是隐藏 NPC 或隐藏家族时，资产 view 不得泄漏。

`estates` 表示田产或庄田。核心字段包括 `ownerType`、`ownerId`、`cityId`、`regionId`、`landMu`、`tenantHouseholds`、`rentGrainEstimate`、`taxBurden`、`waterworks`、`disputeRisk`、`status`。`status` 允许 `held`、`leased`、`disputed`、`mortgaged`、`lost`、`unknown`。

## 关系行

未来关系表不只连接玩家和 NPC，也可以连接 NPC、家族、派系、衙门、官职、城市、国家、资产和田产。

核心字段：

- `id`
- `sourceType` / `sourceId`
- `targetType` / `targetId`
- `relationship`
- `trust`
- `resentment`
- `obligation`
- `patronage`
- `fear`
- `rivalry`
- `stance`
- `recentIntent`
- `recentNotes`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

`sourceType` / `targetType` 允许：`player`、`npc`、`household`、`faction`、`bureau`、`office`、`city`、`country`、`estate`、`asset`。

`relationship`、`obligation`、`patronage` 为 `-100..100`；`trust`、`resentment`、`fear`、`rivalry` 为 `0..100`。AI 仍不能直接写关系表；当前普通回合的合法路径仍是顶层 `relationshipChanges[]`，且只针对既有可见 `character` / `faction` ledger 目标。S51.2 若扩展到新关系表，必须保留 delta、可见目标、clamp 和服务器裁决。

## S55 SQLite 人物域业务表契约与实现边界

S55.1 固定人物域本地 SQLite 表形状；S55.2 已实现可见 bridge 行持久化；S55.3 已实现服务器人物事件和本地 `last_event_id` 关联。SQLite 表是本机索引、修复和长期检索层，不替代当前 route-facing `worldState` snapshot。因为当前 `GET /api/game/state/:sessionId` 仍返回完整本地 `worldState`，真正 hidden NPC 私档、资产真数、隐藏意图、密札备注和审计索引不得回写到 `worldState.worldPeople`；后续如要让玩家 API 不再返回 raw state，必须另立 redaction/API 切片。

### 总体原则

- 所有人物域业务表都以 `session_id` 分区；同一 NPC、家族、资产或关系在不同存档中是不同动态行。
- `world_sessions.world_state_json` 仍保存兼容 snapshot。S55.2 起，SQLite adapter 会从规范化后的 `worldState.worldPeople` 同步当前可见 bridge projection 到 `people_*`；S55.3 起，服务器人物事件通过写库 context 传入 `peopleEventLinks` 并更新 `people_*.last_event_id`。SQLite 私档、raw table 行或事件 id 不得借 `worldState.worldPeople` 泄漏到 route。
- 业务表写入只允许服务器 helper / storage adapter transaction 执行。AI 不能执行 SQL、不能直接写 `people_*` 表，也不能通过 `statePatch.worldPeople`、`relationshipChanges[]` 或叙事绕过可见性、资产、任命或生命周期裁决。
- 浏览器、prompt 和事件档案只能读取 `worldPeopleView`、`relationshipView`、`activeNpcRequestView` 或后续服务器构造的 capped summary；不能读取 raw `people_*` table、raw ledger、raw audit、本地数据库路径、provider proposal、hidden notes 或 hidden intent。
- 人物表只承载人物谱牒、人情、家产、田产、关系与轻量风险线索；科举晋级、官职任免、田产诉讼结局、死亡/迁居确认、家产归属和长期事件结局仍由服务器模块裁决。

### 公共列

每个 `people_*` 表至少包含以下公共列：

| 字段 | 类型建议 | 含义 |
| --- | --- | --- |
| `session_id` | `TEXT NOT NULL` | 本机存档分区，引用 `world_sessions.session_id`。 |
| `row_id` | `TEXT NOT NULL` | 每局内稳定行 id；可沿用旧 `characters[].id`、`worldPeople` id，或由服务器生成安全 id。 |
| `legacy_row_id` | `TEXT` | 旧 `characters`、`relationshipLedger` 或导入来源 id；没有旧来源时为空。 |
| `domain_schema_version` | `INTEGER NOT NULL` | 人物域业务表 schema 版本，S55 初始为 `1`。 |
| `revision` | `INTEGER NOT NULL` | 最后一次同步到该行的 session revision，用于 parity/repair 诊断，不替代 `world_sessions.revision`。 |
| `row_revision` | `INTEGER NOT NULL` | 行级修订计数；S55.2 可在内容变化时递增。 |
| `source` | `TEXT NOT NULL` | `world_people_bridge` / `legacy_bridge` / `server_derived` / `server_event` / `import` / `repair` / `migration`。AI 不可成为 source。 |
| `visibility` | `TEXT NOT NULL` | `public` / `role_visible` / `relationship_visible` / `rumor` / `hidden`。 |
| `known_to_player` | `INTEGER NOT NULL` | 0/1；`relationship_visible` 必须为 1 才能进入 view。 |
| `intel_confidence` | `INTEGER` | 0..100；传闻和未核实资产应低于公开档案。 |
| `last_report_turn` | `INTEGER` | 最近一次进入玩家可见奏报、族谱、人情札记或传闻的回合。 |
| `last_updated_turn` | `INTEGER NOT NULL` | 最近服务器刷新或事件写入回合。 |
| `last_updated_year` | `INTEGER NOT NULL` | 最近服务器刷新年份。 |
| `last_updated_month` | `INTEGER NOT NULL` | 最近服务器刷新月份。 |
| `last_updated_ten_day_period` | `INTEGER NOT NULL` | 最近服务器刷新旬。 |
| `last_event_id` | `TEXT` | 最近关联的安全事件 id；S55.3 已可由服务器人物事件回填，S57 再接安全事件索引。 |
| `public_summary` | `TEXT NOT NULL` | 玩家/AI 可见摘要来源；输出前仍经 view 过滤和 cap。 |
| `hidden_notes_json` | `TEXT NOT NULL` | JSON array；仅服务器本地诊断或私档逻辑可读，永不进入 route view/prompt/UI。 |
| `metadata_json` | `TEXT NOT NULL` | 迁移、修复和调试元数据；不得含 key、路径、prompt 或 raw provider response。 |
| `created_at` / `updated_at` | `TEXT NOT NULL` | 本地 ISO 时间。 |

推荐唯一键：`PRIMARY KEY (session_id, row_id)`。S55.2 如采用 `STRICT` 表，数组字段继续以 JSON text 保存并由服务器 helper 校验；跨表数组引用不依赖数据库自动展开。推荐索引包括 `(session_id, visibility, row_id)`、`last_updated_turn`、`last_event_id`，以及 owner / endpoint / city / household 查询索引。

### 表形状

`people_npcs`

- 身份字段：`name`、`courtesy_name`、`gender_label`、`age`、`alive`。
- 地理/家族：`home_city_row_id`、`current_city_row_id`、`household_row_id`、`father_npc_row_id`、`mother_npc_row_id`、`spouse_npc_ids_json`、`children_npc_ids_json`、`marriage_alliance_tags_json`。
- 官场/派系：`current_office_id`、`current_posting_id`、`rank_label`、`bureau_id`、`faction_id`。这些字段可存可见摘要或服务器已知关联，但实际任免仍由 `officialCareer` / 后续 S56 官职表裁决。
- 能力与性情：`literary_skill`、`administration`、`legal_judgment`、`military_command`、`diplomacy`、`learning`、`ambition`、`loyalty`、`integrity`、`caution`、`temper`，均为 `0..100`。
- 社会资本：`reputation`、`influence`、`patronage_power`、`peer_network`、`ideology_tags_json`、`current_goal`。
- 经济可见估计：`wealth_cash_estimate`、`land_mu_estimate`、`debts_estimate`、`annual_income_estimate`、`asset_ids_json`、`estate_ids_json`。真实资产数、隐名家产和密账只能留在 hidden 行或服务器私档字段，不能进入 `worldPeopleView`。
- 风险与私档：`health`、`legal_risk`、`impeachment_risk`、`resentment_risk`、`hidden_intent`、`hidden_notes_json`。

`people_households`

- 身份/地理：`family_name`、`seat_city_row_id`。
- 家族实力：`wealth_score`、`land_mu_estimate`、`prestige`、`gentry_rank`、`marriage_network_score`、`debt_pressure`、`political_alignment`、`family_risk`。
- 成员与家产引用：`member_npc_ids_json`、`estate_ids_json`、`asset_ids_json`。
- 可见/隐藏：`public_summary`、`visibility`、`known_to_player`、`intel_confidence`、`hidden_notes_json`。

`people_assets`

- 资产形态：`kind`、`name`；`kind` 复用 `cash`、`shop`、`mine`、`granary`、`debt`、`stipend`、`business`、`other`。
- 归属与地点：`owner_type`、`owner_row_id`、`city_row_id`。`owner_type` 可为 `player`、`npc`、`household`、`faction`、`bureau`、`city`、`country`。
- 可见估值：`value_estimate`、`annual_income_estimate`、`debt_value`、`status_label`。隐藏真值、密账来源、抵押细节和涉案账册不得进入 view/prompt。
- 生命周期：`acquired_turn`、`lost_turn`、`last_event_id`；S55.3 可用服务器事件写入财富变化或家产转移。

`people_estates`

- 归属与位置：`owner_type`、`owner_row_id`、`city_row_id`、`region_row_id`。
- 田产状态：`name`、`land_mu`、`tenant_households`、`rent_grain_estimate`、`tax_burden`、`waterworks`、`dispute_risk`、`status`、`status_label`。`status` 复用 `held`、`leased`、`disputed`、`mortgaged`、`lost`、`unknown`。
- 纠纷与生命周期：`dispute_case_id`、`acquired_turn`、`lost_turn`、`last_event_id`。田产诉讼、没收、赎回或归属改变必须由服务器事件裁决。

`people_relationships`

- 端点：`source_type`、`source_row_id`、`target_type`、`target_row_id`。端点类型复用 `player`、`npc`、`household`、`faction`、`bureau`、`office`、`city`、`country`、`estate`、`asset`。
- 关系指标：`relationship`、`obligation`、`patronage` 为 `-100..100`；`trust`、`resentment`、`fear`、`rivalry` 为 `0..100`。
- 语义与札记：`stance`、`recent_intent`、`recent_notes_json`、`relationship_kind`、`public_summary`、`hidden_notes_json`。
- 当前普通 provider 仍只能通过顶层 `relationshipChanges[]` 建议既有、可见 `character` / `faction` 关系 delta；S55.2/S55.3 即便把关系落表，也必须保留现有目标可见性、delta clamp、recent note 脱敏和服务器裁决。

### 字段分类与 AI 权限

| 分类 | 示例 | 写入者 | 可进入 view/prompt |
| --- | --- | --- | --- |
| 旧桥接/公开档案 | `name`、`rank_label`、可见 `public_summary`、公开家族名 | legacy bridge、服务器迁移/修复 | 非 hidden 且引用可见时可以。 |
| 每局动态快照 | `relationship`、`resentment`、`current_goal`、`wealth_cash_estimate`、`dispute_risk` | 服务器 helper、关系系统、NPC 生命周期事件 | 仅可见估计和公开摘要可以，且继续 cap。 |
| 服务器裁决字段 | `current_office_id`、`current_posting_id`、`alive`、`status`、`lost_turn`、`last_event_id` | 官场、长期事件、主动 NPC、未来人物生命周期模块 | 只有已公开或角色可见结果可以。 |
| 服务器隐藏字段 | `hidden_intent`、`hidden_notes_json`、隐藏 owner/ref、密账真值、`metadata_json` | 服务器本地诊断、私档、迁移、修复 | 永不进入 route view、prompt、浏览器或 save list。 |

AI 可以解释可见人物、家族声望、人情债、公开资产压力、田产纠纷传闻；可以继续建议合法 `relationshipChanges[]`。AI 不可以创建隐藏联系人、公开 hidden 私档、直接写 `people_*` 行、改 `visibility` / `known_to_player`、改资产真数、决定婚姻/死亡/迁居/田产归属、任命官职，或把 SQL/table row 写入标记为模型来源。

### 引用、可见性与修复策略

- 可见性继续沿用 S51.1 枚举。`public` / `rumor` 默认可见；`role_visible` 沿用当前粗规则：书生不可见，非书生或 `known_to_player = 1` 才可见；`relationship_visible` 必须 `known_to_player = 1`；`hidden` 永远不进入 view/prompt。
- NPC 家族、资产、田产和关系端点引用隐藏行时，view 必须裁剪该引用；资产/田产 owner 是隐藏 NPC 或隐藏家族时，该资产/田产不进入 view；关系任一端点不可见、缺失或 hidden 时，该关系不进入 view。
- `home_city_row_id`、`current_city_row_id`、`seat_city_row_id` 可引用 S54 `geo_cities`；若地理表尚未存在、城市不可见或旧档缺失，view 降级为空 id 或安全摘要，不展示 raw id。
- 官职字段可先保存 `officialCatalog` / `officialPostings` 可见 id；S56 引入官职表后再补更强引用完整性。隐藏任所、密参考成和未公开调任不得通过人物表泄漏。
- S55.2 读取 session 时，从 `world_sessions.world_state_json` / 规范化 `worldState.worldPeople` 单向修复缺失、陈旧、同数量错 `row_id` 或 raw hidden 行污染的可见桥接行；不得从 raw `people_*` 反向制造 route state 或 hidden 私档。S55.2 当前会重建 bridge-derived rows；S55.3 若引入真正 hidden 私档行，必须先扩展 source/namespace 策略，避免私档被可见 bridge repair 覆盖。
- `last_report_turn` 表示最近向玩家公开或传闻披露的回合；`last_updated_turn` 表示服务器内部最后改动，两者不得混用。prompt/UI 只能用前者或 view 生成时的 `generatedAtTurn` 表达玩家可见时效。

### S55.2/S55.3 验收点

- JSON 默认路径：`STORAGE_ADAPTER=json` 不创建、不读取、不要求 `people_*` 表，`worldPeopleView`、`relationshipView` 和 `activeNpcRequestView` 与现状一致。
- SQLite start/turn/read：`STORAGE_ADAPTER=sqlite` 在同一 transaction 中保存 `world_sessions.world_state_json` 和可见 `people_*` 桥接行；read 能从 snapshot 修复缺失或陈旧可见行；route payload shape 不变。
- JSON/SQLite parity：同一 `worldState.worldPeople` 在两种 adapter 下生成的 `worldPeopleView`、prompt `worldPeople` summary 和后续 `retrievalContext.people` 关键摘要一致，或只有记录过的安全降级。
- 可见性：hidden NPC、hidden household、hidden asset、hidden estate、hidden relationship、`hidden_intent`、`hidden_notes_json`、hidden owner refs、隐藏 active request 和不可见 `role_visible` 行都不能进入 UI/prompt。
- 生命周期：NPC 财富变化、田产变动、官职变动、家庭事件、死亡/迁居、关系升降和 active request 结果必须由服务器事件写入，并与 `event_log` / 后续安全事件索引脱敏关联。
- 关系旧路径：`relationshipLedger`、`activeNpcRequest` 和 `relationshipChanges` 的目标存在性、可见性、delta clamp、recent notes 脱敏和 request 过期/回应顺序继续通过测试。

S55.2 已完成的运行时范围：

- `src/storage/sqlitePeopleTables.js` 创建并同步 `people_npcs`、`people_households`、`people_assets`、`people_estates`、`people_relationships`，字段采用 `STRICT` SQLite 表和 JSON text 数组。
- `src/storage/sqliteSessionAdapter.js` 写入前规范化 `worldPeople`，写入后同步 people rows；读档时按 `world_state_json` 修复 people rows；导入和删除 session 同步维护 people rows。
- `test/sessionStoreAdapterContract.test.js` 覆盖 JSON/SQLite `worldPeopleView` / prompt parity、hidden token 过滤、hidden raw `people_*` row 修复、可见 bridge row 缺失修复、错 `row_id` 修复、relationship mutate revision、stale revision 拒写和 import/delete 清理。

S55.3 已完成的运行时范围：

- `src/game/worldPeopleEvents.js` 以可见 `worldPeople` 前后快照生成安全人物事件；当前普通回合接入关系升降和 active request 结果，helper 同时支持 NPC 生死/迁居/官职履历、家族、资产和田产的后续可见 delta。
- `src/routes/game.js` 将人物事件写入结构化 `world_people` 审计事件和 SQLite people row 关联；公开 `eventHistory` 仍由原有叙事/系统事件维护，`eventArchiveView` 继续只读取安全 projection。
- `peopleEventLinks` 只在 storage context 中流转，SQLite 写 `people_*.last_event_id` 并保留既有安全关联；`worldPeopleView`、prompt summary、`retrievalContext.people` 和浏览器人物谱牒不显示事件 id。

## 可见性

S51.1 统一人物域可见性枚举：

- `public`：公开身份、奏报、族谱或玩家已知事实。
- `role_visible`：只有非书生身份、官署角色或已知关系可合理看到。
- `relationship_visible`：通过师门、同年、人情、私信或亲族关系得知；必须 `knownToPlayer: true` 才进入 view。
- `rumor`：传闻可见，`intelConfidence` 应低于正式档案。
- `hidden`：服务器可用，prompt/UI 不可见。

`buildWorldPeopleSchemaView()` 会过滤 hidden 行、`hiddenNotes`、`hiddenIntent` 和不可见关系。可见行中的嵌套引用也必须裁剪：

- 可见 NPC 不得带出隐藏家族、隐藏资产、隐藏田产、隐藏父母/配偶/子女 id。
- 可见家族不得带出隐藏成员、隐藏资产或隐藏田产 id。
- 资产/田产 owner 是隐藏 NPC 或隐藏家族时，该资产/田产不进入 view。
- 关系两端若指向隐藏 NPC、隐藏家族、隐藏资产或隐藏田产，该关系不进入 view。

`summarizeWorldPeopleSchemaForPrompt()` 只能读取 view，并进一步 cap 摘要数量：NPC 8 条、家族 6 条、资产 6 条、田产 6 条、关系 10 条。关系摘要可以携带 capped 可见 `recentNotes`，用于把 active request 近期札记交给 prompt；它不返回 `hiddenNotes`、`hiddenIntent`、隐藏 id 或 raw bundle。

## AI 与服务器边界

AI 可以：

- 在叙事中解释可见人物、家族、人情、田产纠纷或资产压力。
- 通过现有 `relationshipChanges[]` 建议既有可见关系的有限变化。
- 在未来 proposal 机制中提交 schema-valid 建议，由服务器审查。

AI 不可以：

- 通过普通 `statePatch` 写 `worldPeople`、`npcs`、`households`、`assets`、`estates` 或 `relationships`。
- 新造隐藏联系人、公开隐藏家产、直接改 NPC 财富/田亩/债务。
- 决定官职任免、科举晋级、家产归属裁判、田产诉讼结局或 SQL/table row 写入。
- 读取或输出 `hiddenIntent`、`hiddenNotes`、本地路径、provider key 或完整 raw prompt。

S51.2 的测试已锁定：普通 provider payload 中夹带 `statePatch.worldPeople` 会被 AI schema 拒绝；即使非 schema 路径调用 `applyStatePatch()`，也不会覆盖服务器拥有的 `worldState.worldPeople`。Remote normalization、provider long-run、route red-team 和审计脱敏也覆盖 `worldPeople` 越权。

## 与旧系统的关系

当前运行时仍使用：

- `worldState.characters[]`：薄人物列表。
- `worldState.relationshipLedger`：服务器拥有的关系记忆。
- `worldState.activeNpcRequest`：服务器调度的单条主动请托。
- `player.gold`、`player.localTreasury` 等分散资产字段。

S51.2 不替换这些字段，只在本契约之上做桥接：

- 从 `characters[]` 和 `relationshipLedger.characters` 派生可见 NPC 行，NPC id 沿用旧 `C01` 这类 id。
- 从 `relationshipLedger.characters` / `relationshipLedger.factions` 派生 `player -> npc/faction` 关系行；hidden legacy 目标不写入 `worldPeople`。
- 从 `buildActiveNpcRequestView()` 读取可见请求，把“当前请托”写入对应关系的 `recentNotes`；请求调度、回应和过期仍由 `src/game/activeRequests.js` 裁决。
- 游戏、SSE 和考试 route 额外返回 `worldPeopleView`；`compactWorldState()` 额外放入 capped `worldPeople` prompt summary。
- 仍保留旧字段，直到浏览器 UI、存档迁移和未来 SQLite 业务表都有对应测试。

## 验证

S51 focused 验证：

```powershell
node --check src\game\worldPeopleSchemas.js
node --check src\game\worldPeople.js
node --check test\worldPeopleSchemas.test.js
node --check test\worldPeopleBridge.test.js
node --test test\worldPeopleSchemas.test.js test\worldPeopleBridge.test.js
```

提交前还应跑相关边界测试、治理检查、Mock 全量测试和 `git diff --check`。
