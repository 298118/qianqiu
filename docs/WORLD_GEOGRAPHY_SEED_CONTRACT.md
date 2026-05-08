# 天下地理静态种子与实例化契约

S50.1 新增 `src/game/worldGeographySeeds.js`，为后续国家、城市、路线、边境和官署辖区数据库化提供静态种子。S50.2 新增 `src/game/worldGeography.js`，在每局 `worldState.worldGeography` 中实例化这些种子，并通过 `worldGeographyView` 与 capped prompt summary 暴露玩家/AI 可见地理。S54.1 在本文固定本地 SQLite 地理业务表契约；S54.2 新增 `src/storage/sqliteGeographyTables.js`，在 SQLite adapter transaction 中同步 `geo_*` 地理业务行，并保持 JSON adapter 与 route payload 不变。

当前仅 `STORAGE_ADAPTER=sqlite` 会创建并同步 SQLite 地理业务表；默认 JSON 路径不创建、不读取这些表。该同步不改 route payload，不替代 `treasury`、`grainReserve`、`publicOrder`、`borderThreat` 等既有顶层世界指标。S53.4 后浏览器“天下格局”和“任所地理”已经读取 `worldGeographyView` / `officialPostingsView`，但仍只读 route player-facing view，不读取 raw ledger 或 raw `geo_*` table。

S60 内容充实阶段的国家、城市、路线和边面数量目标见 [S60 超大动态世界数据库内容契约](HUGE_DYNAMIC_WORLD_CONTENT_CONTRACT.md)。其中的大世界总量不等于本文件下方的 prompt cap；prompt 和浏览器仍必须从服务器 view 分页/筛选/裁剪，不得因城市总量变大而全量暴露 raw `worldGeography` 或 raw `geo_*` 行。S61.1/S61.2 起，国家和城市补入可见深度指标；这些指标仍是服务器 projection，不允许 AI 直接写库或裁决外交、战争、财政、灾害和城市治理。

## 目标

- 先固定天下格局的静态名称和引用关系，避免 per-session 国家/城市实例化时临时拼接字符串。
- 给本国、邻国、首都、省府州县、驿路/漕河/关隘、边境压力面和官署辖区统一 id。
- 从第一步就标注初始可见性：玩家公开可知、身份可见、传闻可见和隐藏。
- 保持 AI/server 边界：模型不能直接写国家、城市、路线、边境或官署辖区；只能读取服务器过滤后的 projection。

## 种子范围

默认种子 `late-ming-north-china` 覆盖：

- 国家：大明、关外满洲政权、漠南蒙古诸部、朝鲜、琉球。
- 区域：北直隶、南直隶、山东、河南、山西边面、辽东关外、江南府县、南海海道。
- 城市：北京、南京、苏州、杭州、济南、开封、太原、大同、山海关、盛京、喀喇沁营地、汉城、广州、首里。
- 路线：京杭漕运北段、黄河河防线、大同入京边报驿路、山海关辽东通道、东南海道，以及隐藏的辽东暗路测试种子。
- 边境：山海关辽东边面、大同漠南边面、辽东朝鲜贡道、南海朝贡海道，以及隐藏情报测试种子。
- 官署辖区：吏部、户部、兵部、礼部、都察院、布政司、按察司、府州县的静态空间落点。

这些字段先描述“可落点在哪里”，S61 再补入可见深度指标。国家财政压力、军备、国威、继承风险、外交态势、城市税粮、市价、诉讼、水利、灾害、驻军和书院等字段用于 view、prompt retrieval 和浏览器摘要；动态国库真数、兵力真数、外交关系变更、战争开合、官员任免、城市治理成败和隐藏情报真相仍由后续 per-session 状态与服务器模块裁决。

## 数据形状

`getDefaultWorldGeographySeed()` 返回归一化副本：

```javascript
{
  schemaVersion: 1,
  seedId: "late-ming-north-china",
  label: "明末天下基础种子",
  countries: [],
  regions: [],
  cities: [],
  routes: [],
  frontierZones: [],
  officeJurisdictions: []
}
```

主要字段：

