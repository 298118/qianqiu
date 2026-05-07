# 动态世界本地数据库规划

本文回应“是否需要把国家、邻国、NPC、玩家、官职、城市、事件记录等大量动态数据放入数据库，并允许 AI 随游戏进程影响数据库”的产品方向。

结论：**可行，而且中长期值得做；但不建议一步到位替换当前 JSON 存档，也不能让 AI 直接写数据库。** 当前范围只考虑本地数据库，优先方向是本地 SQLite；不规划远程存档、账号体系、多人同步、云端冲突解决或托管数据库。S49.3 已通过 `STORAGE_ADAPTER=sqlite` 引入可选本地 SQLite session row 原型，仍保留 JSON 默认路径；S49.4 已加入本地 `event_log` 与 `ai_change_proposals` 审计记录。AI 仍只生成叙事、建议和结构化 proposal；最终写库必须由服务器模块校验、夹断、归一化、事务提交。

## 1. 当前基础与是否急需数据库

当前项目已经有一批“动态世界账本”，只是它们仍随单个 session 保存在 JSON 快照里：

- `worldEntities`：朝廷衙门、地方士绅、书院、军镇、盐漕、赈务等制度实体压力。
- `worldThreads`：把 NPC 请托、长期事件、官场差事、世界实体压力等整理成世界议程。
- `relationshipLedger`：NPC/派系关系记忆。
- `longTermEvents`：灾荒、边事、廷争、季节性事件等跨月调度。
- `officialCareer`：官署、差事、考成、弹劾、履历。
- `roleWorldCoupling`：身份行动转入世界影响。

短期内，如果目标只是继续完善 S48 后的场景内时间、科举、官场和少量世界实体，JSON 仍能支撑本地单人开发。当前 JSON 存档已经有 envelope、revision、文件锁、原子写入、存档列表和旧档归一化。

真正需要数据库的信号是：

- 单个世界要保存数百到数千 NPC、城市、官职任命、邻国关系和历史事件。
- 需要按人物、地点、官署、事件线索快速检索，而不是每回合读写整份 JSON。
- 需要历史审计：某个城市为何民变、某个 NPC 为何结怨、某次 AI 建议为何被拒。
- 需要本机多 session 比较、导入导出、长期世界演化和本地检索。
- 需要让 prompt 按“玩家当前可知范围”取上下文，而不是把全部世界状态塞给模型。

所以推荐节奏是：**先规划和适配器，再 SQLite session row；只做本地数据库，不做云端/账号/多人；先事件/索引表，后全量实体拆表。** S49.1-S49.4 已完成规划、adapter 边界、可选 SQLite session row、事件日志和 AI proposal 审计；下一步应进入静态天下/邻国/城市等 seed 契约，而不是直接把所有业务表一次性拆完。

## 1.1 当前不做的范围

以下能力不进入当前数据库专项：

- 远程存档、云同步、云备份和跨设备同步。
- 用户账号、登录、权限、订阅、云端角色库。
- 多人游戏、共享世界、协作回合、联机冲突解决。
- 托管数据库、云数据库、服务端集群、跨用户数据隔离。

本专项里的 `session_id` 只表示本机不同存档的分区，不表示账号、房间或多人世界。

## 2. 数据库不是 AI 直写权

“AI 能根据游戏情况修改数据库”应解释为：

1. AI 读取服务器给出的可见摘要和必要上下文。
2. AI 返回严格 JSON：叙事、受限 `statePatch`、关系建议、事件建议或领域 proposal。
3. 服务器用 schema、白名单、权限矩阵、数值 clamp、可见性过滤和领域规则审查。
4. 服务器把通过审查的结果写入数据库事务。
5. 被拒绝的建议也可进入审计表，供调试和 red-team 使用，但不影响世界。

禁止形态：

- AI 直接执行 SQL。
- AI 直接更新 `countries`、`npcs`、`offices`、`events` 等持久表。
- AI 直接公开隐藏字段、隐藏关系、密谋、密钥、原始 prompt 或数据库路径。
- AI 裁决科举晋级、官职任免、作弊处罚、战争胜负、长期事件结局或存档 revision。

