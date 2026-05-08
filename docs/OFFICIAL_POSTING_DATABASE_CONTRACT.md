# S52 官职、官署、任所与迁转数据库契约

S52 是本地动态世界数据库专项中的官职任所切片。S52.1 先固定官署、官职、任所、城市辖区、考成和迁转记录的 schema/helper；S52.2 已把地方官/入仕官员任所与可见城市动态指标联动。S56.1 在本文固定本地 SQLite 官职任所业务表契约；S56.2 已在 SQLite adapter 中创建并同步 `office_*` 派生业务表；S56.3 已补同 `row_id` / 同 revision 内容漂移探针和旧行缺指纹安全升级，继续保持跨域引用只从服务器可见 projection 修复。

S52/S56.1 切片本身不新增运行时 SQLite 业务表，不改变既有 `officialCareerView` route contract，也不让 AI 直接任命、调任、处分或写官职数据库。S56.2 新增的 `office_*` 表仍是 `world_sessions.world_state_json` 的本地派生索引，不是任免裁决源。S52.2 新增的 `worldState.officialPostings` 只是服务器构造的可见 projection；它不是隐藏官员私档。S53.4/S53.5 后浏览器“任所地理”和“官职簿”已经读取 `officialPostingsView`，但仍只读 route player-facing view，不读取 raw ledger 或 raw `office_*` table。

S60 内容充实阶段的官署、官职、任所、任命、考成和迁转总量目标见 [S60 超大动态世界数据库内容契约](HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md)。这些目标表示数据库/fixture 总量，不自动放宽当前 `officialPostings` bundle cap；后续若要承载大规模任命池，应通过安全分页 view、prompt capped summary 或另行调整 schema cap 与测试，不能让 raw `office_*` 行反向决定任免或泄漏 hidden 任所/密札考成。

## 范围

S52.1 新增运行时契约 helper：`src/game/officialPostingSchemas.js`。

该模块提供：

- `OFFICIAL_POSTING_SCHEMA_VERSION`
- `normalizeOfficialPostingSchemaBundle(input, worldState)`
- `buildOfficialPostingSchemaView(input, worldState)`
- `summarizeOfficialPostingSchemaForPrompt(input, worldState)`
- `canSeeOfficialPostingRow(row, worldState)`

该模块是 future ledger / future SQLite table 的 schema 契约。S52.2 在其上新增 `src/game/officialPostings.js`，负责把官职目录、当前官场/地方官任所和 S50 地理可见 projection 桥接为：

- `worldState.officialPostings`
- `officialPostingsView`
- `compactWorldState().officialPostings`

当前运行时官场仍由 `src/game/officialCareer.js`、`src/game/officialCatalog.js` 和 `officialCareerView` 裁决与展示；`officialPostings` 只记录服务器投影，不决定授官。

## 顶层 Bundle

```json
{
  "schemaVersion": 1,
  "generatedAtTurn": 0,
  "bureaus": [],
  "offices": [],
  "cityJurisdictions": [],
  "postings": [],
  "assessmentRecords": [],
  "transferRecords": [],
  "recentNotes": []
}
```

限制：

- `bureaus` 最多 48 行。
- `offices` 最多 160 行。
- `cityJurisdictions` 最多 160 行。
- `postings` 最多 256 行。
- `assessmentRecords` 最多 256 行。
- `transferRecords` 最多 160 行。
- 文本会裁剪为短句；数值会 clamp；非法 id、重复 id 和缺少关键字段的行会丢弃。

## S52.2 运行时桥接

`src/game/officialPostings.js` 提供：

- `createInitialOfficialPostingsState(worldState)`
- `normalizeOfficialPostingsState(worldState)`
- `ensureOfficialPostingsState(worldState)`
- `buildOfficialPostingsView(worldState)`
- `summarizeOfficialPostingsForPrompt(worldState)`

桥接规则：

