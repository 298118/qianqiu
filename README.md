# 千秋 / Qianqiu

《千秋》是一款浏览器 + Node.js 历史模拟文字游戏。玩家可以扮演书生、皇帝、大臣、将领、地方官或入仕官员，在古代中国历史情境中用自由文本行动推动个人命运、科举功名、官场沉浮和王朝局势。

项目默认使用 Mock AI，本地无需 API Key 即可启动和游玩；配置真实 provider 后，可切换 OpenAI、DeepSeek、Xiaomi MiMo、MiMo + DeepSeek 混合路由或 Anthropic/Claude。

## 这次主要更新

当前项目已经完成可玩纵切、浏览器验收、时间专项、AI provider 扩展、本地动态数据库基础、S54-S59 SQLite 业务表拆分、S60-S67 超大动态世界数据库内容充实、S68-S69 科举读书深化与归档、S70 AI 编排归档，以及 S71 数据库玩法化、维护、安全检索、redacted player API、财政/刑名/军务外交服务器 resolver、压力驱动事件、多 actor 场景、NPC 记忆账本、AI 调动审计面板和 S71 验收归档。近期重点更新集中在“本地数据库专项归档”“S68-S69 科举读书深化”“多 provider 能力”“S70 AI 编排”和“S71 数据库玩法化归档”：