S49.4 已新增 `ai_change_proposals` 等价 ledger：记录模型建议摘要、建议字段、审查结果、拒绝原因、服务器接受结果和应用后的 event id。这样 AI “影响世界”有痕迹，但世界仍由服务器落笔；未来业务表拆分时，应继续沿用这个审计模式。

## 3. 总体架构

推荐采用四层结构：

1. **静态种子目录**：朝代、国家、城市、官职、考试制度、事件模板、NPC 原型。可以先用 JSON seed 文件，SQLite 化后进入 catalog 表。静态目录默认不随游戏回合变化。
2. **每局动态状态表**：国家财政、城市民情、NPC 财富与官职、玩家资产、外交关系、任所数据等，全部带 `session_id`。
3. **事件与审计日志**：每次回合、AI 建议、服务器应用、拒绝、长期事件推进、官场裁决、考试结果都追加记录。
4. **玩家可见 view / prompt projection**：从动态表构造 `worldEntityView`、`worldThreadView`、人物谱、城市奏报、官职簿等。浏览器和 prompt 只读这些过滤后的视图。

推荐事务顺序：

```text
读取 session + revision
读取玩家当前地点、身份、相关 NPC/城市/议题摘要
构造 compact prompt context
调用 AI provider
校验 AI JSON 与 proposal
执行服务器领域模块：关系、考试、时间、长期事件、官场、实体、议程
在同一事务中写动态表、事件日志、revision 和必要 snapshot
返回玩家可见 view
```

数据库表必须以 `session_id` 分区。即使同一个历史种子城市是“南京”，不同存档里的南京也应该有各自的动态行。

## 4. 推荐数据域

### 4.1 存档与世界元信息

用途：替代或包住当前 JSON envelope。

建议字段：

- `session_id`
- `storage_schema_version`
- `world_schema_version`
- `revision`
- `created_at`
- `updated_at`
- `dynasty`
- `year`
- `month`
- `ten_day_period`
- `turn_count`
- `current_player_id`
- `current_role`
- `summary`
- `world_state_json`：迁移早期保留完整 JSON 快照，保证兼容旧路由。

这一步可以先只做“一行一个 session + JSON payload”，行为不变，只换底层 adapter。后续再拆表。

### 4.2 国家与邻国

国家数据建议分成 `countries`、`country_metrics_history`、`diplomatic_relations`、`military_forces`、`frontier_zones`。

`countries` 可变字段：

- 基础：`country_id`、`name`、`short_name`、`polity_type`、`ruler_name`、`ruler_title`、`capital_city_id`、`culture_group`、`religion_or_ritual`、`language_label`。
- 财政：`treasury`、`grain_reserve`、`annual_tax_capacity`、`salt_tax_capacity`、`trade_income`、`debt`、`currency_stability`、`corruption`、`fiscal_pressure`。
- 军事：`army_size`、`elite_troops`、`garrison_quality`、`army_morale`、`logistics`、`naval_power`、`fortification_level`、`border_readiness`。
- 国威与政治：`prestige`、`legitimacy`、`court_stability`、`faction_pressure`、`administrative_capacity`、`succession_risk`、`mandate_pressure`。
- 民生：`population`、`public_order`、`disaster_pressure`、`famine_risk`、`migration_pressure`、`tax_burden`。
- 情报与可见性：`known_to_player`、`intel_confidence`、`last_report_turn`、`public_summary`、`hidden_notes`。

`diplomatic_relations` 可变字段：

- `country_a_id`、`country_b_id`
- `attitude`、`trust`、`fear`、`rivalry`、`tribute_status`
- `trade_openness`、`border_dispute_level`、`war_state`
- `treaty_json`、`claims_json`、`hostages_or_envoys_json`
- `last_incident_event_id`
- `visibility`

AI 可以建议“边报趋急”“邻国求贡”“贸易受阻”，但战争开启、议和、割地、朝贡关系变化必须由服务器根据外交、军事、财政和玩家行动裁决。

### 4.3 省府州县与城市

城市不应只是背景名，应成为地方官、将领、商税、灾荒、交通和科举的落点。

建议表：`regions`、`cities`、`city_metrics_history`、`routes_or_roads`、`city_offices`。

`cities` 可变字段：