- `countries[]`：`id`、`kind`、`name`、`shortName`、`polityType`、`rulerTitle`、`capitalCityId`、`cultureTags`、`governmentTags`、`visibility`、`intelConfidence`、`publicSummary`、`policyPressureTags`、`diplomaticPosture`、`intelligenceSummary`、`fiscalPressure`、`militaryReadiness`、`nationalPrestige`、`legitimacy`、`successionRisk`、`diplomaticTension`、`tributeTradeActivity`、`intelligenceReliability`、`hiddenNotes`。
- `regions[]`：`id`、`countryId`、`name`、`level`、`seatCityId`、`visibility`、`publicSummary`。
- `cities[]`：`id`、`countryId`、`regionId`、`name`、`jurisdictionLevel`、`terrain`、`riverOrCoast`、`strategicTags`、`supervisingBureauIds`、`visibility`、`intelConfidence`、`publicSummary`、`localIssueTags`、`cityIntelligenceSummary`、`populationScale`、`taxBase`、`grainStock`、`marketPriceStress`、`gentryInfluence`、`lawsuitPressure`、`corveeBurden`、`waterworksIntegrity`、`disasterRisk`、`trafficLoad`、`garrisonStrength`、`academyLevel`、`hiddenNotes`。
- `routes[]`：`id`、`type`、`name`、`fromCityId`、`toCityId`、`viaCityIds`、`distanceLabel`、`seasonalRisk`、`strategicTags`、`visibility`、`publicSummary`、`hiddenNotes`。
- `frontierZones[]`：`id`、`name`、`countryId`、`neighborCountryId`、`cityIds`、`routeIds`、`status`、`pressureMetric`、`visibility`、`publicSummary`、`hiddenNotes`。
- `officeJurisdictions[]`：`id`、`bureauId`、`name`、`scope`、`countryIds`、`cityIds`、`routeIds`、`frontierZoneIds`、`officeTrack`、`visibility`、`publicSummary`、`hiddenNotes`。

## 可见性

`visibility` 当前允许：

- `public`：开局即可公开知道，如京师、漕运、主要边镇。
- `role_visible`：具备对应身份或公文视野才合理看到，如礼部贡道、都察院巡按、东南海道。
- `rumor`：只作传闻或粗略情报，如邻国都城和海道传闻。
- `hidden`：服务器保留，不能进入 view、prompt 或玩家 UI。

`buildWorldGeographySeedView()` 只返回非 hidden 行，并移除所有 `hiddenNotes`。S50.2 的 `buildWorldGeographyView()` 在每局账本层做更严格的角色视野过滤、hidden nested ref 裁剪和 prompt cap。

## 引用与校验

`validateWorldGeographySeed(seed)` 检查：

- 国家、区域、城市、路线、边境、官署辖区 id 不重复。
- 国家首都引用存在。
- 区域引用国家和治所城市存在。
- 城市引用国家和区域存在。
- 路线端点和经由城市存在。
- 边境引用本国、邻国、城市和路线存在。
- 官署辖区引用国家、城市、路线和边境存在。

测试还会确认 `cities[].supervisingBureauIds` 与 `officeJurisdictions[].bureauId` 都能在 `officialCatalog` 中找到。

## S50.2 每局地理账本

`src/game/worldGeography.js` 提供：

- `createInitialWorldGeographyState(worldState)`：新局从默认 seed 实例化 `worldState.worldGeography`。
- `normalizeWorldGeographyState(worldState)` / `ensureWorldGeographyState(worldState)`：旧档缺失或旧形状会补齐 seed 行、clamp 动态字段、裁剪列表上限，并用当前顶层世界指标刷新轻量压力快照。
- `buildWorldGeographyView(worldState)`：构造路由可见 projection，过滤 hidden 行、`hiddenNotes`、hidden nested refs，以及书生开局不应直接看到的 `role_visible` 行。
- `summarizeWorldGeographyForPrompt(worldState)`：给 `compactWorldState()` 使用的 capped 摘要，只保留少量国家、城市、路线、边境和官署辖区 highlights。

`worldState.worldGeography` 形状：

```javascript
{
  schemaVersion: 1,
  seedId: "late-ming-north-china",
  label: "明末天下基础种子",
  generatedAtTurn: 0,
  countries: [],
  regions: [],
  cities: [],
  routes: [],
  frontierZones: [],
  officeJurisdictions: [],
  recentNotes: []
}
```