- 官署/官职目录来自 `officialCatalog`，继续沿用既有 `bureau.id` / `office.id`。
- 任所辖区来自可见的 `worldGeographyView.officeJurisdictions` 和 `worldGeographyView.cities`，按城市拆成 `cityJurisdictions` 行；hidden 地理行、hidden route/frontier 引用和书生不可见的 `role_visible` geography 不会进入 stored projection。
- 入仕官员当前任所来自 `player.officeTitle || player.position || officialCareer.currentPosting`，并用 `inferOfficeByTitle()` 归一化到 `officeId`；普通 provider 不能借明显官职 `player.position` 绕过服务器任免。
- 地方官当前任所以 `player.officeTitle`、非空 `officialCareer.currentPosting` 或默认 `知县` 为准，`countyName` 只作为本地县名标签；当前默认把县级任所确定性映射到 S50 可见的府州县城市集合，后续若扩县级 seed 再改为真实县城 id。
- `transferRecords` 从服务器拥有的 `officialCareer.careerHistory` 派生；重复 `ensure` 必须幂等，不会反复追加迁转。
- `assessmentRecords` 从服务器拥有的 `officialCareer.assessmentDossier`、地方官可见地方指标和 S61 可见城市深度 projection 派生；S61.2 起当前任所考成可追加“任所奏报”，概括税基、粮储、市价、士绅、词讼、徭役、水利、灾害、交通、驻军和书院压力。它只作 prompt/view 背景，不替代官场结算，也不改写 merit/risk/recommendation。
- 由于 game/exam route 仍为开发兼容返回完整本地 `worldState`，`worldState.officialPostings` 只保存 `buildOfficialPostingSchemaView()` 后的安全可见 projection，不保存 hidden 官员私档、密札考成或未公开调任。

路由与 prompt：

- 新局、普通回合、SSE `state_preview`/`final_state`、读档、考试取题/推进/交卷都返回 `officialPostingsView`。
- `compactWorldState()` 追加 capped `officialPostings` 摘要。
- 浏览器“任所地理”和“官职簿”已在 S53.4/S53.5 接入；面板必须读取 `officialPostingsView` / `worldGeographyView`，不能读 raw `worldState.officialPostings`。
- S61.2 起，`eventArchiveView` 可以从 `officialPostingsView.assessmentRecords` 派生 `official_assessment` 安全条目；事件档案仍不得读取 raw `office_*` 表、raw ledger、raw audit 或 hidden 考成。

## S56.1/S56.2/S56.3 SQLite 官职任所业务表

S56.1 先固定契约；当时不创建 SQLite 表、不修改 `sqliteSessionAdapter`、不新增 route 字段、不改变 JSON 默认存储。S56.2 已在 `STORAGE_ADAPTER=sqlite` 模式下按本节建表，并通过 `src/storage/sqliteOfficialPostingTables.js` 从规范化后的安全 `worldState.officialPostings` / `officialCareer` / 可见地理与人物 projection 派生业务行。S56.3 为这些派生行追加 `metadata_json.contentHash` 本地漂移探针，用来发现同 id/同 revision 的 raw table 内容污染或旧行缺指纹，再从 `world_sessions.world_state_json` 单向重建。JSON adapter 仍不创建、不读取、不要求 `office_*` 表。

### 总体原则

- 所有官职任所业务表都以 `session_id` 分区；同一个官署、官职、任所或任命在不同存档中是不同动态行。
- `world_sessions.world_state_json` 仍保存兼容 snapshot。S56.2/S56.3 的读档修复只能从该 snapshot 和服务器 helper 单向重建派生 `office_*` 行；不得从 raw `office_*` 行反向制造 route state、prompt 上下文或隐藏官员私档。
- 业务表写入只允许服务器 helper / storage adapter transaction 执行。AI 不能执行 SQL、不能直接写 `office_*` 表，也不能通过 `statePatch.officialPostings`、`statePatch.officialCareer`、`player.officeTitle`、`player.position` 或叙事绕过任免、考成、迁转和可见性裁决。
- 浏览器、prompt 和事件档案只能读取 `officialPostingsView`、`officialCareerView`、`worldGeographyView`、`worldPeopleView` 或后续服务器构造的 capped summary；S61.2 的任所考成事件档案条目也只能从可见 `assessmentRecords` 派生。它们不能读取 raw `office_*` table、raw ledger、raw audit、本地数据库路径、provider proposal、hidden notes 或未公开调任。
- 官职任所表只承载官署、官职目录、任所辖区、任命、考成、迁转和轻量地方指标 projection；科举晋级、官职任免、处分、丁忧、起复、地方事务结局和长期事件仍由服务器模块裁决。