- 基础：`city_id`、`country_id`、`region_id`、`name`、`jurisdiction_level`、`terrain`、`climate`、`river_or_coast`、`strategic_tags`。
- 人口与经济：`population`、`tax_base`、`market_activity`、`craft_output`、`land_tax_pressure`、`merchant_power`、`grain_price`。
- 财政粮储：`local_treasury`、`granary_stock`、`arrears`、`relief_capacity`。
- 民情治安：`public_order`、`gentry_power`、`bandit_pressure`、`lawsuit_backlog`、`corvee_burden`、`local_corruption`。
- 水利灾害：`waterworks`、`flood_risk`、`drought_risk`、`epidemic_risk`、`recent_disaster_id`。
- 军事交通：`garrison_size`、`wall_condition`、`supply_node_value`、`road_security`、`post_station_quality`。
- 文化科举：`academy_level`、`exam_quota_weight`、`scholar_network_strength`。
- 任所：`current_magistrate_posting_id`、`supervising_office_id`。
- 可见性：`known_to_player`、`last_report_turn`、`public_summary`、`hidden_notes`。

邻国城市也可以使用同一表，用 `country_id` 区分；玩家未掌握的邻国城市只暴露粗略情报。

### 4.4 官职、衙门与任命

现有 `officialCatalog.js` 是很好的静态官职目录起点。数据库化后建议拆成：

- `office_catalog`：静态官职定义。
- `bureau_catalog`：六部、都察院、地方衙门、军镇等静态衙门。
- `office_postings`：每局动态任命。
- `official_assignments`：差事、考成、弹劾、外放、丁忧、起复等进行中事项。

`office_catalog` 建议字段：

- `office_id`、`title`、`rank_label`、`bureau_id`
- `jurisdiction_scope`：court / province / prefecture / county / frontier / temporary
- `duties_json`
- `authority_metrics_json`
- `salary_or_stipend`
- `required_rank_or_exam`
- `appointment_method`
- `normal_term_months`
- `promotion_paths_json`
- `risk_tags`

`office_postings` 动态字段：

- `posting_id`
- `office_id`
- `holder_type`：player / npc
- `holder_id`
- `city_id` 或 `region_id`
- `started_year/month/ten_day_period`
- `status`：active / acting / suspended / vacant / transferred / dismissed
- `superior_posting_id`
- `performance_score`
- `impeachment_risk`
- `public_reputation`
- `hidden_notes`

原则：官职任免永远是服务器裁决。AI 可以写奏牍口吻、传闻、上官态度和 meter 建议，但不能直接把玩家或 NPC 改成某官。

### 4.5 NPC、家族、财富与田产

NPC 建议从当前 `characters` 数组升级为 `npcs`、`households`、`estates`、`npc_skills`、`npc_memory_notes`。

`npcs` 可变字段：

- 身份：`npc_id`、`name`、`courtesy_name`、`gender_label`、`age`、`alive`、`home_city_id`、`current_city_id`。
- 官场：`current_office_id`、`current_posting_id`、`rank_label`、`bureau_id`、`faction_id`。
- 能力：`literary_skill`、`administration`、`legal_judgment`、`military_command`、`diplomacy`、`learning`。
- 性情与目标：`ambition`、`loyalty`、`integrity`、`caution`、`temper`、`ideology_tags_json`、`current_goal`。
- 社会资本：`reputation`、`influence`、`patronage_power`、`peer_network`。
- 经济：`wealth_cash`、`land_mu`、`shops_or_mines_json`、`debts`、`annual_income_estimate`。
- 家庭：`household_id`、`father_id`、`mother_id`、`spouse_ids_json`、`children_ids_json`、`marriage_alliance_tags`。
- 风险：`health`、`legal_risk`、`impeachment_risk`、`resentment_risk`。
- 可见性：`visibility`、`known_to_player`、`intel_confidence`、`public_summary`、`hidden_intent`、`hidden_notes`。

`households` 建议字段：

- `household_id`、`family_name`、`seat_city_id`
- `wealth_score`、`land_mu`、`prestige`、`gentry_rank`
- `marriage_network_score`、`debt_pressure`
- `political_alignment`、`family_risk`
- `public_summary`、`hidden_notes`