- 完成 S70.1 AI 提示词与工具协议契约：新增 [docs/AI_PROMPT_ENGINEERING_CONTRACT.md](docs/AI_PROMPT_ENGINEERING_CONTRACT.md) 和 [docs/AI_TOOL_PROTOCOL_CONTRACT.md](docs/AI_TOOL_PROTOCOL_CONTRACT.md)，固定 prompt pack 七层、actor/scene/output/tool policy 边界、MCP-friendly tool envelope、proposal/result/request-adjudication schema、`server.*` 内部化、strict `inputSchema`、Mock/no-key fallback 和 provider smoke 口径。新增 `src/ai/toolSchemas.js`、`scripts/providerToolSmoke.js` 与 `npm run smoke:provider:tools`，可在有 MiMo key 时探测 `tools` / `tool_choice` / `tool_calls` 与工具结果回填形状；无 key 时明确 skip。
- 完成 S70.8 多模型路由与 S70.9 AI 设置：`src/ai/modelRoutePolicy.js` 固定 narrator、actor_mind、planner、domain_specialist、critic、safety_gate、memory_summarizer、monthly_briefing、time_skip_planner 九类任务的 provider/model/budget/tool 边界，`npm run eval:ai` 会先跑本地 route/eval runner；`src/game/aiSettings.js`、`GET/POST /api/ai/settings/:sessionId` 和浏览器 `#ai-control-panel` 让玩家按任务调整 provider/model、输出长度、工具预算、并发和安全严格度。设置与调动摘要只返回 hidden-safe view，不暴露 key、base URL、raw prompt、raw provider payload、本地路径或 raw table，critic/safety 仍强制 review-only。
- 完成 S70.10 玩家官职月报：`src/game/playerMonthlyBriefing.js` 在玩家为入仕官员、地方官、大臣、将领或皇帝时，于下旬进入下月上旬的月末 tick 生成一次 `playerMonthlyBriefingView`。月报只读取服务器公开 projection（官场、任所、案牍、财赋、军务、人物与事件档案），写入脱敏月报账本、事件档案 `monthly_briefing` 条目和 bounded AI 调动摘要；不会直接改官职、财政、案牍、军务、NPC 或数据库。浏览器新增“官职月报”面板，只读 route view 和 turn feedback。
- 完成 S70.11 自然语言跳时：`src/game/timeSkip.js` 把“学习一月”“养病半月”“照旧处理一月”等输入解析为 `timeSkipPlan`，服务器再逐旬调用既有回合结算链，依次处理读书、政务、人脉请托、世界 tick、长期事件、官职月报和中断检测。跳时不会让模型直接改状态或跳过科期/急件；`timeSkip` 反馈只返回安全总结、逐旬摘要、是否中断和下一步提示。
- 完成 S70.12 大模型记忆系统：新增 `actorMemoryLedger`、`actorMemoryView`、`sessionSummary` 和 `sessionSummaryView`，普通回合会把 provider `memoryProposals`、可见关系变化、主动 NPC 请求、官职月报和科举同年座师网络整理为可见 actor memory；月末会生成玩家经历摘要并记录 `memory_summarizer` 调动摘要。provider 记忆 proposal 的来源类型由服务器强制归为 `ai_memory_proposal`，被拒绝的 private/hidden、不可见 actor、跨 actor 或污染文本只进入 hidden-safe 拒绝计数和原因码；浏览器、prompt、事件档案和响应 `worldState` 只接触服务器清洗后的 capped view，不暴露 raw 记忆/摘要账本。
- 完成 S70.13 地图 AI 接口预留与 S70.14 归档验收：新增 `mapContextView`、稳定 `mapEntityRef`、地图可见性和 `map.propose_route_or_geopolitical_move` 待裁决工具；游戏、考试和 prompt 只读地图安全 projection，不暴露 raw coordinate table 或 hidden enemy truth。新增 `scripts/providerAiFirstSmoke.js` 与 `npm run smoke:provider:ai-first`，有 MiMo key 时验收真实开局/普通长回合 JSON 和月报、跳时、记忆、地图、critic/safety、AI 设置等 S70 surface；无 key 时明确 skip，`MIMO_REQUIRED=1` 时缺 key fail。`npm run smoke:dual-mode -- --storage-only` 现在也比较 S70 AI-first JSON/SQLite route-view parity；S70 完成范围见 [docs/AI_ORCHESTRATION_ARCHIVE.md](docs/AI_ORCHESTRATION_ARCHIVE.md)。
- 启动 S72 PixiJS 水墨地图专项并完成 S72.2-S72.3 地图运行时与首批素材：`src/game/mapRuntimeView.js` 从安全 `mapContextView` 派生 `mapRuntimeView`，`public/assets/maps/ink-map-manifest.json` 登记 `ink-map-v1` 底图、纸纹、路线笔触、事件涟漪和地图图标。显示坐标与图片素材只用于未来 PixiJS 前端布局，不进入 prompt、AI 工具、移动裁决、任免、财政、战争或商路收益。
- 完成 S71.0-S71.1 数据库 resolver 输入契约与只读输入层：新增 [docs/DATABASE_RESOLVER_INPUT_CONTRACT.md](docs/DATABASE_RESOLVER_INPUT_CONTRACT.md)、`src/game/resolverInputConfig.js`、`src/game/resolverInputContext.js` 和 `test/resolverInputContext.test.js`。`resolverInputContext` 从服务器安全 view 生成 geography/people/offices/economy/military/events/intel/player/map/memory evidence buckets，带 `sourceViews`、caps、safety 和 audit summary；actor filter 会按 read domain 裁剪，JSON/SQLite adapter 读同一 fixture 后 context 等价，hidden/raw/prompt/path/key 污染会被清洗或拒绝。S71 仍 local-only，redacted API 是 hidden 私档前置，AI 只能读 actor 可见 projection 并提交 proposal/request-adjudication，不能执行 SQL、直写数据库或把 hidden/raw 内容回填普通 state route。
- 完成 S71.2 本地 SQLite schema migration 与维护层初版：新增 `src/storage/sqliteMigrations.js`、`src/storage/sqliteMaintenance.js`、`scripts/sqliteMaintenanceTool.js`、`test/sqliteMigrations.test.js` 和 `test/sqliteMaintenanceTool.test.js`。SQLite adapter 初始化 `schema_migrations`；migration runner 支持 dry-run、幂等跳过、checksum mismatch 阻断、事务回滚、失败不落 applied、forward-only 和破坏性迁移备份确认；维护命令新增 `storage:sqlite:status|health|backup|vacuum|export-safe`，输出数据库体积、迁移状态、索引健康、派生表漂移、备份/VACUUM dry-run 和脱敏诊断，不进入玩家 API、prompt 或浏览器。
- 完成 S71.3 安全全文检索 / 本地搜索：新增 `src/game/safeWorldSearch.js`、`src/storage/sqliteSafeSearchTables.js`、`GET /api/game/search/:sessionId` 和聚焦测试。搜索只从 `worldGeographyView`、`worldPeopleView`、`officialPostingsView`、案牍/军务/财赋报告、公开事件链、事件档案和角色可见传闻生成安全行；JSON 模式直接用 view helper，SQLite 模式同步 `safe_search_index`，FTS5 可用时维护 `safe_search_fts`，不可用时自动走 LIKE fallback。结果只返回 `domain/sourceView/sourceId/title/snippet/confidence/visibility/relatedRefs/routeViewRef`，不会返回内部行、审计原文、提示全文、本地路径、密钥或隐藏私档。
- 完成 S71.4 Redacted player API 与开发诊断 API：新增 `src/game/redactedState.js`、`GET /api/game/player-state/:sessionId`、`GET /api/dev/session-diagnostics/:sessionId` 和聚焦测试。玩家状态 route 只返回 allowlist `worldState`、metadata、redaction 边界和二次清洗 route views；浏览器读档与局势簿分页已改用 player-state。开发诊断默认关闭，production 强制关闭，仅 `ENABLE_DEV_DIAGNOSTICS=true`、远端地址为 loopback，且 Origin 为空或本机 loopback Origin 通过时返回 storage/counts/resolver/AI 摘要统计，不返回 raw state、raw audit、provider payload、prompt、key、本地路径或 SQLite 原始行。
- 完成 S71.5 财政与城市政策 resolver：新增 `src/game/cityPolicyResolverConfig.js`、`src/game/cityPolicyResolver.js` 和聚焦测试，支持开仓赈济、平粜、征粮、修堤、清丈、减免、追赃、盐漕、徭役、市价整肃和安民缉盗等服务器裁决。AI 仍只能通过 `city.propose_policy` 提交 proposal；服务器校验 actor 权限、辖区、可见 evidence、资源余量和 hidden/raw 污染后，才应用受控钱粮/民情/玩家官声 delta、公开事件和内部 `cityPolicyLedger`。`server.adjudicate_policy` 不进入模型可见工具或 provider schema，普通 domain tool runner 仍保持 pending-only。
- 完成 S71.6 地方案件与刑名 resolver：新增 `src/game/judicialCaseConfig.js`、`src/game/judicialCaseResolver.js` 和聚焦测试，支持受理、传唤、查证、调解、罚银、羁押、驳回、判决、申详、移交和缓审。AI 仍只能通过 `judicial.propose_case_resolution` 提交 proposal；服务器校验 T2-T5 权限、`judicial` 工具组、辖区、可见 evidence、证据数量/可信度、重大案件制度路径和 hidden/raw 污染后，才应用受控治安/腐败/玩家刑名考成 delta、公开案牍摘要和内部 `judicialCaseLedger`。公开 docket/event 只显示可见证据摘要，不公开 evidence ref、raw proposal 或 hidden 证据；`server.resolve_case` 不进入模型可见工具或 provider schema，普通 domain tool runner 仍保持 pending-only。
- 完成 S71.7 军务与外交 resolver：新增 `src/game/militaryDiplomacyResolverConfig.js`、`src/game/militaryDiplomacyResolver.js` 和聚焦测试，支持侦察、固守、练兵、调粮、出击、会战、大会战、撤军、遣使、互市、和议、朝贡、威慑、宣战 request、会盟和扣使。AI 仍只能通过 `military.propose_order` / `diplomacy.propose_move` 提交 proposal；服务器校验 T4-T5 权限、军务/外交工具组、可见 evidence、证据领域/数量/可信度、钱粮/市场证据、兵粮资源、target scope、制度路径和 hidden/raw 污染后，才应用受控府库/粮储/军心/边患/玩家将领或外交字段 delta、公开事件和内部 `militaryDiplomacyLedger`。`server.resolve_battle` / `server.apply_diplomacy` 不进入模型可见工具或 provider schema，普通 domain tool runner 仍保持 pending-only。
- 完成 S71.8 压力驱动事件生成器：新增 `src/game/worldPressureEventConfig.js`、`src/game/worldPressureEventGenerator.js` 和聚焦测试，从 S70.6 可见 pressure refs 与 S71.1 `resolverInputContext` 汇集城市、财赋、案牍、边防、情报、人物怨望、书院/士论和官场压力信号。服务器按组合规则、优先级、分数、确定性概率、冷却和每旬上限生成候选并裁决成案；只有 `applyPressureEventOutcome()` 写受控 world meters、公开事件和内部 `worldPressureEventLedger`，公开摘要不泄漏 source refs、raw proposal、hidden 私档或密情真值。
- 完成 S71.9 多 actor 场景运行时：新增 `src/game/sceneRuntimeConfig.js`、`src/game/sceneRuntime.js` 和聚焦测试，支持朝议、堂审、会盟和战役军议 scene-local 场景。每个 actor 单独过滤 `resolverInputContext` 与领域工具可见 evidence refs；Mock/no-key 可 deterministic 生成场景意见，真实运行时可接 proposal generator，但 sanitizer 会锚定参与者、限制场景意见类型、过滤不可见证据并拒绝工具直写/成案伪造。`resolveSceneOutcome()` 只返回 S71.5-S71.7 resolve-only 的 hidden-safe 摘要，不推进全局旬、不写状态或 SQLite。
- 完成 S71.10 NPC 记忆账本：扩展 `src/game/actorMemoryConfig.js`、`src/game/actorMemoryLedger.js` 和聚焦测试，新增目标、家族风险、畏惧、野心等 NPC 记忆类型，并把 NPC mind 的安全 `memoryCandidates` 与背景 NPC heuristic 纳入服务器记忆提案边界。普通回合会基于 `worldPeopleView` 和可见关系 capped 写入高显著 NPC 的长期目标、人情债、恩怨、家族风险等可见记忆；重复/污染/hidden/private 文本仍由服务器清洗或拒绝，浏览器、prompt、搜索、redacted player state 和场景 context 只读安全 `actorMemoryView` / capped 摘要，不暴露 raw `actorMemoryLedger`。
- 完成 S71.11 AI 调动审计面板：新增 `src/game/aiControlAudit.js`，把 `aiInvocationSummaryView`、公开事件档案、可见记忆、官职月报和经历摘要整理为 `aiControlAuditView`。游戏、考试、SSE、player-state 和 AI 设置接口都会返回该 hidden-safe route view；浏览器新增 `#ai-control-audit-panel`，只读公开结果、工具预算/调用/拒绝摘要和本机安全诊断，不读取 raw prompt、raw provider payload、SQLite 原始行、hidden ledger、本地路径或 key。开发诊断 `diagnostics.ai.controlAudit` 复用同一安全投影。
- 完成 S71.12 验收与归档：新增 [docs/DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](docs/DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)，统一归档 S71.0-S71.12 的 resolver 输入、SQLite 维护、安全搜索、玩家/诊断 API、财政/刑名/军务外交 resolver、压力事件、场景运行时、NPC 记忆、AI 调动审计和验收证据。本轮通过 S71 聚焦测试、dual-mode storage-only、Mock 科举、浏览器 smoke、MiMo 工具 smoke、MiMo AI-first smoke、mimo-deepseek provider smoke、provider route health 和全量 `npm test`；S67 large fixture 生成、局势簿 projection 与 SQLite read-repair 性能阈值按当前 S71 派生索引规模更新。
- 新增可选 SQLite 存储模式：默认仍是 JSON 存档；设置 `STORAGE_ADAPTER=sqlite` 后，本地使用 `schema_migrations`、`world_sessions`、审计表、地理 `geo_*`、人物 `people_*`、官职任所 `office_*` 派生业务表、安全事件档案 `event_archive_index`、安全 prompt 检索派生索引和安全搜索派生索引。
- 新增地理业务表同步：SQLite 模式会把 `worldState.worldGeography` 同步到 `geo_countries`、`geo_regions`、`geo_cities`、`geo_routes`、`geo_frontier_zones`、`geo_office_jurisdictions`，读档时可按 JSON snapshot 修复缺失或陈旧行。
- 新增地理维护工具：`npm run storage:geography:sqlite -- import|status|repair|export` 支持导入、漂移检查、修复和脱敏 debug dump；通用 SQLite 维护入口 `npm run storage:sqlite:status|health|backup|vacuum|export-safe` 用于本地迁移状态、索引健康、数据库体积、备份/VACUUM 和安全诊断。
- 新增人物域 SQLite 持久化：SQLite 模式会把规范化后的可见 `worldPeople` bridge rows 同步到 `people_npcs`、`people_households`、`people_assets`、`people_estates`、`people_relationships`；prompt/UI 仍只读 `worldPeopleView`。
- 新增官职任所 SQLite 持久化：SQLite 模式会把规范化后的安全 `officialPostings` projection 同步到 `office_bureaus`、`office_catalog`、`office_city_jurisdictions`、`office_postings`、`office_assessments`、`office_transfers`；读档可按 JSON snapshot 修复缺失、陈旧、错行、同 id/同 revision 内容污染或旧行缺指纹。
- 新增安全事件索引：SQLite 模式会把 `eventArchiveView` 的安全分页 projection 同步到 `event_archive_index`，读档按 `world_sessions.world_state_json` 单向修复；prompt 近事、顶层 `recentEvents`、地方案牍、军务外交预警、经济财政预警、S65.1 公开历史事件链和 S65.2 情报传闻都只读事件档案安全条目。
- 新增 SQLite prompt 检索索引：SQLite 模式会把地理、人物、官职任所、地方案牍、军务外交态势、经济财政态势、公开历史事件链、情报传闻和事件档案的服务器可见 projection 同步为安全检索行，读档用内容指纹修复同 id/同 revision 污染；JSON 模式继续走原 view helper fallback。
- 新增审计公开 projection 工具：`npm run storage:audit-events -- status|export --adapter json|sqlite` 会从 JSON sidecar 或 SQLite 审计读取 allowlist 后的公开摘要，输出本地调试安全的 public projection；AI proposal 只计数，不输出原始建议内容。
- 新增浏览器 SQLite smoke 参数：`npm run smoke:browser -- --storage-adapter sqlite --sqlite-db <path>` 可验证 Mock 浏览器主线与 SQLite adapter 共用同一存储；`npm run smoke:browser -- --information-parity` 会顺序启动 JSON/SQLite 临时服务器，比对局势簿 DOM、route view 摘要和事件档案分页 metadata。
- 完成 S49-S67 数据库与内容统一归档：S49-S67 已把本地数据库基础、SQLite 业务表、双模式验收、小/中/大规模档位、seed 分层、国家/邻国、城市、NPC、官职生态、地方事务、外交军事、经济市场、事件模板、情报可见性、大规模 prompt 检索、局势簿分页和 scale regression 收束到 [docs/LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](docs/LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)，旧分卷仅保留为跳转页。
- 完成 S61 国家/城市深度内容：`worldGeographyView` 与 prompt 检索现在携带国家财政、军备、国威、继承、外交、情报可靠度，以及城市税粮、市价、士绅、词讼、徭役、水利、灾害、交通、驻军和书院等安全指标；AI 只读这些 projection，不能写地理账本或裁决外交/战争/城市治理。
- 完成 S62.1/S62.2 NPC 人口、家族谱系与生命周期：新增 deterministic 人口谱系生成 helper 和服务器月末生命周期 helper，规模 fixture 可生成官员、胥吏、士绅、商贾、军官、书院师友、同年、亲族、邻国使者，以及父母配偶子女、姻亲、门生故旧、同乡同年和派系网络；普通回合月末可推进可见 NPC 健康、婚丧、迁居、官职履历状态、财富/欠账、资产、田产、家族风险和人情债演化，并复用 `world_people` 审计与 `people_*` 派生行链路。hidden 私档、资产真数和隐藏动机仍不进入当前 raw route state。
- 完成 S63.1 官职生态与任命池：`officialPostingsView` 现在能看到上级堂官、属官/胥吏/幕友接口、空缺、候补、补授、试署、外放、丁忧、起复、弹劾候勘和差遣压力；这些只作为服务器可见 projection、SQLite 派生行和 prompt 检索素材，真实任免仍由 `officialCareer` 服务器结算裁决。
- 完成 S63.2 地方事务与案牍模板：新增 `localAffairsDocketView`，把钱粮、刑名、灾赈、水利、盗匪、徭役、士绅、疫病和任所收束压力从可见城市/任所指标整理为行政身份可见案牍；案牍会进入事件档案 `local_docket` 条目和 prompt 检索索引，但不会直接改城市指标、官场考成、任免或 SQLite 原始表。
- 完成 S64.1 外交军务态势：新增 `militaryDiplomacyView`，把可见国家/边面/城市/路线、军官/使节线索和任所辖区整理为战区、驻军、粮道、外交接触与边患预警；这些进入事件档案 `military_diplomacy` 条目和 `events.militaryReports` prompt 检索行，但不会直接宣战、和议、调兵、任免统帅、结算战役或公开 hidden 情报。
- 完成 S64.2 经济财政态势：新增 `economicFiscalView`，把可见国家/城市/路线、任所案牍、财赋赈务实体和债务资产线索整理为税粮、府库、粮价、盐漕商路、地方库银、赈济、债务腐败与市场预警；这些进入事件档案 `economic_fiscal` 条目和 `events.economicReports` prompt 检索行，但不会直接征税、拨银、开仓、平粜、赈济、裁决盐漕、清偿债务、改市场价格或写入持久化表。
- 完成 S65.1 历史事件链：新增 `historicalEventArchiveView`，把可见案牍、军务、财赋、任所考成、人物关系和科举履历组合为自然灾害/赈务、官场争斗、边事、商税、人物关系、科举和地方差遣公共卷宗；公开链进入路由 view、事件档案 `historical_event_chain` 条目和 `events.eventChains` prompt 检索行，密档链只在服务器显式请求时生成，不进入普通玩家路由、浏览器或 SQLite prompt 索引。
- 完成 S65.2 情报传闻视图：新增 `intelligenceRumorView`，从服务器可见地理、案牍、军务、财赋、人物关系和公开历史事件链派生角色可见传闻/奏报/私信/侦报；这些进入事件档案 `intelligence_rumor` 条目和 `intel.rumors` prompt 检索行，传闻真伪、密情公开、任免、战和、刑赏、财政结算和落库仍由服务器裁决。
- 完成 S66.1 prompt retrieval 策略：`retrievalContext.strategy` 会记录 ordinary/high profile、行/字符预算、候选/选中/丢弃域统计、裁剪数量、排序信号、角色视野和分页边界；普通自由回合保持 48 行 / 约 20,000 字符，高相关检索保持 72 行 / 约 30,000 字符。
- 完成 S66.2 局势簿分页面板：新增 `informationPanelPageView`，为天下格局、任所地理、人物谱牒、官职簿和事件档案提供服务器分页、检索、筛选、排序和分页 metadata；浏览器只读 route view，不读 raw SQLite table、raw audit、provider proposal、prompt、本地路径或 key。
- 完成 S67.1 规模/性能/回归验收：`npm run smoke:dual-mode -- --storage-only` 现在除 S59 存储维护外，还输出 `scale` 段，验证 large fixture 的 14 国、300 城、2000 NPC、700 家族、5000 关系、450 官职/官署行、1000 任所/任命行、5000 事件/情报条目和 10000 prompt 行，检查 route cap、S66.1 prompt 策略、S66.2 局势簿分页、事件档案分页、SQLite `prompt_retrieval_index` 删除后读档修复、hidden-token、防泄漏、内存和耗时门槛。
- 完成 S68.1 科举制度契约：新增 [docs/IMPERIAL_EXAM_SYSTEM_CONTRACT.md](docs/IMPERIAL_EXAM_SYSTEM_CONTRACT.md)，固定明清原型与游戏压缩边界，要求外层四级科举 API 保持兼容，内部再扩县试/府试/院试、乡试/会试三场、多卷流转、保结/搜检/号舍/弥封/誊录/对读/磨勘/复核、多考官 proposal 和服务器定榜/授官裁决。
- 完成 S68.2 读书账本与学业计划基础：新增 server-owned `studyProfile` 与 route `studyProfileView`，把经义根柢、制艺章法、策论时务、史事典故、律例判断、誊写卷面和科场耐力整理成可见学业画像；普通读书行动会记入日课，交卷后按评分/复核刷新文卷弱点、老师建议、书目和下旬计划，浏览器书生面板与 prompt 只读该 view，provider 不能直接 patch 账本、名位或官职。
- 完成 S68.3 老师点评与书院/同窗互动：`studyProfileView` 新增老师点评、书院师友、小题训练、荐书和保结前置摘要；普通拜师、讲会、同窗互评和求保结会由服务器写入可见师友关系与保结稳度。真实 provider 可返回 `teacherFeedbackProposal`，但只作为文本点评 proposal，服务器清洗后才进入读书簿，不能 patch `player.teacher` / `player.position`、创造真实关系、准考资格、名位、榜单或官职。
- 完成 S68.4 科场制度流程：新增 server-owned `activeExam.procedure` 与 route `examProcedureView`，在不改变外层四级考试 API 的前提下展示童试县试/府试/院试摘要、乡试/会试三场多卷、保结、搜检、号舍、发题、草稿、誊清、交卷、弥封、誊录、对读、磨勘、放榜和归档流程；交卷后把安全流程快照写入 `player.examHistory[].examProcedure`。浏览器和 prompt 只读脱敏 view，不暴露弥封身份映射、保结密注、考官私意、模型原始建议或内部审计。
- 完成 S68.5 科场事件与多考官阅卷：新增 server-owned `examinerPanelView` 与 `examReview` resolver，把夹带疑云、号舍病困、誊录误差、房官/同考官/主考/磨勘 critic 建议接入交卷后、榜单前的服务器限幅定分流程。真实 provider 可返回 `examiner_reviews`，但只保留脱敏未采纳摘要；服务器仍先应用本地反作弊、再生成 canonical ranking、晋级和处罚。浏览器考试结果、考试档案和书生面板只读 `examinerPanelView` / `examProcedureView.examinerPanelView`。
- 完成 S69.1 榜单与名次荣誉：新增 server-owned `examHonorLedger`、`examHonorView` 与 `examHonors` resolver，从服务器 canonical ranking 写入解元、会元、状元、榜眼、探花、传胪、二甲/三甲次序和三元及第。游戏 start/state/turn 与考试 question/progress/submit 路由返回 `examHonorView`，考试历史保存安全 `examHonor` 快照；浏览器和 prompt 只读该 view，provider ranking、考官建议和皇帝/吏部 proposal 不能直接定荣誉、甲第或官职。
- 完成 S69.2 同年、座师与考官网络：新增 server-owned `examNetworks` resolver，从服务器定榜顺序、公开荣誉和脱敏阅卷摘要派生同年、房官、主考/座师、读卷官等可见关系，写入 `relationshipView` / `worldPeopleView`，并在考试历史保存安全 `examNetwork` 快照、事件档案新增 `exam_network` 公开条目。prompt 只读 capped `examNetwork` 摘要，模型原始建议、弥封映射、考官私意和保结密注不能成为关系事实。
- 完成 S69.3 授官路径深化：新增 server-owned `appointmentTrack` / `appointmentTrackView` 与 `appointmentTracks` resolver，殿试后按服务器 canonical 甲第、榜次、科名荣誉、同年座师摘要、官缺 projection 和籍贯回避裁决初授。一甲区分状元修撰与榜眼/探花编修，二甲优先馆选庶吉士并保留观政/部属备选，三甲按铨选外放、部属候补或候缺观政处理；真实官职、`officialCareer` 履历和事件档案只由服务器写入，吏部/皇帝/provider proposal 只能作为脱敏建议。
- 完成 S69.4 浏览器科举档案面板：`public/app.js` 新增 `#imperial-exam-archive-panel`，把读书簿、科场流程、多考官阅卷、榜单荣誉、同年/座师/考官和授官轨迹整合到玩家侧栏。面板只读 `studyProfileView`、`examProcedureView`、`examinerPanelView`、`examHonorView`、`relationshipView` / `worldPeopleView`、`appointmentTrackView` 和考试历史安全快照；`publicAppSource` 与 browser smoke helper 增加 hidden-token/source-token 守卫。
- 完成 S69.5 Provider/Mock 验收：新增 `npm run smoke:exam-s69`，用 Mock deterministic 路径完整跑通童试、乡试、会试、殿试到入仕，检查读书簿、科场流程、多考官阅卷、榜单荣誉、同年/座师/考官和授官轨迹安全快照；`smoke:provider` 现在要求真实 provider 通过老师点评 `teacherFeedbackProposal`、出题和评卷 smoke，并检查 provider 不得 patch 科举/server-owned 子账本。考试出题与评卷落盘前会清洗 hidden token、raw provider/proposal、prompt/index/table 名、本地路径和 key 形状文本。
- 新增 Xiaomi MiMo provider：支持 `mimo` 与 `mimo-deepseek`，后者让 MiMo 负责开局、普通回合、流式叙事和出题，让 DeepSeek V4 Pro 负责科举评卷。
- 更新 README 与项目文档：把当前功能、修复、安全边界、启动方式和常用命令整理成更适合 GitHub 首页阅读的结构。