### 公共列

每个 `office_*` 表至少包含以下公共列：

| 字段 | 类型建议 | 含义 |
| --- | --- | --- |
| `session_id` | `TEXT NOT NULL` | 本机存档分区，引用 `world_sessions.session_id`。 |
| `row_id` | `TEXT NOT NULL` | 每局内稳定行 id；可沿用 `officialCatalog` / `officialPostings` id，或由服务器生成安全 id。 |
| `catalog_row_id` | `TEXT` | 对应 `officialCatalog` 的 bureau/office id；动态任命、考成或导入修复行可为空。 |
| `domain_schema_version` | `INTEGER NOT NULL` | 官职任所业务表 schema 版本，S56 初始为 `1`。 |
| `revision` | `INTEGER NOT NULL` | 最后一次同步到该行的 session revision，用于 parity/repair 诊断，不替代 `world_sessions.revision`。 |
| `row_revision` | `INTEGER NOT NULL` | 行级修订计数；S56.2 可在内容变化时递增。 |
| `source` | `TEXT NOT NULL` | `official_catalog` / `official_posting_bridge` / `official_career` / `geography_bridge` / `role_state` / `server_event` / `import` / `repair` / `migration`。AI 不可成为 source。 |
| `visibility` | `TEXT NOT NULL` | `public` / `role_visible` / `office_visible` / `relationship_visible` / `rumor` / `hidden`。 |
| `known_to_player` | `INTEGER NOT NULL` | 0/1；`office_visible` 与 `relationship_visible` 需要结合当前身份、官署或关系视野才能进入 view。 |
| `intel_confidence` | `INTEGER` | 0..100；传闻、未核实迁转和密参线索应低于正式公文。 |
| `last_report_turn` | `INTEGER` | 最近一次进入玩家可见公文、官场档案、任所簿或传闻的回合。 |
| `last_updated_turn` | `INTEGER NOT NULL` | 最近服务器刷新、官场结算或事件写入回合。 |
| `last_updated_year` | `INTEGER NOT NULL` | 最近服务器刷新年份。 |
| `last_updated_month` | `INTEGER NOT NULL` | 最近服务器刷新月份。 |
| `last_updated_ten_day_period` | `INTEGER NOT NULL` | 最近服务器刷新旬。 |
| `last_event_id` | `TEXT` | 最近关联的安全事件 id；S57 再统一接入安全事件索引。 |
| `public_summary` | `TEXT NOT NULL` | 玩家/AI 可见摘要来源；输出前仍经 view 过滤和 cap。 |
| `hidden_notes_json` | `TEXT NOT NULL` | JSON array；仅服务器本地诊断、密札考成或未公开调任逻辑可读，永不进入 route view/prompt/UI。 |
| `metadata_json` | `TEXT NOT NULL` | 迁移、修复和调试元数据；S56.3 起可含 `contentHash` 作为派生行漂移探针，但不得含 key、路径、prompt 或 raw provider response。 |
| `created_at` / `updated_at` | `TEXT NOT NULL` | 本地 ISO 时间。 |

推荐唯一键：`PRIMARY KEY (session_id, row_id)`。S56.2 如采用 `STRICT` 表，数组字段继续以 JSON text 保存并由服务器 helper 校验；跨表数组引用不依赖数据库自动展开。推荐索引包括 `(session_id, visibility, row_id)`、`catalog_row_id`、`last_updated_turn`、`last_event_id`、`holder_type/holder_id`、`bureau_row_id`、`office_row_id`、`city_row_id`、`jurisdiction_row_id`、`status` 和 `expected_review_turn`。