NPC 不应一次性全部进入 prompt。服务器应只取与当前行动有关的人：同地、同官署、同事件、同关系网、被玩家点名、世界议程相关。

### 4.6 玩家主角详细数据

玩家可以复用 NPC/household 模型，但需要一个 `player_profile` 或 `player_state` 补充主角专属字段。

建议字段：

- 基础：`player_id`、`session_id`、`npc_id`、`role`、`role_label`、`name`、`current_city_id`。
- 时间与行动：`turn_count`、`last_action_turn`、`active_scene_id`、`travel_status`。
- 身体心性：`health`、`fatigue`、`mentality`、`stress`、`illness_risk`。
- 学业科举：`academia`、`literary_talent`、`adaptability`、`classical_format`、`exam_rank`、`palace_rank`、`teacher_id`、`studied_books_json`、`exam_history_json`。
- 官场：`office_title`、`current_posting_id`、`bureau_id`、`superior_favor`、`peer_network`、`performance_merit`、`promotion_prospect`、`impeachment_risk`、`clean_reputation`。
- 地方任职：`county_id`、`local_treasury`、`local_order`、`gentry_relations`、`bandit_pressure`、`pending_lawsuits`、`corvee_burden`、`waterworks`。
- 将领身份：`command`、`troops`、`supply`、`battle_reputation`、`scouting`、`campaign_risk`。
- 皇帝/大臣身份：`personal_power`、`court_control`、`mandate`、`influence`、`integrity`、`faction_id`。
- 资产：`gold`、`land_mu`、`estate_id`、`debts`、`stipend_income`、`business_interests_json`。
- 知识与可见性：`known_npc_ids_json`、`known_city_ids_json`、`known_country_ids_json`、`rumors_json`。

服务器仍要保护完整书生路径：`exam_rank`、`palace_rank`、`role`、`office_title`、`exam_history` 不能被普通 AI patch 直接写。

### 4.7 关系、人情与隐藏信息

当前 `relationshipLedger` 应升级为通用关系表：

- `relationship_id`
- `source_type` / `source_id`
- `target_type` / `target_id`
- `relationship`：好感或亲近
- `trust`
- `resentment`
- `obligation`：欠情/人情债
- `patronage`：庇护与门生关系
- `fear`
- `rivalry`
- `stance`
- `recent_intent`
- `visibility`
- `known_to_player`
- `last_updated_turn`
- `recent_notes_json`
- `hidden_notes`

关系可以连接 player、NPC、家族、派系、衙门、城市、国家。玩家 UI 只显示可见关系；prompt 也只能读可见摘要。

### 4.8 事件、记录与世界议程

建议保留 append-only 事件日志，不要只保存当前状态。

`event_log` 字段：

- `event_id`
- `session_id`
- `turn_count`
- `year/month/ten_day_period`
- `scene_id`
- `source_system`：player_action / ai_proposal / world_tick / exam / official_career / long_term_event / relationship / world_entity / db_migration
- `event_type`
- `scope_type` / `scope_id`
- `title`
- `summary`
- `public_text`
- `severity`
- `status`
- `related_json`
- `applied_changes_json`
- `visibility`
- `hidden_notes`

`world_threads` 可以由事件和动态状态派生，也可以保留当前 server-owned thread ledger。数据库化后仍不应让 AI 直接解决议题；议题只是索引和玩家介入提示。

### 4.9 场景与行动上下文

S48 已有考试局部时间。数据库化后可以推广：

- `active_scenes`
- `scene_steps`
- `scene_participants`
- `scene_local_time`

适用场景：考试、廷议、堂审、战斗、赶考途中遭遇、重大差事收束、外交会盟。

字段：

- `scene_id`
- `scene_type`
- `status`
- `started_year/month/ten_day_period`
- `current_phase`
- `local_step`
- `approx_hours`
- `location_city_id`
- `participants_json`
- `stakes_json`
- `server_rules_json`
- `public_summary`
- `hidden_notes`

场景动作不自动消耗全局一旬；是否推进全局时间由服务器场景规则决定。

### 4.10 AI 建议与审计

为了实现“AI 能改动动态数据库，但服务器有最终裁判权”，需要记录 AI 建议：