## 修复与加固

- 修复并加固 AI 越权边界：AI 只能提交叙事、题目、评分建议、关系建议和受限 `statePatch`；服务器拥有时间推进、晋级、作弊处罚、官职任免、数据库写入和持久化裁决。
- 加固 SSE 流式安全：真实 provider 可先显示顶层叙事片段，但状态只在完整 JSON 通过 schema 后落盘；失败流式文本会回滚。
- 加固错误脱敏：AI 连接诊断、provider smoke、事件档案和浏览器 smoke 会避免暴露 key、长 token、raw prompt、本地路径和 raw provider response。
- 加固存储一致性：JSON adapter 使用 envelope、revision、atomic write 和本地 lock；SQLite adapter 使用 transaction、revision 检查和同 session 队列。
- 加固玩家可见视图：浏览器和 prompt 只读取服务器整理后的 `worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`historicalEventArchiveView`、`intelligenceRumorView`、`eventArchiveView` 等安全 projection，不读取 raw audit 或 raw business table。

## 项目特点

- 自由文本玩法：玩家不被固定选项限制，可以用自然语言下旨、读书、赶考、办案、治军、结交、上疏或处理地方事务。
- 完整书生路径：保护 `scholar -> child_exam -> provincial_exam -> metropolitan_exam -> palace_exam -> official`，从寒窗到入仕是当前第一优先级体验。
- 多身份循环：书生、皇帝、大臣、将领、地方官、入仕官员都有代表性开局与行动反馈。
- 旬制时间系统：普通自由行动按“上旬 -> 中旬 -> 下旬 -> 下月上旬”推进；“学习一月/养病半月/照旧处理一月”等自然语言跳时会拆成多旬批处理；考试等密集场景使用 scene-local time，不强制消耗全局旬。
- 长期世界模拟：关系账本、读书账本、主动 NPC 请托、长期事件、官场考成、科举日历、角色世界联动、World Entities 和 World Threads 已接入。
- View-first 安全架构：玩家界面和 prompt 使用服务器裁剪后的安全视图，隐藏关系、密札、raw audit、provider proposal 和本地路径不会进入玩家 payload；S70.12 起 route `worldState` 也会剥离 raw `actorMemoryLedger` / `sessionSummary`。
- 本地优先：默认 JSON 存档，SQLite 仅作为本机增强；当前不引入远程存档、账号体系、多人同步或托管数据库。

## 项目优势

- 无 key 可玩：Mock AI 是默认模式，适合本地开发、演示和回归测试。
- 真实 provider 可选：需要时可接入 OpenAI、DeepSeek、MiMo、MiMo + DeepSeek 或 Anthropic，不让真实 key 成为启动门槛。
- 服务器裁决清晰：模型负责创造力，服务器负责规则、边界、晋级、处罚、任免和持久化。
- 文档与验收完整：路线图、架构、AI 权限矩阵、数据库契约、浏览器验收和 provider 验收都有持续维护。
- 渐进式数据库迁移：JSON snapshot 保持可读可回滚，SQLite 逐步拆表增强查询、审计和长期世界存储。
- 内容保护优先：大规模数据库内容只能经服务器 helper、schema、clamp、可见性过滤和本地事务进入世界；AI 不直接写库，hidden 私档不回填玩家 route state。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript，无构建步骤。
- 后端：Node.js + Express。
- AI provider：Mock、OpenAI、DeepSeek、Xiaomi MiMo、MiMo + DeepSeek、Anthropic/Claude。
- 校验：Ajv schema、本地 JSON 解析、重试和降级。
- 流式响应：Server-Sent Events。
- 存储：默认 JSON session files；可选 SQLite session row、审计表、地理 `geo_*` 业务表、可见人物 `people_*` 业务表、人物事件关联、官职任所 `office_*` 派生业务表、安全 `event_archive_index`、安全 prompt 检索索引和安全搜索索引。
- 测试：Node.js `node --test`。
- 浏览器验收：`playwright-core` + 本机 Chrome/Edge。

## 快速启动

需要 Node.js 18+。

```bash
npm install
npm start
```

然后打开：

```text
http://localhost:3000
```

开发时可用自动重启：

```bash
npm run dev
```

## 配置

复制 `.env.example` 为 `.env`，按需填写。最小本地游玩不需要任何 key：

```text
PORT=3000
STORAGE_ADAPTER=json
AI_PROVIDER=mock
```

常用 provider 配置：

```text
AI_PROVIDER=mock

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_GRADE_MODEL=deepseek-v4-pro