每行保留 seed 的 id、名称、引用、可见性和公开摘要，并增加轻量动态字段：

- 国家：`status`、`statusLabel`、`pressure`、`stability`、`fiscalPressure`、`militaryReadiness`、`nationalPrestige`、`legitimacy`、`successionRisk`、`diplomaticTension`、`tributeTradeActivity`、`intelligenceReliability`、`policyPressureTags`、`diplomaticPosture`、`intelligenceSummary`、`lastUpdatedTurn`。
- 城市：`status`、`pressure`、`stability`、`localOrder`、`taxBurden`、`grainStress`、`populationScale`、`taxBase`、`grainStock`、`marketPriceStress`、`gentryInfluence`、`lawsuitPressure`、`corveeBurden`、`waterworksIntegrity`、`disasterRisk`、`trafficLoad`、`garrisonStrength`、`academyLevel`、`localIssueTags`、`cityIntelligenceSummary`、`lastUpdatedTurn`。
- 路线：`status`、`statusLabel`、`risk`、`lastUpdatedTurn`。
- 边境压力面：`status`、`statusLabel`、`pressure`、`pressureMetric`、`lastUpdatedTurn`。
- 官署辖区：`priority`、`lastUpdatedTurn`。

这些字段是从 seed、当前顶层 `worldState` 和服务器 helper 派生的可见压力/内容快照，用于叙事、检索和浏览器摘要，不是新的财政、外交、战争或城市治理裁决来源。S61 的可调默认值集中在 `src/game/worldGeographyConfig.js`；默认 JSON 存档仍保存整份 `world_state`。

## S54.1 SQLite 地理业务表契约

S54.1 只固定契约；S54.2 已在 `STORAGE_ADAPTER=sqlite` 模式下按本节建表并同步地理业务行。实现仍不新增 route 字段、不改变 JSON 默认存储；JSON adapter 继续只保存完整 `worldState` snapshot。

### 总体原则

- 所有地理业务表都以 `session_id` 分区；同一个 seed 城市在不同存档中是不同动态行。
- `world_state_json` 仍是早期兼容 snapshot。SQLite 业务表是本机索引、修复和检索层，不替代 route-facing `worldState`，直到后续路线图明确迁移完成。
- 业务表写入只允许服务器 helper / storage adapter transaction 执行。AI 不能执行 SQL、不能直接写 `geo_*` 表，也不能通过 `statePatch.worldGeography` 绕过 schema、clamp 或可见性过滤。
- 浏览器、prompt 和事件档案只能读取服务器构造的 `worldGeographyView`、`officialPostingsView` 或 capped prompt summary；不能读取 raw table、raw ledger、raw audit、本地数据库路径、provider proposal 或隐藏字段。
- 业务表只承载地理 projection 与轻量压力快照，不裁决财政、外交、战争、城市治理、官职任免或长期事件结局。

### 公共列

每个 `geo_*` 表至少包含以下公共列：

| 字段 | 类型建议 | 含义 |
| --- | --- | --- |
| `session_id` | `TEXT NOT NULL` | 本机存档分区，引用 `world_sessions.session_id`。 |
| `row_id` | `TEXT NOT NULL` | 每局内稳定行 id，默认等于 seed `id`；服务器新增行必须使用安全 id。 |
| `seed_id` | `TEXT NOT NULL` | 来源地理种子 id，默认 `late-ming-north-china`。 |
| `seed_row_id` | `TEXT` | 对应 seed 行 id；服务器新增或导入修复行可为空。 |
| `domain_schema_version` | `INTEGER NOT NULL` | 地理业务表 schema 版本，S54 初始为 `1`。 |
| `revision` | `INTEGER NOT NULL` | 最后一次同步到该行的 session revision，用于 parity/repair 诊断，不替代 `world_sessions.revision`。 |
| `row_revision` | `INTEGER NOT NULL` | 行级修订计数；S54.2 可在内容变化时递增。 |
| `source` | `TEXT NOT NULL` | `seed` / `server_derived` / `custom` / `import` / `repair` / `migration`。AI 不可成为 source。 |
| `visibility` | `TEXT NOT NULL` | `public` / `role_visible` / `rumor` / `hidden`。 |
| `intel_confidence` | `INTEGER` | 0..100；没有情报可信度的表可为空。 |
| `last_updated_turn` | `INTEGER NOT NULL` | 最近服务器刷新回合。 |
| `last_updated_year` | `INTEGER NOT NULL` | 最近服务器刷新年份。 |
| `last_updated_month` | `INTEGER NOT NULL` | 最近服务器刷新月份。 |
| `last_updated_ten_day_period` | `INTEGER NOT NULL` | 最近服务器刷新旬。 |
| `public_summary` | `TEXT NOT NULL` | 玩家/AI 可见摘要来源；输出前仍经 view 过滤。 |
| `hidden_notes_json` | `TEXT NOT NULL` | JSON array；仅服务器本地诊断可读，永不进入 route view/prompt/UI。 |
| `metadata_json` | `TEXT NOT NULL` | 迁移、修复和调试元数据；不得含 key、路径、prompt 或 raw provider response。 |
| `created_at` / `updated_at` | `TEXT NOT NULL` | 本地 ISO 时间。 |