- `ai_call_id`
- `session_id`
- `turn_count`
- `prompt_pack`
- `provider`
- `model`
- `input_summary`
- `raw_output_redacted`
- `parsed_json`
- `proposal_json`
- `validation_status`
- `rejected_reasons_json`
- `applied_event_ids_json`
- `created_at`

不要保存密钥、完整 `.env`、本地文件路径或未经脱敏的 provider 错误。真实 provider 输出若包含敏感或隐藏泄漏，记录时也要脱敏或裁剪。

## 5. 最小表结构切片

第一批 SQLite 原型不需要把上面全部拆完。推荐最小切片：

```text
world_sessions(
  session_id primary key,
  storage_schema_version,
  revision,
  created_at,
  updated_at,
  player_name,
  role,
  role_label,
  dynasty,
  year,
  month,
  ten_day_period,
  turn_count,
  exam_rank,
  palace_rank,
  office_title,
  summary,
  metadata_json,
  world_state_json
)

event_log(
  event_id primary key,
  session_id,
  revision,
  turn_count,
  year,
  month,
  ten_day_period,
  source_system,
  event_type,
  scope_type,
  scope_id,
  title,
  summary,
  visibility,
  related_json,
  applied_changes_json,
  created_at
)

ai_change_proposals(
  proposal_id primary key,
  session_id,
  revision,
  turn_count,
  prompt_pack,
  provider,
  status,
  proposal_json,
  rejected_reasons_json,
  applied_event_ids_json,
  created_at
)
```

这个最小切片的价值是：不破坏现有 route payload，不改变 Mock 默认可玩，却开始拥有 revision、事件审计、AI 建议记录和未来拆表入口。

第二批再加：

```text
countries
diplomatic_relations
regions
cities
npcs
households
office_catalog
office_postings
relationships
active_scenes
world_threads
world_entities
```

## 6. 迁移路线图建议

### S49.1：动态数据库契约与边界

范围：

- 固定本文档或等价契约。
- 明确 SQLite 是首选本地数据库方向；远程存档、账号体系、多人同步和托管数据库不进入当前路线图。
- 同步 AI 权限矩阵：新增 AI proposal 审计、数据库写入边界、隐藏信息过滤。
- 不新增依赖，不改运行时代码。

验收：

- `git diff --check`
- `npm run check:docs-governance`

### S49.2：存储适配器接口

范围：

- 把当前 `sessionStore` 形式化为 adapter：`readSession`、`writeSession`、`mutateSession`、`listSessions`、`deleteSession`、`cleanupSessionTempFiles`。
- 默认 adapter 仍是 JSON。
- 路由不依赖 JSON 文件路径。
- 添加 adapter contract tests。

验收：

- 当前 JSON 行为不变。
- 旧存档读取、存档列表、并发 revision、完整 scholar -> official 路径继续通过。

### S49.3：SQLite 本地原型

范围：

- 按依赖治理选择实现方式：优先评估运行时可用的稳定 SQLite 能力；若需第三方包，必须固定版本、记录许可证、维护状态、安装影响和回滚策略。
- DONE：新增可选 `STORAGE_ADAPTER=sqlite`，默认仍为 JSON。
- DONE：首批只写 `world_sessions`，一行一 session，保留 `world_state_json`，同时投影 metadata/revision/timestamps 方便存档列表。
- DONE：提供 `npm run storage:import:sqlite` 从 JSON envelope 导入 SQLite；不会删除 JSON 原档。SQLite -> JSON 回滚暂以“保留 JSON 原档 + 禁用 env 回到 JSON adapter”为主，后续如需要再加显式导出脚本。
- DONE：S49.3 评估后使用 Node.js 标准库 `node:sqlite`，没有新增 `package.json` 运行依赖；显式 SQLite 模式需要运行时提供 `node:sqlite`。

验收：

- `STORAGE_ADAPTER=json` 默认路径完全不变。
- `STORAGE_ADAPTER=sqlite` 可 start/turn/save/list。
- Mock 模式不需要真实 provider key。

### S49.4：事件日志与 AI proposal 审计

范围：