### 表形状

`office_bureaus`

- 目录字段：`name`、`aliases_json`、`level`、`parent_bureau_row_id`、`capital_city_row_id`。
- 关系字段：`jurisdiction_row_ids_json`、`office_row_ids_json`。
- 职责字段：`duties_json`、`authority_metrics_json`、`risk_tags_json`。
- 可见/隐藏：`visibility`、`known_to_player`、`intel_confidence`、`public_summary`、`hidden_notes_json`。

`office_catalog`

- 目录字段：`title`、`aliases_json`、`rank_label`、`rank_band`、`bureau_row_id`、`track`、`jurisdiction_scope`、`outpost`。
- 任所/晋升字段：`typical_city_row_ids_json`、`required_rank_or_exam_json`、`appointment_methods_json`、`normal_term_months`、`promotion_path_row_ids_json`。
- 职责字段：`duties_json`、`authority_metrics_json`、`risk_tags_json`。
- 可见/隐藏：`visibility`、`known_to_player`、`intel_confidence`、`public_summary`、`hidden_notes_json`。

`office_city_jurisdictions`

- 任所字段：`name`、`bureau_row_id`、`supervising_bureau_row_id`、`city_row_id`、`region_row_id`、`country_row_id`、`jurisdiction_scope`。
- 可任官职与地理引用：`available_office_row_ids_json`、`route_row_ids_json`、`frontier_zone_row_ids_json`。
- 地方动态快照：`public_order`、`tax_capacity`、`lawsuits`、`waterworks`、`gentry_influence`、`disaster_risk`、`military_pressure`、`academy_level`。
- 可见/隐藏：`visibility`、`known_to_player`、`intel_confidence`、`public_summary`、`hidden_notes_json`。

`office_postings`

- 任命字段：`office_row_id`、`office_title`、`bureau_row_id`、`holder_type`、`holder_id`、`holder_people_row_id`、`status`。
- 地理/层级引用：`city_row_id`、`region_row_id`、`jurisdiction_row_id`、`superior_posting_row_id`。
- 任期字段：`started_year`、`started_month`、`started_ten_day_period`、`started_turn`、`ended_year`、`ended_month`、`ended_ten_day_period`、`ended_turn`、`expected_review_turn`、`term_months`。
- 官场指标：`performance_score`、`impeachment_risk`、`public_reputation`、`assignment_ids_json`。
- 可见/隐藏：`visibility`、`known_to_player`、`intel_confidence`、`public_summary`、`hidden_notes_json`。

`office_assessments`

- 关联字段：`posting_row_id`、`office_row_id`、`bureau_row_id`、`holder_type`、`holder_id`、`holder_people_row_id`、`cycle_id`。
- 日期字段：`date_year`、`date_month`、`date_ten_day_period`、`date_turn`。
- 考成字段：`status`、`merit_score`、`risk_score`、`recommendation`、`public_finding`。
- 证据字段：`evidence_event_ids_json`、`assignment_ids_json`、`related_impeachment_stage`。
- 可见/隐藏：`visibility`、`known_to_player`、`intel_confidence`、`public_summary`、`hidden_notes_json`。

`office_transfers`

- 持有人字段：`holder_type`、`holder_id`、`holder_people_row_id`。
- 迁转引用：`from_posting_row_id`、`to_posting_row_id`、`from_office_row_id`、`to_office_row_id`、`from_city_row_id`、`to_city_row_id`、`related_assessment_row_id`。
- 日期字段：`date_year`、`date_month`、`date_ten_day_period`、`date_turn`。
- 裁决字段：`type`、`status`、`public_reason`、`related_event_ids_json`。
- 可见/隐藏：`visibility`、`known_to_player`、`intel_confidence`、`public_summary`、`hidden_notes_json`。

### 字段分类与 AI 权限