推荐唯一键：`PRIMARY KEY (session_id, row_id)`。S54.2 如采用 `STRICT` 表，数组字段继续以 JSON text 保存并由服务器 helper 校验；跨表数组引用不依赖数据库自动展开。

### 表形状

`geo_countries`

- 静态/seed 字段：`kind`、`name`、`short_name`、`polity_type`、`ruler_title`、`capital_city_row_id`、`culture_tags_json`、`government_tags_json`。
- 每局动态字段：`status`、`status_label`、`pressure`、`stability`。
- S61 深度 projection：`metadata_json.s61CountryDepth` 保存财政压力、军备、国威、正统性、继承风险、外交张力、贡贸活跃度、情报可靠度、政策压力标签、外交态势和情报摘要；不新增 STRICT 表列，避免旧本地库迁移风险。
- 可见摘要字段：`visibility`、`intel_confidence`、`public_summary`。
- 服务器隐藏字段：`hidden_notes_json`、`metadata_json`。

`geo_regions`

- 静态/seed 字段：`country_row_id`、`name`、`level`、`seat_city_row_id`。
- 每局动态字段：当前只需要公共时间/revision 字段；后续若加灾情或政区压力，必须先更新本契约和 AI 矩阵。
- 可见摘要字段：`visibility`、`public_summary`。
- 服务器隐藏字段：`hidden_notes_json`、`metadata_json`。

`geo_cities`

- 静态/seed 字段：`country_row_id`、`region_row_id`、`name`、`jurisdiction_level`、`terrain`、`river_or_coast`、`strategic_tags_json`、`supervising_bureau_ids_json`。
- 每局动态字段：`status`、`status_label`、`pressure`、`stability`、`local_order`、`tax_burden`、`grain_stress`。
- S61 深度 projection：`metadata_json.s61CityDepth` 保存人口规模、税基、粮储、市价压力、士绅影响、词讼、徭役、水利、灾害、交通、驻军、书院、地方问题标签和城市情报摘要；prompt/UI 仍读取 server view 或安全 prompt index，不读取 raw `geo_cities`。
- 可见摘要字段：`visibility`、`intel_confidence`、`public_summary`。
- 服务器隐藏字段：`hidden_notes_json`、`metadata_json`。

`geo_routes`

- 静态/seed 字段：`type`、`name`、`from_city_row_id`、`to_city_row_id`、`via_city_ids_json`、`distance_label`、`seasonal_risk`、`strategic_tags_json`。
- 每局动态字段：`status`、`status_label`、`risk`。
- 可见摘要字段：`visibility`、`public_summary`。
- 服务器隐藏字段：`hidden_notes_json`、`metadata_json`。

`geo_frontier_zones`

- 静态/seed 字段：`name`、`country_row_id`、`neighbor_country_row_id`、`city_ids_json`、`route_ids_json`、`pressure_metric`。
- 每局动态字段：`status`、`status_label`、`pressure`。
- 可见摘要字段：`visibility`、`public_summary`。
- 服务器隐藏字段：`hidden_notes_json`、`metadata_json`。
- `pressure_metric` 在可见行中只允许引用公开顶层指标白名单，例如 `borderThreat`、`treasury`、`grainReserve`、`publicOrder`、`corruption`；`hidden` 或内部诊断指标只能留在 hidden 行，不能进入 view/prompt。