- 数据库 adapter 写入 `event_log` 与 `ai_change_proposals`。
- 当前 JSON adapter 可用内嵌 ledger 或跳过 proposal 表，但测试要说明能力差异。
- route 在 provider 输出后记录 applied/rejected proposal 摘要。

验收：

- provider 伪造 server-owned 字段仍被拒。
- 被拒绝建议可审计但不落入 `worldState`。
- 错误脱敏不泄漏 key、路径或隐藏 notes。

### S50：天下地理与国家邻国种子

范围：

- 新增静态种子：本国、若干邻国、首都、边镇、主要省府州县、道路/驿路/河道。
- 每局从 seed 实例化动态国家/城市行。
- World Entities/Threads 可读取国家、城市、边境压力摘要。

S50.1 已先落静态 catalog 契约，见 [天下地理静态种子与实例化契约](WORLD_GEOGRAPHY_SEED_CONTRACT.md) 与 `src/game/worldGeographySeeds.js`。该切片负责国家、邻国、区域、城市、路线、边境、官署辖区和初始可见性。

S50.2 已新增 `src/game/worldGeography.js`，把静态 seed 实例化为每局 `worldState.worldGeography`：国家、区域、城市、路线、边境压力面和官署辖区都成为 server-owned ledger 行；路由返回 `worldGeographyView`，prompt 读取 capped `worldGeography` 摘要。该账本只做轻量压力快照和可见 projection，不替代现有 `treasury`、`grainReserve`、`publicOrder`、`borderThreat` 等顶层指标，不新增浏览器地理面板，也不拆 SQLite 业务表。

验收：

- 玩家可见 route projection `worldGeographyView` 已存在；浏览器“天下格局”或“任所地理”面板仍留给 S53。
- prompt 只取 capped 国家/城市/路线/边境/辖区摘要，不全量塞入模型，也不暴露 hidden rows 或 `hiddenNotes`。

### S51：NPC、家族、资产与关系数据库化

范围：

- `characters` 和 `relationshipLedger` 迁入 NPC/relationship/household 动态表。
- 玩家关系 view 继续过滤隐藏信息。
- NPC 财富、田产、家族、官职、声望、人情债开始可追踪。

S51.1 已先新增 [人物、家族、资产、田产与关系 Schema 契约](NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md) 与 `src/game/worldPeopleSchemas.js`，固定 `npcs`、`households`、`assets`、`estates`、`relationships` 的字段、数值范围、可见性枚举、hidden refs 过滤和 capped prompt summary。S51.2 已新增 `src/game/worldPeople.js` 和每局 `worldState.worldPeople` 的安全可见桥接层，从当前 `characters`、`relationshipLedger` 和可见 active request 近期札记生成 `worldPeopleView` 与 prompt projection；它不替换现有 `characters` / `relationshipLedger` / `activeNpcRequest`，不新增浏览器人物/家产面板，也不建 SQLite 业务表。

验收：

- 既有关系测试通过。
- AI 只能建议可见关系变化，不能新造隐藏联系人或直接写 NPC 资产。

### S52：官职任命、城市任所与地方事务

范围：

- `officialCatalog` 进入静态目录或保留代码目录并挂动态 `office_postings`。
- 地方官任所读取 `cities` 动态指标。
- 城市民情、钱粮、案牍、水利、士绅与官场差事联动。

S52.1 已先新增 [官职、官署、任所与迁转数据库契约](OFFICIAL_POSTING_DATABASE_CONTRACT.md) 与 `src/game/officialPostingSchemas.js`，固定 future `bureaus`、`offices`、`cityJurisdictions`、`postings`、`assessmentRecords`、`transferRecords` 的字段、数值范围、`public/role_visible/office_visible/relationship_visible/rumor/hidden` 可见性、hidden nested refs 裁剪和 capped prompt summary。该步骤只定义 schema/helper 与 provider 越权边界，不写 `worldState.officialPostings`，不改变 `officialCareerView`，不新增浏览器官职簿/任所地理面板，也不建 SQLite 业务表。

验收：

- 完整入仕路径不破坏。
- 玩家外放/任所变动由服务器写 posting，不由 AI 直接任命。

### S53：检索式 prompt context 与浏览器检查面板

范围：