| 分类 | 示例 | 写入者 | 可进入 view/prompt |
| --- | --- | --- | --- |
| 静态目录字段 | `name`、`title`、`rank_band`、`duties_json`、`promotion_path_row_ids_json` | `officialCatalog` 初始化、服务器迁移/修复 | 非 hidden 且引用可见时可以。 |
| 每局动态 projection | `status`、`term_months`、`performance_score`、`impeachment_risk`、`localMetrics` | `officialPostings` bridge、`officialCareer`、地方官 role state、地理 helper | 仅可见摘要和公开/角色可见指标可以，且继续 cap。 |
| 服务器裁决字段 | `holder_type`、`holder_id`、任命/调任/处分日期、`recommendation`、`type`、`last_event_id` | `promotions`、`officialCareer`、官场结算、后续安全事件索引 | 只有已公开或角色可见结果可以。 |
| 服务器隐藏字段 | `hidden_notes_json`、隐藏 holder/ref、未公开密参、未公开迁转、`metadata_json` | 服务器本地诊断、密札考成、迁移、修复 | 永不进入 route view、prompt、浏览器或 save list。 |

AI 可以解释可见官署职责、任所地理、公开考成、迁转传闻和官场人情；可以继续通过既有受限 `statePatch.player` 建议 `superiorFavor`、`peerNetwork`、`performanceMerit`、`promotionProspect`、`impeachmentRisk`、`cleanReputation` 等 meter；也可以继续建议合法 `relationshipChanges[]`。AI 不可以创建或改写 `office_*` 行、改 `visibility` / `known_to_player`、任命/调任/处分玩家或 NPC、改 `player.officeTitle`、改 `officialCareer`、直接裁决考成或弹劾阶段、公开 hidden notes，或把 SQL/table row 写入标记为模型来源。

### 引用、可见性与修复策略

- 可见性继续沿用 S52.1 枚举。`public` / `rumor` 默认可见；`role_visible` 沿用当前粗规则：书生不可见，非书生或 `known_to_player = 1` 才可见；`office_visible` 在玩家当前官署、官职或任所相关时可见；`relationship_visible` 必须 `known_to_player = 1`；`hidden` 永远不进入 view/prompt。
- 官署、官职、辖区、任命、考成和迁转之间的引用必须在同一 `session_id` 内解析。引用目标不可见、缺失或 `hidden` 时，view 必须裁剪该引用，或把行降级为安全摘要；不得把 raw id 当作 fallback 展示。
- `city_row_id`、`region_row_id`、`country_row_id`、`route_row_ids_json` 和 `frontier_zone_row_ids_json` 可引用 S54 `geo_*` 行；若地理表尚未存在、城市不可见或旧档缺失，view 降级为空 id 或“未明任所”摘要，不展示 raw id。
- `holder_people_row_id` 可引用 S55 `people_npcs`；玩家使用 `holder_type = player` 与安全 `holder_id`，NPC 持有人只有在对应人物可见或 public/rumor 时才进入 view。隐藏 NPC、隐藏家族关系或未公开庇护不得通过任命行泄漏。
- `player.officeTitle`、`officialCareer.currentPosting`、`officialPostingsView.postings[].officeId` / `posting-player-current` 必须在 S56.2 parity 中保持一致；殿试入仕、直接 `official` 开局、`magistrate` 开局和官场结算都不能被 SQLite raw row 反向改变。
- S56.2/S56.3 读取 session 时，从 `world_sessions.world_state_json` / 规范化 `worldState.officialPostings` 单向修复缺失、陈旧、同数量错 `row_id`、旧行缺 `contentHash` 或同 `row_id` / 同 revision 内容污染的可见桥接行；不得从 raw `office_*` 反向制造 route state 或 hidden 私档。
- `last_report_turn` 表示最近向玩家公开或传闻披露的回合；`last_updated_turn` 表示服务器内部最后改动，两者不得混用。prompt/UI 只能用前者或 view 生成时的 `generatedAtTurn` 表达玩家可见时效。

### S56.2/S56.3 验收点