`geo_office_jurisdictions`

- 静态/seed 字段：`bureau_id`、`name`、`scope`、`country_ids_json`、`city_ids_json`、`route_ids_json`、`frontier_zone_ids_json`、`office_track`。
- 每局动态字段：`priority`。
- 可见摘要字段：`visibility`、`public_summary`。
- 服务器隐藏字段：`hidden_notes_json`、`metadata_json`。

### 字段分类与权限

| 分类 | 示例 | 写入者 | 可进入 view/prompt |
| --- | --- | --- | --- |
| 静态 seed 字段 | `name`、`terrain`、`country_row_id`、`strategic_tags_json` | seed 初始化、服务器迁移/修复 | 非 hidden 且引用可见时可以。 |
| 每局动态快照 | `pressure`、`stability`、`risk`、`priority`、S61 国家/城市深度指标 | 服务器 helper 从 seed、顶层世界状态、身份和官场状态派生 | 非 hidden 且经 cap/role filter 后可以。 |
| 玩家可见摘要 | `public_summary`、`status_label`、`intel_confidence` | seed 或服务器审核后的公开叙述 | 可以，但仍需按身份/可见性过滤。 |
| 服务器隐藏字段 | `hidden_notes_json`、隐藏 refs、`metadata_json` | 服务器本地诊断、迁移、修复 | 永不进入 route view、prompt、浏览器或 save list。 |

普通 provider 最多能在叙事中解释可见地理，也可以通过既有受限 meter 间接影响顶层状态；它不能写 `geo_*` 行、不能改变 row visibility、不能公开 hidden refs，不能把 `source` 标记为 AI。

`role_visible` 在当前运行时仍沿用粗规则：书生只看 `public` / `rumor`，非书生身份可以看角色公文视野行。S54.2 实现 SQLite parity 时不得提前改成更细粒度官署权限；若后续细化，必须另行更新契约、测试和浏览器/prompt 验收。

### 引用与修复策略

- 直接引用字段如 `country_row_id`、`region_row_id`、`from_city_row_id`、`to_city_row_id` 应优先保持同一 `session_id` 内存在。由于 `geo_countries.capital_city_row_id` 与 `geo_cities.country_row_id` 存在初始化环，S54.2 可使用事务内延迟校验或服务器 repair 校验，而不是强制同步顺序泄漏到 route。
- JSON 数组引用字段如 `via_city_ids_json`、`city_ids_json`、`route_ids_json`、`frontier_zone_ids_json` 必须由服务器 helper 归一化、去重、限长和校验。
- 读表构建 view 时，任何引用目标不可见、缺失或 `hidden`，都按当前 `buildWorldGeographyView()` 规则裁剪；不得把 raw id 当作 fallback 展示。
- `geo_regions.seat_city_row_id` 和 `geo_countries.capital_city_row_id` 指向不可见城市时，view 中应降为 `null`；`geo_cities.supervising_bureau_ids_json` 当前按公开 `officialCatalog` 引用输出，后续 S56 若引入隐藏官署权限，必须再加过滤规则。
- 导入旧档或损坏行时，repair 策略优先级为：从 `worldState.worldGeography` 回填 seed 行；裁剪 dangling refs；必要时把无法确认的行降级为 `visibility = hidden` 或安全 `unknown` 摘要；记录 sanitized repair event，但不暴露 raw row。
- `worldGeographyView.generatedAtTurn` 表示当前构造 view 的回合，不等同于任何业务行的 `last_updated_turn`；S54.2 parity 测试要分别检查这两个语义。

### S54.2/S54.3 验收点