MIMO_API_KEY=
MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
MIMO_MODEL=mimo-v2.5-pro
MIMO_AUTH_HEADER=api-key

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5
```

`AI_PROVIDER` 可选：

- `mock`：默认模式，无需 key，完整可玩。
- `openai`：使用 OpenAI Responses API。
- `deepseek`：使用 OpenAI-compatible chat completions，支持按任务覆盖模型。
- `mimo`：使用 Xiaomi MiMo OpenAI-compatible chat completions，默认模型 ID 为 `mimo-v2.5-pro`。
- `mimo-deepseek`：混合 provider，MiMo 负责叙事/出题，DeepSeek 负责科举评卷。
- `claude` 或 `anthropic`：使用 Anthropic Messages API。

MiMo Token Plan 的 `tp-...` key 必须配套订阅页给出的 token-plan Base URL，不能与普通 `sk-...` key 或按量 Base URL 混用。公开部署或非 Coding 自定义后端使用前，请先确认订阅条款或改用普通 API key。

## 存储模式

默认 JSON：

```text
STORAGE_ADAPTER=json
```

存档位于 `data/sessions/`，带 schema envelope、metadata、revision、atomic write 和 save-list API。

可选 SQLite：

```text
STORAGE_ADAPTER=sqlite
SQLITE_DATABASE_PATH=data/qianqiu.sqlite
```

SQLite 模式需要当前 Node.js 运行时提供 `node:sqlite`。它会保留完整 `world_sessions.world_state_json`，初始化 `schema_migrations`，同步地理 `geo_*` 业务表、可见人物 `people_*` bridge rows、官职任所 `office_*` projection rows、安全事件档案 `event_archive_index`、安全 prompt 检索索引和安全搜索索引，并把服务器人物事件关联到本地 `people_*.last_event_id`。`office_*`、`event_archive_index`、prompt 检索索引和 `safe_search_index` 派生行带本地内容指纹；`prompt_retrieval_index` 也包含 `localAffairsDocketView` 的地方案牍 compact rows、`militaryDiplomacyView` 的军务外交 compact rows、`economicFiscalView` 的经济财政 compact rows、`historicalEventArchiveView` 的公开事件链 compact rows 和 `intelligenceRumorView` 的情报传闻 compact rows，用于发现同 id/同 revision 的内部表污染或旧行缺指纹。`safe_search_index` 只保存玩家可见搜索片段和 route view ref，FTS5 可用时同步本地 `safe_search_fts`，不可用时 LIKE fallback；内部 SQLite table 不进入浏览器、prompt 或 save-list payload；读取修复也只从 `world_state_json` 单向重建，不把内部行、事件 id、密档链或隐藏情报真值回填为 route state。

导入、地理维护与审计公开 projection：

```bash
npm run storage:import:sqlite -- --dry-run
npm run storage:geography:sqlite -- status
npm run storage:geography:sqlite -- repair --dry-run
npm run storage:geography:sqlite -- export
npm run storage:audit-events -- status --adapter json
npm run storage:audit-events -- export --adapter sqlite --db data/qianqiu.sqlite
npm run storage:sqlite:status -- --db data/qianqiu.sqlite
npm run storage:sqlite:health -- --db data/qianqiu.sqlite
npm run storage:sqlite:backup -- --db data/qianqiu.sqlite --dry-run
npm run storage:sqlite:vacuum -- --db data/qianqiu.sqlite --dry-run
npm run storage:sqlite:export-safe -- --db data/qianqiu.sqlite
npm run smoke:dual-mode -- --storage-only
```

`storage:import:sqlite` 会通过 SQLite adapter 同步 `geo_*`、`people_*`、`office_*`、`event_archive_index`、`prompt_retrieval_index` 和 `safe_search_index` 等派生表；`storage:sqlite:*` 仅作为本地维护命令，缺失数据库时 status/health/export-safe 不创建文件，backup/vacuum 支持 `--dry-run`，输出会脱敏本机路径、key、提示内容和 hidden/private 字段；`smoke:dual-mode -- --storage-only` 是当前 JSON/SQLite 快速整体验收，串联 JSON -> SQLite dry-run/正式导入、地理修复/导出、审计公开 projection、派生表计数、large fixture scale regression、prompt 策略、局势簿分页、S70 AI-first route-view parity、SQLite 读档修复、性能门槛和 hidden-token 防线。

回滚优先关闭 `STORAGE_ADAPTER=sqlite` 回到 JSON adapter，或保留/恢复原 JSON 存档。

## 常用命令

```bash
npm test
npm run check:docs-governance
npm run eval:ai
npm run smoke:browser
npm run smoke:browser -- --information-parity
npm run smoke:dual-mode -- --storage-only
npm run smoke:exam-s69
npm run smoke:provider
npm run smoke:provider:tools
npm run smoke:provider:ai-first
npm run smoke:provider:route
npm run smoke:provider:long
npm run storage:audit-events -- status
npm run storage:sqlite:status -- --db data/qianqiu.sqlite
npm run storage:sqlite:export-safe -- --db data/qianqiu.sqlite
```

说明：

- `npm test` 使用 Node.js 内置测试，覆盖状态边界、AI schema、科举、关系、长期事件、官场、角色联动、存储、SSE 和脚本逻辑。
- `npm run check:docs-governance` 检查开发治理规范、活动路线图和必读文档中的受保护规则。
- `npm run eval:ai` 是离线 AI 输出质量门槛，覆盖 provider-shaped JSON、越权风险、历史语气、评分边界和作弊处罚。
- `npm run smoke:browser` 启动临时 Mock 服务器，覆盖完整书生到入仕路径、作弊样例、代表身份回合、存档簿、年月旬显示和桌面/移动布局；`--information-parity` 专项比对 JSON/SQLite 双模式下“局势簿”五类面板、搜索/筛选/排序/分页控件、分页 metadata 和 hidden-token 防线。
- `npm run smoke:dual-mode` 串联 JSON/SQLite 完整 Mock browser smoke、局势簿 parity、S59 存储维护、S67.1 large fixture 规模回归和 S70 AI-first route-view parity；无浏览器或只想核验导入/修复/导出、读档修复、prompt/局势簿/S70 views/性能门槛时可加 `--storage-only`。
- `npm run smoke:exam-s69` 使用 Mock deterministic provider 完整跑通四级科举到初授入仕，验证 S68-S69 的读书、科场、评卷、荣誉、同年座师网络、授官轨迹和 hidden-token 防线。
- `npm run smoke:provider:tools` 是 S70.1 MiMo 工具调用形状探针；缺 `MIMO_API_KEY` 时明确跳过，`MIMO_REQUIRED=1` 或 `--required` 时缺 key 失败。
- `npm run smoke:provider:ai-first` 是 S70.14 MiMo AI-first 验收；有 key 时真实调用 MiMo 开局和普通长回合，再以内存 fixture 验证月报、跳时、记忆、地图 proposal、critic/safety review-only 和 AI 设置 surface；缺 key 时明确跳过，`MIMO_REQUIRED=1` 或 `--required` 时缺 key 失败。
- `npm run smoke:provider*` 只在配置真实 provider key 时进行网络调用；无 key 环境会成功跳过。
- `npm run storage:audit-events -- status|export` 是本地审计公开 projection 工具，默认只输出脱敏统计和 public 事件摘要，不输出 raw audit、provider proposal、prompt、key、本地路径或 hidden notes。
- `npm run storage:sqlite:status|health|backup|vacuum|export-safe` 是本地 SQLite 维护入口，覆盖 `schema_migrations`、索引健康、派生表漂移、数据库体积、备份、VACUUM 和安全诊断；这些命令不进入玩家 API，缺 `node:sqlite` 时给出可读错误或由测试受控 skip。

## API 概览

```text
GET  /api/health
POST /api/game/start
GET  /api/game/saves
GET  /api/game/player-state/:sessionId
GET  /api/game/state/:sessionId
GET  /api/game/search/:sessionId
POST /api/game/turn
POST /api/ai/connection-test
GET  /api/ai/settings/:sessionId
POST /api/ai/settings/:sessionId
POST /api/exam/question
POST /api/exam/progress
POST /api/exam/submit
```

核心约定：

- `POST /api/game/start` 校验身份，只允许 `scholar`、`emperor`、`minister`、`general`、`magistrate`、`official`。
- `GET /api/game/saves` 只返回脱敏 metadata，不返回完整 `worldState`、隐藏关系、provider 配置或本地路径。
- `GET /api/game/player-state/:sessionId` 是普通浏览器读档优先入口，返回 redacted player state 和清洗后的 route views；支持与 state route 相同的局势簿分页查询参数。
- `POST /api/game/turn` 支持普通 JSON 与 SSE。SSE 事件包括 `state_preview`、`narrative_chunk`、`final_state`、`error`。
- `POST /api/ai/connection-test` 不创建 session、不写存档、不用 Mock fallback 掩盖真实 provider 问题。
- `GET/POST /api/ai/settings/:sessionId` 读取或更新 session 级 AI 设置；服务端只接受 provider/model、输出长度、预算、并发、安全严格度等质量/路由设置，拒绝 hidden/raw/server/path/key、直写状态/数据库和观测日志伪造。
- `GET /api/game/state/:sessionId` 可用 `informationTab`、`informationQuery`、`informationFilter`、`informationSort`、`informationPage`、`informationPageSize` 查询局势簿分页；兼容别名 `informationPanelTab` / `informationCollection` 和 `informationSearch`。S70.12 起响应 `worldState` 不携带 raw `actorMemoryLedger` / `sessionSummary`，S71.4 后该 route 保留为开发兼容快照，普通浏览器读档请用 player-state。
- `GET /api/game/search/:sessionId` 可用 `q` / `query`、`domain`、`page`、`pageSize` 查询安全世界索引；`domain` 支持 `geography`、`people`、`offices`、`events`、`reports`、`rumors`，`pageSize` 最大 25。返回 `safeWorldSearchView`，结果只含摘要片段、来源视图和可跳转 ref；敏感查询会 `queryRejected`，不会暴露内部表名、审计原文、提示全文、本地路径、密钥或隐藏私档。
- `GET /api/dev/session-diagnostics/:sessionId` 是本机开发诊断入口，不属于普通玩家 API；默认关闭，production 关闭，仅 `ENABLE_DEV_DIAGNOSTICS=true`、远端地址为 loopback，且 Origin 为空或本机 loopback Origin 门禁通过后返回脱敏统计。
- 游戏与考试路由会返回服务器整理后的可见视图，例如 `examProcedureView`、`examinerPanelView`、`examHonorView`、`appointmentTrackView`、`studyProfileView`、`relationshipView`、`worldGeographyView`、`worldPeopleView`、`officialPostingsView`、`localAffairsDocketView`、`militaryDiplomacyView`、`economicFiscalView`、`historicalEventArchiveView`、`eventArchiveView`、`informationPanelPageView`、`aiSettingsView`、`aiInvocationSummaryView`、`playerMonthlyBriefingView`、`actorMemoryView`、`sessionSummaryView`、`mapContextView`、`mapRuntimeView` 和 `aiControlAuditView`。S69.2 的同年/座师/考官事实通过 `relationshipView`、`worldPeopleView`、`eventArchiveView` 和考试历史 `examNetwork` 快照暴露；S69.3 的初授事实通过 `appointmentTrackView`、`officialCareerView`、`eventArchiveView` 和考试历史 `appointmentTrack` 快照暴露；S69.4 的浏览器科举档案面板只组合这些 route view 与安全快照，不新增 raw route 入口；S70.9 的 AI 设置面板只读 AI route view，不读取 raw `worldState.aiSettings`；S70.10 的官职月报面板只读 `playerMonthlyBriefingView` 和本回合 `playerMonthlyBriefing` 反馈，不读取 raw `worldState.playerMonthlyBriefing`；S70.11 的跳时叙事只读本回合 `timeSkip` 安全总结，不读取 raw 计划或隐藏状态；S70.12 的记忆与经历摘要只读 `actorMemoryView`、`sessionSummaryView` 和本回合安全反馈，不读取 raw `worldState.actorMemoryLedger` 或 `worldState.sessionSummary`；S70.13 的地图接口只读 `mapContextView` 和稳定 refs，不读取 raw coordinate table 或 hidden enemy truth；S72.2 的 `mapRuntimeView` 只供浏览器地图 runtime 使用，不进入 prompt 或服务器裁决事实；S71.11 的 AI 调动审计只读 `aiControlAuditView`，不读取 raw prompt、provider payload、SQLite row、hidden ledger、本地路径或 key。

## 项目结构

```text
server.js
public/
  index.html
  styles.css
  app.js