- JSON 默认路径：`STORAGE_ADAPTER=json` 不创建、不读取、不要求 `office_*` 表，`officialPostingsView`、`officialCareerView` 和 prompt summary 与现状一致。
- SQLite start/turn/read：`STORAGE_ADAPTER=sqlite` 在同一 transaction 中保存 `world_sessions.world_state_json` 和可见 `office_*` 桥接行；read 能从 snapshot 修复缺失、陈旧、同数量错行、旧行缺指纹或同 id/同 revision 内容污染；route payload shape 不变。
- JSON/SQLite parity：同一 `worldState.officialPostings` 在两种 adapter 下生成的 `officialPostingsView`、prompt `officialPostings` summary 和后续 `retrievalContext.officialPostings` 关键摘要一致，或只有记录过的安全降级。
- 主线 continuity：完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`、直接 `official` 开局、`magistrate` 开局、官场差事、考成、迁转和处分测试继续通过。
- 可见性：hidden 官署、hidden 官职、hidden 任所、hidden assessment、hidden transfer、`hidden_notes_json`、hidden holder refs、hidden 地理 refs、hidden people refs、书生不可见 `role_visible` 行和未公开调任都不能进入 UI/prompt。
- 引用修复：缺失 `office_catalog`、不可见城市、缺失 NPC、错 `superior_posting_row_id`、同数量错 `row_id`、stale revision、同 id/同 revision 内容污染、旧行缺 `contentHash`、import/delete 清理都不会导致读档失败；玩家 API 返回安全降级 view。
- 安全事件：`last_event_id` 只作为后续 S57 安全事件索引关联，不回写 route raw `worldState.officialPostings`，也不进入 `officialPostingsView`、prompt summary 或浏览器官职簿。

## 官署与官职目录

`bureaus` 表示静态或半静态官署目录，优先沿用 `officialCatalog.js` 的 `bureau.id`。

核心字段：

- `id`、`name`、`aliases`
- `level`：`court`、`provincial`、`prefecture`、`county`、`frontier`、`temporary`、`academy`、`censorate`、`military`
- `parentBureauId`、`capitalCityId`
- `jurisdictionIds`、`officeIds`
- `duties`、`authorityMetrics`、`riskTags`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

`offices` 表示官职目录，优先沿用 `officialCatalog.js` 的 `office.id` 和 `office.title`。S52.1 不要求严格复刻历史品级；当前仍使用游戏化 `rankBand`，后续若需要更细品级可在此契约上扩展。

核心字段：

- `id`、`title`、`aliases`
- `rankLabel`、`rankBand`
- `bureauId`、`track`
- `jurisdictionScope`：`court`、`province`、`prefecture`、`county`、`frontier`、`temporary`、`academy`、`censorate`、`military`
- `typicalCityIds`
- `requiredRankOrExam`
- `appointmentMethods`
- `normalTermMonths`
- `duties`、`authorityMetrics`、`promotionPathIds`、`riskTags`
- `outpost`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

## 城市辖区与任所

`cityJurisdictions` 表示官署和城市/区域之间的任所辖区关系。它应引用 S50.2 的 `worldGeography` id，而不是另造地理体系。

核心字段：

- `id`、`name`
- `bureauId`、`supervisingBureauId`
- `cityId`、`regionId`、`countryId`
- `jurisdictionScope`
- `availableOfficeIds`
- `routeIds`、`frontierZoneIds`
- `localMetrics.publicOrder`
- `localMetrics.taxCapacity`
- `localMetrics.lawsuits`
- `localMetrics.waterworks`
- `localMetrics.gentryInfluence`
- `localMetrics.disasterRisk`
- `localMetrics.militaryPressure`
- `localMetrics.academyLevel`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

S52.1 只定义这些字段和 projection。S52.2 才把地方官/入仕官员的任所行动与城市钱粮、治安、案牍、水利、士绅和灾荒指标联动。S61.2 起，这些地方指标优先读取可见城市深度 projection，并作为当前任所考成“任所奏报”和事件档案 `official_assessment` 的安全素材；玩家地方官已有的自身地方指标仍优先。

## 任命、考成与迁转记录

`postings` 表示每局动态任命/官缺记录。它不是 `player.officeTitle` 的替代品，而是后续数据库化时的可索引履历行。

核心字段：

- `id`
- `officeId`、`officeTitle`
- `bureauId`
- `holderType`：`player`、`npc`、`vacant`、`unknown`
- `holderId`
- `status`：`active`、`acting`、`suspended`、`vacant`、`transferred`、`dismissed`、`mourning_leave`、`restoration_pending`
- `cityId`、`regionId`、`jurisdictionId`
- `superiorPostingId`
- `startedAt.year/month/tenDayPeriod/turn`
- `endedAt.year/month/tenDayPeriod/turn`
- `expectedReviewTurn`
- `termMonths`
- `performanceScore`
- `impeachmentRisk`
- `publicReputation`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

`assessmentRecords` 表示考成记录，覆盖公开考语、风险分、推荐方向和证据关联。

核心字段：

- `id`
- `postingId`、`officeId`、`bureauId`
- `holderType`、`holderId`
- `cycleId`
- `date.year/month/tenDayPeriod/turn`
- `status`：`draft`、`pending`、`resolved`、`archived`
- `meritScore`
- `riskScore`
- `recommendation`：`none`、`retention`、`promotion`、`transfer`、`outpost`、`demotion`、`impeachment`、`punishment`
- `publicFinding`
- `evidenceEventIds`
- `assignmentIds`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

`transferRecords` 表示任命、平调、升迁、外放、降调、处分、丁忧、起复或留任等迁转记录。

核心字段：

- `id`
- `holderType`、`holderId`
- `fromPostingId`、`toPostingId`
- `fromOfficeId`、`toOfficeId`
- `fromCityId`、`toCityId`
- `relatedAssessmentId`
- `date.year/month/tenDayPeriod/turn`
- `type`：`appointment`、`transfer`、`promotion`、`outpost`、`demotion`、`punishment`、`mourning_leave`、`restoration`、`retention`
- `status`：`proposed`、`approved`、`applied`、`rejected`、`cancelled`
- `publicReason`
- `relatedEventIds`
- `visibility`、`knownToPlayer`、`intelConfidence`、`publicSummary`、`hiddenNotes`、`lastUpdatedTurn`

## 可见性

S52.1 沿用人物域和地理域的可见性分层，并为官署同僚视野补充 `office_visible`：

- `public`：公开官署、官名、已发明文或玩家已知事实。
- `role_visible`：非书生身份、官署角色或公文视野可见。
- `office_visible`：与玩家当前官署、当前官职或当前任所相关时可见。
- `relationship_visible`：由师门、同年、上官、同僚、人情或私札得知；必须 `knownToPlayer: true` 才进入 view。
- `rumor`：传闻可见，`intelConfidence` 应低于正式档案。
- `hidden`：服务器可用，prompt/UI 不可见。

`buildOfficialPostingSchemaView()` 会过滤 hidden 行、`hiddenNotes` 和不可见考成/迁转记录。可见行中的嵌套引用也必须裁剪：

- 可见官署不得带出隐藏官职或隐藏辖区 id。
- 可见官职不得带出隐藏官署或隐藏迁转路径 id。
- 可见辖区不得带出隐藏官署或隐藏官职 id。
- 可见任命不得带出隐藏上官任命 id。
- 可见考成/迁转记录不得带出隐藏任命、隐藏官职、隐藏官署或隐藏考成 id。

`summarizeOfficialPostingSchemaForPrompt()` 只能读取 view，并进一步 cap 摘要数量：官署 6 条、官职 8 条、辖区 8 条、任命 8 条、考成 6 条、迁转 6 条。它不返回 `hiddenNotes`、隐藏 id、raw bundle、SQL 表名或本地路径。

## AI 与服务器边界

AI 可以：

- 在叙事中解释可见官署、官职职责、任所地理、公开考成和迁转传闻。
- 通过既有受限 `statePatch.player` 建议官场仪表，例如 `performanceMerit`、`superiorFavor`、`promotionProspect`、`impeachmentRisk`。
- 通过现有 `relationshipChanges[]` 建议既有可见人物/派系关系变化。
- 在未来 proposal 机制中提交 schema-valid 建议，由服务器审查。

AI 不可以：

- 通过普通 `statePatch` 写 `officialPostings`、`postings`、`assessmentRecords`、`transferRecords`、`worldState.officialCareer` 或 `player.officeTitle`。
- 直接任命、罢免、升迁、外放、处分、丁忧、起复或公开 hidden notes。
- 直接裁决城市财政、治安、水利、案牍、士绅关系、战争胜负、科举晋级或 SQL/table row 写入。
- 读取或输出 `hiddenNotes`、本地路径、provider key、raw prompt 或完整 raw ledger。

S52.1 已把 `officialPostings` 作为 server-owned patch key 纳入边界测试；S52.2 开始实际写入安全 projection。普通 provider payload 中夹带 `statePatch.officialPostings` 会被 AI schema 拒绝；remote normalization 和 provider long-run 会把它视为越权；普通 `applyStatePatch()` 不会覆盖服务器已有的 `worldState.officialPostings`；本地 audit proposal 会把 `officialPostings` / `postings` / `assessmentRecords` / `transferRecords` 脱敏。

S52.2 同时把明显官职 `player.position` 伪造过滤扩展到地方官，避免 provider 把地方官软位置写成中央官名后被 `officialPostings` bridge 误读为当前任所。

## 与旧系统的关系

当前运行时仍使用：

- `src/game/officialCatalog.js`：静态官署/官职目录。
- `src/game/officialCareer.js`：服务器拥有的官场差遣、考成卷宗、弹劾流程、履历和任免结算。
- `officialCareerView`：浏览器官场面板的唯一数据来源。
- `worldGeographyView`：任所地理面板的地理 projection。
- `worldPeopleView`：人物谱牒/官场关系面板的人物 projection。

S52.2 不替换这些字段和视图，只把 `officialPostings` / future SQLite `office_postings` 可用的数据形状接入可见 projection。后续若扩展为真正 hidden 官职数据库，必须继续保留：

- 完整 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official` 路径。
- `player.officeTitle`、`officialCareer.currentPosting`、`officialPostingsView.postings[].officeId` / current posting id 的一致性。
- `officialCareerView` 的现有 browser contract。
- 默认 JSON + Mock 可玩。
- AI 不写数据库、不直接任免、不公开 hidden records。