- JSON 默认路径：`STORAGE_ADAPTER=json` 不创建、不读取、不要求 `geo_*` 表，`worldGeographyView` 与现状一致。
- SQLite start/turn/read：`STORAGE_ADAPTER=sqlite` 在同一 session transaction 中保存 `world_sessions.world_state_json` 和 `geo_*` 行；read 会从 `world_state_json` 修复缺失或陈旧的地理业务行；route payload shape 不变。
- JSON/SQLite parity：同一 `worldState.worldGeography` 在两种 adapter 下生成的 `worldGeographyView`、prompt `worldGeography` summary 和 `retrievalContext.geography` 关键摘要一致，或只有记录过的安全降级。
- 可见性：hidden 国家、城市、路线、边面、辖区、`hidden_notes_json`、hidden nested refs、书生不可见 `role_visible` 行都不能进入 UI/prompt。
- 导入/修复：JSON -> SQLite dry-run 不改数据库；正式导入不删除 JSON 原档；dangling refs 不导致读档失败。
- 导出/回滚：SQLite -> JSON snapshot 或 debug dump 默认脱敏；禁用 `STORAGE_ADAPTER=sqlite` 可回到 JSON adapter；导出不得输出 hidden notes、数据库路径、prompt、key 或 raw provider response。

## View 与 Prompt Projection

游戏与考试路由现在返回 `worldGeographyView`。S53.4 的浏览器“天下格局”和“任所地理”面板必须读取这个 view 或可见 `officialPostingsView`，不要直接渲染 raw `worldState.worldGeography`。现有 API 为保持开发兼容仍随 payload 返回完整本地 `worldState`。

Prompt 中的 `worldGeography` summary 上限：

- `countries` 最多 4 条。
- `cities` 最多 6 条。
- `routes` 最多 4 条。
- `frontierZones` 最多 4 条。
- `officeJurisdictions` 最多 4 条。

`role_visible` 当前按身份做粗过滤：书生只看 public/rumor，入仕官员、皇帝、大臣、将领、地方官可以看到角色公文视野行。S53.1 的检索式 context assembler 仍只读取可见 projection；后续 S54 拆地理业务表时可以把角色视野细分到官署、任所、路引和人脉来源。

## AI 与服务器边界

- `worldState.worldGeography` 是 server-owned ledger。普通 provider 的 `statePatch.worldGeography` 会被 schema、remote normalization、`applyStatePatch()` 和 provider long-run 检查拒绝或忽略。
- AI 可以在收到可见 projection 后解释“山海关边报”“漕运阻滞”“江南钱粮”“税粮吃紧”“水利失修”等公开事实；可以把 S61 指标作为叙事依据，但不能裁决战争、外交、城市指标改写、官署任免、事件成案或隐藏情报公开。
- 隐藏路线、隐藏边境、`hiddenNotes`、本地路径、审计 payload 和 provider 配置不得进入 prompt、route view 或浏览器面板。

## 后续边界

S50.2 已完成每局实例化、路由 projection 和 prompt projection；S53.1/S53.4 已完成检索式 context 与浏览器地理面板；S54.1 已完成 SQLite 地理业务表契约；S54.2 已完成 SQLite adapter 内部 `geo_*` 表初始化、写入、读取修复和 focused parity 测试；S54.3 已补 `npm run storage:geography:sqlite -- status|repair|export` 地理维护工具、导入 dry-run 不建库语义、SQLite browser smoke 存储参数，以及 JSON/SQLite route/prompt 可见摘要 parity 测试。S61.1 已完成国家/邻国深度指标基础，S61.2 已启动城市/区域深度指标基础。后续边界：

- S51/S52 再把 NPC、家族、官职、任所与城市进一步联动。
- `storage:geography:sqlite export` 只作为脱敏 debug dump，不是默认完整回滚导出；回滚仍优先关闭 `STORAGE_ADAPTER=sqlite` 并回到保留的 JSON 原档。
- 仍不替代现有 `treasury`、`grainReserve`、`publicOrder`、`borderThreat` 等顶层指标，直到后续迁移明确完成。

## 验证要求

- `node --check src\game\worldGeographySeeds.js`
- `node --check src\game\worldGeography.js`
- `node --check src\storage\sqliteGeographyTables.js`
- `node --check src\storage\sqliteSessionAdapter.js`
- `node --check test\worldGeographySeeds.test.js`
- `node --check test\worldGeography.test.js`
- `node --check test\sessionStoreAdapterContract.test.js`
- `node --test test\worldGeographySeeds.test.js test\worldGeography.test.js`
- `node --test test\sessionStoreAdapterContract.test.js`
- `node --test test\gameTurnWorldGeography.test.js test\prompts.test.js test\stateRules.test.js test\aiSchemas.test.js test\remoteHelpers.test.js`
- `npm run check:docs-governance`
- `git diff --check`