src/
  ai/
  config/
  game/
  routes/
  storage/
  utils/
test/
docs/
data/sessions/
```

## 重要文档

- [docs/SHARED_CONTEXT.md](docs/SHARED_CONTEXT.md)：Codex 与 Claude Code 共享交接板。
- [docs/QIANQIU_DEVELOPMENT_BRIEF.md](docs/QIANQIU_DEVELOPMENT_BRIEF.md)：产品目标、架构、数据契约和交付标准。
- [docs/DEVELOPMENT_STEPS.md](docs/DEVELOPMENT_STEPS.md)：当前活动路线图与进度台账；S71 已完成验收归档，后续新开发应从新的小步骤继续。
- [docs/DEVELOPMENT_GOVERNANCE.md](docs/DEVELOPMENT_GOVERNANCE.md)：稳定开发治理锚点。
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：当前架构、API、状态模型和验证要求。
- [docs/AI_CONTROL_AUDIT_MATRIX.md](docs/AI_CONTROL_AUDIT_MATRIX.md)：AI/server 权限矩阵。
- [docs/AI_PROMPT_ENGINEERING_CONTRACT.md](docs/AI_PROMPT_ENGINEERING_CONTRACT.md)：S70.1 prompt pack 分层、actor/scene/output/tool policy、输入预算、provider smoke 和红队 fixture 契约。
- [docs/AI_TOOL_PROTOCOL_CONTRACT.md](docs/AI_TOOL_PROTOCOL_CONTRACT.md)：S70.1 工具协议契约，固定 tool envelope、permission、resolver、audit、cooldown、mockFallback、proposal/result/request-adjudication schema 和 provider 兼容策略。
- [docs/DATABASE_RESOLVER_INPUT_CONTRACT.md](docs/DATABASE_RESOLVER_INPUT_CONTRACT.md)：S71.0 数据库 resolver 输入契约，固定 `resolverInputContext` 字段、允许来源、禁止源、evidence ref、AI 权限和 JSON/SQLite parity 测试矩阵。
- [docs/IMPERIAL_EXAM_SYSTEM_CONTRACT.md](docs/IMPERIAL_EXAM_SYSTEM_CONTRACT.md)：S68.1 科举制度契约，固定科场流程、卷件生命周期、AI 老师/考官/吏部/皇帝权限和服务器裁决边界。
- [docs/DYNAMIC_WORLD_DATABASE_PLAN.md](docs/DYNAMIC_WORLD_DATABASE_PLAN.md)：本地动态数据库规划。
- [docs/LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md](docs/LOCAL_DATABASE_AND_WORLD_CONTENT_ARCHIVE.md)：S49-S67 本地数据库基础、SQLite 业务表、双模式验收、超大动态世界内容归档与 S60 内容契约。
- [docs/IMPERIAL_EXAM_DEEPENING_ARCHIVE.md](docs/IMPERIAL_EXAM_DEEPENING_ARCHIVE.md)：S68-S69 科举、读书、评卷、榜单、同年座师、授官和 Provider/Mock 验收归档。
- [docs/AI_ORCHESTRATION_ARCHIVE.md](docs/AI_ORCHESTRATION_ARCHIVE.md)：S70 AI prompt/tool/actor/多模型路由、AI 设置、官职月报、跳时、记忆、地图接口、provider AI-first smoke、JSON/SQLite parity 与归档。
- [docs/DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md](docs/DATABASE_GAMEPLAY_RESOLVER_ARCHIVE.md)：S71 数据库 resolver 输入、SQLite 维护、安全搜索、redacted API、财政/刑名/军务外交 resolver、压力事件、场景运行时、NPC 记忆、AI 调动审计和验收归档。
- [docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md](docs/WORLD_GEOGRAPHY_SEED_CONTRACT.md)：天下地理与 SQLite 地理业务表契约。
- [docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md](docs/NPC_HOUSEHOLD_ASSET_RELATIONSHIP_CONTRACT.md)：人物、家族、资产、田产、关系 schema/桥接与 S55 SQLite 人物域表契约/实现边界。
- [docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md](docs/OFFICIAL_POSTING_DATABASE_CONTRACT.md)：官署、官职、任所、考成、迁转 schema/桥接与 S56 SQLite 官职任所表契约。

## 已知限制

- 真实 provider 网络调用需要配置 API key；无 key 环境只验证 Mock、缺 key 分支和 no-key skip。
- 浏览器 smoke 覆盖完整主线和代表身份回合，但不等同于所有身份的长线游玩验收。
- SQLite 目前已经包含 `schema_migrations`、session row、审计表、地理 `geo_*` 业务表、可见人物 `people_*` bridge rows、人物事件到 `people_*.last_event_id` 的本地关联、带内容漂移探针的官职任所 `office_*` 派生业务表、安全事件档案 `event_archive_index`、安全 prompt 检索索引、安全搜索索引，以及只输出 allowlist public 摘要的本地审计公开 projection 工具和本地维护命令；它们都不是浏览器、prompt 或服务器裁决的内部来源。
- “超大动态世界数据库”的 S60-S67 内容充实阶段已并入统一归档；S68-S69 科举深化、S70 AI 编排和 S71 数据库玩法化也已归档。后续活动应从新的小步骤继续，仍保护 JSON/Mock 默认可玩、SQLite local-only、AI proposal-only、server resolver 裁决和完整书生路径。
- 当前不包含远程存档、账号体系、多人同步或云端数据库。