- 新增 `worldContextAssembler`：根据玩家身份、地点、active scene、世界议程和玩家输入提取相关数据库摘要。
- 浏览器新增或扩展“天下格局”“地方任所”“人物谱牒”“官职簿”“事件档案”面板。
- 所有面板只读服务器 view。

验收：

- hidden token/browser smoke 覆盖新增面板。
- prompt tests 确认隐藏字段不进入模型。

## 7. AI 可修改范围分级

推荐把数据库字段分成四类：

| 等级 | 含义 | 示例 | AI 权限 |
| --- | --- | --- | --- |
| A 展示生成 | 文本、传闻、公文口吻、事件描述 | `public_summary`、叙事事件 | 可生成，经 schema 与长度过滤 |
| B 建议变更 | 普通 meter、关系建议、线索建议 | 民心、军心、关系 delta | 可建议，服务器 clamp 后决定 |
| C 服务器账本 | 官职、考试、长期事件、城市/NPC/国家实体行 | `office_postings`、`event_log`、`worldThreads` | AI 不可写，只能影响服务器来源 |
| D 隐藏/安全 | 密谋、隐藏 notes、密钥、文件路径、完整 raw prompt | `hidden_notes`、provider 配置 | AI 不可读不可写，视图过滤 |

所有新增表都要给字段标注 AI 权限，或至少在契约文档中说明。

## 8. 可见性与信息战

历史模拟里“玩家不知道”很重要。数据库必须从第一天保留可见性字段：

- `public`：公开奏报、官样文书、玩家已知。
- `role_visible`：只有当前身份能合理看到，如官员看到官署档案。
- `relationship_visible`：通过关系、人情、私信得知。
- `rumor`：玩家听闻但可信度不满。
- `hidden`：服务器可用，prompt/UI 不可见。

邻国、NPC 家产、官场密谋、弹章、隐秘结盟尤其需要 `intel_confidence` 或 `visibility`。AI 叙事只能把隐藏事实包装成“传闻/未证/风声”时，也必须由服务器决定是否给它这些摘要。

## 9. 风险与控制

主要风险：

- 复杂度暴涨：表多了以后，每回合要知道改哪里。
- Prompt 过载：数据库越大，越不能全量交给模型。
- 隐藏泄漏：人物密谋、邻国虚实、官场 hidden notes 容易从 raw row 泄出。
- 迁移风险：一次性替换 sessionStore 会伤到完整科举路径。
- 依赖风险：SQLite 包可能带来安装、原生编译或 Windows 差异。
- 范围漂移：如果把本地 SQLite 误扩成账号、远程存档或多人同步，会显著放大权限、安全和同步复杂度。

控制办法：

- 先 adapter，后数据库；先 JSON payload 行，后业务拆表。
- 每个动态系统都保留 server-owned helper，不把裁决交给 SQL 或 AI。
- Prompt 只能读 projection，不读 raw table。
- 所有写入放在同一事务，带 `session_id`、`revision` 和事件日志。
- 数据库 adapter 必须有和 JSON adapter 同一套 contract tests。
- 默认仍保留 Mock + JSON 路径，直到 SQLite 路径成熟。
- 明确拒绝云端/账号/多人设计，除非未来用户重新开启该范围并另立专项。

## 10. 推荐优先级

如果下一阶段目标是“世界规模变大”，推荐优先级如下：

1. **S49.2 存储适配器**：这是所有数据库工作的地基。
2. **S49.3 SQLite session 原型**：只换底层，不改变玩法。
3. **S49.4 事件与 AI proposal 审计**：先把“发生过什么、AI 建议过什么、服务器为何拒绝”记录下来。
4. **S50 国家/城市种子**：开始承载本国与邻国的世界地图。
5. **S51 NPC/家族/关系**：让人物和家产真正长期存在。
6. **S52 官职/任所/城市联动**：让地方官、将领、朝臣都落到具体空间和机构。
7. **S53 检索式 prompt 与 UI**：让 AI 和玩家只看当前合理可见的世界切片。

这条路线不会阻止继续做考试外的 scene-local time；两者可以并行，但数据库实现应优先选择小切片，避免把 S48 已稳定的时间契约和完整书生入仕路径一起掀开。