## 验证

S52.1 focused 验证：

```powershell
node --check src\game\officialPostingSchemas.js
node --check test\officialPostingSchemas.test.js
node --test test\officialPostingSchemas.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js test\providerLongRunScript.test.js test\aiControlRedTeam.test.js
```

S52.2 focused 验证：

```powershell
node --check src\game\officialPostings.js
node --check src\routes\game.js
node --check src\routes\exam.js
node --check src\ai\prompts.js
node --check scripts\providerLongRun.js
node --test test\officialPostings.test.js test\gameTurnOfficialPostings.test.js test\prompts.test.js test\providerLongRunScript.test.js test\stateRules.test.js test\auditRoute.test.js test\aiControlRedTeam.test.js
```

S56.2 focused 验证：

```powershell
node --check src\storage\sqliteOfficialPostingTables.js src\storage\sqliteSessionAdapter.js test\sessionStoreAdapterContract.test.js
node --test test\sessionStoreAdapterContract.test.js
node --test test\sessionStoreAdapterContract.test.js test\officialPostingSchemas.test.js test\officialPostings.test.js test\gameTurnOfficialPostings.test.js test\officialCareer.test.js test\officialCatalog.test.js test\prompts.test.js test\promptContextAssembler.test.js test\stateRules.test.js test\auditRoute.test.js test\aiControlRedTeam.test.js
```

提交前还应跑相关官场/地理/人物测试、治理检查、Mock 全量测试和 `git diff --check`。
